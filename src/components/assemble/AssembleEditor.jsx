// src/components/assemble/AssembleEditor.jsx
// -----------------------------------------------------------------------------
// AssembleEditor (전체 수정본)
// - ArrangeTab과 ReviewTab이 같은 씬 상태를 공유(상위 보관)
// - 탭 전환 시 언마운트 금지: KeepAlivePane으로 모든 탭 감싸기
// - 자동배치: autoMatchEngine(runAutoMatch)로 단일 진실원 사용 + stats 노출
// -----------------------------------------------------------------------------

import { useMemo, useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import KeywordsTab from "./tabs/KeywordsTab.jsx";
import ArrangeTab from "./tabs/ArrangeTab.jsx";
import ReviewTab from "./tabs/ReviewTab.jsx";
import SetupTab from "./tabs/SetupTab.jsx";
import { parseSrtToScenes } from "../../utils/parseSrt";
import KeepAlivePane from "../common/KeepAlivePane";
import CanvaTab from "./tabs/CanvaTab";

// ▼ 분리한 유틸
import { getSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
// ⬇️ autoAssignAssets → runAutoMatch로 교체
import { runAutoMatch } from "../../utils/autoMatchEngine";
import { clampSelectedIndex } from "../../utils/sceneIndex";

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-lg text-sm border transition
        ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default function AssembleEditor() {
  // 고정 폭 카드 컨테이너
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  const containerStyle = fixedWidthPx
    ? {
        width: `${fixedWidthPx}px`,
        minWidth: `${fixedWidthPx}px`,
        maxWidth: `${fixedWidthPx}px`,
        flex: `0 0 ${fixedWidthPx}px`,
        boxSizing: "border-box",
        scrollbarGutter: "stable both-edges",
      }
    : { scrollbarGutter: "stable both-edges" };

  // 상태
  const [tab, setTab] = useState("setup"); // setup | keywords | arrange | review | canva
  const [scenes, setScenes] = useState([]); // ← SRT에서 채움 (상위 보관: Arrange/Review 공유)
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);

  const [assets, setAssets] = useState([]); // {id,type,thumbUrl,durationSec,tags?}
  const [autoMatch, setAutoMatch] = useState(true);
  const [autoOpts, setAutoOpts] = useState({
    emptyOnly: true,
    byKeywords: true,
    byOrder: true,
    overwrite: false,
    // runAutoMatch가 DEFAULT_OPTS로 나머지를 채워줌(allowReuseIfShortfall 등)
  });

  const [autoStats, setAutoStats] = useState(null); // ← 자동배치 통계/사유
  useEffect(() => {
    // 디버깅 편의: 콘솔/윈도우에서 바로 확인 가능
    window.__autoStats = autoStats;
  }, [autoStats]);

  const [srtConnected, setSrtConnected] = useState(false);
  const [mp3Connected, setMp3Connected] = useState(false);
  const [audioDur, setAudioDur] = useState(0);

  const totalDur = useMemo(
    () => (scenes.length ? (Number(scenes[scenes.length - 1].end) || 0) - (Number(scenes[0].start) || 0) : 0),
    [scenes]
  );

  const selectScene = (i) => setSelectedSceneIdx(i);
  const addAssets = (items) => setAssets((prev) => [...prev, ...items]);

  // 씬 배열 변경 시 선택 인덱스 안전화
  useEffect(() => {
    setSelectedSceneIdx((old) => clampSelectedIndex(scenes, old));
  }, [scenes]);

  // (개발 편의) 현재 씬 전역 노출
  useEffect(() => {
    window.__scenes = scenes;
  }, [scenes]);

  // ===== SRT 로드 & 파싱 =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const srtPath = await getSetting("paths.srt");
        if (!srtPath) return;
        const raw = await readTextAny(srtPath);
        if (cancelled) return;
        const parsed = parseSrtToScenes(raw || "");
        if (!cancelled && parsed.length) {
          setScenes(parsed);
          setSelectedSceneIdx(0);
          setSrtConnected(true);
          console.log("[assemble] SRT scenes:", parsed.length);
        }
      } catch (e) {
        if (!cancelled) console.warn("SRT 로드/파싱 실패:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [srtConnected]); // 셋업에서 연결되면 true로 들어오므로 재파싱

  // ===== MP3 길이 조회 =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mp3Path = await getSetting("paths.mp3");
        if (!mp3Path) return;
        const dur = await getMp3DurationSafe(mp3Path);
        if (!cancelled && dur) {
          setAudioDur(Number(dur));
          setMp3Connected(true);
          console.log("[assemble] MP3 duration:", dur);
        }
      } catch (e) {
        if (!cancelled) console.warn("MP3 길이 조회 실패:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mp3Connected]);

  // ===== 에셋 자동 배치 =====
  // 단일 엔진(runAutoMatch) 사용. 결과 scenes + stats 동시 관리.
  const runAutoAssign = useCallback(() => {
    if (!autoMatch) return;
    setScenes((prev) => {
      const { scenes: next, stats } = runAutoMatch({ scenes: prev, assets, opts: autoOpts });
      setAutoStats(stats);
      return next;
    });
  }, [assets, autoMatch, autoOpts]);

  // 자산/토글/옵션 변경 시 자동배치 시도
  useEffect(() => {
    runAutoAssign();
  }, [runAutoAssign]);

  // 씬 수가 바뀌면(SRT 재파싱 등) 한 번 더 시도
  useEffect(() => {
    if (!autoMatch) return;
    setScenes((prev) => {
      const { scenes: next, stats } = runAutoMatch({ scenes: prev, assets, opts: autoOpts });
      setAutoStats(stats);
      return next;
    });
    // scenes 자체를 의존성으로 넣으면 setScenes로 루프가 날 수 있어 길이만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.length, autoMatch, assets, autoOpts]);

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-md" style={containerStyle}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span>✨</span> 영상 구성
        </h1>
        <div className="text-xs text-gray-500">
          총 길이 {totalDur.toFixed(1)}s{audioDur ? ` · 오디오 ${audioDur.toFixed(1)}s` : ""} · 씬 {scenes.length}개
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === "setup"} onClick={() => setTab("setup")}>
          셋업
        </TabButton>
        <TabButton active={tab === "canva"} onClick={() => setTab("canva")}>
          {/*               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */}
          {/* FIX: setActiveTab → setTab 으로 수정하여 탭 전환 정상화 */}
          캔바 다운로드
        </TabButton>
        <TabButton active={tab === "keywords"} onClick={() => setTab("keywords")}>
          키워드 & 소스
        </TabButton>
        <TabButton active={tab === "arrange"} onClick={() => setTab("arrange")}>
          배치 & 타임라인
        </TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")}>
          미리보기 & 자막
        </TabButton>
      </div>

      {/* 본문: ✅ 모든 탭을 KeepAlivePane으로 감싸 언마운트 방지 */}
      <div className="space-y-4">
        <KeepAlivePane active={tab === "setup"}>
          <SetupTab
            srtConnected={srtConnected}
            mp3Connected={mp3Connected}
            setSrtConnected={setSrtConnected}
            setMp3Connected={setMp3Connected}
            autoMatch={autoMatch}
            setAutoMatch={setAutoMatch}
            autoOpts={autoOpts}
            setAutoOpts={setAutoOpts}
          />
        </KeepAlivePane>

        <KeepAlivePane active={tab === "canva"}>
          <CanvaTab addAssets={addAssets} />
        </KeepAlivePane>

        <KeepAlivePane active={tab === "keywords"}>
          <KeywordsTab assets={assets} addAssets={addAssets} autoMatch={autoMatch} />
        </KeepAlivePane>

        <KeepAlivePane active={tab === "arrange"}>
          <ArrangeTab
            // ✅ ArrangeTab이 기대하는 prop 이름으로 전달
            scenes={scenes}
            onChangeScenes={setScenes}
            selectedSceneIdx={selectedSceneIdx}
            onChangeSelectedScene={setSelectedSceneIdx}
          />
        </KeepAlivePane>

        <KeepAlivePane active={tab === "review"}>
          <ReviewTab scenes={scenes} selectedSceneIdx={selectedSceneIdx} srtConnected={srtConnected} mp3Connected={mp3Connected} />
        </KeepAlivePane>
      </div>
    </div>
  );
}
