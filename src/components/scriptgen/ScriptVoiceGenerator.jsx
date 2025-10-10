import React, { useState, useCallback, useEffect } from "react";
import { Text, tokens, Button, Card } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import { DocumentEditRegular, VideoRegular, EyeRegular } from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";

// 컴포넌트 imports
import ModeSelector from "./parts/ModeSelector";
import ActionCard from "./parts/ActionCard";
import BasicSettingsCard from "./parts/BasicSettingsCard";
import VoiceSettingsCard from "./parts/VoiceSettingsCard";
import ResultsSidebar from "./parts/ResultsSidebar";
import FixedProgressBar from "./parts/FixedProgressBar";

// 훅 imports
import { useScriptGeneration } from "../../hooks/useScriptGeneration";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { usePromptSettings } from "../../hooks/usePromptSettings";
import { useApi } from "../../hooks/useApi";

// 상수 imports
import { makeDefaultForm } from "../../constants/scriptSettings";

/**
 * 대본 & 음성 생성 메인 컴포넌트 (간소화됨)
 */
function ScriptVoiceGenerator({ onGeneratingChange }) {
  // 스타일 훅들
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // 기본 상태 관리 (단순화)
  const [form, setForm] = useState(makeDefaultForm());
  const [globalSettings, setGlobalSettings] = useState({});
  const [selectedMode, setSelectedMode] = useState("script_mode");

  // 전체 영상 생성 상태
  const [fullVideoState, setFullVideoState] = useState({
    isGenerating: false,
    mode: "idle",
    currentStep: "idle",
    progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
    results: { script: null, audio: null, images: [], video: null },
    streamingScript: "",
    error: null,
    startTime: null,
    logs: [],
  });

  // 커스텀 훅들
  const api = useApi();
  const { promptNames, promptLoading } = usePromptSettings();
  const { doc, setDoc, isLoading, error, setIsLoading, setError, runGenerate, chunkProgress } = useScriptGeneration();
  const { voices, voiceLoading, voiceError, previewVoice, stopVoice, retryVoiceLoad } = useVoiceSettings(form);

  // 폼 변경 핸들러
  const onChange = useCallback((k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  // 상태 초기화 헬퍼
  const resetFullVideoState = useCallback(
    (clearLogs = false) => {
      setFullVideoState((prev) => ({
        isGenerating: false,
        mode: "idle",
        currentStep: "idle",
        progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
        results: { script: null, audio: null, images: [], video: null },
        streamingScript: "",
        error: null,
        startTime: null,
        logs: clearLogs ? [] : prev.logs,
      }));
      setDoc(null);
      setIsLoading(false);
    },
    [setDoc, setIsLoading]
  );

  // 전역 설정에서 TTS 설정 불러오기
  useEffect(() => {
    const loadTtsSettings = async () => {
      try {
        const ttsEngine = await window.api.getSetting("ttsEngine");
        const ttsSpeed = await window.api.getSetting("ttsSpeed");

        if (ttsEngine) {
          setForm((prev) => ({ ...prev, ttsEngine }));
        }
        if (ttsSpeed) {
          setForm((prev) => ({ ...prev, speed: ttsSpeed }));
        }
      } catch (error) {
        console.error("TTS 설정 로드 실패:", error);
      }
    };

    loadTtsSettings();

    // 설정 변경 이벤트 리스너
    const handleSettingsChanged = () => {
      loadTtsSettings();
    };

    window.addEventListener("settingsChanged", handleSettingsChanged);

    return () => {
      window.removeEventListener("settingsChanged", handleSettingsChanged);
    };
  }, []);

  // 생성 상태 변경 시 부모에게 알림
  useEffect(() => {
    console.log("📢 생성 상태 변경:", fullVideoState.isGenerating);
    if (onGeneratingChange) {
      onGeneratingChange(fullVideoState.isGenerating);
    }
  }, [fullVideoState.isGenerating, onGeneratingChange]);

  // 미디어 준비 초기화 시 대본도 초기화
  useEffect(() => {
    const handleResetScriptGeneration = () => {
      console.log("🔄 대본 생성 초기화 이벤트 수신");
      resetFullVideoState(true);
      setDoc(null);
    };

    window.addEventListener("reset-script-generation", handleResetScriptGeneration);

    return () => {
      window.removeEventListener("reset-script-generation", handleResetScriptGeneration);
    };
  }, [resetFullVideoState, setDoc]);

  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <DocumentEditRegular />
          대본 & 음성 생성
        </div>
        <div className={headerStyles.pageDescription}>SRT 자막 + MP3 내레이션을 한 번에 생성합니다</div>
        <div className={headerStyles.divider} />
      </div>

      {/* 세로 흐름 레이아웃 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacingVerticalL,
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
          overflowY: "visible",
          position: "relative",
        }}
      >
        {/* 1행: 실행 버튼 (1열) */}
        <ActionCard
          selectedMode={selectedMode}
          form={form}
          isLoading={isLoading}
          fullVideoState={fullVideoState}
          setFullVideoState={setFullVideoState}
          voices={voices}
          api={api}
          runGenerate={runGenerate}
          setError={setError}
          setIsLoading={setIsLoading}
          setDoc={setDoc}
          chunkProgress={chunkProgress}
          centered={true}
        />

        {/* 2행: 기본 설정 (1열) */}
        <BasicSettingsCard
          form={form}
          onChange={onChange}
          promptNames={promptNames}
          promptLoading={promptLoading}
          setForm={setForm}
          disabled={fullVideoState.isGenerating}
        />

        {/* 3행: 음성 설정 (1열) */}
        <VoiceSettingsCard
          form={form}
          voices={voices}
          voiceLoading={voiceLoading}
          voiceError={voiceError}
          onChange={onChange}
          onPreviewVoice={previewVoice}
          onStopVoice={stopVoice}
          onRetryVoiceLoad={retryVoiceLoad}
          setForm={setForm}
          disabled={fullVideoState.isGenerating}
        />

      </div>

      {/* 하단 고정 미니 진행바 */}
      <FixedProgressBar
        fullVideoState={fullVideoState}
        doc={doc}
        isLoading={isLoading}
        onClose={() => {
          resetFullVideoState(true);
        }}
      />
    </div>
  );
}

export default function ScriptVoiceGeneratorWithBoundary({ onGeneratingChange }) {
  return (
    <PageErrorBoundary>
      <ScriptVoiceGenerator onGeneratingChange={onGeneratingChange} />
    </PageErrorBoundary>
  );
}
