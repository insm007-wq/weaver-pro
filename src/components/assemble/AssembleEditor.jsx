// src/components/assemble/AssembleEditor.jsx
import { useMemo, useState, useRef, useLayoutEffect } from "react";

import KeywordsTab from "./tabs/KeywordsTab.jsx";
import ArrangeTab from "./tabs/ArrangeTab.jsx";
import ReviewTab from "./tabs/ReviewTab.jsx";
import SetupTab from "./tabs/SetupTab.jsx";

/** 샘플 씬 데이터 */
const seedScenes = [
  { id: "sc1", start: 0, end: 3, text: "씬 01 자막" },
  { id: "sc2", start: 3, end: 7, text: "씬 02 자막" },
  { id: "sc3", start: 7, end: 11, text: "씬 03 자막" },
  { id: "sc4", start: 11, end: 15, text: "씬 04 자막" },
  { id: "sc5", start: 15, end: 18, text: "씬 05 자막" },
  { id: "sc6", start: 18, end: 22, text: "씬 06 자막" },
  { id: "sc7", start: 22, end: 26, text: "씬 07 자막" },
  { id: "sc8", start: 26, end: 30, text: "씬 08 자막" },
];

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3 rounded-lg text-sm border transition
        ${
          active
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default function AssembleEditor() {
  // ▼ 썸네일 페이지와 동일: 고정 폭 카드 컨테이너
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
  const [tab, setTab] = useState("setup"); // setup | keywords | arrange | review
  const [scenes, setScenes] = useState(seedScenes);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);

  const [assets, setAssets] = useState([]); // {id,type,thumbUrl,durationSec}
  const [autoMatch, setAutoMatch] = useState(true);
  const [autoOpts, setAutoOpts] = useState({
    emptyOnly: true,
    byKeywords: true,
    byOrder: true,
    overwrite: false,
  });

  const [srtConnected, setSrtConnected] = useState(false);
  const [mp3Connected, setMp3Connected] = useState(false);

  const totalDur = useMemo(
    () => (scenes.length ? scenes[scenes.length - 1].end - scenes[0].start : 0),
    [scenes]
  );

  const selectScene = (i) => setSelectedSceneIdx(i);
  const addAssets = (items) => setAssets((prev) => [...items, ...prev]);

  return (
    <div
      ref={containerRef}
      className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-md"
      style={containerStyle}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span>✨</span> 영상 구성
        </h1>
        <div className="text-xs text-gray-500">
          총 길이 {totalDur.toFixed(0)}s · 씬 {scenes.length}개
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-5 flex gap-2">
        <TabButton active={tab === "setup"} onClick={() => setTab("setup")}>
          셋업
        </TabButton>
        <TabButton
          active={tab === "keywords"}
          onClick={() => setTab("keywords")}
        >
          키워드 & 소스
        </TabButton>
        <TabButton active={tab === "arrange"} onClick={() => setTab("arrange")}>
          배치 & 타임라인
        </TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")}>
          미리보기 & 자막
        </TabButton>
      </div>

      {/* 본문 */}
      <div className="space-y-4">
        {tab === "setup" && (
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
        )}

        {tab === "keywords" && (
          <KeywordsTab
            assets={assets}
            addAssets={addAssets}
            autoMatch={autoMatch}
          />
        )}

        {tab === "arrange" && (
          <ArrangeTab
            scenes={scenes}
            setScenes={setScenes}
            selectedSceneIdx={selectedSceneIdx}
            selectScene={selectScene}
          />
        )}

        {tab === "review" && (
          <ReviewTab
            scenes={scenes}
            selectedSceneIdx={selectedSceneIdx}
            srtConnected={srtConnected}
            mp3Connected={mp3Connected}
          />
        )}
      </div>
    </div>
  );
}
