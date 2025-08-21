import { useEffect, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";
import { extractKeywords } from "../../../utils/extractKeywords";

const FALLBACK_SEED = ["여행", "산", "노을", "도시", "강아지", "바다"];

export default function KeywordsTab({ assets, addAssets, autoMatch }) {
  const [keywords, setKeywords] = useState(FALLBACK_SEED);
  const [history, setHistory] = useState([]);
  const [srtFileName, setSrtFileName] = useState(null);
  const [busy, setBusy] = useState(false);

  // 미니 브라우저
  const [canvaUrl, setCanvaUrl] = useState("https://www.canva.com/");
  const webviewRef = useRef(null);

  // ✅ 자동 순회 상태
  const [autoCycle, setAutoCycle] = useState(true); // ON이면 다운로드 완료 시 다음 키워드로 이동
  const queueRef = useRef([]); // 순회 대상 키워드 목록
  const idxRef = useRef(0); // 현재 인덱스
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState(0);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const srtPath = await window.api.getSetting("paths.srt");
        if (srtPath) setSrtFileName(srtPath.split(/[/\\]/).pop());
      } catch {}
    })();
  }, []);

  // ✅ 다운로드 훅: 저장되면 에셋 추가 + 자동 다음 키워드
  useEffect(() => {
    const off1 = window.api.onCanvaDownloaded((d) => {
      if (!d?.ok) return;
      const filePath = d.path;
      const type = d.type || (/video/i.test(d.mime) ? "video" : "image");
      const fileUrl =
        process.platform === "win32"
          ? "file:///" + filePath.replace(/\\/g, "/")
          : "file://" + filePath;

      // 라이브러리에 추가
      addAssets([
        {
          id: "dl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          type,
          thumbUrl: fileUrl,
          filePath,
        },
      ]);

      // 진행 카운트
      setCompleted((n) => n + 1);

      // 자동 순회: 다음 키워드로 이동
      if (autoCycle) {
        gotoNextKeyword();
      }
    });

    const off2 = window.api.onCanvaProgress?.((p) => {
      setProgress({ received: p.received, total: p.total });
    });

    return () => {
      off1 && off1();
      off2 && off2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAssets, autoCycle]);

  const buildSearchUrl = (q) =>
    q
      ? `https://www.canva.com/search?q=${encodeURIComponent(q)}`
      : "https://www.canva.com/";

  const openCanvaSearch = (kw = "") => {
    const url = buildSearchUrl(kw);
    setCanvaUrl(url);
    const wv = webviewRef.current;
    if (wv && wv.loadURL) wv.loadURL(url);
  };

  // ✅ 다음 키워드로 이동
  const gotoNextKeyword = () => {
    const list = queueRef.current;
    const next = idxRef.current + 1;
    if (next < list.length) {
      idxRef.current = next;
      openCanvaSearch(list[next]);
    } else {
      // 끝
      // 원하는 경우 토스트/알림
      console.log("[cycle] done");
    }
  };

  // ✅ 수동으로 현재 키워드 다시 열기 (다운로드 실패 시 등)
  const reopenCurrent = () => {
    const list = queueRef.current;
    const i = idxRef.current;
    if (list[i]) openCanvaSearch(list[i]);
  };

  // ✅ SRT에서 키워드 추출 & 순회 큐 설정
  const extractFromSrt = async () => {
    setBusy(true);
    try {
      const srtPath = await window.api.getSetting("paths.srt");
      if (!srtPath) {
        alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
        return;
      }
      const raw = await window.api.readTextFile(srtPath);
      const cleaned = raw
        .replace(/\r/g, "\n")
        .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
        .replace(
          /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g,
          ""
        );

      const kws = extractKeywords(cleaned, { topK: 20, minLen: 2 });
      const final = kws.length ? kws : FALLBACK_SEED;

      setKeywords(final);
      setHistory((h) => [{ at: Date.now(), items: final }, ...h]);
      setSrtFileName(srtPath.split(/[/\\]/).pop());

      // 순회 준비
      queueRef.current = final;
      idxRef.current = 0;
      setCompleted(0);
      setTarget(final.length);

      // 첫 키워드 열기
      if (final[0]) openCanvaSearch(final[0]);
    } catch (e) {
      console.error(e);
      alert("키워드 추출 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* 좌측: 키워드 & 컨트롤 */}
      <SectionCard
        title="키워드 & 소스"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={extractFromSrt}
              disabled={busy}
              className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-60"
            >
              {busy ? "추출 중..." : "키워드 추출"}
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoCycle}
                onChange={(e) => setAutoCycle(e.target.checked)}
              />
              <span
                className={`w-10 h-6 rounded-full relative transition ${
                  autoCycle ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full shadow transition-transform ${
                    autoCycle ? "translate-x-4" : ""
                  }`}
                />
              </span>
              자동 순회
            </label>
            <button
              onClick={reopenCurrent}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              title="현재 키워드 다시 열기"
            >
              다시 열기
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

        <div className="flex flex-wrap gap-2">
          {keywords.map((k, i) => (
            <button
              key={k + i}
              onClick={() => {
                queueRef.current = keywords;
                idxRef.current = i;
                openCanvaSearch(k);
              }}
              className={`px-3 h-8 rounded-full border border-slate-200 text-sm hover:bg-slate-50 whitespace-nowrap ${
                i === idxRef.current ? "ring-1 ring-blue-400" : ""
              }`}
              title="클릭하면 우측 Canva에서 검색"
            >
              #{k}
            </button>
          ))}
        </div>

        <div className="mt-3 text-xs text-slate-600 space-y-1">
          <div>
            진행: <b>{completed}</b> / <b>{target}</b> (키워드당 1개)
          </div>
          {progress?.total ? (
            <div className="h-2 bg-slate-200 rounded">
              <div
                className="h-2 bg-blue-500 rounded"
                style={{
                  width: `${Math.min(
                    100,
                    (progress.received / progress.total) * 100
                  )}%`,
                }}
              />
            </div>
          ) : null}
          <div className="text-[11px] text-slate-500">
            다운로드 버튼은 <b>사용자가 누르는 것</b>만 필요합니다. 저장 완료 시
            자동으로 다음 키워드로 전환됩니다.
          </div>
        </div>
      </SectionCard>

      {/* 중앙: 에셋 라이브러리 */}
      <div className="xl:col-span-1">
        <SectionCard title="에셋 라이브러리">
          <AssetLibrary
            assets={assets}
            onPick={() => alert("해당 씬에 배치")}
          />
        </SectionCard>
      </div>

      {/* 우측: Canva 미니 브라우저 */}
      <div className="xl:col-span-1">
        <SectionCard title="Canva 미니 브라우저">
          <div className="rounded-xl overflow-hidden border border-slate-200 h-[520px] bg-white">
            {/* eslint-disable-next-line react/no-unknown-property */}
            <webview
              ref={webviewRef}
              src={canvaUrl}
              className="w-full h-full"
              allowpopups="true"
              partition="persist:canva" // main의 will-download 훅과 매칭
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            키워드 클릭 → Canva에서 원하는 항목 <b>Download</b> → 저장되면 다음
            키워드로 자동 이동(자동 순회 ON).
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
