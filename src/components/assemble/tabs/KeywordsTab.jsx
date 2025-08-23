// src/components/tabs/KeywordsTab.jsx
import { useEffect, useMemo, useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";

const MB = 1024 * 1024;

const RES_PRESETS = [
  { id: "hd", label: "HD (1280×720)", w: 1280, h: 720 },
  { id: "fhd", label: "FHD (1920×1080)", w: 1920, h: 1080 },
  { id: "qhd", label: "QHD (2560×1440)", w: 2560, h: 1440 },
  { id: "uhd", label: "4K (3840×2160)", w: 3840, h: 2160 },
];

export default function KeywordsTab({ assets, addAssets }) {
  // ---------------- state: keywords & ui ----------------
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState("");
  const [srtFileName, setSrtFileName] = useState(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 옵션
  const [minMB, setMinMB] = useState(1);
  const [maxMB, setMaxMB] = useState(14);
  const [resPreset, setResPreset] = useState("qhd");
  const [perKeyword, setPerKeyword] = useState(1);
  const [concurrency, setConcurrency] = useState(3);
  const [dedupAcrossKeywords, setDedupAcrossKeywords] = useState(true);
  const [usePexels, setUsePexels] = useState(true);
  const [usePixabay, setUsePixabay] = useState(true);

  // 🔁 새 옵션: 한→영 자동 변환 / 키워드 엄격 매칭
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [strictKeyword, setStrictKeyword] = useState(true);

  // provider key 보유 여부 -> UI 토글 disable 처리
  const [hasPexelsKey, setHasPexelsKey] = useState(false);
  const [hasPixabayKey, setHasPixabayKey] = useState(false);

  // SRT 이름 초기 표시 & provider 키 유무 확인
  useEffect(() => {
    (async () => {
      try {
        const srtPath = await window.api.getSetting?.("paths.srt");
        if (srtPath) setSrtFileName(srtPath.split(/[/\\]/).pop());
      } catch {}
      try {
        const [px, pb] = await Promise.all([window.api.getSecret?.("pexelsApiKey"), window.api.getSecret?.("pixabayApiKey")]);
        setHasPexelsKey(!!px);
        setHasPixabayKey(!!pb);
        if (!px) setUsePexels(false);
        if (!pb) setUsePixabay(false);
      } catch {}
    })();
  }, []);

  const chosenRes = useMemo(
    () => RES_PRESETS.find((r) => r.id === resPreset) || RES_PRESETS[2], // default QHD
    [resPreset]
  );

  // ---------------- keyword helpers ----------------
  const addKeyword = (k) => {
    const t = (k || "").trim();
    if (!t) return;
    setKeywords((old) => (old.includes(t) ? old : [...old, t]).slice(0, 200));
  };
  const removeKeyword = (k) => setKeywords((old) => old.filter((x) => x !== k));
  const clearKeywords = () => setKeywords([]);

  const addFromInput = () => {
    const items = input
      .split(/[,/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    items.forEach(addKeyword);
    setInput("");
  };

  // ---------------- SRT read/clean ----------------
  const readCleanSrt = async () => {
    const srtPath = await window.api.getSetting?.("paths.srt");
    if (!srtPath) {
      alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
      return null;
    }
    const raw = await window.api.readTextFile?.(srtPath);
    const cleaned = String(raw || "")
      .replace(/\r/g, "\n")
      .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
      .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g, "");
    setSrtFileName(srtPath.split(/[/\\]/).pop());
    return cleaned;
  };

  // ---------------- AI extract ----------------
  const extractFromSrtAI = async () => {
    try {
      setBusy(true);
      setMsg("SRT 로드 중…");
      const text = await readCleanSrt();
      if (!text) return;

      const apiKey = await window.api.getSecret?.("openaiKey");
      if (!apiKey) {
        alert("OpenAI API 키가 없습니다. [Settings > API]에서 먼저 저장해 주세요.");
        return;
      }

      setMsg("AI가 키워드를 추출 중… (GPT-5 mini)");
      const res = await window.api.aiExtractKeywords({
        apiKey,
        text,
        topK: 30, // 살짝 늘려서 여유 확보
        language: "ko",
      });

      if (res?.ok && Array.isArray(res.keywords) && res.keywords.length) {
        setKeywords(res.keywords);
        setMsg(`AI 추출 완료 · ${res.keywords.length}개`);
      } else {
        const local = fallbackExtract(text, { topK: 20, minLen: 2 });
        if (local.length) {
          setKeywords(local);
          setMsg("AI 실패 → 로컬 추출로 대체");
        } else {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
        }
      }
    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
      alert("AI 추출 중 오류: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // ---------------- utility: p-limit ----------------
  const pLimit = (n) => {
    let active = 0;
    const q = [];
    const next = () => {
      active--;
      if (q.length) q.shift()();
    };
    return (fn) =>
      new Promise((res, rej) => {
        const run = () => {
          active++;
          fn().then(
            (v) => {
              res(v);
              next();
            },
            (e) => {
              rej(e);
              next();
            }
          );
        };
        if (active < n) run();
        else q.push(run);
      });
  };

  // ---------------- download by keywords ----------------
  const downloadFromKeywords = async () => {
    if (!keywords.length) return;

    // 사용 가능한 provider 정리
    const providerList = [...(usePexels && hasPexelsKey ? ["pexels"] : []), ...(usePixabay && hasPixabayKey ? ["pixabay"] : [])];
    if (providerList.length === 0) {
      alert("사용할 수 있는 제공사가 없습니다. (Pexels/Pixabay 키 확인)");
      return;
    }

    try {
      setBusy(true);
      setMsg("스톡 검색 준비…");

      const [pexelsKey, pixabayKey, openaiKey] = await Promise.all([
        window.api.getSecret?.("pexelsApiKey"),
        window.api.getSecret?.("pixabayApiKey"),
        window.api.getSecret?.("openaiKey"),
      ]);

      // 🔁 한→영 번역(짧은 용어만, 토큰 소모 적음)
      let enMap = {};
      if (autoTranslate && openaiKey && typeof window.api.aiTranslateTerms === "function") {
        const koTerms = keywords.filter((k) => /[ㄱ-ㅎ가-힣]/.test(k));
        if (koTerms.length) {
          try {
            const tr = await window.api.aiTranslateTerms({ apiKey: openaiKey, terms: koTerms });
            if (tr?.ok && Array.isArray(tr.terms)) {
              koTerms.forEach((ko, i) => (enMap[ko] = tr.terms[i] || ko));
            }
          } catch {
            // 번역 실패 시 원문만 사용
          }
        }
      }

      const SEARCH_OPTS = {
        // perPage는 여유 있게(중복/필터 탈락 대비)
        perPage: Math.min(10, perKeyword * 3),
        minBytes: Math.max(0, Math.floor(minMB * MB)),
        maxBytes: Math.max(0, Math.floor(maxMB * MB)),
        targetRes: { w: chosenRes.w, h: chosenRes.h },
        sizeProbeConcurrency: 6,
        providers: providerList,
        pexelsKey,
        pixabayKey,
        type: "videos",
        strictKeyword, // 우선 엄격 매칭으로 시도
      };

      const limit = pLimit(Math.max(1, Math.min(6, concurrency)));
      let added = 0;
      const seenUrl = new Set(); // 중복 방지(키워드 간)

      const tasks = keywords.map((k) =>
        limit(async () => {
          const kEn = enMap[k];
          // 원문 + 번역문을 함께 queries로 보냄(백엔드가 태그/메타로 스코어링)
          const queries = kEn && kEn !== k ? [k, kEn] : [k];

          setMsg(`"${k}" 검색 중…`);
          let r = await window.api.stockSearch({ queries, ...SEARCH_OPTS });

          // 엄격 매칭에서 0건 → 자동 완화 재시도(한 번)
          if ((!r?.ok || !Array.isArray(r.items) || r.items.length === 0) && strictKeyword) {
            setMsg(`"${k}" 결과 없음 → 엄격 매칭 완화 재시도…`);
            r = await window.api.stockSearch({ queries, ...SEARCH_OPTS, strictKeyword: false });
          }
          if (!r?.ok || !Array.isArray(r.items) || r.items.length === 0) return;

          // 필터링: 키워드당 perKeyword개, 전역 dedup 적용
          const picked = [];
          for (const it of r.items) {
            if (!it?.url) continue;
            if (dedupAcrossKeywords && seenUrl.has(it.url)) continue;
            picked.push(it);
            seenUrl.add(it.url);
            if (picked.length >= perKeyword) break;
          }

          for (const item of picked) {
            setMsg(`"${k}" 저장 중…`);
            const save = await window.api.saveUrlToProject({
              url: item.url,
              category: "videos",
              fileName: item.filename, // 중복 시 백엔드에서 (n) 붙여줌
            });
            if (save?.ok && save?.path) {
              const filePath = save.path;
              const fileUrl = process.platform === "win32" ? "file:///" + filePath.replace(/\\/g, "/") : "file://" + filePath;

              addAssets([
                {
                  id: "stk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                  type: "video",
                  thumbUrl: fileUrl,
                  filePath,
                },
              ]);
              added += 1;
            }
          }
        })
      );

      await Promise.allSettled(tasks);
      setMsg(`다운로드 완료: ${added}개 (키워드 ${keywords.length}개, 키워드당 ${perKeyword}개 목표)`);
    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
      alert("다운로드 중 오류: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // ---------------- render ----------------
  const estimatedDownloads = keywords.length * perKeyword;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* 키워드 구성 */}
      <SectionCard
        title="키워드 구성"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={extractFromSrtAI}
              className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-60"
              disabled={busy}
              title="SRT에서 GPT-5 mini로 추출"
            >
              {busy ? "AI 추출 중…" : "SRT에서 AI 추출"}
            </button>

            <button
              onClick={downloadFromKeywords}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
              disabled={busy || keywords.length === 0}
              title="키워드로 스톡 영상 다운로드"
            >
              {busy ? "처리 중…" : "키워드로 영상 받기"}
            </button>

            <button
              onClick={clearKeywords}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              disabled={busy || keywords.length === 0}
              title="현재 키워드 전부 지우기"
            >
              비우기
            </button>
          </div>
        }
      >
        <div className="text-xs text-slate-600 mb-2">
          {srtFileName ? (
            <>
              현재 SRT: <span className="font-medium">{srtFileName}</span>
            </>
          ) : (
            <>SRT 미연결 (셋업에서 선택)</>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFromInput()}
            placeholder="키워드 입력 후 Enter (쉼표/줄바꿈으로 여러 개)"
            className="flex-1 h-9 px-3 text-sm rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400"
            disabled={busy}
          />
          <button
            onClick={addFromInput}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={!input.trim() || busy}
          >
            추가
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <div className="text-[12px] text-slate-500">SRT에서 AI 추출하거나, 직접 키워드를 추가해 주세요.</div>
          ) : (
            keywords.map((k) => (
              <span key={k} className="px-2 py-1.5 h-8 rounded-full border border-slate-200 bg-white text-sm inline-flex items-center gap-2">
                <span className="px-1">#{k}</span>
                <button onClick={() => removeKeyword(k)} className="text-slate-400 hover:text-slate-600" title="제거">
                  ✕
                </button>
              </span>
            ))
          )}
        </div>

        <div className="mt-3 text-[12px] text-slate-600">
          예상 다운로드: <b>{estimatedDownloads}</b>개
        </div>

        {msg && <div className="mt-3 text-[12px] text-slate-600">{msg}</div>}
      </SectionCard>

      {/* 다운로드 옵션 */}
      <SectionCard title="다운로드 옵션" right={<span className="text-xs text-slate-500">필터 & 제공사</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-700 flex flex-col gap-1">
            해상도
            <select
              value={resPreset}
              onChange={(e) => setResPreset(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white"
              disabled={busy}
            >
              {RES_PRESETS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            키워드당 개수
            <input
              type="number"
              min={1}
              max={6}
              value={perKeyword}
              onChange={(e) => setPerKeyword(Math.max(1, Math.min(6, +e.target.value || 1)))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            최소 용량 (MB)
            <input
              type="number"
              min={0}
              max={500}
              value={minMB}
              onChange={(e) => setMinMB(Math.max(0, +e.target.value || 0))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            최대 용량 (MB)
            <input
              type="number"
              min={0}
              max={2000}
              value={maxMB}
              onChange={(e) => setMaxMB(Math.max(0, +e.target.value || 0))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            동시 다운로드
            <input
              type="number"
              min={1}
              max={6}
              value={concurrency}
              onChange={(e) => setConcurrency(Math.max(1, Math.min(6, +e.target.value || 1)))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={dedupAcrossKeywords}
              onChange={(e) => setDedupAcrossKeywords(!!e.target.checked)}
              disabled={busy}
            />
            키워드 간 중복 영상 제거
          </label>

          {/* 🔁 새 옵션들 */}
          <label className="text-xs text-slate-700 flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={autoTranslate} onChange={(e) => setAutoTranslate(!!e.target.checked)} disabled={busy} />
            한→영 자동 변환(권장)
          </label>

          <label className="text-xs text-slate-700 flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={strictKeyword} onChange={(e) => setStrictKeyword(!!e.target.checked)} disabled={busy} />
            키워드 엄격(태그 포함 필수)
          </label>
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-slate-700 mb-2">제공사</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className={`inline-flex items-center gap-2 ${!hasPexelsKey ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={usePexels && hasPexelsKey}
                onChange={(e) => setUsePexels(!!e.target.checked)}
                disabled={!hasPexelsKey || busy}
              />
              Pexels {hasPexelsKey ? "" : "(키 없음)"}
            </label>
            <label className={`inline-flex items-center gap-2 ${!hasPixabayKey ? "opacity-50" : ""}`}>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={usePixabay && hasPixabayKey}
                onChange={(e) => setUsePixabay(!!e.target.checked)}
                disabled={!hasPixabayKey || busy}
              />
              Pixabay {hasPixabayKey ? "" : "(키 없음)"}
            </label>
          </div>

          <div className="mt-2 text-[12px] text-slate-500">
            현재 해상도: <b>{chosenRes.label}</b> · 용량:{" "}
            <b>
              {minMB}–{maxMB}MB
            </b>{" "}
            · 동시성: <b>{concurrency}</b>
          </div>
        </div>
      </SectionCard>

      {/* 라이브러리 */}
      <div className="xl:col-span-1">
        <SectionCard title="에셋 라이브러리">
          <AssetLibrary assets={assets} onPick={() => alert("해당 씬에 배치")} />
        </SectionCard>
      </div>

      {/* 안내 */}
      <div className="xl:col-span-1">
        <SectionCard title="사용 안내">
          <div className="text-sm text-slate-700 space-y-2">
            <p>1) [셋업] 탭에서 SRT를 연결합니다.</p>
            <p>
              2) <b>SRT에서 AI 추출</b>로 핵심 키워드를 얻습니다.
            </p>
            <p>
              3) 아래 <b>다운로드 옵션</b>을 설정하고, <b>키워드로 영상 받기</b>를 누르세요.
            </p>
            <p className="text-[12px] text-slate-500">
              저장은 프로젝트 <code>videos</code> 폴더에 자동으로 이루어지며, 성공 시 라이브러리에 즉시 추가됩니다.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
