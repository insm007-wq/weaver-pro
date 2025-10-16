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
import BottomFixedBar from "../common/BottomFixedBar";

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
      {(fullVideoState?.isGenerating || isLoading || doc) && (
        <BottomFixedBar
          isComplete={["complete", "completed"].includes(fullVideoState?.currentStep)}
          isLoading={fullVideoState?.isGenerating || isLoading}
          statusText={
            ["complete", "completed"].includes(fullVideoState?.currentStep)
              ? "✅ 대본 생성 완료"
              : `🎬 ${
                  {
                    script: "대본 생성",
                    audio: "음성 합성",
                    subtitle: "자막 생성",
                    idle: "대기",
                  }[fullVideoState?.currentStep || "idle"] || fullVideoState?.currentStep
                }`
          }
          progress={Math.round(
            ["script", "audio", "subtitle"].reduce(
              (acc, k) => acc + (fullVideoState?.progress?.[k] || 0),
              0
            ) / 3
          )}
          nextStepButton={{
            text: "➡️ 다음 단계: 미디어 준비",
            eventName: "navigate-to-assemble",
          }}
          expandedContent={
            doc && (
              <div style={{ padding: "12px 16px" }}>
                <Text size={300} weight="semibold" style={{ marginBottom: 12, display: "block" }}>
                  📖 생성된 대본 ({doc.scenes?.length}개 장면)
                </Text>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {doc.scenes?.map((scene, index) => (
                    <div
                      key={index}
                      style={{
                        padding: 12,
                        background: tokens.colorNeutralBackground1,
                        borderRadius: 8,
                        border: `1px solid ${tokens.colorNeutralStroke1}`,
                      }}
                    >
                      <Text size={250} weight="semibold" style={{ color: "#667eea", marginBottom: 4, display: "block" }}>
                        장면 {index + 1}
                      </Text>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground2, lineHeight: 1.5 }}>
                        {scene.text}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
          onClose={() => {
            resetFullVideoState(true);
          }}
        />
      )}
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
