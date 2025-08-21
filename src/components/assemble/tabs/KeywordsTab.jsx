import { useEffect, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";
import { extractKeywords } from "../../../utils/extractKeywords";

const FALLBACK_SEED = ["여행", "산", "노을", "도시", "강아지", "바다"];
// 404가 뜨는 경우가 있어 홈에서 진입하도록 변경
const CANVA_HOME = "https://www.canva.com/";

export default function KeywordsTab({ assets, addAssets, autoMatch }) {
  const [keywords, setKeywords] = useState(FALLBACK_SEED);
  const [history, setHistory] = useState([]);
  const [srtFileName, setSrtFileName] = useState(null);
  const [busy, setBusy] = useState(false);

  const [loggedIn, setLoggedIn] = useState(null);

  const [canvaUrl, setCanvaUrl] = useState(CANVA_HOME);
  const webviewRef = useRef(null);

  const [autoCycle, setAutoCycle] = useState(true);
  const [autoRun, setAutoRun] = useState(false);
  const queueRef = useRef([]);
  const idxRef = useRef(0);
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState(0);
  const [progress, setProgress] = useState(null);

  const injectTimerRef = useRef(null);
  const lastInjectedKwRef = useRef("");
  const injectInFlightRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const srtPath = await window.api.getSetting("paths.srt");
        if (srtPath) setSrtFileName(srtPath.split(/[/\\]/).pop());
      } catch {}
      try {
        const r = await window.api.canvaCheckAuth?.();
        setLoggedIn(!!r?.loggedIn);
      } catch {
        setLoggedIn(false);
      }
    })();
  }, []);

  useEffect(() => {
    const off1 = window.api.onCanvaDownloaded((d) => {
      if (!d?.ok) return;
      const fileUrl = window.api.toFileUrl
        ? window.api.toFileUrl(d.path)
        : d.path;
      const type = d.type || (/video/i.test(d.mime) ? "video" : "image");
      addAssets([
        {
          id: "dl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          type,
          thumbUrl: fileUrl,
          filePath: d.path,
        },
      ]);
      setCompleted((n) => n + 1);
      if (autoCycle) gotoNextKeyword(true);
    });

    const off2 = window.api.onCanvaProgress?.((p) =>
      setProgress({ received: p.received, total: p.total })
    );

    return () => {
      off1 && off1();
      off2 && off2();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAssets, autoCycle, autoRun]);

  // ── webview 이벤트에서 주입 스케줄 ──────────────────────────────
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const scheduleInject = (delay = 400) => {
      if (!autoRun) return;
      if (injectTimerRef.current) clearTimeout(injectTimerRef.current);
      injectTimerRef.current = setTimeout(tryInjectForCurrentKeyword, delay);
    };

    const onDomReady = () => scheduleInject(600);
    const onStop = () => scheduleInject(400);
    const onNav = () => scheduleInject(600);

    wv.addEventListener("dom-ready", onDomReady);
    wv.addEventListener("did-stop-loading", onStop);
    wv.addEventListener("did-navigate", onNav);
    wv.addEventListener("did-navigate-in-page", onNav);

    return () => {
      wv.removeEventListener("dom-ready", onDomReady);
      wv.removeEventListener("did-stop-loading", onStop);
      wv.removeEventListener("did-navigate", onNav);
      wv.removeEventListener("did-navigate-in-page", onNav);
      if (injectTimerRef.current) clearTimeout(injectTimerRef.current);
    };
  }, [autoRun, canvaUrl]);

  // ── 로그인 보장 ────────────────────────────────────────────────
  const ensureLoggedInOrOpenLogin = async () => {
    try {
      const r = await window.api.canvaCheckAuth?.();
      if (!r?.loggedIn) {
        setLoggedIn(false);
        setCanvaUrl("https://www.canva.com/login");
        webviewRef.current?.loadURL?.("https://www.canva.com/login");
        return false;
      }
      setLoggedIn(true);
      return true;
    } catch {
      setLoggedIn(false);
      return false;
    }
  };

  const openHome = async () => {
    const ok = await ensureLoggedInOrOpenLogin();
    if (!ok) return;
    setCanvaUrl(CANVA_HOME);
    webviewRef.current?.loadURL?.(CANVA_HOME);
  };

  const openEditorForKeyword = async () => {
    const ok = await ensureLoggedInOrOpenLogin();
    if (!ok) return;
    // 홈에서 자동으로 에디터 진입을 시도 → 주입 스크립트에서 처리
  };

  const gotoNextKeyword = (autoClickAfter = false) => {
    const list = queueRef.current;
    const next = idxRef.current + 1;
    if (next < list.length) {
      idxRef.current = next;
      if (autoRun && autoClickAfter) {
        lastInjectedKwRef.current = "";
        openEditorForKeyword();
      }
    } else {
      setAutoRun(false);
      console.log("[cycle] done");
    }
  };

  const extractFromSrt = async () => {
    setBusy(true);
    try {
      const srtPath = await window.api.getSetting("paths.srt");
      if (!srtPath) {
        alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
        return;
      }
      const rawRes = await window.api.readTextFile(srtPath);
      const src = typeof rawRes === "string" ? rawRes : rawRes?.data || "";
      if (!src) throw new Error("SRT 파일을 읽지 못했습니다.");

      const cleaned = src
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

      queueRef.current = final;
      idxRef.current = 0;
      setCompleted(0);
      setTarget(final.length);

      await openHome(); // 홈에서 시작 → 자동 주입이 에디터 진입까지 수행
      if (autoRun) lastInjectedKwRef.current = "";
    } catch (e) {
      console.error(e);
      alert("키워드 추출 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  // ── 자동 주입 스크립트 ─────────────────────────────────────────
  const currentKeyword = () =>
    queueRef.current[idxRef.current] || keywords[idxRef.current] || "";

  const isEditorUrl = (url) => /\/design\/[^/]+\/edit/.test(url || "");

  const AUTO_JS = (kw) => `
    (async () => {
      const KW = ${JSON.stringify(kw)};
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      const clickByText = async (texts) => {
        const joined = texts
          .map(t => \`//button[contains(., "\${t}")] | //a[contains(., "\${t}")] | //div[contains(@role,"button") and contains(., "\${t}")]\`)
          .join(" | ");
        const it = document.evaluate(joined, document, null, XPathResult.ANY_TYPE, null);
        let n; while(n = it.iterateNext()){ if(n.offsetParent !== null) { n.click(); await sleep(600); return true; } }
        return false;
      };

      const inEditor = () => /\\/design\\/[^/]+\\/edit/.test(location.pathname);

      // 0) 404 페이지면 홈으로 이동
      const bodyText = (document.body && document.body.innerText || "").slice(0, 4000);
      if (/404|찾을 수 없음/i.test(bodyText)) {
        location.href = "https://www.canva.com/";
        return { retry: "go_home" };
      }

      // 1) 에디터가 아니면: 홈/대시보드 → '디자인 만들기/만들기/Create a design' 클릭 후 '동영상/Video' 선택 시도
      if (!inEditor()) {
        // 메뉴 열기
        await clickByText(["디자인 만들기","만들기","Create a design"]);
        await sleep(500);
        // 비디오 항목 선택
        const opened = await clickByText([
          "동영상(1920 × 1080)","동영상","비디오",
          "Video","Video (1920 × 1080)","Video (1920 x 1080)"
        ]);
        if (!opened) {
          // 직접 이동 시도 (locale 상관없이)
          location.href = "https://www.canva.com/design?create&category=video";
        }
        // 에디터 진입 대기
        let t=0; while(!inEditor() && t<60){ await sleep(300); t++; }
        if (!inEditor()) return { retry: "wait_editor" };
      }

      // 2) 에디터 도달 → 좌측 검색 입력 찾기
      let input = document.querySelector('input[placeholder*="검색"], input[placeholder*="Search"]');
      if (!input) {
        await clickByText(["동영상","Videos","요소","Elements"]);
        await sleep(400);
        input = document.querySelector('input[placeholder*="검색"], input[placeholder*="Search"]');
      }
      if (!input) return { error: "search_input_not_found" };

      // 3) 키워드 입력 + 엔터
      input.focus();
      input.value = KW;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await sleep(1000);

      // 4) 첫 동영상 카드 클릭
      let card = document.querySelector('[data-testid*="search"] video, [data-testid*="card"] video, [data-testid*="media"] video');
      if (card) {
        let clickable = card.closest('[role="button"], [data-testid*="card"], [data-testid*="grid"] [tabindex]');
        (clickable || card).click();
        await sleep(800);
      }

      // 5) 공유 → 다운로드 → MP4 → 다운로드
      const okShare = await clickByText(["공유","Share"]);
      if (!okShare) return { error: "share_not_found" };
      await clickByText(["다운로드","Download"]);
      await sleep(700);

      const all = Array.from(document.querySelectorAll('button,[role=menuitem],[role="option"]'));
      const mp4 = all.find(el => /mp4/i.test(el.textContent || ""));
      if (mp4) { mp4.click(); await sleep(300); }

      await clickByText(["다운로드","Download"]);
      return { ok: true };
    })().catch(e => ({ error: String(e?.message || e) }));
  `;

  const tryInjectForCurrentKeyword = async () => {
    const wv = webviewRef.current;
    if (!wv || !autoRun) return;
    if (injectInFlightRef.current) return;

    const url = wv.getURL?.() || "";
    // 에디터 진입은 스크립트가 알아서 함 — 홈이어도 쏘자
    const kw = currentKeyword();
    if (!kw) return;
    if (lastInjectedKwRef.current === kw) return;

    try {
      injectInFlightRef.current = true;
      const res = await wv.executeJavaScript(AUTO_JS(kw), true);
      console.log("[inject]", kw, res);
      if (res?.retry) {
        // 홈 이동/에디터 대기 등 재시도 신호
        lastInjectedKwRef.current = "";
        injectInFlightRef.current = false;
        setTimeout(tryInjectForCurrentKeyword, 900);
        return;
      }
      lastInjectedKwRef.current = kw;
      if (res && res.error) {
        // 재시도
        lastInjectedKwRef.current = "";
        injectInFlightRef.current = false;
        setTimeout(tryInjectForCurrentKeyword, 900);
      } else {
        injectInFlightRef.current = false;
      }
    } catch (e) {
      console.warn("[inject error]", e);
      injectInFlightRef.current = false;
      lastInjectedKwRef.current = "";
      setTimeout(tryInjectForCurrentKeyword, 900);
    }
  };

  const manualInject = () => {
    lastInjectedKwRef.current = "";
    tryInjectForCurrentKeyword();
  };

  const startAuto = async () => {
    if (!keywords?.length) return;
    const ok = await ensureLoggedInOrOpenLogin();
    if (!ok) return;
    queueRef.current = keywords;
    idxRef.current = 0;
    lastInjectedKwRef.current = "";
    setAutoRun(true);
    await openHome();
  };
  const stopAuto = () => setAutoRun(false);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
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

            {autoRun ? (
              <button
                onClick={stopAuto}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              >
                자동 수집 중지
              </button>
            ) : (
              <button
                onClick={startAuto}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                title="홈→에디터 진입→검색→공유→다운로드 자동 수행"
              >
                자동 수집 시작
              </button>
            )}

            <button
              onClick={openHome}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              title="Canva 홈 열기"
            >
              홈 열기
            </button>

            <button
              onClick={manualInject}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              title="현재 키워드 강제 실행(주입)"
            >
              수동 실행
            </button>
          </div>
        }
      >
        {loggedIn === false && (
          <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
            Canva에 로그인해야 자동 수집/다운로드가 가능합니다.
            <button
              className="ml-2 px-2 py-0.5 text-xs rounded bg-amber-600 text-white"
              onClick={() => {
                setCanvaUrl("https://www.canva.com/login");
                webviewRef.current?.loadURL?.("https://www.canva.com/login");
              }}
            >
              로그인 열기
            </button>
            <button
              className="ml-2 px-2 py-0.5 text-xs rounded border"
              onClick={async () => {
                const r = await window.api.canvaCheckAuth?.();
                setLoggedIn(!!r?.loggedIn);
                if (r?.loggedIn) openHome();
              }}
            >
              로그인 완료 확인
            </button>
          </div>
        )}

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
                lastInjectedKwRef.current = "";
                openEditorForKeyword();
              }}
              className={`px-3 h-8 rounded-full border border-slate-200 text-sm hover:bg-slate-50 whitespace-nowrap ${
                i === idxRef.current ? "ring-1 ring-blue-400" : ""
              }`}
            >
              #{k}
            </button>
          ))}
        </div>

        <div className="mt-3 text-xs text-slate-600 space-y-1">
          <div>
            진행: <b>{completed}</b> / <b>{target}</b> (키워드당 1개)
            {autoRun && (
              <span className="ml-2 text-blue-600">· 자동 수집 ON</span>
            )}
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
            로그인 후 동작합니다. 404가 뜨면 자동으로 홈으로 복구 후
            재시도합니다.
          </div>
        </div>
      </SectionCard>

      <div className="xl:col-span-1">
        <SectionCard title="에셋 라이브러리">
          <AssetLibrary
            assets={assets}
            onPick={() => alert("해당 씬에 배치")}
          />
        </SectionCard>
      </div>

      <div className="xl:col-span-1">
        <SectionCard title="Canva 미니 브라우저">
          <div className="rounded-xl overflow-hidden border border-slate-200 h-[520px] bg-white">
            {/* eslint-disable-next-line react/no-unknown-property */}
            <webview
              ref={webviewRef}
              src={canvaUrl}
              className="w-full h-full"
              allowpopups="true"
              partition="persist:canva"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36"
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            홈 → ‘디자인 만들기/만들기’ → ‘동영상’ 선택 → 에디터에서
            검색·다운로드까지 자동 실행합니다.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
