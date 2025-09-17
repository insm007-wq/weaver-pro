import React, { useEffect, useState, useCallback } from "react";
import { Text, tokens, Button, Spinner, ProgressBar, Card, CardHeader } from "@fluentui/react-components";
import { useHeaderStyles, useCardStyles, useContainerStyles } from "../../styles/commonStyles";
import {
  DocumentEditRegular,
  VideoRegular,
  MicRegular,
  ImageRegular,
  PlayRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  FolderOpenRegular,
} from "@fluentui/react-icons";
import { ErrorBoundary } from "../common";

// 새로운 모듈들 import
import ScriptGenerationCard from "./parts/ScriptGenerationCard";
import BasicSettingsCard from "./parts/BasicSettingsCard";
import VoiceSettingsCard from "./parts/VoiceSettingsCard";
import GenerationPreviewCard from "./parts/GenerationPreviewCard";
import AdvancedSettingsCard from "./parts/AdvancedSettingsCard";
import { useScriptGeneration } from "../../hooks/useScriptGeneration";
import { useVoiceSettings } from "../../hooks/useVoiceSettings";
import { usePromptSettings } from "../../hooks/usePromptSettings";
import { useApi } from "../../hooks/useApi";

// 상수들을 별도 파일에서 import
import { ADVANCED_PRESETS, makeDefaultForm } from "../../constants/scriptSettings";

function ScriptVoiceGenerator() {
  const headerStyles = useHeaderStyles();
  const cardStyles = useCardStyles();
  const containerStyles = useContainerStyles();

  const [form, setForm] = useState(makeDefaultForm());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [globalSettings, setGlobalSettings] = useState({ llmModel: "anthropic" });

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

  // 실시간 타이핑 시뮬레이션 상태
  const [typingState, setTypingState] = useState({
    currentText: "",
    isTyping: false,
    fullText: "",
  });

  // 커스텀 훅 사용
  const api = useApi();
  const { promptNames, promptLoading } = usePromptSettings();
  const { doc, setDoc, isLoading, error, setIsLoading, setError, getSelectedPromptContent } = useScriptGeneration();
  const { voices, voiceLoading, voiceError, previewVoice, retryVoiceLoad } = useVoiceSettings(form);

  // Toast 추가 (applyPreset에서 사용)
  const toast = {
    success: (message) => console.log("Success:", message),
    error: (message) => console.error("Error:", message),
  };

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
        setTypingState(prev => ({ ...prev, isTyping: false }));
        return;
      }

      setTypingState(prev => ({
        ...prev,
        currentText: text.substring(0, currentIndex + 1),
      }));

      currentIndex++;
    }, 30); // 30ms마다 글자 추가 (ChatGPT와 비슷한 속도)

    return () => clearInterval(typingInterval);
  }, []);

  const stopTypingSimulation = useCallback(() => {
    setTypingState({
      currentText: "",
      isTyping: false,
      fullText: "",
    });
  }, []);

  const applyPreset = (presetName) => {
    const preset = ADVANCED_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setForm((prev) => ({ ...prev, ...preset.settings }));
      setSelectedPreset(presetName);
      toast.success(`${presetName} 프리셋을 적용했습니다.`);
    }
  };

  // 로컬 runGenerate 함수 (전역 설정 사용)
  const runGenerate = useCallback(async (formData) => {
    console.log("🚀 runGenerate 함수 시작!");
    console.log("🚀 formData:", formData);
    console.log("🚀 globalSettings:", globalSettings);

    setError("");
    setIsLoading(true);

    // 타이핑 시뮬레이션 시작
    const simulationText = `📝 대본 생성을 시작합니다...

주제: ${formData.topic || "미정"}
스타일: ${formData.style || "기본"}
길이: ${formData.durationMin || 3}분
AI 모델: ${globalSettings.llmModel || "Anthropic Claude"}

🤖 AI가 대본을 분석하고 생성 중입니다...
📊 구조를 설계하고 있습니다...
✨ 내용을 다듬고 있습니다...

잠시만 기다려주세요...`;

    startTypingSimulation(simulationText);

    try {
      let promptContent = { script: "", reference: "" };
      if (formData.promptName) {
        promptContent = await getSelectedPromptContent(formData.promptName);
      }

      // 유효한 LLM 모델인지 확인 후 설정
      const validLlmModels = ["anthropic", "openai-gpt5mini"];
      const selectedLlm = globalSettings.llmModel && validLlmModels.includes(globalSettings.llmModel)
        ? globalSettings.llmModel
        : "anthropic"; // 기본값

      console.log("🔍 Original LLM:", globalSettings.llmModel);
      console.log("🔍 Valid LLM used:", selectedLlm);

      // 모델이 변경된 경우 사용자에게 알림
      if (globalSettings.llmModel && globalSettings.llmModel !== selectedLlm) {
        toast.success(`지원하지 않는 모델(${globalSettings.llmModel})이 감지되어 ${selectedLlm} 모델로 변경되었습니다.`);
      }

      const payload = {
        llm: selectedLlm,
        type: "auto",
        topic: formData.topic,
        style: formData.style,
        duration: formData.durationMin,
        maxScenes: formData.maxScenes,
        temperature: formData.temperature,
        prompt: promptContent.script || formData.customPrompt,
        referenceText: formData.referenceScript,
        cpmMin: 300,
        cpmMax: 400,
      };

      console.log("🔍 Manual Generation - globalSettings:", globalSettings);
      console.log("🔍 Manual Generation - LLM Model:", globalSettings.llmModel);
      console.log("Manual Generation payload:", payload);

      const res = await api.invoke("llm/generateScript", payload, { timeout: 120000 });
      console.log("Manual Generation API 응답:", res);

      if (res && res.data && res.data.scenes && Array.isArray(res.data.scenes) && res.data.scenes.length > 0) {
        setDoc(res.data);
        toast.success("대본 생성이 완료되었습니다!");

        // 대본 생성 후 음성과 자막 생성
        await generateAudioAndSubtitles(res.data);
      } else {
        throw new Error(`대본 생성 실패: ${JSON.stringify(res)}`);
      }
    } catch (error) {
      console.error("대본 생성 오류:", error);
      setError(error.message);
      toast.error(`대본 생성 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
      stopTypingSimulation(); // 타이핑 시뮬레이션 종료
    }
  }, [globalSettings, api, getSelectedPromptContent, setDoc, setError, setIsLoading, toast, startTypingSimulation, stopTypingSimulation]);

  // 대본 생성 후 음성과 자막을 생성하는 함수
  const generateAudioAndSubtitles = async (scriptData) => {
    try {
      console.log("🎤 음성 및 자막 생성 시작...");

      // TTS 생성
      const audioResult = await api.invoke("tts:synthesize", {
        scenes: scriptData.scenes,
        ttsEngine: form.ttsEngine || "google",
        voiceId: form.voiceId || voices[0]?.id,
        speed: form.speed || "1.0",
      });

      if (audioResult && audioResult.data && audioResult.data.ok) {
        const audioFiles = audioResult.data.audioFiles;
        console.log("✅ 음성 생성 완료:", audioFiles);
        toast.success(`음성 파일 ${audioFiles.length}개가 생성되었습니다!`);

        // 음성 파일들을 하나로 합치기
        if (audioFiles.length > 1) {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const mergedFileName = `merged_audio_${timestamp}.mp3`;
            const outputPathResult = await api.invoke("project:getFilePath", {
              category: "audio",
              filename: mergedFileName,
            });

            if (outputPathResult.success) {
              const audioFilePaths = audioFiles.map(f => f.audioUrl).filter(url => url && url !== "pending");
              const mergeResult = await window.electronAPI.audioMergeFiles({
                audioFiles: audioFilePaths,
                outputPath: outputPathResult.filePath
              });

              if (mergeResult.success) {
                console.log("✅ 음성 파일 합치기 완료:", mergeResult.outputPath);
                toast.success(`통합 음성 파일이 생성되었습니다: ${mergedFileName}`);
              } else {
                console.error("❌ 음성 파일 합치기 실패:", mergeResult.message);
                toast.error(`음성 파일 합치기 실패: ${mergeResult.message}`);
              }
            }
          } catch (error) {
            console.error("❌ 음성 파일 합치기 오류:", error);
            toast.error(`음성 파일 합치기 오류: ${error.message}`);
          }
        }
      }

      // SRT 자막 생성
      try {
        const srtResult = await api.invoke("script/toSrt", {
          doc: scriptData
        });

        if (srtResult && srtResult.srt) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const srtFileName = `subtitles_${timestamp}.srt`;
          const srtPathResult = await api.invoke("project:getFilePath", {
            category: "subtitle",
            filename: srtFileName,
          });

          if (srtPathResult.success) {
            await api.invoke("files:writeText", {
              filePath: srtPathResult.filePath,
              content: srtResult.srt
            });
            console.log("✅ SRT 자막 파일 생성 완료:", srtPathResult.filePath);
            toast.success(`SRT 자막 파일이 생성되었습니다: ${srtFileName}`);
          }
        }
      } catch (error) {
        console.error("❌ SRT 자막 생성 오류:", error);
        toast.error(`SRT 자막 생성 오류: ${error.message}`);
      }

    } catch (error) {
      console.error("음성/자막 생성 오류:", error);
      toast.error(`음성/자막 생성 실패: ${error.message}`);
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


  const generateScriptStep = async () => {
    try {
      let promptContent = { script: "", reference: "" };
      if (form.promptName) {
        promptContent = await getSelectedPromptContent(form.promptName);
      }

      // 유효한 LLM 모델인지 확인 후 설정
      const validLlmModels = ["anthropic", "openai-gpt5mini"];
      const selectedLlm = globalSettings.llmModel && validLlmModels.includes(globalSettings.llmModel)
        ? globalSettings.llmModel
        : "anthropic"; // 기본값

      const payload = {
        llm: selectedLlm,
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

      console.log("🔍 globalSettings:", globalSettings);
      console.log("🔍 LLM Model:", globalSettings.llmModel);
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

        // 음성 파일들을 하나로 합치기
        if (audioFiles.length > 1) {
          try {
            addLog(`🔄 ${audioFiles.length}개 음성 파일을 하나로 합치는 중...`);
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const mergedFileName = `merged_audio_${timestamp}.mp3`;
            const outputPathResult = await api.invoke("project:getFilePath", {
              category: "audio",
              filename: mergedFileName,
            });

            if (outputPathResult.success) {
              const audioFilePaths = audioFiles.map(f => f.audioUrl).filter(url => url && url !== "pending");
              const mergeResult = await window.electronAPI.audioMergeFiles({
                audioFiles: audioFilePaths,
                outputPath: outputPathResult.filePath
              });

              if (mergeResult.success) {
                addLog(`✅ 통합 음성 파일 생성 완료: ${mergedFileName}`);
                // 합쳐진 파일 정보를 audioFiles에 추가
                audioFiles.push({
                  fileName: mergedFileName,
                  audioUrl: outputPathResult.filePath,
                  merged: true
                });
              } else {
                addLog(`❌ 음성 파일 합치기 실패: ${mergeResult.message}`, "error");
              }
            }
          } catch (error) {
            addLog(`❌ 음성 파일 합치기 오류: ${error.message}`, "error");
          }
        }

        // SRT 자막 파일 생성
        try {
          addLog("📝 SRT 자막 파일 생성 중...");
          const srtResult = await api.invoke("script/toSrt", {
            doc: scriptData
          });

          if (srtResult && srtResult.srt) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const srtFileName = `subtitles_${timestamp}.srt`;
            const srtPathResult = await api.invoke("project:getFilePath", {
              category: "subtitle",
              filename: srtFileName,
            });

            if (srtPathResult.success) {
              await api.invoke("files:writeText", {
                filePath: srtPathResult.filePath,
                content: srtResult.srt
              });
              addLog(`✅ SRT 자막 파일 생성 완료: ${srtFileName}`);
            }
          }
        } catch (error) {
          addLog(`❌ SRT 자막 생성 오류: ${error.message}`, "error");
        }

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
    // 대본 생성 중이거나 완성된 대본이 있을 때 표시
    const shouldShow = (fullVideoState.isGenerating && fullVideoState.currentStep === "script") || isLoading || typingState.isTyping || doc;
    if (!shouldShow) return null;

    return (
      <Card
        style={{
          background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 14,
          padding: tokens.spacingVerticalL,
          marginBottom: tokens.spacingVerticalL,
          minHeight: doc ? 600 : 300, // 대본 완성 시 더 큰 높이
          maxHeight: doc ? 700 : 450, // 대본 완성 시 최대 높이 증가
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        <CardHeader style={{ paddingBottom: tokens.spacingVerticalM }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(isLoading || typingState.isTyping) ? (
              <Spinner size="small" appearance="primary" />
            ) : doc ? (
              <CheckmarkCircleRegular style={{ color: tokens.colorPaletteLightGreenForeground1, fontSize: 20 }} />
            ) : null}
            <Text size={500} weight="semibold" style={{ color: doc ? tokens.colorPaletteLightGreenForeground1 : tokens.colorBrandForeground1 }}>
              {doc ? "✅ 대본 생성 완료" : "📝 AI 대본 생성 중..."}
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            {doc
              ? `총 ${doc.scenes?.length || 0}개 장면으로 구성된 대본이 생성되었습니다`
              : `${globalSettings.llmModel === "anthropic" ? "🧠 Anthropic Claude" : "🤖 OpenAI GPT-5 Mini"} 모델이 실시간으로 대본을 생성하고 있습니다`
            }
          </Text>
        </CardHeader>

        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            padding: tokens.spacingVerticalL,
            border: "1px solid rgba(0,0,0,0.04)",
            fontFamily: doc ? "inherit" : "'Consolas', 'Monaco', 'Courier New', monospace",
            fontSize: doc ? "15px" : "14px",
            lineHeight: 1.7,
            minHeight: doc ? 400 : 200, // 대본 완성 시 더 큰 최소 높이
            maxHeight: doc ? 550 : 450, // 대본 완성 시 더 큰 최대 높이
            overflowY: "auto",
            whiteSpace: doc ? "normal" : "pre-wrap",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
          }}
        >
          {doc ? (
            // 완성된 대본 표시
            <div>
              <div style={{ marginBottom: tokens.spacingVerticalL }}>
                <Text size={400} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
                  📖 {doc.title || "생성된 대본"}
                </Text>
              </div>
              {doc.scenes?.map((scene, index) => (
                <div key={index} style={{
                  marginBottom: tokens.spacingVerticalM,
                  paddingBottom: tokens.spacingVerticalM,
                  borderBottom: index < doc.scenes.length - 1 ? `1px solid ${tokens.colorNeutralStroke3}` : 'none'
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: tokens.spacingVerticalXS,
                    gap: 8
                  }}>
                    <Text size={300} weight="semibold" style={{ color: tokens.colorPaletteBlueForeground1 }}>
                      🎬 장면 {index + 1}
                    </Text>
                    {scene.duration && (
                      <Text size={200} style={{
                        color: tokens.colorNeutralForeground3,
                        backgroundColor: tokens.colorNeutralBackground2,
                        padding: "2px 8px",
                        borderRadius: 4
                      }}>
                        {scene.duration}초
                      </Text>
                    )}
                  </div>
                  <Text style={{ lineHeight: 1.6 }}>
                    {scene.text}
                  </Text>
                </div>
              ))}
            </div>
          ) : (
            // 생성 중 표시
            <>
              {typingState.currentText || `대본 생성 준비 중...\n\n주제: ${form.topic || "미정"}\n스타일: ${form.style || "기본"}\n길이: ${form.durationMin || 3}분\n\n🤖 AI가 곧 대본 생성을 시작합니다...`}
              {(isLoading || typingState.isTyping) && (
                <span
                  style={{
                    animation: "blink 1s infinite",
                    marginLeft: 2,
                    fontSize: "16px",
                    color: tokens.colorBrandForeground1,
                    fontWeight: "bold",
                  }}
                >
                  █
                </span>
              )}
            </>
          )}
        </div>
      </Card>
    );
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
                console.log("🔥 Form data:", form);
                console.log("🔥 Global settings:", globalSettings);
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
