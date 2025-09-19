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

// 상수 및 유틸리티 imports
import { ADVANCED_PRESETS, makeDefaultForm } from "../../constants/scriptSettings";
import { generateAudioAndSubtitles } from "../../utils/audioSubtitleGenerator";
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
  const { promptNames, promptLoading } = usePromptSettings();
  const { doc, setDoc, isLoading, error, setIsLoading, setError, getSelectedPromptContent, runGenerate } = useScriptGeneration();
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
      console.log(`${presetName} 프리셋을 적용했습니다.`);
    }
  };

  /**
   * 대본 생성 모드 실행 함수
   * 3단계: 대본 생성 → 음성 생성 → 자막 생성
   */
  const runScriptMode = useCallback(
    async (formData) => {
      console.log("🚀 runGenerate 함수 실행 시작! (SCRIPT MODE)");

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
      console.log("✅ fullVideoState mode가 script_mode로 설정됨");

      try {
        // 전역 설정에서 영상 폴더 경로 가져오기
        let videoSaveFolder = null;
        try {
          const videoFolderSettingResult = await window.api.getSetting("videoSaveFolder");
          const videoFolderSetting = videoFolderSettingResult?.value || videoFolderSettingResult;
          if (videoFolderSetting) {
            videoSaveFolder = videoFolderSetting;
            console.log("📂 대본 모드 - 설정된 영상 폴더:", videoSaveFolder);
          }
        } catch (settingError) {
          console.warn("⚠️ 대본 모드 - 전역 설정 읽기 실패:", settingError.message);
        }

        // 대본 모드에서는 프로젝트 생성 없이 직접 영상 폴더에 파일 생성
        if (videoSaveFolder && formData.topic) {
          console.log("🎯 대본 모드 - 파일 생성 경로 설정:", videoSaveFolder);
          console.log("📂 대본 모드 - 프로젝트 폴더 생성 없이 직접 파일 생성 모드");
        } else {
          console.warn("⚠️ 대본 모드 - 영상 폴더 설정이 필요합니다");
        }

        // 1단계: 대본 생성
        addLog("📝 AI 대본 생성 중...");
        const scriptResult = await runGenerate(formData);

        if (scriptResult && scriptResult.scenes && Array.isArray(scriptResult.scenes) && scriptResult.scenes.length > 0) {
          // 2단계 음성 및 자막 생성 시작
          setFullVideoState((prev) => ({
            ...prev,
            currentStep: "audio",
            progress: { ...prev.progress, script: 100, audio: 0 },
          }));

          // 대본 생성 모드: 음성과 자막만 생성 (프로젝트 폴더 구조 사용)
          await generateAudioAndSubtitles(scriptResult, "script_mode", {
            form,
            voices,
            setFullVideoState,
            api,
              addLog,
          });
        } else {
          throw new Error("대본이 생성되지 않았습니다. 먼저 대본을 생성해주세요.");
        }
      } catch (error) {
        console.error("대본 생성 오류:", error);
        setError(error.message);
        console.error(`대본 생성 실패: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [globalSettings, api, getSelectedPromptContent, setDoc, setError, setIsLoading]
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

  const resetFullVideoState = (clearLogs = false) => {
    setFullVideoState(prev => ({
      isGenerating: false,
      mode: "idle",
      currentStep: "idle",
      progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
      results: { script: null, audio: null, images: [], video: null },
      streamingScript: "",
      error: null,
      startTime: null,
      // 로그는 clearLogs가 true일 때만 지우고, 기본적으로는 보존
      logs: clearLogs ? [] : prev.logs,
    }));

    // 예상 생성 결과(doc)도 함께 초기화
    setDoc(null);
    setIsLoading(false);
    console.log("✅ 상태 초기화 완료: fullVideoState + doc + isLoading");
  };

  /**
   * 완전 자동화 영상 생성 함수
   * 4단계: 대본 생성 → 음성 생성 → 이미지 생성 → 영상 합성
   */
  const runFullVideoGeneration = async () => {
    console.log("🚀 runFullVideoGeneration 함수 실행 시작! (AUTOMATION MODE)");
    // 로그는 보존하고 상태만 리셋
    resetFullVideoState(false);
    updateFullVideoState({
      isGenerating: true,
      mode: "automation_mode",
      currentStep: "script",
      startTime: new Date(),
      progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
    });
    console.log("✅ fullVideoState mode가 automation_mode로 설정됨");
    addLog("🎬 완전 자동화 영상 생성을 시작합니다...");

    // 프로젝트 설정 확인 (대본 생성 모드와 동일한 방식)
    addLog("📁 현재 프로젝트 설정 사용 중...");

    try {
      // 전역 설정에서 영상 폴더 경로 가져오기
      addLog("📁 전역 설정에서 영상 폴더 경로 확인 중...");
      let videoSaveFolder = null;

      try {
        const videoFolderSetting = await api.invoke("settings:get", "videoSaveFolder");
        if (videoFolderSetting) {
          videoSaveFolder = videoFolderSetting;
          addLog(`📂 설정된 영상 폴더: ${videoSaveFolder}`);
        } else {
          addLog("⚠️ 전역 설정에 영상 폴더가 설정되지 않음");
        }
      } catch (settingError) {
        addLog(`⚠️ 전역 설정 읽기 실패: ${settingError.message}`, "warning");
      }

      // 현재 폼 설정 확인 및 디버깅
      console.log("🔍 자동화 모드 실행 중 현재 폼 설정:", form);
      console.log("🔍 전역 영상 폴더 설정:", videoSaveFolder);
      addLog(`📋 현재 주제: "${form.topic}"`);
      addLog(`📊 설정된 장면 수: ${form.maxScenes}개`);
      addLog(`⏱️ 설정된 영상 길이: ${form.durationMin}분`);

      // 자동화 모드에서는 설정에서 직접 경로 가져오기
      let projectPaths = null;
      try {
        const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
        const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
        const currentProjectIdResult = await window.api.getSetting("currentProjectId");
        const currentProjectId = currentProjectIdResult?.value || currentProjectIdResult;

        if (videoSaveFolder && currentProjectId) {
          projectPaths = {
            root: videoSaveFolder,
            scripts: `${videoSaveFolder}\\scripts`,
            audio: `${videoSaveFolder}\\audio`,
            images: `${videoSaveFolder}\\images`,
            output: `${videoSaveFolder}\\output`,
            temp: `${videoSaveFolder}\\temp`
          };

          addLog(`🎯 현재 프로젝트: ${currentProjectId}`);
          addLog(`📂 프로젝트 폴더 구조 사용 모드`);
          addLog(`  - 루트: ${projectPaths.root}`);
          addLog(`  - 대본/자막: ${projectPaths.scripts}`);
          addLog(`  - 음성: ${projectPaths.audio}`);
          addLog(`  - 이미지: ${projectPaths.images}`);
          addLog(`  - 영상: ${projectPaths.output}`);
        } else {
          addLog(`⚠️ 프로젝트 설정이 없습니다`, "warning");
          throw new Error("프로젝트 설정이 없습니다.");
        }
      } catch (settingsError) {
        addLog(`❌ 프로젝트 설정 가져오기 실패: ${settingsError.message}`, "error");
        throw new Error("프로젝트 설정을 가져올 수 없습니다.");
      }

      addLog("📝 AI 대본 생성 중...");
      const script = await runGenerate(form);
      if (!script || !script.scenes || script.scenes.length === 0) {
        throw new Error("대본 생성에 실패했습니다.");
      }

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
        // 프로젝트 API가 실패할 경우 videoSaveFolder의 output 폴더 직접 열기
        try {
          await window.electronAPI.project.openOutputFolder();
          addLog("📂 출력 폴더를 열었습니다.", "success");
        } catch (projectError) {
          console.warn("프로젝트 출력 폴더 열기 실패, 대안 시도:", projectError.message);

          // 대안: videoSaveFolder/output 폴더 직접 열기
          const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
          const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

          if (videoSaveFolder) {
            const outputFolder = `${videoSaveFolder}\\output`;
            await api.invoke("shell:openPath", outputFolder);
            addLog("📂 출력 폴더를 열었습니다.", "success");
          } else {
            throw new Error("출력 폴더 경로를 찾을 수 없습니다.");
          }
        }
      } catch (error) {
        addLog("❌ 출력 폴더 열기 실패: " + error.message, "error");
      }

      console.log("🎉 완전 자동화 영상 생성 완료! 출력 폴더를 확인해보세요.");
    } catch (error) {
      updateFullVideoState({
        currentStep: "error",
        failedStep: fullVideoState.currentStep, // 실패한 단계 기록
        error: error.message,
        isGenerating: false,
      });
      addLog(`❌ 오류 발생: ${error.message}`, "error");
      console.error(`영상 생성 실패: ${error.message}`);
    }
  };

  // 컴포넌트 마운트 시 상태 초기화 및 전역 설정 로드
  useEffect(() => {
    // 프로그램 시작 시 항상 깨끗한 상태로 시작 (예상 생성 결과 삭제)
    setDoc(null);
    setIsLoading(false);

    // 영상 생성 상태도 초기화하여 완전한 clean state 보장
    setFullVideoState({
      mode: "idle",
      isGenerating: false,
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

    console.log("✅ ScriptVoiceGenerator 초기 상태 설정 완료 - 예상 생성 결과 삭제됨");

    // localStorage 완전 클리어 - 모든 저장된 상태 삭제
    try {
      localStorage.removeItem("defaultSettings");
      localStorage.removeItem("doc");
      localStorage.removeItem("fullVideoState");
      localStorage.removeItem("scriptGenerator");
      // 관련된 모든 키 삭제
      Object.keys(localStorage).forEach(key => {
        if (key.includes('script') || key.includes('doc') || key.includes('video') || key.includes('generation')) {
          localStorage.removeItem(key);
        }
      });
      console.log("✅ localStorage 완전 클리어 완료");
    } catch (error) {
      console.warn("localStorage 클리어 실패:", error);
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
        <FullVideoProgressPanel fullVideoState={fullVideoState} resetFullVideoState={resetFullVideoState} api={api} />

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
                  onClick={() => {
                    console.log("🎬 완전 자동화 버튼 클릭됨! (automation_mode)");
                    runFullVideoGeneration();
                  }}
                  disabled={(() => {
                    const hasValidTopic = form.topic?.trim();
                    const hasValidReference = form.referenceScript?.trim() && form.referenceScript.trim().length >= 50;
                    const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

                    return fullVideoState.isGenerating ||
                           (!hasValidTopic && !hasValidReference) ||
                           (!isReferenceOnlyMode && !form.promptName);
                  })()}
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

              {/* 설정 정보 표시 */}
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
                {form.topic?.trim() ? (
                  <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.95)", marginBottom: 4 }}>
                    📋 주제: {form.topic}
                  </Text>
                ) : (
                  <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>
                    ⚠️ 영상 주제를 입력해주세요.
                  </Text>
                )}

                {form.promptName ? (
                  <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.8)" }}>
                    🤖 프롬프트: {form.promptName}
                  </Text>
                ) : (
                  <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.9)" }}>
                    ⚠️ 대본 생성 프롬프트를 선택해주세요.
                  </Text>
                )}

                {/* ✅ 레퍼런스 대본 상태 표시 */}
                {form.referenceScript && form.referenceScript.trim() ? (
                  <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                    📜 레퍼런스: 적용됨 ({form.referenceScript.trim().length.toLocaleString()}자)
                  </Text>
                ) : (
                  <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                    📜 레퍼런스: 사용 안함
                  </Text>
                )}
              </div>
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
            <GenerationPreviewCard
              form={form}
              globalSettings={globalSettings}
              doc={doc}
              isGenerating={fullVideoState.isGenerating}
              hasJustCompleted={fullVideoState.currentStep === "completed"}
            />

            {/* 대본만 생성 카드 */}
            <ScriptGenerationCard
              form={form}
              isLoading={isLoading}
              fullVideoState={fullVideoState}
              globalSettings={globalSettings}
              onGenerate={() => {
                console.log("📝 대본 생성 버튼 클릭됨! (script_mode)");
                console.log("🎯 전달되는 form 데이터:", {
                  topic: form.topic,
                  durationMin: form.durationMin,
                  maxScenes: form.maxScenes,
                  promptName: form.promptName
                });
                runScriptMode(form);
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
