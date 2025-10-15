import React, { useState, useCallback, useEffect, useRef } from "react";
import { Text, Button, Card, Badge, Avatar, Input, Textarea } from "@fluentui/react-components";
import {
  DocumentTextRegular,
  ClockRegular,
  AutoFitWidthRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  VideoRegular,
  ImageRegular,
  SpeakerMuteRegular,
  SpeakerOffRegular,
  ArrowDownloadRegular,
} from "@fluentui/react-icons";
import { ensureSceneDefaults } from "../../../utils/scenes";
import { assignVideosToScenes, assignMediaToScenes, assignVideosWithDownload, assignImagesToMissingScenes, assignVideosToMissingScenes, assignPhotosToMissingScenes, assignPrioritizedMediaToMissingScenes } from "../../../services/videoAssignment";
import { showError, showSuccess, showInfo } from "../../common/GlobalToast";
import { isVideoFile, isImageFile } from "../../../utils/fileHelpers";
import BottomFixedBar from "../../common/BottomFixedBar";

function SceneList({
  scenes,
  setScenes,
  selectedSceneIndex,
  onSceneSelect,
}) {
  // 내부 편집 상태 관리
  const [editingSceneIndex, setEditingSceneIndex] = useState(-1);
  const [editingText, setEditingText] = useState("");
  const [editingStartTime, setEditingStartTime] = useState("");
  const [editingEndTime, setEditingEndTime] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // 미디어 자동 생성 상태
  const [mediaGenerationState, setMediaGenerationState] = useState({
    isActive: false,
    phase: "idle", // "idle" | "video" | "image" | "completed" | "error"
    current: 0,
    total: 0,
    message: "",
    videoCount: 0,
    imageCount: 0,
    currentScene: null,
  });

  // 영상 자동 할당 상태 (다운로드 포함)
  const [videoAssignState, setVideoAssignState] = useState({
    isActive: false,
    phase: "idle", // "idle" | "local" | "download" | "completed" | "error"
    current: 0,
    total: 0,
    message: "",
    assignedCount: 0,
    downloadedCount: 0,
    currentScene: null,
  });

  // 컨텍스트 메뉴 상태
  const [contextMenuSceneIndex, setContextMenuSceneIndex] = useState(-1);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  // 드래그 앤 드롭 상태
  const [dragOverSceneIndex, setDragOverSceneIndex] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);

  // 미리듣기 상태
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [currentPreviewAudio, setCurrentPreviewAudio] = useState(null);

  // TTS 설정 상태
  const [ttsSettings, setTtsSettings] = useState({
    ttsEngine: "google",
    voice: "ko-KR-Standard-A",
    speed: "1.0",
    pitch: "-1"
  });

  // 음성 파일 duration 상태
  const [audioDurations, setAudioDurations] = useState({});

  // 씬 카드 refs (자동 스크롤용)
  const sceneRefs = useRef([]);

  // 선택된 씬으로 자동 스크롤
  useEffect(() => {
    if (selectedSceneIndex >= 0 && sceneRefs.current[selectedSceneIndex]) {
      sceneRefs.current[selectedSceneIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedSceneIndex]);

  // 시간 포맷 헬퍼
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 시간 문자열을 초로 변환하는 헬퍼 함수
  const timeStringToSeconds = (timeStr) => {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    return minutes * 60 + seconds;
  };

  // VREW 스타일 편집 핸들러들
  const handleStartEditText = useCallback((index) => {
    const scene = scenes[index];
    setEditingSceneIndex(index);
    setEditingText(scene.text || "");
    setEditingStartTime(formatTime(scene.start));
    setEditingEndTime(formatTime(scene.end));
  }, [scenes]);

  const handleCancelEdit = useCallback(() => {
    setEditingSceneIndex(-1);
    setEditingText("");
    setEditingStartTime("");
    setEditingEndTime("");
  }, []);

  // SRT 파일 업데이트 함수
  const updateSrtFile = useCallback(async (updatedScenes) => {
    try {
      // videoSaveFolder 경로 가져오기
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

      if (!videoSaveFolder) {
        console.warn("videoSaveFolder를 찾을 수 없습니다.");
        return;
      }

      // SRT 생성을 위한 데이터 구성
      const doc = { scenes: updatedScenes };

      // SRT 생성 API 호출
      const result = await window.api.invoke("script/toSrt", { doc });

      if (result?.success && result?.data?.srt) {
        // SRT 파일 경로 구성
        const srtFilePath = `${videoSaveFolder}\\scripts\\subtitle.srt`;

        // scripts 디렉토리 생성 (없는 경우)
        await window.api.invoke("fs:mkDirRecursive", { dirPath: `${videoSaveFolder}\\scripts` }).catch(() => {});

        // SRT 파일 저장
        await window.api.invoke("files:writeText", { filePath: srtFilePath, content: result.data.srt });

        console.log(`✅ SRT 파일 업데이트 완료: ${srtFilePath}`);
      }
    } catch (error) {
      console.error("❌ SRT 파일 업데이트 실패:", error);
    }
  }, []);

  // 개별 씬 TTS 재생성 핸들러
  const regenerateSceneTTS = useCallback(async (sceneIndex, sceneText) => {
    try {
      // 입력 유효성 검사
      if (!sceneText || sceneText.trim().length === 0) {
        throw new Error("생성할 텍스트가 비어있습니다.");
      }

      if (sceneIndex < 0 || sceneIndex >= scenes.length) {
        throw new Error("잘못된 씬 인덱스입니다.");
      }

      const voiceSettings = {
        voiceId: ttsSettings.voice,
        speakingRate: parseFloat(ttsSettings.speed),
        pitch: parseFloat(ttsSettings.pitch),
        volumeGainDb: 2.0
      };

      // 새로운 단일 씬 TTS API 호출 (사용자 설정 사용)
      const result = await window.api.ttsRegenerateScene({
        sceneIndex: sceneIndex,
        sceneText: sceneText,
        voiceSettings: voiceSettings
      });

      if (result?.ok && result?.audioFile) {
        const audioFile = result.audioFile;

        // 새로 생성된 음성 파일의 duration 가져오기
        let newDuration = null;
        try {
          const durationResult = await window.api.invoke("audio:getDuration", { filePath: audioFile.audioUrl });
          if (durationResult?.success) {
            newDuration = durationResult.duration;
            setAudioDurations(prev => ({
              ...prev,
              [sceneIndex]: newDuration
            }));
          }
        } catch (error) {
          console.error("음성 파일 길이 가져오기 실패:", error);
        }

        // 씬 데이터에 audioPath 추가/업데이트 + 시간 자동 조정
        const updatedScenes = [...scenes];
        const currentScene = updatedScenes[sceneIndex];

        // 이전 씬의 end 시간 (시작 기준점)
        const prevSceneEnd = sceneIndex > 0 ? updatedScenes[sceneIndex - 1].end : 0;

        // 새 음성 길이에 맞게 시간 업데이트
        const newStart = prevSceneEnd;
        const newEnd = newDuration ? newStart + newDuration : currentScene.end;

        const audioUpdatedAt = Date.now();

        updatedScenes[sceneIndex] = {
          ...currentScene,
          audioPath: audioFile.audioUrl,
          audioGenerated: true,
          audioFileName: audioFile.fileName,
          start: newStart,
          end: newEnd,
          audioUpdatedAt: audioUpdatedAt // 오디오 업데이트 타임스탬프 (캐시 무효화용)
        };

        // 이후 씬들의 시간도 연쇄적으로 조정 (불변성 유지)
        for (let i = sceneIndex + 1; i < updatedScenes.length; i++) {
          const prevEnd = updatedScenes[i - 1].end;
          const currentDuration = audioDurations[i] || (updatedScenes[i].end - updatedScenes[i].start);
          updatedScenes[i] = {
            ...updatedScenes[i],
            start: prevEnd,
            end: prevEnd + currentDuration
          };
        }

        setScenes(updatedScenes);
        showSuccess(`씬 ${sceneIndex + 1} 음성이 재생성되었습니다. (${newDuration ? newDuration.toFixed(1) : '0.0'}초)`);

        // 수정된 씬의 오디오 캐시만 제거
        if (window.api?.revokeVideoUrl && currentScene.audioPath) {
          window.api.revokeVideoUrl(currentScene.audioPath);
        }

        // SRT 파일도 업데이트
        await updateSrtFile(updatedScenes);
      } else {
        throw new Error(result?.error || "TTS 생성 실패");
      }
    } catch (error) {
      console.error(`[TTS 재생성] 씬 ${sceneIndex + 1} 실패:`, error);
      showError(`씬 ${sceneIndex + 1} 음성 생성에 실패했습니다: ${error.message}`);
    }
  }, [scenes, setScenes, ttsSettings, audioDurations, updateSrtFile]);

  // 미리듣기 함수
  const handlePreviewTTS = useCallback(async (text) => {
    if (!text || text.trim().length === 0) {
      showError("미리들을 텍스트가 없습니다.");
      return;
    }

    try {
      setIsPreviewPlaying(true);

      // 현재 재생 중인 오디오가 있으면 정지
      if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio.currentTime = 0;
        setCurrentPreviewAudio(null);
      }

      // 사용자 TTS 설정 사용
      const payload = {
        doc: { scenes: [{ text: text }] },
        tts: {
          engine: ttsSettings.ttsEngine,
          voiceId: ttsSettings.voice,
          voiceName: ttsSettings.voice,
          speakingRate: parseFloat(ttsSettings.speed),
          pitch: parseFloat(ttsSettings.pitch),
          provider: "Google",
        },
      };

      const result = await window.api.invoke("tts/synthesizeByScenes", payload);

      if (result?.ok && result?.parts?.length > 0 && result.parts[0].base64) {
        try {
          // base64 데이터 검증
          const base64Data = result.parts[0].base64.replace(/^data:audio\/[^;]+;base64,/, '');
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);

          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const audioBlob = new Blob([bytes], { type: "audio/mpeg" });

          if (audioBlob.size === 0) {
            throw new Error("생성된 오디오 blob이 비어있습니다");
          }

          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          setCurrentPreviewAudio(audio);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentPreviewAudio(null);
          setIsPreviewPlaying(false);
        };

        audio.onerror = (error) => {
          console.error("오디오 재생 실패:", error);
          setCurrentPreviewAudio(null);
          setIsPreviewPlaying(false);
          showError("미리듣기 재생에 실패했습니다.");
        };

          await audio.play();
        } catch (blobError) {
          console.error("오디오 blob 생성 실패:", blobError);
          throw new Error(`오디오 데이터 처리 실패: ${blobError.message}`);
        }
      } else {
        throw new Error(result?.error || result?.message || "음성 합성 실패");
      }
    } catch (error) {
      console.error("TTS 미리듣기 실패:", error);
      showError(`미리듣기에 실패했습니다: ${error.message}`);
      setIsPreviewPlaying(false);
      setCurrentPreviewAudio(null);
    }
  }, [currentPreviewAudio, ttsSettings]);

  // 미리듣기 중지 함수
  const handleStopPreview = useCallback(() => {
    if (currentPreviewAudio) {
      currentPreviewAudio.pause();
      currentPreviewAudio.currentTime = 0;
      setCurrentPreviewAudio(null);
    }
    setIsPreviewPlaying(false);
  }, [currentPreviewAudio]);

  const handleSaveEdit = useCallback(async () => {
    if (editingSceneIndex === -1) return;

    const originalText = scenes[editingSceneIndex]?.text || "";
    const hasTextChanged = editingText !== originalText;

    const updatedScenes = [...scenes];
    const scene = updatedScenes[editingSceneIndex];

    // 텍스트 업데이트
    scene.text = editingText;

    // 시간 업데이트 (시간 포맷을 초로 변환)
    const startSeconds = timeStringToSeconds(editingStartTime);
    const endSeconds = timeStringToSeconds(editingEndTime);

    if (startSeconds !== null) scene.start = startSeconds;
    if (endSeconds !== null) scene.end = endSeconds;

    setScenes(updatedScenes);
    handleCancelEdit();

    // SRT 파일 업데이트 (텍스트나 시간이 변경된 경우)
    await updateSrtFile(updatedScenes);

    // 텍스트가 변경된 경우에만 TTS 재생성
    if (hasTextChanged && editingText.trim().length > 0) {
      await regenerateSceneTTS(editingSceneIndex, editingText);
    }
  }, [editingSceneIndex, editingText, editingStartTime, editingEndTime, scenes, setScenes, handleCancelEdit, regenerateSceneTTS, updateSrtFile]);

  // 더블클릭으로 편집 모드 진입
  const handleSceneDoubleClick = useCallback((index, event) => {
    event.stopPropagation();

    // 영상 생성/할당 중일 때는 편집 불가
    if (isAssigning || mediaGenerationState.isActive || videoAssignState.isActive) {
      showInfo("미디어 처리 중에는 씬을 편집할 수 없습니다.");
      return;
    }

    handleStartEditText(index);
  }, [handleStartEditText, isAssigning, mediaGenerationState.isActive, videoAssignState.isActive]);

  // 실시간 텍스트 변경 핸들러 (VREW 스타일)
  const handleTextChange = useCallback(async (newText) => {
    setEditingText(newText);


  }, []);

  // 자동 영상 할당 핸들러 (에러 핸들링 강화)
  const handleAutoAssignVideos = useCallback(async () => {
    // 중복 실행 방지
    if (isAssigning) {
      return;
    }

    // 입력 검증
    if (!scenes || scenes.length === 0) {
      showError("할당할 씬이 없습니다.");
      return;
    }

    // 텍스트가 있는 씬이 있는지 확인
    const scenesWithText = scenes.filter(scene => scene.text && scene.text.trim().length > 0);
    if (scenesWithText.length === 0) {
      showError("텍스트가 있는 씬이 없습니다. 먼저 자막을 작성해주세요.");
      return;
    }

    setIsAssigning(true);
    try {
      const assignedScenes = await assignVideosToScenes(scenes, {
        minScore: 0.1, // VREW 스타일: 관대한 매칭
        allowDuplicates: false, // 중복 방지
      });

      setScenes(assignedScenes);

      const assignedCount = assignedScenes.filter((scene) => scene.asset?.path).length;
      const totalCount = assignedScenes.length;

      if (assignedCount > 0) {
        showSuccess(`${assignedCount}/${totalCount}개 씬에 영상을 자동으로 할당했습니다.`);
      } else {
        showError("자동으로 할당할 수 있는 영상이 없습니다. 먼저 미디어 다운로드에서 영상을 다운로드해주세요.");
      }
    } catch (error) {
      console.error("[자동 할당] 오류:", error);
      showError(`자동 할당 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  }, [scenes, setScenes]);

  // 미디어 없음 자동 할당 핸들러
  const handleAutoAssignMissingOnly = useCallback(async () => {
    // 중복 실행 방지
    if (isAssigning) {
      return;
    }

    if (!scenes || scenes.length === 0) {
      showError("할당할 씬이 없습니다.");
      return;
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      showError("미디어가 없는 씬이 없습니다.");
      return;
    }

    setIsAssigning(true);
    try {
      // 미디어가 없는 씬만 할당
      const assignedMissingScenes = await assignVideosToScenes(missingScenes, {
        minScore: 0.1,
        allowDuplicates: false,
      });

      // 전체 씬 배열에 결과 병합
      const updatedScenes = [...scenes];
      let assignedIndex = 0;

      for (let i = 0; i < updatedScenes.length; i++) {
        if (!updatedScenes[i].asset?.path && updatedScenes[i].text && updatedScenes[i].text.trim().length > 0) {
          updatedScenes[i] = assignedMissingScenes[assignedIndex];
          assignedIndex++;
        }
      }

      setScenes(updatedScenes);

      const assignedCount = assignedMissingScenes.filter(scene => scene.asset?.path).length;
      const totalMissing = missingScenes.length;

      if (assignedCount > 0) {
        showSuccess(`미디어 없는 ${assignedCount}/${totalMissing}개 씬에 영상을 할당했습니다.`);
      } else {
        showError("자동으로 할당할 수 있는 영상이 없습니다. 먼저 미디어 다운로드에서 영상을 다운로드해주세요.");
      }
    } catch (error) {
      console.error("[미디어 없음 자동 할당] 오류:", error);
      showError(`자동 할당 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  }, [scenes, setScenes]);

  // 미디어 없는 씬에 이미지 자동 생성 핸들러
  const handleAutoAssignImagesOnly = useCallback(async () => {
    // 중복 실행 방지
    if (mediaGenerationState.isActive || videoAssignState.isActive) {
      return;
    }

    if (!scenes || scenes.length === 0) {
      showError("생성할 씬이 없습니다.");
      return;
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      showError("미디어가 없는 씬이 없습니다.");
      return;
    }

    // 초기 상태 설정
    setMediaGenerationState({
      isActive: true,
      phase: "image",
      current: 0,
      total: missingScenes.length,
      message: "AI 이미지 생성 시작...",
      videoCount: 0,
      imageCount: 0,
      currentScene: null,
    });

    let finalImageCount = 0;

    try {
      const assignedScenes = await assignImagesToMissingScenes(scenes, {
        onProgress: (progress) => {
          // 진행 상황 업데이트
          setMediaGenerationState(prev => ({
            ...prev,
            phase: progress.phase,
            current: progress.current,
            total: progress.total,
            message: progress.message,
            imageCount: progress.imageCount || prev.imageCount,
            currentScene: progress.currentScene || null,
          }));

          // 최종 카운트 캡처
          if (progress.phase === "completed") {
            finalImageCount = progress.imageCount || 0;
          }
        },
      });

      setScenes(assignedScenes);

      const totalAssigned = assignedScenes.filter(s => s.asset?.path).length;
      const allComplete = assignedScenes.every(s => s.asset?.path && s.audioPath);

      if (allComplete) {
        showSuccess(`이미지 자동 생성 완료! AI 이미지 ${finalImageCount}개 - ✨ 모든 씬이 완성되었습니다! 이제 영상 내보내기를 진행할 수 있습니다.`);
      } else {
        showSuccess(`이미지 자동 생성 완료! AI 이미지 ${finalImageCount}개`);
      }

      // 완료 후 3초 뒤 자동으로 닫기
      setTimeout(() => {
        setMediaGenerationState({
          isActive: false,
          phase: "idle",
          current: 0,
          total: 0,
          message: "",
          videoCount: 0,
          imageCount: 0,
          currentScene: null,
        });
      }, 3000);

    } catch (error) {
      console.error("[이미지 자동 생성] 오류:", error);
      showError(`이미지 자동 생성 중 오류가 발생했습니다: ${error.message}`);

      setMediaGenerationState(prev => ({
        ...prev,
        phase: "error",
        message: `오류 발생: ${error.message}`,
      }));
    }
  }, [scenes, setScenes]);

  // 사진 할당 (온라인 우선 → 로컬 폴백)
  const handleAssignPhotos = useCallback(async () => {
    if (isAssigning) {
      return;
    }

    if (!scenes || scenes.length === 0) {
      showError("할당할 씬이 없습니다.");
      return;
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      showError("미디어가 없는 씬이 없습니다.");
      return;
    }

    setIsAssigning(true);
    let onlineAssignedCount = 0;
    let localAssignedCount = 0;

    try {
      const pexelsKey = await window.api.invoke("secrets:get", "pexelsApiKey");
      const pixabayKey = await window.api.invoke("secrets:get", "pixabayApiKey");

      if (!pexelsKey && !pixabayKey) {
        showError("Pexels 또는 Pixabay API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.");
        setIsAssigning(false);
        return;
      }

      let updatedScenes = [...scenes];

      // 1단계: 온라인 검색 및 다운로드 (Pexels → Pixabay)
      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];

        // 이미 미디어가 있으면 스킵
        if (scene.asset?.path) continue;

        const keyword = scene.keyword || scene.text?.substring(0, 20);
        if (!keyword) continue;

        showInfo(`온라인 사진 검색 중... (${i + 1}/${missingScenes.length}): ${keyword}`);

        try {
          // stock.js의 searchPexelsPhotos, searchPixabayPhotos 사용
          const searchResult = await window.api.invoke("stock:search", {
            query: keyword,
            perPage: 1,
            providers: pexelsKey && pixabayKey ? ["pexels", "pixabay"] : pexelsKey ? ["pexels"] : ["pixabay"],
            pexelsKey,
            pixabayKey,
            targetRes: { w: 1920, h: 1080 },
            type: "photos"
          });

          if (searchResult?.ok && searchResult?.items?.length > 0) {
            const photo = searchResult.items[0];

            // 사진 다운로드
            const videoSaveFolder = await window.api.getSetting("videoSaveFolder");
            const imagesPath = `${videoSaveFolder}/images`;

            // URL에서 확장자 추출
            const urlExtension = photo.url.split('.').pop().split('?')[0].toLowerCase();
            const fileExtension = ['webp', 'jpg', 'jpeg', 'png'].includes(urlExtension) ? urlExtension : 'jpg';
            const safeKeyword = keyword.replace(/[^\w가-힣-]/g, "_");
            const filename = `${safeKeyword}_photo.${fileExtension}`;

            const downloadResult = await window.api.invoke("media:downloadPhoto", {
              url: photo.url,
              filename,
              imagesPath
            });

            if (downloadResult?.success) {
              // 경로 정규화 (백슬래시를 슬래시로)
              const normalizedPath = downloadResult.filePath.replace(/\\/g, '/');

              updatedScenes[i] = {
                ...updatedScenes[i],
                asset: {
                  path: normalizedPath,
                  type: "image",
                  provider: photo.provider,
                },
              };
              onlineAssignedCount++;
            }
          }
        } catch (error) {
          console.error(`온라인 사진 검색 실패 (${keyword}):`, error);
        }

        // 약간의 딜레이
        await new Promise(r => setTimeout(r, 300));
      }

      // 2단계: 온라인에서 못 찾은 씬들 → 로컬 폴백
      const stillMissingScenes = updatedScenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

      if (stillMissingScenes.length > 0) {
        showInfo(`로컬 이미지 검색 중... (${stillMissingScenes.length}개 씬)`);

        try {
          // assignPhotosToMissingScenes로 로컬 사진만 할당 (영상 제외)
          const localAssignedScenes = await assignPhotosToMissingScenes(updatedScenes, {
            minScore: 0.1,
            allowDuplicates: false,
          });

          // 로컬에서 할당된 개수 계산
          const beforeLocalCount = updatedScenes.filter(s => s.asset?.path).length;
          const afterLocalCount = localAssignedScenes.filter(s => s.asset?.path).length;
          localAssignedCount = afterLocalCount - beforeLocalCount;

          updatedScenes = localAssignedScenes;
        } catch (error) {
          console.error("로컬 이미지 할당 실패:", error);
        }
      }

      setScenes(updatedScenes);

      const totalAssigned = onlineAssignedCount + localAssignedCount;
      const totalMissing = missingScenes.length;

      if (totalAssigned > 0) {
        const details = [];
        if (onlineAssignedCount > 0) details.push(`온라인 ${onlineAssignedCount}개`);
        if (localAssignedCount > 0) details.push(`로컬 ${localAssignedCount}개`);

        showSuccess(`사진 할당 완료! ${details.join(', ')} (총 ${totalAssigned}/${totalMissing}개)`);
      } else {
        showError(`사진을 찾을 수 없습니다.`);
      }
    } catch (error) {
      console.error("사진 할당 오류:", error);
      showError(`사진 할당 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  }, [scenes, setScenes, isAssigning]);

  // 영상 할당 (온라인 우선 → 로컬 폴백)
  const handleAssignVideos = useCallback(async () => {
    if (isAssigning) {
      return;
    }

    if (!scenes || scenes.length === 0) {
      showError("할당할 씬이 없습니다.");
      return;
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      showError("미디어가 없는 씬이 없습니다.");
      return;
    }

    setIsAssigning(true);
    let onlineAssignedCount = 0;
    let localAssignedCount = 0;

    try {
      const pexelsKey = await window.api.invoke("secrets:get", "pexelsApiKey");
      const pixabayKey = await window.api.invoke("secrets:get", "pixabayApiKey");

      if (!pexelsKey && !pixabayKey) {
        showError("Pexels 또는 Pixabay API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.");
        setIsAssigning(false);
        return;
      }

      let updatedScenes = [...scenes];

      // 1단계: 온라인 검색 및 다운로드 (Pexels → Pixabay)
      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];

        // 이미 미디어가 있으면 스킵
        if (scene.asset?.path) continue;

        const keyword = scene.keyword || scene.text?.substring(0, 20);
        if (!keyword) continue;

        showInfo(`온라인 영상 검색 중... (${i + 1}/${missingScenes.length}): ${keyword}`);

        try {
          // stock.js의 searchPexels, searchPixabay 사용
          const searchResult = await window.api.invoke("stock:search", {
            query: keyword,
            perPage: 1,
            providers: pexelsKey && pixabayKey ? ["pexels", "pixabay"] : pexelsKey ? ["pexels"] : ["pixabay"],
            pexelsKey,
            pixabayKey,
            targetRes: { w: 1920, h: 1080 },
            minBytes: 0,
            maxBytes: 20 * 1024 * 1024,
            type: "videos"
          });

          if (searchResult?.ok && searchResult?.items?.length > 0) {
            const video = searchResult.items[0];

            // 영상 다운로드
            const videoSaveFolder = await window.api.getSetting("videoSaveFolder");
            const videoPath = `${videoSaveFolder}/video`;

            const safeKeyword = keyword.replace(/[^\w가-힣-]/g, "_");
            const resolution = `${video.width}x${video.height}`;
            const filename = `${safeKeyword}_${resolution}.mp4`;

            const downloadResult = await window.api.invoke("media:downloadVideo", {
              url: video.url,
              filename,
              videoPath,
              maxFileSize: 20
            });

            if (downloadResult?.success) {
              // 경로 정규화 (백슬래시를 슬래시로)
              const normalizedPath = downloadResult.filePath.replace(/\\/g, '/');

              updatedScenes[i] = {
                ...updatedScenes[i],
                asset: {
                  path: normalizedPath,
                  type: "video",
                  provider: video.provider,
                },
              };
              onlineAssignedCount++;
            }
          }
        } catch (error) {
          console.error(`온라인 영상 검색 실패 (${keyword}):`, error);
        }

        // 약간의 딜레이
        await new Promise(r => setTimeout(r, 300));
      }

      // 2단계: 온라인에서 못 찾은 씬들 → 로컬 폴백
      const stillMissingScenes = updatedScenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

      if (stillMissingScenes.length > 0) {
        showInfo(`로컬 영상 검색 중... (${stillMissingScenes.length}개 씬)`);

        try {
          // assignPrioritizedMediaToMissingScenes로 로컬 영상/사진/AI 이미지 할당
          const localAssignedScenes = await assignPrioritizedMediaToMissingScenes(updatedScenes, {
            minScore: 0.1,
            allowDuplicates: false,
          });

          // 로컬에서 할당된 개수 계산
          const beforeLocalCount = updatedScenes.filter(s => s.asset?.path).length;
          const afterLocalCount = localAssignedScenes.filter(s => s.asset?.path).length;
          localAssignedCount = afterLocalCount - beforeLocalCount;

          updatedScenes = localAssignedScenes;
        } catch (error) {
          console.error("로컬 영상 할당 실패:", error);
        }
      }

      setScenes(updatedScenes);

      const totalAssigned = onlineAssignedCount + localAssignedCount;
      const totalMissing = missingScenes.length;

      if (totalAssigned > 0) {
        const details = [];
        if (onlineAssignedCount > 0) details.push(`온라인 ${onlineAssignedCount}개`);
        if (localAssignedCount > 0) details.push(`로컬 ${localAssignedCount}개`);

        showSuccess(`영상 할당 완료! ${details.join(', ')} (총 ${totalAssigned}/${totalMissing}개)`);
      } else {
        showError(`영상을 찾을 수 없습니다.`);
      }
    } catch (error) {
      console.error("영상 할당 오류:", error);
      showError(`영상 할당 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  }, [scenes, setScenes, isAssigning]);

  // 우클릭 컨텍스트 메뉴 핸들러
  const handleContextMenu = useCallback((event, index) => {
    event.preventDefault();

    // 영상 생성/할당 중일 때는 컨텍스트 메뉴 불가
    if (isAssigning || mediaGenerationState.isActive || videoAssignState.isActive) {
      showInfo("미디어 처리 중에는 씬을 편집할 수 없습니다.");
      return;
    }

    setContextMenuSceneIndex(index);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setIsContextMenuOpen(true);
  }, [isAssigning, mediaGenerationState.isActive, videoAssignState.isActive]);

  // 미디어 교체 핸들러들
  const handleReplaceWithVideo = useCallback(async () => {
    if (contextMenuSceneIndex === -1) return;

    try {
      const result = await window.api.invoke("files/select", { type: "video" });

      if (!result?.canceled && result?.filePath) {
        const updatedScenes = [...scenes];
        const fileName = result.filePath.split(/[\\/]/).pop();
        updatedScenes[contextMenuSceneIndex].asset = {
          path: result.filePath,
          filename: fileName,
          type: "video",
          keyword: "사용자 선택",
          provider: "local",
          resolution: "unknown"
        };
        setScenes(updatedScenes);
        showSuccess(`씬 ${contextMenuSceneIndex + 1}에 영상이 연결되었습니다.`);
      } else if (!result?.canceled) {
        console.error("[미디어 교체] 파일 선택 실패:", result);
        showError(`영상 파일 선택에 실패했습니다.`);
      }
    } catch (error) {
      console.error("[미디어 교체] 영상 교체 오류:", error);
      showError(`영상 교체 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsContextMenuOpen(false);
      setContextMenuSceneIndex(-1);
    }
  }, [contextMenuSceneIndex, scenes, setScenes]);

  const handleReplaceWithImage = useCallback(async () => {
    if (contextMenuSceneIndex === -1) return;

    try {
      const result = await window.api.invoke("files/select", { type: "image" });

      if (!result?.canceled && result?.filePath) {
        const updatedScenes = [...scenes];
        const fileName = result.filePath.split(/[\\\/]/).pop();
        updatedScenes[contextMenuSceneIndex].asset = {
          path: result.filePath,
          filename: fileName,
          type: "image",
          keyword: "사용자 선택",
          provider: "local",
          resolution: "unknown"
        };
        setScenes(updatedScenes);
        showSuccess(`씬 ${contextMenuSceneIndex + 1}에 이미지가 연결되었습니다.`);
      } else if (!result?.canceled) {
        showError("이미지 파일 선택에 실패했습니다.");
      }
    } catch (error) {
      console.error("[미디어 교체] 이미지 교체 오류:", error);
      showError("이미지 교체 중 오류가 발생했습니다.");
    } finally {
      setIsContextMenuOpen(false);
      setContextMenuSceneIndex(-1);
    }
  }, [contextMenuSceneIndex, scenes, setScenes]);

  const handleRemoveMedia = useCallback(() => {
    if (contextMenuSceneIndex === -1) return;

    const updatedScenes = [...scenes];
    // asset만 제거하고, scene.keyword는 유지됨 (다음 할당 시 재사용)
    updatedScenes[contextMenuSceneIndex].asset = null;
    setScenes(updatedScenes);

    setIsContextMenuOpen(false);
    setContextMenuSceneIndex(-1);
    showSuccess("미디어가 제거되었습니다.");
  }, [contextMenuSceneIndex, scenes, setScenes]);

  // 드래그 앤 드롭 이벤트 핸들러
  const handleDragEnter = useCallback((e, index) => {
    e.preventDefault();
    setDragOverSceneIndex(index);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e, index) => {
    e.preventDefault();
    // 실제로 씬 카드를 벗어났는지 확인
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverSceneIndex(-1);
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(async (e, index) => {
    e.preventDefault();
    setDragOverSceneIndex(-1);
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) {
      showError("드롭된 파일이 없습니다.");
      return;
    }

    const file = files[0];
    const fileName = file.name;

    // 파일 타입 검증
    if (!isVideoFile(fileName) && !isImageFile(fileName)) {
      showError("지원하지 않는 파일 형식입니다. 이미지 또는 비디오 파일만 지원됩니다.");
      return;
    }

    // 파일 크기 검증 (100MB 제한)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      showError("파일 크기가 너무 큽니다. 100MB 이하의 파일만 지원됩니다.");
      return;
    }

    try {
      // 파일을 프로젝트 폴더에 저장
      const buffer = await file.arrayBuffer();
      const fileType = isVideoFile(fileName) ? "video" : "image";
      const category = fileType === "video" ? "videos" : "images";

      const result = await window.api.invoke("files/saveToProject", {
        category: category,
        fileName: fileName,
        buffer: buffer
      });

      if (result?.ok && result?.path) {
        const updatedScenes = [...scenes];

        updatedScenes[index].asset = {
          path: result.path,
          filename: fileName,
          type: fileType,
          keyword: "드래그 앤 드롭",
          provider: "local",
          resolution: "unknown"
        };

        setScenes(updatedScenes);
        showSuccess(`씬 ${index + 1}에 ${fileType === "video" ? "영상" : "이미지"}이 연결되었습니다.`);
      } else {
        showError(`파일 저장에 실패했습니다: ${result?.message || "알 수 없는 오류"}`);
      }
    } catch (error) {
      console.error("[드래그 앤 드롭] 파일 처리 오류:", error);
      showError("파일 처리 중 오류가 발생했습니다.");
    }
  }, [scenes, setScenes]);

  // 컨텍스트 메뉴 외부 클릭시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isContextMenuOpen) {
        setIsContextMenuOpen(false);
        setContextMenuSceneIndex(-1);
      }
    };

    if (isContextMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isContextMenuOpen]);

  // TTS 설정 로드
  useEffect(() => {
    const loadTtsSettings = async () => {
      try {
        const [ttsEngine, voice, speed, pitch] = await Promise.all([
          window.api.invoke("settings:get", "ttsEngine"),
          window.api.invoke("settings:get", "voice"),
          window.api.invoke("settings:get", "speed"),
          window.api.invoke("settings:get", "pitch")
        ]);

        const loadedSettings = {
          ttsEngine: ttsEngine || "google",
          voice: voice || "ko-KR-Standard-A",
          speed: speed || "1.0",
          pitch: pitch || "-1"
        };

        setTtsSettings(loadedSettings);
      } catch (error) {
        console.error("TTS 설정 로드 실패:", error);
        // 기본 설정 유지
      }
    };

    loadTtsSettings();
  }, []);

  // 모든 씬의 음성 파일 duration 로드
  const loadAudioDurations = useCallback(async () => {
    try {
      // videoSaveFolder 경로 가져오기
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

      if (!videoSaveFolder || scenes.length === 0) {
        return;
      }

      // 각 씬의 음성 파일 경로 생성
      const filePaths = scenes.map((_, index) => {
        const sceneNumber = String(index + 1).padStart(3, "0");
        return `${videoSaveFolder}\\audio\\parts\\scene-${sceneNumber}.mp3`;
      });

      // 모든 음성 파일의 duration 가져오기
      const result = await window.api.invoke("audio:getDurations", { filePaths });

      if (result?.success && result?.results) {
        const durationsMap = {};
        result.results.forEach((item, index) => {
          if (item.success) {
            durationsMap[index] = item.duration;
          }
        });
        setAudioDurations(durationsMap);
      }
    } catch (error) {
      console.error("음성 파일 길이 로드 실패:", error);
    }
  }, [scenes]);

  // 씬 변경 시 음성 파일 duration 로드
  useEffect(() => {
    loadAudioDurations();
  }, [loadAudioDurations]);

  // 컴포넌트 언마운트 시 미리듣기 오디오 정리
  useEffect(() => {
    return () => {
      if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        currentPreviewAudio.currentTime = 0;
        setCurrentPreviewAudio(null);
      }
    };
  }, [currentPreviewAudio]);

  return (
    <Card
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        height: "fit-content",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <DocumentTextRegular style={{ fontSize: 18 }} />
          <Text size={400} weight="semibold">
            씬 목록
          </Text>
          <Badge appearance="filled" size="small">
            {scenes.length}
          </Badge>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            appearance="primary"
            size="small"
            icon={<ImageRegular />}
            onClick={handleAutoAssignImagesOnly}
            disabled={mediaGenerationState.isActive || videoAssignState.isActive || isAssigning || scenes.length === 0}
          >
            {mediaGenerationState.isActive ? "할당 중..." : "AI 이미지 할당"}
          </Button>
          <Button
            appearance="primary"
            size="small"
            icon={<ImageRegular />}
            onClick={handleAssignPhotos}
            disabled={videoAssignState.isActive || mediaGenerationState.isActive || isAssigning || scenes.length === 0}
          >
            {isAssigning ? "할당 중..." : "사진 할당"}
          </Button>
          <Button
            appearance="primary"
            size="small"
            icon={<VideoRegular />}
            onClick={handleAssignVideos}
            disabled={videoAssignState.isActive || mediaGenerationState.isActive || isAssigning || scenes.length === 0}
          >
            {isAssigning ? "할당 중..." : "영상 할당"}
          </Button>
        </div>
      </div>

      {/* 씬 목록 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {scenes.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20 }}>
            <Text size={300} style={{ color: "#666" }}>
              씬가 없습니다
            </Text>
          </div>
        ) : (
          scenes.map((scene, index) => {
            const isSelected = index === selectedSceneIndex;
            const isEditing = index === editingSceneIndex;
            const sceneWithDefaults = ensureSceneDefaults(scene);
            const hasMedia = sceneWithDefaults.asset?.path;

            // 키워드는 씬 레벨 또는 asset 레벨에 저장될 수 있음
            const displayKeyword = scene.keyword || scene.asset?.keyword;

            const isDragOver = dragOverSceneIndex === index;

            return (
              <div
                key={scene.id}
                ref={(el) => (sceneRefs.current[index] = el)}
                style={{ position: "relative" }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `2px solid ${
                      isDragOver
                        ? "#00bcf2"
                        : isEditing
                        ? "#ff6b35"
                        : isSelected
                        ? "#0078d4"
                        : "#e1dfdd"
                    }`,
                    backgroundColor: isDragOver
                      ? "#e8f7ff"
                      : isEditing
                      ? "#fff4f1"
                      : isSelected
                      ? "#f3f9ff"
                      : "transparent",
                    cursor: isEditing ? "default" : "pointer",
                    transition: "all 0.2s ease",
                    position: "relative",
                    ...(isDragOver && {
                      transform: "scale(1.02)",
                      boxShadow: "0 4px 12px rgba(0, 188, 242, 0.3)",
                    }),
                  }}
                  onClick={isEditing ? undefined : () => onSceneSelect(index)}
                  onDoubleClick={isEditing ? undefined : (e) => handleSceneDoubleClick(index, e)}
                  onContextMenu={(e) => handleContextMenu(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={(e) => handleDragLeave(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {/* 드래그 오버 오버레이 */}
                  {isDragOver && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 188, 242, 0.1)",
                        borderRadius: 6,
                        border: "2px dashed #00bcf2",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                {/* 헤더 영역 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Avatar size={20} name={`씬 ${index + 1}`} color={hasMedia ? "colorful" : "neutral"} />
                  <Text size={300} weight="medium" style={{ fontSize: "14px" }}>
                    씬 {index + 1}
                  </Text>
                  <div style={{ flex: 1 }} />

                  {/* 시간 편집 영역 */}
                  {isEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Input
                        size="small"
                        value={editingStartTime}
                        onChange={(e) => setEditingStartTime(e.target.value)}
                        placeholder="00:00"
                        style={{ width: 60, fontSize: "12px" }}
                      />
                      <Text size={200}>-</Text>
                      <Input
                        size="small"
                        value={editingEndTime}
                        onChange={(e) => setEditingEndTime(e.target.value)}
                        placeholder="00:00"
                        style={{ width: 60, fontSize: "12px" }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <ClockRegular style={{ fontSize: 12 }} />
                      <Text size={200} style={{ color: "#666" }}>
                        {audioDurations[index] ?
                          `${formatTime(audioDurations[index])} (음성)` :
                          (scene.start && scene.end && scene.start !== scene.end) ?
                            `${formatTime(scene.start)} - ${formatTime(scene.end)}` :
                            "음성 파일 로드 중..."
                        }
                      </Text>
                    </div>
                  )}
                </div>

                {/* 자막 텍스트 영역 */}
                {isEditing ? (
                  <div style={{ marginBottom: 8 }}>
                    <Textarea
                      value={editingText}
                      onChange={(e) => handleTextChange(e.target.value)}
                      placeholder="자막을 입력하세요..."
                      resize="vertical"
                      rows={4}
                      style={{
                        width: "100%",
                        fontSize: "15px",
                        lineHeight: "1.5",
                        padding: "12px",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "8px 0",
                      minHeight: "40px",
                      cursor: "text",
                      borderRadius: "4px",
                      position: "relative",
                    }}
                    onDoubleClick={(e) => handleSceneDoubleClick(index, e)}
                  >
                    <Text
                      size={300}
                      style={{
                        color: scene.text ? "#333" : "#999",
                        fontSize: "13px",
                        lineHeight: "1.4",
                        display: "block",
                        wordWrap: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {scene.text || "더블클릭하여 자막을 편집하세요..."}
                    </Text>
                  </div>
                )}


                {/* 편집 버튼 영역 */}
                {isEditing && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <Button appearance="primary" size="small" onClick={handleSaveEdit}>
                      저장
                    </Button>
                    <Button appearance="secondary" size="small" onClick={handleCancelEdit}>
                      취소
                    </Button>
                    {editingText.trim().length > 0 && (
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={isPreviewPlaying ? <SpeakerOffRegular /> : <SpeakerMuteRegular />}
                        onClick={isPreviewPlaying ? handleStopPreview : () => handlePreviewTTS(editingText)}
                        disabled={editingText.trim().length === 0}
                      >
                        {isPreviewPlaying ? "중지" : "미리듣기"}
                      </Button>
                    )}
                  </div>
                )}

                {/* 미디어 상태 표시 */}
                {hasMedia && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Badge appearance="tint" color="success" size="small" style={{ fontSize: "12px" }}>
                      <CheckmarkCircleRegular style={{ fontSize: 12, marginRight: 3 }} />
                      {sceneWithDefaults.asset.type === "image" ? "이미지" : "영상"} 연결됨
                    </Badge>
                    {sceneWithDefaults.keyword && (
                      <Badge appearance="outline" size="small" style={{ fontSize: "12px" }}>
                        키워드: {sceneWithDefaults.keyword}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 미디어 없지만 키워드는 있을 때 표시 (미디어 제거 후 상태) */}
                {!hasMedia && sceneWithDefaults.keyword && (
                  <div style={{ marginTop: 6 }}>
                    <Badge appearance="outline" size="small" style={{ fontSize: "12px", color: "#666" }}>
                      키워드: {sceneWithDefaults.keyword}
                    </Badge>
                  </div>
                )}

                {/* 편집 힌트 */}
                {!isEditing && !hasMedia && (
                  <div style={{ marginTop: 6 }}>
                    <Text size={200} style={{ color: "#999", fontSize: "11px" }}>
                      💡 더블클릭하여 편집 • 우클릭으로 미디어 교체
                    </Text>
                  </div>
                )}
                </div>

                {/* 고정 위치 컨텍스트 메뉴 */}
                {isContextMenuOpen && contextMenuSceneIndex === index && (
                  <div
                    style={{
                      position: "fixed",
                      left: contextMenuPosition.x,
                      top: contextMenuPosition.y,
                      zIndex: 1000,
                      backgroundColor: "white",
                      border: "1px solid #e1dfdd",
                      borderRadius: 8,
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                      padding: 8,
                      minWidth: 160,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "background-color 0.2s",
                      }}
                      onClick={handleReplaceWithVideo}
                      onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f9ff")}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                    >
                      <VideoRegular style={{ fontSize: 16 }} />
                      영상으로 교체
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "background-color 0.2s",
                      }}
                      onClick={handleReplaceWithImage}
                      onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f9ff")}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                    >
                      <ImageRegular style={{ fontSize: 16 }} />
                      이미지로 교체
                    </div>
                    {hasMedia && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 12px",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: "14px",
                          transition: "background-color 0.2s",
                          color: "#d13438",
                        }}
                        onClick={handleRemoveMedia}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = "#fdf6f6")}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
                      >
                        미디어 제거
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 미디어 자동 생성 진행 바 */}
      {mediaGenerationState.isActive && (
        <BottomFixedBar
          isComplete={mediaGenerationState.phase === "completed"}
          isLoading={mediaGenerationState.phase === "video" || mediaGenerationState.phase === "image"}
          statusText={mediaGenerationState.message}
          progress={mediaGenerationState.total > 0 ? Math.round((mediaGenerationState.current / mediaGenerationState.total) * 1000) / 10 : 0}
          borderColor={
            mediaGenerationState.phase === "completed" ? "#10b981" :
            mediaGenerationState.phase === "image" ? "#a855f7" :
            mediaGenerationState.phase === "video" ? "#3b82f6" :
            "#ef4444"
          }
          expandedContent={
            mediaGenerationState.currentScene ? (
              <div style={{ padding: "12px 16px", fontSize: "13px", color: "#666" }}>
                <div><strong>현재 씬 {mediaGenerationState.currentScene.index + 1}</strong></div>
                <div style={{ marginTop: 4 }}>{mediaGenerationState.currentScene.text}</div>
              </div>
            ) : null
          }
          onClose={() => {
            setMediaGenerationState({
              isActive: false,
              phase: "idle",
              current: 0,
              total: 0,
              message: "",
              videoCount: 0,
              imageCount: 0,
              currentScene: null,
            });
          }}
        />
      )}

      {/* 영상 자동 할당 진행 바 */}
      {videoAssignState.isActive && (
        <BottomFixedBar
          isComplete={videoAssignState.phase === "completed"}
          isLoading={videoAssignState.phase === "local" || videoAssignState.phase === "download"}
          statusText={videoAssignState.message}
          progress={videoAssignState.total > 0 ? Math.round((videoAssignState.current / videoAssignState.total) * 1000) / 10 : 0}
          borderColor={
            videoAssignState.phase === "completed" ? "#10b981" :
            videoAssignState.phase === "download" ? "#a855f7" :
            videoAssignState.phase === "local" ? "#3b82f6" :
            "#ef4444"
          }
          expandedContent={
            videoAssignState.currentScene ? (
              <div style={{ padding: "12px 16px", fontSize: "13px", color: "#666" }}>
                <div><strong>현재 씬 {videoAssignState.currentScene.index + 1}</strong></div>
                <div style={{ marginTop: 4 }}>{videoAssignState.currentScene.text}</div>
              </div>
            ) : null
          }
          onClose={() => {
            setVideoAssignState({
              isActive: false,
              phase: "idle",
              current: 0,
              total: 0,
              message: "",
              assignedCount: 0,
              downloadedCount: 0,
              currentScene: null,
            });
          }}
        />
      )}
    </Card>
  );
}

export default SceneList;