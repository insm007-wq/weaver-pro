// src/utils/autoMatchEngine.js
// ============================================================================
// AutoMatch Engine (Single-File SSOT)
// - 입력: scenes, assets, opts
// - 출력: { scenes: 새 씬 배열, stats: 채움 통계 + 미배치 사유 }
// - 특징:
//   * 키워드 스코어링 + 순차 보충(후순위)
//   * 재사용 허용/제한(모자랄 때만, 연속중복 방지, 재사용 최대횟수)
//   * "왜 못 채웠는지" reasons 리포트
//   * 여기만 고치면 자동배치 전체 동작이 바뀜(유지보수 포인트 1곳)
// ============================================================================

/** 기본 옵션 (필요에 따라 여기만 수정) */
export const DEFAULT_OPTS = {
  emptyOnly: true, // true면 assetId 비어있는 씬만 채움
  byKeywords: true, // 키워드 스코어링으로 우선 배치
  byOrder: true, // 남은 건 순서대로 보충
  overwrite: false, // 기존 배치가 있어도 덮어쓸지
  allowReuseIfShortfall: true, // 후보가 부족하면 재사용 허용(씬 끝까지 채우려면 true 권장)
  avoidConsecutiveDuplicate: true, // 같은 에셋 연속 배치 금지
  maxReusePerAsset: 3, // 재사용 허용 시, 에셋 1개가 최대 몇 번까지 쓰일 수 있는지
  minScore: 1, // 키워드 스코어 최소 기준(0이면 아무거나 매칭)
  debug: false, // 내부 로그
};

/** 유틸: 안전 문자열화 */
const S = (v) => (v == null ? "" : String(v));

/** 유틸: 간단 토큰화 (한글/영문/숫자 토큰 추출) */
function tokenize(text = "") {
  const lower = S(text).toLowerCase();
  const ko = lower.match(/[가-힣]{1,}/g) || [];
  const en = lower.match(/[a-z0-9]+/g) || [];
  // 중복 제거
  return Array.from(new Set([...ko, ...en]));
}

/** 씬 텍스트와 에셋 태그의 스코어 계산 (가볍고 빠르게) */
function scoreAssetForScene(sceneText = "", asset) {
  const sceneTokens = new Set(tokenize(sceneText));
  const tags = (Array.isArray(asset?.tags) && asset.tags.length ? asset.tags : Array.isArray(asset?.keywords) ? asset.keywords : []).map(S);

  if (!tags.length) return 0;

  let score = 0;

  for (const rawTag of tags) {
    const tag = S(rawTag).trim();
    if (!tag) continue;

    // 1) 구(phrase) 포함 보너스
    if (sceneText.includes(tag)) score += 2;

    // 2) 토큰 단위 교집합(태그를 토큰화해서 씬 토큰과 겹치는 개수만큼 가산)
    for (const t of tokenize(tag)) {
      if (sceneTokens.has(t)) score += 1;
    }
  }

  return score;
}

/** 확보 가능한 후보 풀을 구성 (이미 사용된 것 제외) */
function makeCandidatePool(assets, usedSet) {
  return (assets || []).filter((a) => a && !usedSet.has(a.id));
}

/** 재사용 가능 여부 검사 */
function canReuse(assetId, reuseCountMap, opts) {
  if (!opts.allowReuseIfShortfall) return false;
  const used = reuseCountMap.get(assetId) || 0;
  return used < (opts.maxReusePerAsset ?? DEFAULT_OPTS.maxReusePerAsset);
}

/** 연속 중복 방지 검사 */
function isConsecutiveDuplicate(prevAssetId, nextAssetId, opts) {
  if (!opts.avoidConsecutiveDuplicate) return false;
  return prevAssetId && nextAssetId && prevAssetId === nextAssetId;
}

/** 미배치 사유 기록 헬퍼 */
function pushReason(reasons, i, scene, reason, detail = "") {
  reasons.push({
    index: i,
    sceneId: scene?.id ?? `idx:${i}`,
    reason,
    detail,
  });
}

/**
 * 메인 엔진
 * @param {Object} input
 *  - scenes: [{ id, text, assetId, ... }]
 *  - assets: [{ id, tags?:string[], keywords?:string[] }, ...]
 *  - opts: DEFAULT_OPTS 기반 옵션
 * @returns {Object} { scenes, stats }
 */
export function runAutoMatch(input) {
  const scenes = Array.isArray(input?.scenes) ? input.scenes : [];
  const assets = Array.isArray(input?.assets) ? input.assets : [];
  const opts = { ...DEFAULT_OPTS, ...(input?.opts || {}) };

  if (!scenes.length) {
    return { scenes, stats: { totalScenes: 0, filled: 0, byStrategy: {}, remaining: 0, reasons: [] } };
  }

  // 불변성 유지: 얕은 복사
  const next = scenes.map((s) => ({ ...s }));

  // 초기 상태
  const initiallyUsed = new Set(next.map((s) => s.assetId).filter(Boolean));
  const reuseCount = new Map(); // assetId -> 재사용 횟수 (초기값 포함 X)
  const reasons = [];
  const byStrategy = { keyword: 0, order: 0, reused: 0 };

  // 어느 인덱스를 채울지 결정
  const indicesToFill = [];
  for (let i = 0; i < next.length; i++) {
    const sc = next[i];
    const isEmpty = !sc.assetId;
    if (opts.emptyOnly && !isEmpty) continue;
    if (!opts.overwrite && !isEmpty) continue;
    indicesToFill.push(i);
  }

  // 채울 게 없으면 그대로 반환
  if (!indicesToFill.length) {
    return {
      scenes: next,
      stats: {
        totalScenes: next.length,
        filled: 0,
        byStrategy,
        remaining: next.filter((s) => !s.assetId).length,
        reasons,
      },
    };
  }

  // 1) 키워드 우선 배치
  const usedSet = new Set(initiallyUsed);
  let pool = makeCandidatePool(assets, usedSet);

  if (opts.byKeywords) {
    for (const i of indicesToFill) {
      const sc = next[i];

      // 덮어쓰기라면 기존 배정 제거
      if (opts.overwrite && sc.assetId) {
        usedSet.delete(sc.assetId);
        sc.assetId = null;
      }

      let best = null;
      let bestScore = -Infinity;

      // 후보 중 최고 스코어 찾기
      for (const a of pool) {
        const s = scoreAssetForScene(sc.text || "", a);
        if (s > bestScore) {
          best = a;
          bestScore = s;
        }
      }

      if (best && bestScore >= (opts.minScore ?? DEFAULT_OPTS.minScore)) {
        // 연속 중복 방지
        const prevAssetId = i > 0 ? next[i - 1]?.assetId : null;
        if (isConsecutiveDuplicate(prevAssetId, best.id, opts)) {
          // 연속이라면 "차선책" 시도: 스코어 순 2등을 찾아본다
          let second = null;
          let secondScore = -Infinity;
          for (const a of pool) {
            if (a.id === best.id) continue;
            const s = scoreAssetForScene(sc.text || "", a);
            if (s > secondScore) {
              second = a;
              secondScore = s;
            }
          }
          if (second && secondScore >= (opts.minScore ?? 0)) {
            sc.assetId = second.id;
            usedSet.add(second.id);
            pool = makeCandidatePool(assets, usedSet);
            byStrategy.keyword += 1;
            continue;
          }
          // 차선책도 없으면 일단 best 사용(옵션 끄면 바로 사용됨)
        }

        sc.assetId = best.id;
        usedSet.add(best.id);
        pool = makeCandidatePool(assets, usedSet);
        byStrategy.keyword += 1;
        continue;
      }

      // 키워드 매칭 실패 → 이유 기록(순서 보충 단계에서 채워질 수도 있음)
      pushReason(reasons, i, sc, "no_keyword_match", "최소 스코어 미만 또는 후보 스코어 0");
    }
  }

  // 2) 순차 보충(남은 빈 칸)
  if (opts.byOrder) {
    pool = makeCandidatePool(assets, usedSet);
    let poolIdx = 0;

    for (const i of indicesToFill) {
      const sc = next[i];
      if (sc.assetId && !opts.overwrite) continue; // 이미 채워짐

      // 덮어쓰기라면 기존 배정 제거
      if (opts.overwrite && sc.assetId) {
        usedSet.delete(sc.assetId);
        sc.assetId = null;
      }

      // 풀에 남은 게 있으면 순차 할당
      if (poolIdx < pool.length) {
        const candidate = pool[poolIdx++];
        // 연속 중복 방지
        const prevAssetId = i > 0 ? next[i - 1]?.assetId : null;
        if (isConsecutiveDuplicate(prevAssetId, candidate.id, opts)) {
          // 다음 후보 시도
          if (poolIdx < pool.length) {
            const alt = pool[poolIdx++];
            sc.assetId = alt.id;
            usedSet.add(alt.id);
            byStrategy.order += 1;
            continue;
          }
          // 대안이 없으면 일단 배정(옵션 끄면 바로 배정됨)
        }
        sc.assetId = candidate.id;
        usedSet.add(candidate.id);
        byStrategy.order += 1;
        continue;
      }

      // 풀이 다 떨어짐 → 재사용 허용이면 재사용
      if (opts.allowReuseIfShortfall && assets.length) {
        // 재사용 가능한 후보를 찾자
        let reused = null;
        for (const a of assets) {
          if (!canReuse(a.id, reuseCount, opts)) continue;
          const prevAssetId = i > 0 ? next[i - 1]?.assetId : null;
          if (isConsecutiveDuplicate(prevAssetId, a.id, opts)) continue; // 연속 중복 회피

          reused = a;
          break;
        }

        // 연속 중복 때문에 못 찾았으면 연속 허용하고라도 하나 선택(최후의 수단)
        if (!reused) {
          for (const a of assets) {
            if (!canReuse(a.id, reuseCount, opts)) continue;
            reused = a;
            break;
          }
        }

        if (reused) {
          sc.assetId = reused.id;
          reuseCount.set(reused.id, (reuseCount.get(reused.id) || 0) + 1);
          byStrategy.reused += 1;
          continue;
        }
      }

      // 여기까지 왔는데도 배정 실패
      pushReason(reasons, i, sc, "no_candidates_left", opts.allowReuseIfShortfall ? "재사용 제한으로 배정 불가" : "재사용 비허용");
    }
  }

  // 미배치 씬 수
  const remaining = next.filter((s) => !s.assetId).length;

  // 디버그 로그
  if (opts.debug) {
    // eslint-disable-next-line no-console
    console.log("[autoMatch] result:", {
      filled: next.length - remaining,
      remaining,
      byStrategy,
      reasons,
    });
  }

  return {
    scenes: next,
    stats: {
      totalScenes: next.length,
      filled: next.length - remaining,
      byStrategy,
      remaining,
      reasons,
    },
  };
}

export default runAutoMatch;
