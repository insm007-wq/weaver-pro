// src/services/autoplace.js
// 다운로드 완료 후, 새로 들어온 에셋들을 배치/타임라인에 꽂는 엔진
// UI 변경 없음. 필요한 부분만 app의 기존 store/함수에 맞춰 바인딩하세요.

const KO_STOP = new Set([
  "그리고",
  "그러나",
  "하지만",
  "및",
  "등",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "과",
  "와",
  "하다",
  "했다",
  "하는",
  "있다",
  "없다",
  "이다",
  "됩니다",
]);

function tokenize(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !KO_STOP.has(t));
}

function scoreKeywordMatch(sceneTags = [], assetKeyword = "") {
  const st = tokenize(sceneTags.join(" "));
  const at = tokenize(assetKeyword);
  if (!st.length || !at.length) return 0;

  const sset = new Set(st);
  const aset = new Set(at);
  let score = 0;

  // 완전 동일 토큰
  for (const t of at) if (sset.has(t)) score += 100;

  if (score === 0) {
    // 부분 일치(서로의 토큰 포함 관계)
    for (const s of sset)
      for (const a of aset) {
        if (s.includes(a) || a.includes(s)) {
          score += 60;
          break;
        }
      }
  }
  // 중복 없이 일치 토큰 수 가산
  const inter = [...aset].filter((t) => sset.has(t)).length;
  score += inter * 40;

  return score;
}

async function readSetupOptions() {
  // 이미 있는 “셋업” 설정 키를 사용하세요. 없으면 아래 키로 저장/호출.
  const [
    on,
    fillEmptyOnly,
    useKeywordMatch,
    useSequential,
    allowOverwrite,
    maxAutoPlace,
  ] = await Promise.all([
    window.api.getSetting?.("autoMatch.enabled"),
    window.api.getSetting?.("autoMatch.fillEmptyOnly"),
    window.api.getSetting?.("autoMatch.useKeyword"),
    window.api.getSetting?.("autoMatch.useSequential"),
    window.api.getSetting?.("autoMatch.allowOverwrite"),
    window.api.getSetting?.("autoMatch.maxCount"), // 옵션 없으면 null
  ]);

  return {
    on: !!on,
    fillEmptyOnly: !!fillEmptyOnly,
    useKeywordMatch: !!useKeywordMatch,
    useSequential: !!useSequential,
    allowOverwrite: !!allowOverwrite,
    maxAutoPlace: Number(maxAutoPlace) > 0 ? Number(maxAutoPlace) : null,
  };
}

// ↓↓↓ 이 두 함수는 앱의 상태/스토어에 맞게 교체하세요 ↓↓↓
async function getScenes() {
  // 타임라인/배치 씬 배열 반환: [{ id, tags:[], hasVideo:boolean, locked:boolean }, ...]
  // 프로젝트에 맞는 셀렉터로 교체.
  return window.sceneStore?.getScenes?.() || [];
}

async function applyAssetToScene(sceneId, assetPath) {
  // 특정 씬에 영상 파일 경로를 꽂는 함수 (교체)
  return window.sceneStore?.setSceneVideo?.(sceneId, assetPath);
}
// ↑↑↑ 앱마다 여기만 바꿔주면 됩니다 ↑↑↑

export async function autoPlace(newAssets) {
  // newAssets: [{ path, keyword, width, height, provider, assetId, savedAt }, ...]
  if (!Array.isArray(newAssets) || newAssets.length === 0) return;

  const opt = await readSetupOptions();
  if (!opt.on) return;

  // 개수 제한
  const assets = opt.maxAutoPlace
    ? newAssets.slice(0, opt.maxAutoPlace)
    : newAssets.slice();

  const scenes = await getScenes();
  if (!Array.isArray(scenes) || scenes.length === 0) return;

  // 배치 후보 씬 필터링
  let candidates = scenes.filter((s) => !s.locked);
  if (opt.fillEmptyOnly) candidates = candidates.filter((s) => !s.hasVideo);

  if (candidates.length === 0) return;

  // 순차 모드: 도착 순 → 빈 씬 순서대로
  if (opt.useSequential) {
    const seq = Math.min(candidates.length, assets.length);
    for (let i = 0; i < seq; i++) {
      const scene = candidates[i];
      if (!scene) break;
      const a = assets[i];
      if (!opt.allowOverwrite && scene.hasVideo) continue;
      await applyAssetToScene(scene.id, a.path);
    }
    return;
  }

  // 키워드 매칭 모드 (기본 추천)
  if (opt.useKeywordMatch) {
    // 각 씬에 대해 최고 점수 에셋 할당 (1:1)
    const used = new Set();
    for (const scene of candidates) {
      let best = null;
      let bestScore = -1;

      for (let i = 0; i < assets.length; i++) {
        if (used.has(i)) continue;
        const a = assets[i];
        const sc = scoreKeywordMatch(scene.tags || [], a.keyword || "");
        if (sc > bestScore) {
          bestScore = sc;
          best = { idx: i, a };
        }
      }

      if (!best) continue;
      if (!opt.allowOverwrite && scene.hasVideo) continue;

      // 점수가 0인 경우는 “연관 없음” → 건너뛰기(실패 시 자동 OFF 동작은 기존 로직 그대로)
      if (bestScore <= 0) continue;

      await applyAssetToScene(scene.id, best.a.path);
      used.add(best.idx);
    }
    return;
  }

  // 아무 옵션도 없으면 순차로 폴백
  const seq = Math.min(candidates.length, assets.length);
  for (let i = 0; i < seq; i++) {
    const scene = candidates[i];
    const a = assets[i];
    if (!opt.allowOverwrite && scene.hasVideo) continue;
    await applyAssetToScene(scene.id, a.path);
  }
}
