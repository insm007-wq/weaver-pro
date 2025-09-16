import React, { useEffect, useState, useCallback } from "react";
import {
  Body1,
  Text,
  Badge,
  Field,
  Input,
  Dropdown,
  Option,
  Switch,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridCell,
  DataGridBody,
  createTableColumn,
  MessageBar,
  MessageBarBody,
  tokens,
  Button,
  Spinner,
  ProgressBar,
  Card,
  CardHeader,
} from "@fluentui/react-components";
import { useHeaderStyles, useCardStyles, useSettingsStyles, useLayoutStyles, useContainerStyles } from "../../styles/commonStyles";
import {
  DocumentEditRegular,
  SettingsRegular,
  VideoRegular,
  MicRegular,
  ImageRegular,
  PlayRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  FolderOpenRegular,
} from "@fluentui/react-icons";
import { ErrorBoundary } from "../common";
import { safeCharCount } from "../../utils/safeChars";

// 새로운 모듈들 import
import ScriptGenerationCard from "./parts/ScriptGenerationCard";
import BasicSettingsCard from "./parts/BasicSettingsCard";
import VoiceSettingsCard from "./parts/VoiceSettingsCard";
import GenerationPreviewCard from "./parts/GenerationPreviewCard";
import ScenePreviewCard from "./parts/ScenePreviewCard";
import AdvancedSettingsCard from "./parts/AdvancedSettingsCard";
import { useScriptGeneration } from "../../hooks/useScriptGeneration";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { usePromptSettings } from "../../hooks/usePromptSettings";
import { useApi } from "../../hooks/useApi";

// 옵션 데이터는 기존 코드를 그대로 사용
const STYLE_OPTIONS = [
  { key: "informative", text: "📚 정보 전달형", desc: "교육적이고 명확한 설명" },
  { key: "engaging", text: "🎯 매력적인", desc: "흥미롭고 재미있는 톤" },
  { key: "professional", text: "💼 전문적인", desc: "비즈니스에 적합한 스타일" },
  { key: "casual", text: "😊 캐주얼한", desc: "친근하고 편안한 분위기" },
  { key: "dramatic", text: "🎭 극적인", desc: "강렬하고 임팩트 있는 전개" },
  { key: "storytelling", text: "📖 스토리텔링", desc: "이야기 형식의 구성" },
];

const DURATION_OPTIONS = [
  { key: 1, text: "1분 (초단편)" },
  { key: 2, text: "2분 (단편)" },
  { key: 3, text: "3분 (표준)" },
  { key: 5, text: "5분 (중편)" },
  { key: 8, text: "8분 (장편)" },
  { key: 10, text: "10분 (긴편)" },
];

const IMAGE_STYLE_OPTIONS = [
  { key: "photo", text: "실사" },
  { key: "illustration", text: "일러스트" },
  { key: "cinematic", text: "시네마틱" },
  { key: "sketch", text: "스케치" },
];

const AI_ENGINE_OPTIONS = [
  {
    key: "openai-gpt5mini",
    text: "🤖 OpenAI GPT-5 Mini",
    desc: "최신 GPT-5 모델, 롱폼 대본 최적화",
    processingTime: "2-5분",
    features: ["📝 긴 대본 생성", "🎯 정확성", "🔄 일관성"],
    rating: 4.8,
  },
  {
    key: "anthropic",
    text: "🧠 Anthropic Claude",
    desc: "Claude Sonnet/Haiku, 정확하고 자연스러운 문체",
    processingTime: "1-3분",
    features: ["✨ 자연스런 문체", "🎪 창의성", "📚 교육적"],
    rating: 4.9,
  },
];

const ADVANCED_PRESETS = [
  {
    name: "🎯 유튜브 최적화",
    description: "유튜브 알고리즘에 최적화된 설정",
    settings: {
      style: "engaging",
      durationMin: 8,
      maxScenes: 12,
      temperature: 1.1,
      imageStyle: "cinematic",
    },
  },
  {
    name: "📚 교육 컨텐츠",
    description: "교육용 영상에 최적화된 설정",
    settings: {
      style: "informative",
      durationMin: 5,
      maxScenes: 8,
      temperature: 0.9,
      imageStyle: "illustration",
    },
  },
  {
    name: "💼 비즈니스 프레젠테이션",
    description: "기업 발표용 영상 설정",
    settings: {
      style: "professional",
      durationMin: 3,
      maxScenes: 6,
      temperature: 0.8,
      imageStyle: "photo",
    },
  },
  {
    name: "🎪 엔터테인먼트",
    description: "재미있고 매력적인 콘텐츠 설정",
    settings: {
      style: "dramatic",
      durationMin: 2,
      maxScenes: 10,
      temperature: 1.2,
      imageStyle: "cinematic",
    },
  },
];

const makeDefaultForm = () => ({
  topic: "",
  style: "informative",
  durationMin: 3,
  maxScenes: 15,
  temperature: 1.0,
  customPrompt: "",
  referenceScript: "",
  showReferenceScript: false,
  imageStyle: "photo",
  speed: "1.0",
  voiceId: "",
  promptName: "",
  aiEngine: "anthropic",
  ttsEngine: "elevenlabs",
});

function ScriptVoiceGenerator() {
  const headerStyles = useHeaderStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const layoutStyles = useLayoutStyles();
  const containerStyles = useContainerStyles();

  const [form, setForm] = useState(makeDefaultForm());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [formValidation, setFormValidation] = useState({
    topicValid: true,
    promptValid: true,
    engineValid: true,
  });

  const [fullVideoState, setFullVideoState] = useState({
    isGenerating: false,
    currentStep: "idle",
    progress: {
      script: 0,
      audio: 0,
      images: 0,
      video: 0,
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

  // 커스텀 훅 사용
  const api = useApi();
  const { promptNames, promptLoading } = usePromptSettings();
  const { doc, setDoc, isLoading, error, runGenerate, getSelectedPromptContent } = useScriptGeneration();
  const { voices, voiceLoading, voiceError, previewVoice, retryVoiceLoad } = useVoiceSettings(form);

  // Toast 추가 (applyPreset에서 사용)
  const toast = {
    success: (message) => console.log("Success:", message),
    error: (message) => console.error("Error:", message),
  };

  const onChange = useCallback((k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === "topic") {
      setFormValidation((prev) => ({ ...prev, topicValid: v?.trim().length > 0 }));
    }
  }, []);

  const applyPreset = (presetName) => {
    const preset = ADVANCED_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setForm((prev) => ({ ...prev, ...preset.settings }));
      setSelectedPreset(presetName);
      toast.success(`${presetName} 프리셋을 적용했습니다.`);
    }
  };

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
      currentStep: "idle",
      progress: { script: 0, audio: 0, images: 0, video: 0 },
      results: { script: null, audio: null, images: [], video: null },
      streamingScript: "",
      error: null,
      startTime: null,
      logs: [],
    });
  };

  const runFullVideoGeneration = async () => {
    resetFullVideoState();
    updateFullVideoState({
      isGenerating: true,
      currentStep: "script",
      startTime: new Date(),
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
          aiEngine: form.aiEngine,
        },
      });

      if (!projectResult.success) {
        throw new Error(`프로젝트 생성 실패: ${projectResult.message}`);
      }

      // 프로젝트 데이터 안전한 접근 (중첩 구조 처리)
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
      const script = await generateScriptStep();

      updateFullVideoState({ currentStep: "audio", progress: { script: 100 } });
      addLog("🎤 음성 생성 중...");
      const audio = await generateAudioStep(script);

      updateFullVideoState({ currentStep: "images", progress: { audio: 100 } });
      addLog("🖼️ 이미지 생성 중...");
      const images = await generateImagesStep(script);

      updateFullVideoState({ currentStep: "video", progress: { images: 100 } });
      addLog("🎬 영상 합성 중...");
      const video = await generateVideoStep(script, audio, images);

      updateFullVideoState({
        currentStep: "complete",
        progress: { video: 100 },
        results: { script, audio, images, video },
        isGenerating: false, // 생성 완료 시 false로 설정
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

      // 5초 후 자동으로 초기화 상태로 돌아가기
      setTimeout(() => {
        resetFullVideoState();
      }, 5000);
    } catch (error) {
      updateFullVideoState({
        currentStep: "error",
        error: error.message,
        isGenerating: false, // 에러 발생 시에도 false로 설정
      });
      addLog(`❌ 오류 발생: ${error.message}`, "error");
      toast.error(`영상 생성 실패: ${error.message}`);

      // 에러 상태에서도 10초 후 초기화
      setTimeout(() => {
        resetFullVideoState();
      }, 10000);
    }
  };

  const simulateStreamingScript = () => {
    const fullScript = `# ${form.topic}

🎬 영상 대본 생성 중...

## 장면 1: 오프닝
안녕하세요! 오늘은 "${form.topic}"에 대해서 알아보겠습니다. 
이 영상을 끝까지 보시면 많은 도움이 될 거예요.

## 장면 2: 메인 내용
${form.topic}의 핵심은 바로 이것입니다...
실제로 많은 사람들이 이런 방법으로 성공을 거두고 있어요.

## 장면 3: 구체적 예시
예를 들어서 설명드리면...
이런 경우에는 어떻게 해야 할지 함께 알아보죠.

## 장면 4: 실용적 팁
지금 바로 적용할 수 있는 실용적인 팁을 알려드릴게요.
첫 번째 팁은...

## 장면 5: 마무리
오늘 영상 어떠셨나요? 
구독과 좋아요는 저에게 큰 힘이 됩니다!`;

    let currentText = "";
    let index = 0;

    const typeInterval = setInterval(() => {
      if (index < fullScript.length) {
        currentText += fullScript[index];
        updateFullVideoState({
          streamingScript: currentText,
          progress: { script: Math.round((index / fullScript.length) * 100) },
        });
        index++;
      } else {
        clearInterval(typeInterval);
        updateFullVideoState({
          progress: { script: 100 },
        });
      }
    }, 30);

    return () => clearInterval(typeInterval);
  };

  const generateScriptStep = async () => {
    const stopStreaming = simulateStreamingScript();

    try {
      let promptContent = { script: "", reference: "" };
      if (form.promptName) {
        promptContent = await getSelectedPromptContent(form.promptName);
      }

      const payload = {
        llm: form.aiEngine,
        type: "auto",
        topic: form.topic,
        style: form.style,
        duration: form.durationMin,
        maxScenes: form.maxScenes,
        temperature: form.temperature,
        prompt: promptContent.script || form.customPrompt,
        referenceText: form.referenceScript,
        cpmMin: 300,
        cpmMax: 400,
      };

      console.log("전송할 payload:", payload); // 디버그 로그 추가

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const res = await api.invoke("llm/generateScript", payload, { timeout: 120000 }); // 2분 타임아웃
      console.log("🔍 API 응답 확인:", res); // 디버그 로그 추가
      console.log("🔍 응답 타입:", typeof res);
      console.log("🔍 응답 키들:", Object.keys(res || {}));
      console.log("🔍 scenes 존재:", res?.scenes);
      console.log("🔍 scenes 타입:", typeof res?.scenes);
      console.log("🔍 scenes 길이:", res?.scenes?.length);

      // 만약 다른 필드명을 사용하고 있다면 확인
      if (res && !res.scenes) {
        console.log("🔍 scenes 대신 다른 필드들:");
        console.log("- data:", res.data);
        console.log("- result:", res.result);
        console.log("- script:", res.script);
        console.log("- content:", res.content);
      }

      if (res && res.data && res.data.scenes && Array.isArray(res.data.scenes) && res.data.scenes.length > 0) {
        setDoc(res.data);
        stopStreaming();
        updateFullVideoState({
          results: { script: res.data },
          progress: { script: 100 },
          streamingScript: "",
        });
        return res.data;
      } else {
        console.error("❌ 대본 생성 실패 상세:");
        console.error("- res가 존재하는가?", !!res);
        console.error("- res.scenes가 존재하는가?", !!res?.scenes);
        console.error("- scenes가 배열인가?", Array.isArray(res?.scenes));
        console.error("- scenes 길이:", res?.scenes?.length);
        console.error("- 전체 응답 구조:", JSON.stringify(res, null, 2));

        throw new Error(`대본 생성 API 응답이 올바르지 않습니다. 응답: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      stopStreaming();
      throw error;
    }
  };

  const generateAudioStep = async (scriptData) => {
    addLog("🎤 음성 생성 중...");

    try {
      if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
        throw new Error("대본 데이터가 없습니다.");
      }

      // TTS 엔진과 음성 설정 확인
      const ttsEngine = form.ttsEngine || "elevenlabs";
      const voiceId = form.voiceId;

      if (!voiceId) {
        throw new Error("음성을 선택해주세요.");
      }

      addLog(`🎙️ ${ttsEngine} 엔진으로 음성 생성 시작...`);

      // 각 장면별로 음성 생성 (긴 타임아웃 설정)
      addLog(`🔄 ${scriptData.scenes.length}개 장면의 음성 생성 중... (예상 시간: ${Math.ceil(scriptData.scenes.length * 2)}초)`);

      // TTS 진행률 리스너 설정 (단순화)
      let ttsProgressListener = null;
      try {
        ttsProgressListener = (data) => {
          const { current, total, progress } = data;
          setFullVideoState((prev) => ({
            ...prev,
            progress: { ...prev.progress, audio: progress },
          }));
          addLog(`🎤 음성 생성 진행률: ${current + 1}/${total} (${progress}%)`);
        };

        if (window.electronAPI?.on) {
          window.electronAPI.on("tts:progress", ttsProgressListener);
        }
      } catch (listenerError) {
        console.warn("TTS 진행률 리스너 설정 실패:", listenerError);
      }

      let audioResult;
      try {
        audioResult = await api.invoke(
          "tts:synthesize",
          {
            scenes: scriptData.scenes,
            ttsEngine: ttsEngine,
            voiceId: voiceId,
            speed: form.speed || "1.0",
          },
          {
            timeout: Math.max(60000, scriptData.scenes.length * 10000), // 최소 60초, 장면당 10초 추가
          }
        );

        // 중첩된 응답 구조 처리
        const ttsData = audioResult.data || audioResult;

        if (!ttsData.ok) {
          console.error("TTS 응답 상세:", audioResult);
          const errorMsg = ttsData.error || audioResult.error || audioResult.message || "알 수 없는 오류";
          throw new Error(`음성 생성 실패: ${errorMsg}`);
        }

        console.log("TTS 성공 응답:", audioResult);
        console.log("TTS 데이터:", ttsData);

        addLog(`✅ 음성 생성 완료: ${ttsData.audioFiles?.length || 0}개 파일`);

        // TTS에서 이미 파일 저장이 완료되었으므로 바로 audioFiles 반환
        const audioFiles = ttsData.audioFiles || [];

        if (audioFiles.length === 0) {
          throw new Error("생성된 음성 파일이 없습니다.");
        }

        addLog(`💾 음성 파일들: ${audioFiles.map((f) => f.fileName).join(", ")}`);

        return audioFiles;
      } catch (ttsError) {
        throw ttsError;
      } finally {
        // 진행률 리스너 제거 (성공/실패 관계없이)
        try {
          if (ttsProgressListener && window.electronAPI?.off) {
            window.electronAPI.off("tts:progress", ttsProgressListener);
          }
        } catch (cleanupError) {
          console.warn("TTS 진행률 리스너 정리 실패:", cleanupError);
        }
      }
    } catch (error) {
      addLog(`❌ 음성 생성 실패: ${error.message}`, "error");
      throw error;
    }
  };

  const generateImagesStep = async (scriptData) => {
    addLog("🖼️ 이미지 생성 중...");

    try {
      if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
        throw new Error("대본 데이터가 없습니다.");
      }

      const images = [];
      const total = scriptData.scenes.length;

      for (let i = 0; i < scriptData.scenes.length; i++) {
        const scene = scriptData.scenes[i];
        const sceneNum = i + 1;

        addLog(`🎨 이미지 ${sceneNum}/${total} 생성 중...`);

        // visual_description이 있으면 사용, 없으면 text 기반으로 프롬프트 생성
        const imagePrompt =
          scene.visual_description || `${scene.text.substring(0, 100)}을 표현하는 ${form.imageStyle || "photo"} 스타일 이미지`;

        try {
          // Replicate API를 사용한 이미지 생성
          addLog(`🎨 Replicate로 이미지 생성: "${imagePrompt}"`);

          const imageResult = await api.invoke("replicate:generate", {
            prompt: imagePrompt,
            style: form.imageStyle || "photo",
            width: 1920,
            height: 1080,
            aspectRatio: "16:9",
          });

          console.log(`🔍 Replicate 응답 (장면 ${sceneNum}):`, imageResult);

          // Replicate 응답 구조 확인
          const isSuccess = imageResult.ok || imageResult.success;
          const imageUrls = imageResult.images || [];

          if (isSuccess && imageUrls.length > 0) {
            const imageUrl = imageUrls[0]; // 첫 번째 이미지 사용
            // 프로젝트 폴더에 이미지 파일명 생성
            const imageFileName = `scene_${String(sceneNum).padStart(3, "0")}.jpg`;
            const imagePathResult = await api.invoke("project:getFilePath", {
              category: "images",
              filename: imageFileName,
            });

            if (imagePathResult.success) {
              images.push({
                sceneIndex: i,
                sceneNumber: sceneNum,
                imagePath: imagePathResult.filePath,
                imageUrl: imageUrl, // Replicate에서 받은 실제 URL
                prompt: imagePrompt,
                fileName: imageFileName,
                provider: "Replicate",
              });

              addLog(`✅ 이미지 ${sceneNum} 생성 완료: ${imageUrl}`);
            } else {
              addLog(`❌ 이미지 ${sceneNum} 경로 생성 실패: ${imagePathResult.message}`, "error");
            }
          } else {
            const errorMsg = imageResult.message || "알 수 없는 오류";
            addLog(`❌ 이미지 ${sceneNum} 생성 실패: ${errorMsg}`, "error");
            console.error(`Replicate 실패 상세 (장면 ${sceneNum}):`, {
              success: isSuccess,
              imageCount: imageUrls.length,
              fullResponse: imageResult,
            });
          }
        } catch (error) {
          addLog(`⚠️ 이미지 ${sceneNum} 생성 오류: ${error.message}`, "warning");
          images.push({
            sceneIndex: i,
            sceneNumber: sceneNum,
            imagePath: null,
            imageUrl: null,
            prompt: imagePrompt,
            error: error.message,
          });
        }

        // 진행률 업데이트
        const progress = Math.round((sceneNum / total) * 100);
        updateFullVideoState({
          progress: { ...fullVideoState.progress, images: progress },
        });
      }

      addLog(`✅ 이미지 생성 완료: ${images.filter((img) => img.imageUrl).length}/${total}개 성공`);
      return images;
    } catch (error) {
      addLog(`❌ 이미지 생성 실패: ${error.message}`, "error");
      throw error;
    }
  };

  const generateVideoStep = async (scriptData, audioFiles, imageFiles) => {
    try {
      addLog("🎬 FFmpeg 영상 합성 시작...");

      // 프로젝트 매니저에서 출력 파일 경로 생성
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const videoFileName = `video_${timestamp}.mp4`;
      const videoPathResult = await api.invoke("project:getFilePath", {
        category: "output",
        filename: videoFileName,
      });

      if (!videoPathResult.success) {
        throw new Error("출력 파일 경로 생성 실패: " + videoPathResult.message);
      }

      const outputPath = videoPathResult.filePath;
      addLog(`📁 출력 경로: ${outputPath}`);

      // 유효한 파일들만 필터링
      const validAudioFiles = audioFiles.filter((audio) => audio.audioUrl && audio.audioUrl !== "pending").map((audio) => audio.audioUrl);

      const validImageFiles = imageFiles.filter((img) => img.imageUrl && img.imageUrl !== "pending").map((img) => img.imageUrl);

      if (validAudioFiles.length === 0) {
        throw new Error("생성된 음성 파일이 없습니다.");
      }

      if (validImageFiles.length === 0) {
        throw new Error("생성된 이미지 파일이 없습니다.");
      }

      addLog(`🎵 음성 파일: ${validAudioFiles.length}개`);
      addLog(`🖼️ 이미지 파일: ${validImageFiles.length}개`);

      // FFmpeg 진행률 리스너 설정
      const removeProgressListener = window.electronAPI.onceAny("ffmpeg:progress", (progress) => {
        setFullVideoState((prev) => ({
          ...prev,
          progress: { ...prev.progress, video: Math.round(progress) },
        }));
        addLog(`📹 영상 합성 진행률: ${Math.round(progress)}%`);
      });

      // FFmpeg 영상 합성 실행
      const result = await window.electronAPI.ffmpeg.compose({
        audioFiles: validAudioFiles,
        imageFiles: validImageFiles,
        outputPath: outputPath,
        options: {
          fps: 24,
          videoCodec: "libx264",
          audioCodec: "aac",
          crf: 18,
          preset: "medium",
        },
      });

      // 진행률 리스너 제거
      if (removeProgressListener) removeProgressListener();

      if (!result.success) {
        throw new Error(result.message || "영상 합성 실패");
      }

      addLog(`✅ 영상 합성 완료: ${result.videoPath}`);
      addLog(`📊 영상 정보: ${result.duration ? Math.round(result.duration) + "초" : "정보 없음"}`);

      return {
        videoPath: result.videoPath,
        duration: result.duration,
        size: result.size,
      };
    } catch (error) {
      addLog(`❌ 영상 합성 실패: ${error.message}`, "error");
      throw error;
    }
  };

  const ProgressStepComponent = ({ step, currentStep, progress, title, icon, isCompleted, hasError }) => {
    const isActive = currentStep === step;
    const isPast =
      ["script", "audio", "images", "video", "complete"].indexOf(currentStep) >
      ["script", "audio", "images", "video", "complete"].indexOf(step);

    const getStepColor = () => {
      if (hasError) return tokens.colorPaletteRedBackground1;
      if (isCompleted || isPast) return tokens.colorPaletteLightGreenBackground1;
      if (isActive) return tokens.colorPaletteBlueBackground1;
      return tokens.colorNeutralBackground3;
    };

    const getIconColor = () => {
      if (hasError) return tokens.colorPaletteRedForeground1;
      if (isCompleted || isPast) return tokens.colorPaletteLightGreenForeground1;
      if (isActive) return tokens.colorPaletteBlueForeground1;
      return tokens.colorNeutralForeground3;
    };

    const stepProgress = progress[step] || 0;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: isActive || isPast || isCompleted ? 1 : 0.6,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            backgroundColor: getStepColor(),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${getIconColor()}`,
            position: "relative",
          }}
        >
          {hasError ? (
            <DismissCircleRegular style={{ fontSize: 24, color: getIconColor() }} />
          ) : isCompleted || isPast ? (
            <CheckmarkCircleRegular style={{ fontSize: 24, color: getIconColor() }} />
          ) : isActive ? (
            <Spinner size="medium" />
          ) : (
            React.createElement(icon, { style: { fontSize: 24, color: getIconColor() } })
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <Text size={300} weight={isActive ? "semibold" : "regular"} style={{ color: getIconColor() }}>
            {title}
          </Text>
          {isActive && stepProgress > 0 && (
            <div style={{ width: 80, marginTop: 4 }}>
              <ProgressBar value={stepProgress / 100} />
              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                {stepProgress}%
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  };

  const FullVideoProgressPanel = () => {
    if (!fullVideoState.isGenerating && fullVideoState.currentStep === "idle") return null;

    const steps = [
      { key: "script", title: "대본 생성", icon: DocumentEditRegular },
      { key: "audio", title: "음성 생성", icon: MicRegular },
      { key: "images", title: "이미지 생성", icon: ImageRegular },
      { key: "video", title: "영상 합성", icon: VideoRegular },
    ];

    const getElapsedTime = () => {
      if (!fullVideoState.startTime) return "0초";
      const elapsed = Math.floor((new Date() - fullVideoState.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
    };

    return (
      <Card
        style={{
          background:
            fullVideoState.currentStep === "complete"
              ? tokens.colorPaletteLightGreenBackground1
              : fullVideoState.currentStep === "error"
              ? tokens.colorPaletteRedBackground1
              : "#fff",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
          borderRadius: 14,
          padding: tokens.spacingVerticalL,
          marginBottom: tokens.spacingVerticalL,
        }}
      >
        <CardHeader style={{ paddingBottom: tokens.spacingVerticalM }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Text size={500} weight="semibold">
                🎬 완전 자동화 영상 생성
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                {fullVideoState.currentStep === "complete"
                  ? `✅ 완료! (총 소요시간: ${getElapsedTime()})`
                  : fullVideoState.currentStep === "error"
                  ? `❌ 오류 발생 (${getElapsedTime()} 경과)`
                  : `🔄 진행 중... (${getElapsedTime()} 경과)`}
              </Text>
            </div>
            {fullVideoState.isGenerating && (
              <Button appearance="secondary" size="small" onClick={resetFullVideoState}>
                취소
              </Button>
            )}
          </div>
        </CardHeader>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: tokens.spacingVerticalL,
            padding: tokens.spacingVerticalM,
            backgroundColor: tokens.colorNeutralBackground1,
            borderRadius: 12,
          }}
        >
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <ProgressStepComponent
                step={step.key}
                currentStep={fullVideoState.currentStep}
                progress={fullVideoState.progress}
                title={step.title}
                icon={step.icon}
                isCompleted={
                  ["script", "audio", "images", "video"].indexOf(fullVideoState.currentStep) >
                    ["script", "audio", "images", "video"].indexOf(step.key) || fullVideoState.currentStep === "complete"
                }
                hasError={fullVideoState.currentStep === "error"}
              />
              {index < steps.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: tokens.colorNeutralStroke2,
                    margin: "0 16px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      backgroundColor:
                        ["script", "audio", "images", "video"].indexOf(fullVideoState.currentStep) > index
                          ? tokens.colorPaletteLightGreenForeground1
                          : tokens.colorNeutralStroke2,
                      transition: "all 0.3s ease",
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {fullVideoState.logs.length > 0 && (
          <div
            style={{
              backgroundColor: tokens.colorNeutralBackground2,
              borderRadius: 8,
              padding: tokens.spacingVerticalS,
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            <Text size={300} weight="semibold" style={{ marginBottom: 8 }}>
              📋 진행 로그
            </Text>
            {fullVideoState.logs.slice(-5).map((log, index) => (
              <div key={index} style={{ marginBottom: 4 }}>
                <Text
                  size={200}
                  style={{
                    color:
                      log.type === "error"
                        ? tokens.colorPaletteRedForeground1
                        : log.type === "success"
                        ? tokens.colorPaletteLightGreenForeground1
                        : tokens.colorNeutralForeground2,
                  }}
                >
                  [{log.timestamp}] {log.message}
                </Text>
              </div>
            ))}
          </div>
        )}

        {fullVideoState.currentStep === "complete" && fullVideoState.results.video && (
          <div
            style={{
              marginTop: tokens.spacingVerticalM,
              display: "flex",
              gap: tokens.spacingHorizontalM,
            }}
          >
            <Button
              appearance="primary"
              icon={<FolderOpenRegular />}
              onClick={async () => {
                try {
                  const result = await api.invoke("project:openOutputFolder");
                  if (result.success) {
                    toast.success("출력 폴더를 열었습니다.");
                  } else {
                    toast.error(`폴더 열기 실패: ${result.message}`);
                  }
                } catch (error) {
                  toast.error(`오류: ${error.message}`);
                }
              }}
            >
              출력 폴더 열기
            </Button>
            <Button
              appearance="secondary"
              icon={<PlayRegular />}
              onClick={() => {
                toast.success("영상 재생 기능 구현 예정");
              }}
            >
              영상 재생
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const StreamingScriptViewer = () => {
    if (!fullVideoState.isGenerating || fullVideoState.currentStep !== "script") return null;

    return (
      <Card
        style={{
          background: "#f8f9fa",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 14,
          padding: tokens.spacingVerticalL,
          marginBottom: tokens.spacingVerticalL,
          minHeight: 300,
        }}
      >
        <CardHeader style={{ paddingBottom: tokens.spacingVerticalM }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Spinner size="small" />
            <Text size={500} weight="semibold">
              📝 실시간 대본 생성 중...
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            ChatGPT 스타일로 실시간 타이핑 효과를 보여줍니다
          </Text>
        </CardHeader>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            padding: tokens.spacingVerticalM,
            border: "1px solid rgba(0,0,0,0.04)",
            fontFamily: "monospace",
            fontSize: "14px",
            lineHeight: 1.6,
            minHeight: 200,
            maxHeight: 400,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {fullVideoState.streamingScript || "대본 생성을 시작합니다..."}
          <span
            style={{
              animation: "blink 1s infinite",
              marginLeft: 2,
              fontSize: "16px",
            }}
          >
            |
          </span>
        </div>
      </Card>
    );
  };

  const statTile = (label, value) => (
    <div
      style={{
        textAlign: "center",
        padding: tokens.spacingVerticalM,
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
      }}
    >
      <Text size={200} color="secondary" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text weight="semibold" size={400}>
          {value}
        </Text>
      ) : (
        value
      )}
    </div>
  );

  const duration = form.durationMin || 3;
  const avgChars = Math.floor((duration * 300 + duration * 400) / 2);
  const estimatedScenes = Math.min(form.maxScenes || 15, Math.max(3, Math.ceil(duration * 2)));

  // 프롬프트 자동 선택 (프롬프트 목록이 로드된 후)
  useEffect(() => {
    if (promptNames.length > 0 && !form.promptName) {
      setForm((prev) => ({ ...prev, promptName: promptNames[0] }));
    }
  }, [promptNames, form.promptName]);

  // 목소리 자동 선택 (목소리 목록이 로드된 후)
  useEffect(() => {
    if (voices.length > 0 && !form.voiceId) {
      setForm((prev) => ({ ...prev, voiceId: voices[0].id }));
    }
  }, [voices, form.voiceId]);

  // FFmpeg 설치 확인
  useEffect(() => {
    const checkFFmpeg = async () => {
      try {
        const result = await window.electronAPI.ffmpeg.check();
        if (!result.installed) {
          addLog("⚠️ FFmpeg가 설치되지 않았습니다. 영상 합성이 불가능할 수 있습니다.", "warning");
          addLog("💡 FFmpeg 설치 방법: https://ffmpeg.org/download.html", "info");
        } else {
          addLog("✅ FFmpeg 설치 확인됨", "success");
        }
      } catch (error) {
        addLog("❌ FFmpeg 확인 실패: " + error.message, "error");
      }
    };

    checkFFmpeg();
  }, []);

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
        <FullVideoProgressPanel />

        {/* 스트리밍 뷰어 */}
        <StreamingScriptViewer />

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: tokens.spacingHorizontalXL }}>
          {/* 좌측: 메인 설정 영역 */}
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
            {/* 완전 자동화 섹션 (새로운 디자인) */}
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
                  disabled={fullVideoState.isGenerating || !form.topic?.trim() || !form.promptName || !form.aiEngine}
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

              {(!form.topic?.trim() || !form.promptName || !form.aiEngine) && (
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
                  {!form.aiEngine && (
                    <Text size={200} style={{ display: "block", color: "rgba(255,255,255,0.9)" }}>
                      ⚠️ AI 엔진을 선택해주세요.
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
            <GenerationPreviewCard form={form} aiEngineOptions={AI_ENGINE_OPTIONS} />

            {/* 씬 미리보기 카드 */}
            <ScenePreviewCard doc={doc} error={error} />

            {/* 대본만 생성 카드 */}
            <ScriptGenerationCard form={form} isLoading={isLoading} fullVideoState={fullVideoState} onGenerate={() => runGenerate(form)} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function ScriptVoiceGeneratorWithBoundary() {
  return <ScriptVoiceGenerator />;
}
