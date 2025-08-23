import { useEffect, useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";

/* 가벼운 클라이언트 사이드 후처리(불용어/어미 제거 + 중복/길이제한) */
const STOPWORDS = new Set([
  "그리고",
  "그러나",
  "하지만",
  "또한",
  "및",
  "등",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "와",
  "과",
  "이다",
  "입니다",
  "있습니다",
  "있으면",
  "있다",
  "없다",
  "합니다",
  "하는",
  "했다",
  "된다",
  "되는",
]);
const BAD_END = /(습니다|입니다|하였다|했다|하는|하여|하고|되다|된다|되는|이었다|였다)$/;

function cleanKeywords(list = [], topK = 20) {
  const out = [];
  const seen = new Set();
  for (let raw of list) {
    let s = String(raw || "").trim();
    s = s.replace(/^#/, "").replace(/[^\p{L}\p{N}\s\-_.]/gu, "");
    if (!s || s.length < 2 || s.length > 20) continue;
    const key = s.toLowerCase();
    if (STOPWORDS.has(s) || BAD_END.test(s)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
    if (out.length >= topK) break;
  }
  return out;
}

export default function KeywordsTab({ assets, addAssets }) {
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState("");
  const [srtFileName, setSrtFileName] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 초기 SRT 파일명 표시
  useEffect(() => {
    (async () => {
      try {
        const srtPath = await window.api.getSetting?.("paths.srt");
        if (srtPath) setSrtFileName(srtPath.split(/[/\\]/).pop());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const addKeyword = (k) => {
    const trimmed = (k || "").trim();
    if (!trimmed) return;
    const cleaned = cleanKeywords([trimmed], 1);
    if (!cleaned.length) return;
    setKeywords((old) => (old.includes(cleaned[0]) ? old : [...old, cleaned[0]]).slice(0, 100));
  };
  const removeKeyword = (k) => setKeywords((old) => old.filter((x) => x !== k));
  const clearKeywords = () => setKeywords([]);

  const addFromInput = () => {
    const items = input
      .split(/[,/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const cleaned = cleanKeywords(items, 100);
    if (cleaned.length) {
      setKeywords((old) => {
        const set = new Set(old);
        cleaned.forEach((c) => set.add(c));
        return Array.from(set).slice(0, 100);
      });
    }
    setInput("");
  };

  /** SRT 텍스트 로드 & 정리 */
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

  /** ✅ GPT-5 mini(→ 4o-mini → 4o 폴백)로 키워드 추출, 실패 시 로컬 */
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

      // 브릿지 이름 호환: extractKeywordsAI(권장) or aiExtractKeywords(구)
      const aiExtract = window.api.extractKeywordsAI || window.api.aiExtractKeywords;
      if (typeof aiExtract !== "function") {
        // 브릿지가 없으면 즉시 로컬 폴백
        const local = cleanKeywords(fallbackExtract(text, { topK: 20, minLen: 2 }), 20);
        if (local.length) {
          setKeywords(local);
          setMsg("AI 브릿지 없음 → 로컬 추출로 대체");
        } else {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
        }
        return;
      }

      setMsg("AI가 키워드를 추출 중… (gpt-5-mini → 4o 폴백)");
      const res = await aiExtract({
        apiKey,
        text,
        topK: 20,
        language: "ko",
      });

      if (res?.ok && Array.isArray(res.keywords) && res.keywords.length) {
        const final = cleanKeywords(res.keywords, 20);
        setKeywords(final);
        setMsg(`AI 추출 완료 · ${final.length}개`);
      } else {
        // 안전망: 로컬 키워드 추출
        const local = cleanKeywords(fallbackExtract(text, { topK: 20, minLen: 2 }), 20);
        if (local.length) {
          setKeywords(local);
          setMsg("AI 실패 → 로컬 추출로 대체");
        } else {
          setMsg("키워드 추출 실패");
          alert(res?.message || "키워드를 추출하지 못했습니다.");
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
              title="SRT에서 AI로 추출"
            >
              {busy ? "AI 추출 중…" : "SRT에서 AI 추출"}
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

        {msg && <div className="mt-3 text-[12px] text-slate-600">{msg}</div>}
      </SectionCard>

      {/* 에셋 라이브러리 (유지) */}
      <div className="xl:col-span-1">
        <SectionCard title="에셋 라이브러리">
          <AssetLibrary assets={assets} onPick={() => alert("해당 씬에 배치")} />
        </SectionCard>
      </div>

      {/* 사용 안내 */}
      <div className="xl:col-span-1">
        <SectionCard title="사용 안내">
          <div className="text-sm text-slate-700 space-y-2">
            <p>1) [셋업] 탭에서 SRT를 연결합니다.</p>
            <p>
              2) <b>SRT에서 AI 추출</b>을 누르면 GPT-5 mini(필요 시 4o)로 핵심 키워드를 반환합니다.
            </p>
            <p className="text-[12px] text-slate-500">AI 호출 실패 시 로컬 추출 로직으로 자동 대체합니다.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
