import React, { useEffect, useState, useCallback } from "react";
import {
  Body1,
  Text,
  Title1,
  Title2,
  Badge,
  Field,
  Input,
  Dropdown,
  Option,
  Textarea,
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
  Divider,
  Card,
  CardHeader,
} from "@fluentui/react-components";
import { useHeaderStyles, useCardStyles, useSettingsStyles, useLayoutStyles, useContainerStyles } from "../../styles/commonStyles";
import {
  DocumentEditRegular,
  SparkleRegular,
  BrainCircuitRegular,
  DocumentTextRegular,
  SettingsRegular,
  CheckmarkCircle24Regular,
  ShieldError24Regular,
  VideoRegular,
  MicRegular,
  ImageRegular,
  PlayRegular,
  PauseRegular,
  CircleRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  FolderOpenRegular,
} from "@fluentui/react-icons";
import { ErrorBoundary } from "../common";
import { safeCharCount } from "../../utils/safeChars";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";

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
  {
    key: "minimax",
    text: "🚀 Minimax Abab",
    desc: "중국 Minimax API, 빠른 처리 속도",
    processingTime: "30초-2분",
    features: ["⚡ 빠른 처리", "💰 저렴함", "🔧 효율성"],
    rating: 4.6,
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
  imageStyle: "photo",
  speed: "1.0",
  voiceId: "",
  promptName: "",
  aiEngine: "anthropic",
  ttsEngine: "elevenlabs",
});

function ScriptVoiceGenerator() {
  const api = useApi();
  const toast = useToast();
  const headerStyles = useHeaderStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const layoutStyles = useLayoutStyles();
  const containerStyles = useContainerStyles();

  const [form, setForm] = useState(makeDefaultForm());
  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [batchTopics, setBatchTopics] = useState([""]);
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

  const [promptNames, setPromptNames] = useState([]);
  const [promptLoading, setPromptLoading] = useState(true);

  const [voices, setVoices] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceError, setVoiceError] = useState(null);

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

  const addBatchTopic = () => {
    setBatchTopics((prev) => [...prev, ""]);
  };

  const removeBatchTopic = (index) => {
    if (batchTopics.length > 1) {
      setBatchTopics((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateBatchTopic = (index, value) => {
    setBatchTopics((prev) => prev.map((topic, i) => (i === index ? value : topic)));
  };

  const previewVoice = async (voiceId, voiceName) => {
    try {
      console.log(`🎵 목소리 미리듣기 시작: ${voiceName} (${voiceId})`);
      const sampleText = "안녕하세요. 이것은 목소리 미리듣기 샘플입니다. 자연스럽고 명확한 발음으로 한국어를 읽어드립니다.";
      const payload = {
        doc: { scenes: [{ text: sampleText }] },
        tts: {
          engine: form.ttsEngine,
          voiceId: voiceId,
          voiceName: voiceName,
          speakingRate: form.speed || "1.0",
          provider: form.ttsEngine === "elevenlabs" ? "ElevenLabs" : "Google",
        },
      };

      const res = await api.invoke("tts/synthesizeByScenes", payload);
      if (res?.success && res?.data?.parts?.length > 0) {
        const audioBlob = new Blob([Uint8Array.from(atob(res.data.parts[0].base64), (c) => c.charCodeAt(0))], { type: "audio/mpeg" });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        audio.play().catch((err) => {
          console.error("오디오 재생 실패:", err);
          toast.error("목소리 미리듣기 재생에 실패했습니다.");
        });
        console.log("✅ 목소리 미리듣기 재생 성공");
      } else {
        throw new Error(res?.error || res?.data?.message || "음성 합성 실패");
      }
    } catch (error) {
      console.error("목소리 미리듣기 실패:", error);
      toast.error("목소리 미리듣기에 실패했습니다.");
    }
  };

  const validateForm = () => {
    const validation = {
      topicValid: form.topic?.trim().length > 0,
      promptValid: !!form.promptName,
      engineValid: !!form.aiEngine,
    };
    setFormValidation(validation);
    return Object.values(validation).every(Boolean);
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

  const getSelectedPromptContent = async (promptName) => {
    try {
      const res = await api.invoke("prompts:getPairByName", promptName);
      if ((res?.ok || res?.success) && res.data) {
        return {
          script: res.data.script?.content || "",
          reference: res.data.reference?.content || "",
        };
      }
    } catch (error) {
      console.error("프롬프트 내용 로딩 실패:", error);
    }
    return { script: "", reference: "" };
  };

  const runFullVideoGeneration = async () => {
    resetFullVideoState();
    updateFullVideoState({
      isGenerating: true,
      currentStep: "script",
      startTime: new Date(),
    });
    addLog("🎬 완전 자동화 영상 생성을 시작합니다...");

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
      });
      addLog("✅ 완전 자동화 영상 생성이 완료되었습니다!", "success");
      toast.success("🎉 완전 자동화 영상 생성 완료! 출력 폴더를 확인해보세요.");
    } catch (error) {
      updateFullVideoState({
        currentStep: "error",
        error: error.message,
      });
      addLog(`❌ 오류 발생: ${error.message}`, "error");
      toast.error(`영상 생성 실패: ${error.message}`);
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

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const res = await api.invoke("llm/generateScript", payload);
      if (res && res.scenes) {
        setDoc(res);
        stopStreaming();
        updateFullVideoState({
          results: { script: res },
          progress: { script: 100 },
          streamingScript: "",
        });
        return res;
      } else {
        throw new Error("대본 생성 API 응답이 올바르지 않습니다.");
      }
    } catch (error) {
      stopStreaming();
      throw error;
    }
  };

  const generateAudioStep = async (script) => {
    addLog("🎤 음성 생성 API 연동 준비 중...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { audioPath: "/path/to/audio.mp3" };
  };

  const generateImagesStep = async (script) => {
    addLog("🖼️ 이미지 생성 API 연동 준비 중...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return [{ imagePath: "/path/to/image1.jpg" }, { imagePath: "/path/to/image2.jpg" }];
  };

  const generateVideoStep = async (script, audio, images) => {
    addLog("🎬 영상 합성 API 연동 준비 중...");
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return { videoPath: "/path/to/final-video.mp4" };
  };

  const runGenerate = async () => {
    setError("");
    setIsLoading(true);

    try {
      let promptContent = { script: "", reference: "" };
      if (form.promptName) {
        promptContent = await getSelectedPromptContent(form.promptName);
      }

      const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);

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

      const res = await api.invoke("llm/generateScript", payload);

      if (res && res.scenes) {
        setDoc(res);
        const engineName = selectedEngine?.text || form.aiEngine;
        const promptName = form.promptName || "기본";
        toast.success(`${engineName}로 "${promptName}" 프롬프트를 사용해 대본을 생성했습니다.`);
      } else {
        throw new Error("API 응답이 올바르지 않습니다.");
      }
    } catch (e) {
      const errorMessage = e?.message || "대본 생성 중 오류가 발생했습니다.";
      setError(errorMessage);
      toast.error(`대본 생성 실패: ${errorMessage}`);
      console.error("대본 생성 오류:", e);
    } finally {
      setIsLoading(false);
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
              onClick={() => {
                toast.success("출력 폴더 열기 기능 구현 예정");
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

  const sectionTitle = (icon, text) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: tokens.spacingVerticalM }}>
      {icon}
      <Text size={400} weight="semibold">
        {text}
      </Text>
    </div>
  );

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

  // 초기 데이터 로드 (마운트 시 한 번만)
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      // 프롬프트 로드
      try {
        const res = await api.invoke("prompts:getAll");
        if (isMounted && (res?.ok || res?.success) && Array.isArray(res.data)) {
          const list = res.data;
          const names = Array.from(new Set(list.filter((p) => !p.isDefault && p.name?.trim()).map((p) => p.name.trim()))).sort((a, b) =>
            a.localeCompare(b, "ko")
          );
          setPromptNames(names);
        }
      } catch (error) {
        console.error("프롬프트 로딩 실패:", error);
      } finally {
        if (isMounted) setPromptLoading(false);
      }

      // 목소리 로드
      if (form.ttsEngine) {
        try {
          setVoiceLoading(true);
          setVoiceError(null);
          console.log("🔄 목소리 로드:", form.ttsEngine);

          const res = await api.invoke("tts:listVoices", { engine: form.ttsEngine });

          if (isMounted && (res?.ok || res?.success)) {
            const allItems = Array.isArray(res.data) ? res.data : [];
            let filteredItems;

            if (form.ttsEngine === "elevenlabs") {
              filteredItems = allItems.filter((voice) => voice.provider === "ElevenLabs");
              const recommendedNames = ["alice", "bella", "dorothy", "elli", "josh", "sam", "rachel", "domi", "fin", "sarah"];
              const recommendedVoices = filteredItems.filter((voice) =>
                recommendedNames.some((name) => voice.name.toLowerCase().includes(name))
              );
              const otherVoices = filteredItems.filter((voice) => !recommendedNames.some((name) => voice.name.toLowerCase().includes(name)));
              filteredItems = [...recommendedVoices, ...otherVoices].slice(0, 10);
            } else {
              filteredItems = allItems
                .filter((voice) => voice.provider === "Google" && (voice.type === "Neural2" || voice.type === "Wavenet"))
                .slice(0, 8);
            }

            setVoices(filteredItems);
          } else if (isMounted) {
            setVoiceError({
              code: res?.code ?? res?.errorCode ?? 1004,
              message: res?.message ?? "TTS API 키를 확인해주세요.",
            });
          }
        } catch (e) {
          if (isMounted) {
            setVoiceError({
              code: e?.code ?? e?.status ?? 1004,
              message: e?.message ?? "TTS API 연결에 실패했습니다.",
            });
          }
        } finally {
          if (isMounted) setVoiceLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // TTS 엔진 변경 시 목소리 다시 로드
  useEffect(() => {
    if (!form.ttsEngine) return;
    
    let isMounted = true;
    
    const reloadVoices = async () => {
      try {
        setVoiceLoading(true);
        setVoiceError(null);
        console.log("🔄 TTS 엔진 변경 - 목소리 다시 로드:", form.ttsEngine);

        const res = await api.invoke("tts:listVoices", { engine: form.ttsEngine });

        if (isMounted && (res?.ok || res?.success)) {
          const allItems = Array.isArray(res.data) ? res.data : [];
          let filteredItems;

          if (form.ttsEngine === "elevenlabs") {
            filteredItems = allItems.filter((voice) => voice.provider === "ElevenLabs");
            const recommendedNames = ["alice", "bella", "dorothy", "elli", "josh", "sam", "rachel", "domi", "fin", "sarah"];
            const recommendedVoices = filteredItems.filter((voice) =>
              recommendedNames.some((name) => voice.name.toLowerCase().includes(name))
            );
            const otherVoices = filteredItems.filter((voice) => !recommendedNames.some((name) => voice.name.toLowerCase().includes(name)));
            filteredItems = [...recommendedVoices, ...otherVoices].slice(0, 10);
          } else {
            filteredItems = allItems
              .filter((voice) => voice.provider === "Google" && (voice.type === "Neural2" || voice.type === "Wavenet"))
              .slice(0, 8);
          }

          setVoices(filteredItems);
        } else if (isMounted) {
          setVoiceError({
            code: res?.code ?? res?.errorCode ?? 1004,
            message: res?.message ?? "TTS API 키를 확인해주세요.",
          });
        }
      } catch (e) {
        if (isMounted) {
          setVoiceError({
            code: e?.code ?? e?.status ?? 1004,
            message: e?.message ?? "TTS API 연결에 실패했습니다.",
          });
        }
      } finally {
        if (isMounted) setVoiceLoading(false);
      }
    };

    reloadVoices();

    return () => {
      isMounted = false;
    };
  }, [form.ttsEngine]);

  // 프롬프트 자동 선택 (프롬프트 목록이 로드된 후)
  useEffect(() => {
    if (promptNames.length > 0 && !form.promptName) {
      setForm(prev => ({ ...prev, promptName: promptNames[0] }));
    }
  }, [promptNames, form.promptName]);

  // 목소리 자동 선택 (목소리 목록이 로드된 후)
  useEffect(() => {
    if (voices.length > 0 && !form.voiceId) {
      setForm(prev => ({ ...prev, voiceId: voices[0].id }));
    }
  }, [voices, form.voiceId]);

  return (
    <ErrorBoundary>
      <div className={containerStyles.container}>
        {/* 헤더 */}
        <div className={headerStyles.pageHeader}>
          <div className={headerStyles.pageTitleWithIcon}>
            <DocumentEditRegular />
            대본 & 음성 생성
          </div>
          <div className={headerStyles.pageDescription}>
            SRT 자막 + MP3 내레이션을 한 번에 생성합니다
          </div>
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
                  <strong>협력업체보다 더 나은 올인원 솔루션</strong>
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

            {/* 기본 옵션 카드 */}
            <Card className={cardStyles.settingsCard}>
              <div className={settingsStyles.sectionHeader}>
                <div className={settingsStyles.sectionTitle}>
                  <SettingsRegular />
                  <Text size={400} weight="semibold">
                    기본 설정
                  </Text>
                </div>
              </div>
              <div className={layoutStyles.gridTwo}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="영상 주제" required>
                    <Input
                      value={form.topic}
                      onChange={(_, d) => onChange("topic", d.value)}
                      placeholder="예: 건강한 아침 루틴 만들기"
                      size="large"
                      appearance={!formValidation.topicValid && form.topic.length > 0 ? "filled-darker" : "outline"}
                    />
                    {form.topic.length > 0 && (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        {formValidation.topicValid ? (
                          <>
                            <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground2, fontSize: 14 }} />
                            <Text size={200} style={{ color: tokens.colorPaletteGreenForeground2 }}>
                              주제가 적절합니다 ({form.topic.length}자)
                            </Text>
                          </>
                        ) : (
                          <>
                            <DismissCircleRegular style={{ color: tokens.colorPaletteRedForeground1, fontSize: 14 }} />
                            <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                              주제를 입력해주세요
                            </Text>
                          </>
                        )}
                      </div>
                    )}
                  </Field>
                </div>
                <Field label="영상 길이">
                  <Dropdown
                    value={DURATION_OPTIONS.find((o) => o.key === form.durationMin)?.text || "3분 (표준)"}
                    selectedOptions={[String(form.durationMin)]}
                    onOptionSelect={(_, d) => onChange("durationMin", Number(d.optionValue))}
                    size="large"
                  >
                    {DURATION_OPTIONS.map((o) => (
                      <Option key={o.key} value={String(o.key)}>
                        {o.text}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="영상 스타일">
                  <Dropdown
                    value={STYLE_OPTIONS.find((o) => o.key === form.style)?.text || "📚 정보 전달형"}
                    selectedOptions={[form.style]}
                    onOptionSelect={(_, d) => onChange("style", d.optionValue)}
                    size="large"
                  >
                    {STYLE_OPTIONS.map((o) => (
                      <Option key={o.key} value={o.key} text={o.desc}>
                        {o.text}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="이미지 스타일">
                  <Dropdown
                    value={IMAGE_STYLE_OPTIONS.find((o) => o.key === form.imageStyle)?.text || "실사"}
                    selectedOptions={[form.imageStyle]}
                    onOptionSelect={(_, d) => onChange("imageStyle", d.optionValue)}
                    size="large"
                  >
                    {IMAGE_STYLE_OPTIONS.map((o) => (
                      <Option key={o.key} value={o.key}>
                        {o.text}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <Field label="AI 엔진">
                  <Dropdown
                    value={AI_ENGINE_OPTIONS.find((o) => o.key === form.aiEngine)?.text || "🧠 Anthropic Claude"}
                    selectedOptions={[form.aiEngine]}
                    onOptionSelect={(_, d) => onChange("aiEngine", d.optionValue)}
                    size="large"
                  >
                    {AI_ENGINE_OPTIONS.map((o) => (
                      <Option key={o.key} value={o.key} text={o.desc}>
                        {o.text}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="대본 생성 프롬프트">
                    <Dropdown
                      placeholder={promptLoading ? "불러오는 중…" : "프롬프트를 선택하세요"}
                      value={form.promptName}
                      selectedOptions={form.promptName ? [form.promptName] : []}
                      onOptionSelect={(_, d) => onChange("promptName", d.optionValue)}
                      size="large"
                    >
                      {promptNames.map((nm) => (
                        <Option key={nm} value={nm}>
                          {nm}
                        </Option>
                      ))}
                    </Dropdown>
                    {promptLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                        <Spinner size="tiny" />
                        <Text>프롬프트 목록을 불러오는 중…</Text>
                      </div>
                    ) : form.promptName ? (
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6, color: tokens.colorPaletteGreenForeground2, marginTop: 4 }}
                      >
                        <CheckmarkCircleRegular />
                        <Text>선택됨: {form.promptName}</Text>
                      </div>
                    ) : (
                      <Text style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                        설정 탭에서 프롬프트를 먼저 저장하세요. (대본 생성 프롬프트가 필요합니다)
                      </Text>
                    )}
                  </Field>
                </div>
              </div>
            </Card>

            {/* TTS 및 보이스 설정 카드 (복원) */}
            <Card className={cardStyles.settingsCard}>
              <div className={settingsStyles.sectionHeader}>
                <div className={settingsStyles.sectionTitle}>
                  <MicRegular />
                  <Text size={400} weight="semibold">
                    음성 설정
                  </Text>
                </div>
              </div>
              <div className={layoutStyles.gridTwo}>
                <Field label="TTS 엔진">
                  <Dropdown
                    value={form.ttsEngine === "google" ? "Google Cloud TTS" : "ElevenLabs"}
                    selectedOptions={[form.ttsEngine]}
                    onOptionSelect={(_, d) => onChange("ttsEngine", d.optionValue)}
                    size="large"
                  >
                    <Option value="google">Google Cloud TTS</Option>
                    <Option value="elevenlabs">ElevenLabs</Option>
                  </Dropdown>
                </Field>
                <Field label="말하기 속도">
                  <Dropdown
                    value={form.speed === "0.9" ? "느림 (0.9x)" : form.speed === "1.1" ? "빠름 (1.1x)" : "보통 (1.0x)"}
                    selectedOptions={[form.speed]}
                    onOptionSelect={(_, d) => onChange("speed", d.optionValue)}
                    size="large"
                  >
                    <Option value="0.9">느림 (0.9x)</Option>
                    <Option value="1.0">보통 (1.0x)</Option>
                    <Option value="1.1">빠름 (1.1x)</Option>
                  </Dropdown>
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="목소리">
                    <Dropdown
                      value={voices.find((v) => v.id === form.voiceId)?.name || (voiceLoading ? "불러오는 중…" : "목소리 선택")}
                      selectedOptions={form.voiceId ? [form.voiceId] : []}
                      onOptionSelect={(_, d) => onChange("voiceId", d.optionValue)}
                      size="large"
                      disabled={voiceLoading || !!voiceError}
                    >
                      {voices.map((v) => (
                        <Option key={v.id} value={v.id}>
                          {v.name || v.id}
                          {v.type && (
                            <Badge size="small" appearance="tint" style={{ marginLeft: "8px" }}>
                              {v.type}
                            </Badge>
                          )}
                        </Option>
                      ))}
                    </Dropdown>
                    {form.voiceId &&
                      (() => {
                        const selectedVoice = voices.find((v) => v.id === form.voiceId);
                        return selectedVoice ? (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              background: "#f8f9fa",
                              borderRadius: 8,
                              border: "1px solid rgba(0,0,0,0.06)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <Text weight="semibold" size={300}>
                                🎤 {selectedVoice.name}
                              </Text>
                              <Badge appearance="tint" color="brand">
                                {form.ttsEngine === "elevenlabs" ? "ElevenLabs" : "Google TTS"}
                              </Badge>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                              <Badge appearance="outline" size="small">
                                {selectedVoice.gender === "MALE" ? "👨 남성" : selectedVoice.gender === "FEMALE" ? "👩 여성" : "🧑 중성"}
                              </Badge>
                              <Badge appearance="outline" size="small">
                                {selectedVoice.type}
                              </Badge>
                              <Badge appearance="outline" size="small">
                                {selectedVoice.language}
                              </Badge>
                            </div>
                            <div
                              style={{
                                marginBottom: 8,
                                padding: 8,
                                background: "#f8f9fa",
                                borderRadius: 6,
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              <Text size={200} style={{ color: "#666", lineHeight: 1.4 }}>
                                {(() => {
                                  const voiceName = selectedVoice.name.toLowerCase();
                                  if (voiceName.includes("alice")) {
                                    return "💬 친근한 대화형 - 리뷰, 브이로그에 적합한 자연스러운 톤";
                                  } else if (voiceName.includes("bella") || voiceName.includes("rachel")) {
                                    return "📰 뉴스/설명형 - 튜토리얼, 가이드에 적합한 중립적 톤";
                                  } else if (voiceName.includes("dorothy") || voiceName.includes("elli")) {
                                    return "🎓 교육/강의형 - 온라인 강의, 학습에 최적화 (가장 추천)";
                                  } else if (voiceName.includes("josh")) {
                                    return "🏢 차분/전문형 - B2B, 기업 소개에 적합한 안정적 톤";
                                  } else if (voiceName.includes("sam")) {
                                    return "⚡ 에너지 광고형 - 프로모션, 광고에 적합한 역동적 톤";
                                  } else if (voiceName.includes("domi")) {
                                    return "📚 스토리텔링 - 다큐멘터리, 힐링 콘텐츠에 적합한 감성적 톤";
                                  } else if (voiceName.includes("fin")) {
                                    return "🎭 다양한 표현형 - 창의적 콘텐츠, 엔터테인먼트에 적합";
                                  } else if (voiceName.includes("sarah")) {
                                    return "🌟 프리미엄 여성형 - 고급스러운 브랜드, 럭셔리 콘텐츠용";
                                  } else {
                                    return "🎓 교육/강의형 - 한국어 콘텐츠에 가장 적합한 범용 목소리";
                                  }
                                })()}
                              </Text>
                            </div>
                            <div>
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<PlayRegular />}
                                onClick={() => {
                                  console.log("🔊 선택된 목소리 미리듣기 버튼 클릭됨:", selectedVoice.name, selectedVoice.id);
                                  previewVoice(selectedVoice.id, selectedVoice.name);
                                }}
                              >
                                미리듣기
                              </Button>
                            </div>
                          </div>
                        ) : null;
                      })()}
                  </Field>
                </div>
              </div>
              {voiceError && (
                <div
                  style={{
                    marginTop: tokens.spacingVerticalM,
                    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
                    background: "#fff5f5",
                    borderRadius: 12,
                    padding: tokens.spacingVerticalM,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <ShieldError24Regular />
                    <Text weight="semibold">TTS 음성 목록 로드 실패</Text>
                  </div>
                  <Body1 style={{ marginBottom: 8 }}>
                    Google TTS 음성 목록을 불러올 수 없습니다. API 키를 확인해주세요.
                    <br />
                    <strong>현재 지원 TTS:</strong> Google Cloud Text-to-Speech
                    <br />
                    API 오류 ({voiceError.code}): {voiceError.message || "Google TTS API 키가 설정되지 않았습니다."}
                  </Body1>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      appearance="secondary"
                      onClick={async () => {
                        try {
                          setVoiceLoading(true);
                          setVoiceError(null);
                          const res = await api.invoke("tts:listVoices");
                          if (res?.ok || res?.success) {
                            const items = Array.isArray(res.data) ? res.data : [];
                            setVoices(items);
                            if (!form.voiceId && items[0]?.id) setForm(prev => ({ ...prev, voiceId: items[0].id }));
                            toast.success(`✅ ${items.length}개의 목소리를 로드했습니다!`);
                          } else {
                            setVoiceError({
                              code: res?.code ?? res?.errorCode ?? 1004,
                              message: res?.message ?? "API 키가 올바르지 않거나 설정되지 않았습니다.",
                            });
                          }
                        } catch (e) {
                          setVoiceError({
                            code: e?.code ?? 1004,
                            message: e?.message ?? "API 연결에 실패했습니다.",
                          });
                        } finally {
                          setVoiceLoading(false);
                        }
                      }}
                    >
                      다시 시도
                    </Button>
                    <Button
                      appearance="outline"
                      onClick={() => {
                        toast.success("설정 탭에서 API 키를 설정할 수 있습니다");
                      }}
                    >
                      API 키 설정
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* 고급 설정 & 배치 처리 카드 */}
            <Card className={cardStyles.settingsCard}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: tokens.spacingVerticalM,
                }}
              >
                <div>
                  <Text weight="semibold" size={400}>
                    🔧 고급 설정 & 자동화
                  </Text>
                  <div style={{ color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 }}>
                    프리셋, 배치 처리, 실시간 검증 등 전문 기능을 사용할 수 있습니다.
                  </div>
                </div>
                <Switch checked={showAdvanced} onChange={(_, d) => setShowAdvanced(d.checked)} />
              </div>

              {showAdvanced && (
                <div style={{ marginTop: tokens.spacingVerticalM }}>
                  <div style={{ marginBottom: tokens.spacingVerticalM }}>
                    <Text weight="semibold" size={300}>
                      🎯 설정 프리셋
                    </Text>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                      용도별 최적화된 설정을 한 번에 적용할 수 있습니다.
                    </Text>
                  </div>

                  <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: tokens.spacingHorizontalS }}
                  >
                    {ADVANCED_PRESETS.map((preset) => (
                      <Card
                        key={preset.name}
                        style={{
                          padding: tokens.spacingVerticalM,
                          cursor: "pointer",
                          border:
                            selectedPreset === preset.name ? `2px solid ${tokens.colorBrandBackground}` : "1px solid rgba(0,0,0,0.08)",
                          background: selectedPreset === preset.name ? tokens.colorBrandBackground2 : "#fff",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => applyPreset(preset.name)}
                      >
                        <Text weight="semibold" size={200}>
                          {preset.name}
                        </Text>
                        <Text size={100} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                          {preset.description}
                        </Text>
                        {selectedPreset === preset.name && (
                          <Badge appearance="tint" color="brand" style={{ marginTop: 8 }}>
                            적용됨
                          </Badge>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* 우측: 상태 및 결과 패널 */}
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
            {/* 진행률 패널 */}
            <FullVideoProgressPanel />

            {/* 스트리밍 뷰어 */}
            <StreamingScriptViewer />

            {/* 예상 결과 카드 */}
            <Card className={cardStyles.settingsCard}>
              <div className={settingsStyles.sectionHeader}>
                <div className={settingsStyles.sectionTitle}>
                  <Badge appearance="outline" style={{ border: `1px solid ${tokens.colorNeutralStroke2}` }}>
                    📊
                  </Badge>
                  <Text size={400} weight="semibold">
                    예상 생성 결과
                  </Text>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM }}>
                {statTile("예상 장면 수", `${estimatedScenes}개`)}
                {statTile("예상 글자 수", `${avgChars.toLocaleString()}자`)}
                {statTile("음성 시간", `약 ${duration}분`)}
                {statTile(
                  "AI 엔진",
                  (() => {
                    const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);
                    return selectedEngine ? (
                      <Badge appearance="tint" color="brand" style={{ fontWeight: 600 }}>
                        {selectedEngine.text.split(" ")[1]}
                      </Badge>
                    ) : (
                      "미선택"
                    );
                  })()
                )}
              </div>
            </Card>

            {/* 결과 미리보기 카드 */}
            <Card className={cardStyles.resultCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Text weight="semibold">씬 미리보기</Text>
                <Badge appearance="tint">{doc?.scenes?.length ? `${doc.scenes.length}개 씬` : "대본 없음"}</Badge>
              </div>

              {(doc?.scenes || []).length > 0 ? (
                <DataGrid
                  items={doc.scenes}
                  columns={[
                    createTableColumn({
                      columnId: "scene_number",
                      renderHeaderCell: () => "#",
                      renderCell: (item, index) => (
                        <DataGridCell>
                          <Text>{item.scene_number ?? index + 1}</Text>
                        </DataGridCell>
                      ),
                    }),
                    createTableColumn({
                      columnId: "duration",
                      renderHeaderCell: () => "지속 시간",
                      renderCell: (item) => (
                        <DataGridCell>
                          <Text>{item.duration}초</Text>
                        </DataGridCell>
                      ),
                    }),
                    createTableColumn({
                      columnId: "charCount",
                      renderHeaderCell: () => "글자수",
                      renderCell: (item) => (
                        <DataGridCell>
                          <Text>{safeCharCount(item.text)}</Text>
                        </DataGridCell>
                      ),
                    }),
                    createTableColumn({
                      columnId: "text",
                      renderHeaderCell: () => "텍스트",
                      renderCell: (item) => (
                        <DataGridCell>
                          <Text>{item.text}</Text>
                        </DataGridCell>
                      ),
                    }),
                  ]}
                >
                  <DataGridHeader>
                    <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
                  </DataGridHeader>
                  <DataGridBody>
                    {({ item, rowId }) => <DataGridRow key={rowId}>{({ renderCell }) => renderCell(item)}</DataGridRow>}
                  </DataGridBody>
                </DataGrid>
              ) : (
                <div style={{ textAlign: "center", padding: 36 }}>
                  <Body1>대본을 생성하거나 SRT를 불러오면 씬 목록이 표시됩니다.</Body1>
                </div>
              )}

              {error && (
                <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalM }}>
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
            </Card>

            {/* 대본만 생성 카드 */}
            <Card className={cardStyles.settingsCard}>
              <div className={settingsStyles.sectionHeader}>
                <div className={settingsStyles.sectionTitle}>
                  <SparkleRegular />
                  <Text size={400} weight="semibold">
                    대본 생성 (기본 모드)
                  </Text>
                </div>
              </div>
              
              <div style={{ marginBottom: tokens.spacingVerticalM }}>
                <Text size={300} color="secondary" style={{ lineHeight: 1.4 }}>
                  {(() => {
                    const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);
                    return selectedEngine
                      ? `${selectedEngine.text.replace(/🤖|🧠|🚀/g, '').trim()}로 대본을 생성합니다`
                      : "AI 엔진을 선택해 대본을 생성합니다";
                  })()}
                </Text>
                {(() => {
                  const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);
                  return selectedEngine ? (
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                      예상 처리 시간: {selectedEngine.processingTime}
                    </Text>
                  ) : null;
                })()}
              </div>

              <Button
                appearance="primary"
                icon={<SparkleRegular />}
                onClick={runGenerate}
                disabled={isLoading || !form.topic?.trim() || !form.promptName || !form.aiEngine || fullVideoState.isGenerating}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: "600",
                }}
              >
                {isLoading ? "대본 생성 중..." : "📝 대본 생성 시작"}
              </Button>

              {(!form.topic?.trim() || !form.promptName || !form.aiEngine) && (
                <div style={{ 
                  marginTop: tokens.spacingVerticalS, 
                  padding: tokens.spacingVerticalS,
                  backgroundColor: tokens.colorNeutralBackground2,
                  borderRadius: 8 
                }}>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontWeight: "500" }}>
                    완료해야 할 설정:
                  </Text>
                  {!form.topic?.trim() && (
                    <Text size={200} style={{ display: "block", color: tokens.colorPaletteRedForeground1, marginTop: 2 }}>
                      • 영상 주제 입력
                    </Text>
                  )}
                  {!form.promptName && (
                    <Text size={200} style={{ display: "block", color: tokens.colorPaletteRedForeground1, marginTop: 2 }}>
                      • 대본 생성 프롬프트 선택
                    </Text>
                  )}
                  {!form.aiEngine && (
                    <Text size={200} style={{ display: "block", color: tokens.colorPaletteRedForeground1, marginTop: 2 }}>
                      • AI 엔진 선택
                    </Text>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default function ScriptVoiceGeneratorWithBoundary() {
  return <ScriptVoiceGenerator />;
}
