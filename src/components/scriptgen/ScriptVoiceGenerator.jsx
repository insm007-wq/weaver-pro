/**
 * 대본 & 음성 생성 메인 컴포넌트
 *
 * @description
 * AI를 활용한 대본 생성과 TTS 음성 생성을 통합한 메인 컴포넌트
 * 자동화 모드(대본→음성→이미지→영상)와 대본 생성 모드(대본→음성→자막)를 모두 지원합니다.
 *
 * @features
 * - 🤖 AI 대본 생성 (Anthropic Claude, OpenAI GPT 지원)
 * - 🎤 다중 TTS 엔진 지원 (Google, ElevenLabs 등)
 * - 📝 SRT 자막 자동 생성
 * - 🎬 완전 자동화 영상 생성 (4단계)
 * - 📊 실시간 진행률 표시
 * - 🎨 타이핑 시뮬레이션 UI
 *
 * @requires
 * - API: llm/generateScript, tts:synthesize, script/toSrt, audio/mergeFiles, files:writeText
 * - Hooks: useToast, useApi, useScriptGeneration, useVoiceSettings, usePromptSettings
 * - Utils: audioSubtitleGenerator, scriptGenerator, automationSteps
 *
 * @author Weaver Pro Team
 * @version 2.0.0 (Optimized)
 * @since 2024-01-01
 */

import React, { useEffect, useState, useCallback } from "react";
import { Text, tokens, Button, Card } from "@fluentui/react-components";
import { useHeaderStyles, useCardStyles, useContainerStyles } from "../../styles/commonStyles";
import { DocumentEditRegular, VideoRegular } from "@fluentui/react-icons";
import { ErrorBoundary } from "../common";

// 컴포넌트 imports
import ScriptGenerationCard from "./parts/ScriptGenerationCard";
import BasicSettingsCard from "./parts/BasicSettingsCard";
import VoiceSettingsCard from "./parts/VoiceSettingsCard";
import GenerationPreviewCard from "./parts/GenerationPreviewCard";
import AdvancedSettingsCard from "./parts/AdvancedSettingsCard";
import FullVideoProgressPanel from "./parts/FullVideoProgressPanel";
import StreamingScriptViewer from "./parts/StreamingScriptViewer";

// 훅 imports
import { useScriptGeneration } from "../../hooks/useScriptGeneration";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { usePromptSettings } from "../../hooks/usePromptSettings";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";

// 상수 및 유틸리티 imports
import { ADVANCED_PRESETS, makeDefaultForm } from "../../constants/scriptSettings";
import { generateAudioAndSubtitles } from "../../utils/audioSubtitleGenerator";
import { generateScriptStep } from "../../utils/scriptGenerator";
import { generateAudioStep, generateImagesStep, generateVideoStep } from "../../utils/automationSteps";

/**
 * 대본 & 음성 생성 메인 컴포넌트
 */
function ScriptVoiceGenerator() {
  // 스타일 훅들
  const headerStyles = useHeaderStyles();
  const cardStyles = useCardStyles();
  const containerStyles = useContainerStyles();

  // 상태 관리
  const [form, setForm] = useState(makeDefaultForm());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [globalSettings, setGlobalSettings] = useState({ llmModel: "anthropic" });

  // 전체 영상 생성 상태 (모드별 분기 지원)
  const [fullVideoState, setFullVideoState] = useState({
    isGenerating: false,
    mode: "idle", // "automation_mode" | "script_mode" | "idle"
    currentStep: "idle",
    progress: {
      script: 0,
      audio: 0,
      images: 0,
      video: 0,
      subtitle: 0,
    },
    results: {
      script: null,
      audio: null,
      images: [],
      video: null,
    },
    streamingScript: "",
    error: null,
    startTime: null,
    logs: [],
  });

  // 커스텀 훅들
  const api = useApi();
  const toast = useToast();
  const { promptNames, promptLoading } = usePromptSettings();
  const { doc, setDoc, isLoading, error, setIsLoading, setError, getSelectedPromptContent } = useScriptGeneration();
  const { voices, voiceLoading, voiceError, previewVoice, retryVoiceLoad } = useVoiceSettings(form);

  // 폼 변경 핸들러
  const onChange = useCallback((k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  // 실시간 타이핑 시뮬레이션 함수
  const startTypingSimulation = useCallback((text) => {
    setTypingState({
      currentText: "",
      isTyping: true,
      fullText: text,
    });

    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex >= text.length) {
        clearInterval(typingInterval);
        setTypingState((prev) => ({ ...prev, isTyping: false }));
        return;
      }

      setTypingState((prev) => ({
        ...prev,
        currentText: text.substring(0, currentIndex + 1),
      }));

      currentIndex++;
    }, 30);

    return () => clearInterval(typingInterval);
  }, []);

  const stopTypingSimulation = useCallback(() => {
    setTypingState({
      currentText: "",
      isTyping: false,
      fullText: "",
    });
  }, []);

  // 프리셋 적용 함수
  const applyPreset = (presetName) => {
    const preset = ADVANCED_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setForm((prev) => ({ ...prev, ...preset.settings }));
      setSelectedPreset(presetName);
      toast.success(`${presetName} 프리셋을 적용했습니다.`);
    }
  };

  /**
   * 대본 생성 모드 실행 함수
   * 3단계: 대본 생성 → 음성 생성 → 자막 생성
   */
  const runGenerate = useCallback(
    async (formData) => {
      console.log("🚀 대본 생성 모드 시작!");

      setError("");
      setIsLoading(true);

      // 대본 생성 모드 상태 설정
      setFullVideoState((prev) => ({
        ...prev,
        isGenerating: true,
        mode: "script_mode",
        currentStep: "script",
        progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
        startTime: new Date(),
      }));

      try {
        // 1단계: 대본 생성 (새로운 generateScriptStep 함수 사용)
        const res = await generateScriptStep(
          formData,
          globalSettings,
          getSelectedPromptContent,
          api,
          setDoc,
          setFullVideoState,
          toast,
          addLog
        );

        if (res && res.scenes && Array.isArray(res.scenes) && res.scenes.length > 0) {
          // 2단계 음성 및 자막 생성 시작
          setFullVideoState((prev) => ({
            ...prev,
            currentStep: "audio",
            progress: { ...prev.progress, script: 100, audio: 0 },
          }));

          // 대본 생성 모드: 음성과 자막만 생성
          await generateAudioAndSubtitles(res, "script_mode", {
            form,
            voices,
            setFullVideoState,
            api,
            toast,
            addLog,
          });
        } else {
          throw new Error(`대본 생성 실패: ${JSON.stringify(res)}`);
        }
      } catch (error) {
        console.error("대본 생성 오류:", error);
        setError(error.message);
        toast.error(`대본 생성 실패: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [globalSettings, api, getSelectedPromptContent, setDoc, setError, setIsLoading, toast]
  );

  // 상태 업데이트 헬퍼 함수들
  const updateFullVideoState = (updates) => {
    setFullVideoState((prev) => ({
      ...prev,
      ...updates,
      logs: updates.logs ? [...prev.logs, ...updates.logs] : prev.logs,
    }));
  };

  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    updateFullVideoState({
      logs: [{ timestamp, message, type }],
    });
  };

  const resetFullVideoState = () => {
    setFullVideoState({
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
  };

  /**
   * 완전 자동화 영상 생성 함수
   * 4단계: 대본 생성 → 음성 생성 → 이미지 생성 → 영상 합성
   */
  const runFullVideoGeneration = async () => {
    resetFullVideoState();
    updateFullVideoState({
      isGenerating: true,
      mode: "automation_mode",
      currentStep: "script",
      startTime: new Date(),
      progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
    });
    addLog("🎬 완전 자동화 영상 생성을 시작합니다...");

    // 프로젝트 생성
    try {
      addLog("📁 프로젝트 생성 중...");

      const projectResult = await api.invoke("project:create", {
        topic: form.topic,
        options: {
          style: form.style,
          duration: form.durationMin,
        },
      });

      if (!projectResult.success) {
        throw new Error(`프로젝트 생성 실패: ${projectResult.message}`);
      }

      const project = projectResult.data?.project || projectResult.project;
      if (!project || !project.id) {
        throw new Error("프로젝트 데이터가 올바르지 않습니다: " + JSON.stringify(projectResult));
      }

      addLog(`✅ 프로젝트 생성 완료: ${project.id}`);
    } catch (error) {
      addLog(`❌ 프로젝트 생성 실패: ${error.message}`, "error");
      updateFullVideoState({
        currentStep: "error",
        error: error.message,
      });
      return;
    }

    try {
      addLog("📝 AI 대본 생성 중...");
      const script = await generateScriptStep(
        form,
        globalSettings,
        getSelectedPromptContent,
        api,
        setDoc,
        setFullVideoState,
        toast,
        addLog
      );

      updateFullVideoState({ currentStep: "audio", progress: { script: 100 } });
      addLog("🎤 음성 생성 중...");
      const audio = await generateAudioStep(script, form, addLog, setFullVideoState, api);

      updateFullVideoState({ currentStep: "images", progress: { audio: 100 } });
      addLog("🖼️ 이미지 생성 중...");
      const images = await generateImagesStep(script, form, addLog, updateFullVideoState, api);

      updateFullVideoState({ currentStep: "video", progress: { images: 100 } });
      addLog("🎬 영상 합성 중...");
      const video = await generateVideoStep(script, audio, images, addLog, setFullVideoState, api);

      updateFullVideoState({
        currentStep: "complete",
        progress: { video: 100 },
        results: { script, audio, images, video },
        isGenerating: false,
      });
      addLog("✅ 완전 자동화 영상 생성이 완료되었습니다!", "success");
      addLog(`📁 영상 파일: ${video.videoPath}`, "info");

      // 출력 폴더 자동 열기
      try {
        await window.electronAPI.project.openOutputFolder();
        addLog("📂 출력 폴더를 열었습니다.", "success");
      } catch (error) {
        addLog("❌ 출력 폴더 열기 실패: " + error.message, "error");
      }

      toast.success("🎉 완전 자동화 영상 생성 완료! 출력 폴더를 확인해보세요.");

      // 5초 후 자동으로 초기화
      setTimeout(() => {
        resetFullVideoState();
      }, 5000);
    } catch (error) {
      updateFullVideoState({
        currentStep: "error",
        error: error.message,
        isGenerating: false,
      });
      addLog(`❌ 오류 발생: ${error.message}`, "error");
      toast.error(`영상 생성 실패: ${error.message}`);

      // 에러 상태에서도 10초 후 초기화
      setTimeout(() => {
        resetFullVideoState();
      }, 10000);
    }
  };

  // 전역 설정 로드
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("defaultSettings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setGlobalSettings((prev) => ({ ...prev, ...parsedSettings }));
      }
    } catch (error) {
      console.error("전역 설정 로드 실패:", error);
    }
  }, []);

  // 프롬프트 자동 선택
  useEffect(() => {
    if (promptNames.length > 0 && !form.promptName) {
      setForm((prev) => ({ ...prev, promptName: promptNames[0] }));
    }
  }, [promptNames, form.promptName]);

  // 목소리 자동 선택
  useEffect(() => {
    if (voices.length > 0 && !form.voiceId) {
      setForm((prev) => ({ ...prev, voiceId: voices[0].id }));
    }
  }, [voices, form.voiceId]);

  // FFmpeg 설치 확인 (자동화 모드에서만)
  useEffect(() => {
    const checkFFmpeg = async () => {
      if (fullVideoState.mode !== "automation_mode") return;

      try {
        if (!window.electronAPI || !window.electronAPI.ffmpeg) {
          console.warn("FFmpeg API가 로드되지 않았습니다.");
          return;
        }

        const result = await window.electronAPI.ffmpeg.check();
        if (!result.installed) {
          addLog("⚠️ FFmpeg가 설치되지 않았습니다. 영상 합성이 불가능할 수 있습니다.", "warning");
          addLog("💡 FFmpeg 설치 방법: https://ffmpeg.org/download.html", "info");
        } else {
          addLog("✅ FFmpeg 설치 확인됨", "success");
        }
      } catch (error) {
        console.warn("FFmpeg 확인 중 오류:", error.message);
        if (fullVideoState.mode === "automation_mode") {
          addLog("❌ FFmpeg 확인 실패: " + error.message, "error");
        }
      }
    };

    checkFFmpeg();
  }, [fullVideoState.mode]);

  return (
    <ErrorBoundary>
      <div className={containerStyles.container}>
        {/* 헤더 */}
        <div className={headerStyles.pageHeader}>
          <div className={headerStyles.pageTitleWithIcon}>
            <DocumentEditRegular />
            대본 & 음성 생성
          </div>
          <div className={headerStyles.pageDescription}>SRT 자막 + MP3 내레이션을 한 번에 생성합니다</div>
          <div className={headerStyles.divider} />
        </div>

        {/* 진행률 패널 */}
        <FullVideoProgressPanel fullVideoState={fullVideoState} resetFullVideoState={resetFullVideoState} api={api} toast={toast} />

        {/* 스트리밍 뷰어 */}
        <StreamingScriptViewer
          fullVideoState={fullVideoState}
          doc={doc}
          isLoading={isLoading}
          form={form}
          globalSettings={globalSettings}
          onClose={() => {
            setDoc(null);
            resetFullVideoState();
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: tokens.spacingHorizontalXL }}>
          {/* 좌측: 메인 설정 영역 */}
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
            {/* 완전 자동화 섹션 */}
            <Card
              className={cardStyles.settingsCard}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "#fff",
                position: "relative",
                overflow: "hidden",
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* 배경 장식 원들 */}
              <div
                style={{
                  position: "absolute",
                  top: -50,
                  right: -50,
                  width: 150,
                  height: 150,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "50%",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -30,
                  left: -30,
                  width: 100,
                  height: 100,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "50%",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <Text weight="bold" size={600} style={{ color: "#fff", marginBottom: 8, display: "block" }}>
                  🎬 완전 자동화 영상 생성
                </Text>
                <Text size={300} style={{ color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
                  원클릭으로 대본 → 음성 → 이미지 → 영상까지 자동 생성
                  <br />
                </Text>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: tokens.spacingVerticalXL,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <Button
                  appearance="secondary"
                  size="large"
                  icon={<VideoRegular />}
                  onClick={runFullVideoGeneration}
                  disabled={fullVideoState.isGenerating || !form.topic?.trim() || !form.promptName}
                  style={{
                    backgroundColor: "#fff",
                    color: "#667eea",
                    border: "none",
                    padding: "16px 24px",
                    fontWeight: "bold",
                    fontSize: "16px",
                  }}
                >
                  {fullVideoState.isGenerating ? "생성 중..." : "🚀 완전 자동화 시작"}
                </Button>
              </div>

              {/* 필수 조건 안내 */}
              {(!form.topic?.trim() || !form.promptName) && (
                <div
                  style={{
                    marginTop: 16,
                    background: "rgba(255,255,255,0.1)",
                    padding: 12,
                    borderRadius: 8,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {!form.topic?.trim() && (
                    <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.9)" }}>
                      ⚠️ 영상 주제를 입력해주세요.
                    </Text>
                  )}
                  {!form.promptName && (
                    <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.9)" }}>
                      ⚠️ 대본 생성 프롬프트를 선택해주세요.
                    </Text>
                  )}
                </div>
              )}
            </Card>

            {/* 기본 설정 카드 */}
            <BasicSettingsCard form={form} onChange={onChange} promptNames={promptNames} promptLoading={promptLoading} />

            {/* TTS 및 보이스 설정 카드 */}
            <VoiceSettingsCard
              form={form}
              voices={voices}
              voiceLoading={voiceLoading}
              voiceError={voiceError}
              onChange={onChange}
              onPreviewVoice={previewVoice}
              onRetryVoiceLoad={retryVoiceLoad}
            />

            {/* 고급 설정 & 자동화 카드 */}
            <AdvancedSettingsCard
              showAdvanced={showAdvanced}
              onToggleAdvanced={setShowAdvanced}
              selectedPreset={selectedPreset}
              onApplyPreset={applyPreset}
              presets={ADVANCED_PRESETS}
            />
          </div>

          {/* 우측: 상태 및 결과 패널 */}
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
            {/* 예상 결과 카드 */}
            <GenerationPreviewCard form={form} globalSettings={globalSettings} doc={doc} />

            {/* 대본만 생성 카드 */}
            <ScriptGenerationCard
              form={form}
              isLoading={isLoading}
              fullVideoState={fullVideoState}
              globalSettings={globalSettings}
              onGenerate={() => {
                console.log("🔥 대본 생성 버튼 클릭됨!");
                runGenerate(form);
              }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function ScriptVoiceGeneratorWithBoundary() {
  return (
    <ErrorBoundary>
      <ScriptVoiceGenerator />
    </ErrorBoundary>
  );
}
