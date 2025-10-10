import { useState, useCallback, useRef } from "react";
import { parseSrtToScenes } from "../utils/parseSrt";
import { getSetting, setSetting, readTextAny, getMp3DurationSafe } from "../utils/ipcSafe";
import { showSuccess, showError } from "../components/common/GlobalToast";

/**
 * 파일 관리 및 업로드 관련 커스텀 훅
 * AssembleEditor에서 사용하는 파일 업로드, 연결, 리셋 등의 로직을 관리
 */
export const useFileManagement = () => {
  // State
  const [scenes, setScenes] = useState([]);
  const [srtConnected, setSrtConnected] = useState(false);
  const [mp3Connected, setMp3Connected] = useState(false);
  const [audioDur, setAudioDur] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [srtFilePath, setSrtFilePath] = useState("");
  const [mp3FilePath, setMp3FilePath] = useState("");

  // Refs
  const srtInputRef = useRef(null);

  // 파일명과 경로 정보를 가져오는 헬퍼 함수
  const getFileInfo = useCallback((filePath) => {
    if (!filePath) return { fileName: "", folderPath: "", displayPath: "" };

    const normalizedPath = filePath.replace(/\\/g, "/");
    const fileName = normalizedPath.split("/").pop() || "";
    const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
    const displayPath = folderPath.length > 50 ? "..." + folderPath.slice(-47) : folderPath;

    return { fileName, folderPath, displayPath };
  }, []);

  // SRT 파일 업로드 처리
  const handleSrtUpload = useCallback(async (fileOrEvent) => {
    let file;

    // 파일 객체가 직접 전달된 경우 (DropZone에서)
    if (fileOrEvent.name) {
      file = fileOrEvent;
    } else {
      // 이벤트 객체가 전달된 경우 (input onChange에서)
      const files = fileOrEvent.target.files;
      if (!files || files.length === 0) return;
      file = files[0];
    }
    if (!file.name.toLowerCase().endsWith(".srt")) {
      showError("SRT 파일만 업로드 가능합니다.");
      return;
    }

    setIsLoading(true);
    try {
      const content = await readTextAny(file.path);
      const parsedScenes = parseSrtToScenes(content);

      if (parsedScenes.length === 0) {
        showError("유효한 SRT 형식이 아닙니다.");
        return;
      }

      // videoSaveFolder 가져오기
      const videoSaveFolder = await getSetting("videoSaveFolder");

      // 각 씬에 audioPath 추가 (audio/parts/scene-XXX.mp3)
      const scenesWithAudio = parsedScenes.map((scene, index) => {
        if (videoSaveFolder) {
          const sceneNumber = String(index + 1).padStart(3, "0");
          const audioPath = `${videoSaveFolder}\\audio\\parts\\scene-${sceneNumber}.mp3`;
          return {
            ...scene,
            audioPath: audioPath,
            audioGenerated: true
          };
        }
        return scene;
      });

      setScenes(scenesWithAudio);
      setSrtConnected(true);
      setSrtFilePath(file.path);

      // 설정 저장
      await setSetting({ key: "paths.srt", value: file.path });

      showSuccess(`SRT 파일이 업로드되었습니다. (${parsedScenes.length}개 씬)`);
    } catch (error) {
      console.error("SRT 업로드 오류:", error);
      showError("SRT 파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 파일 선택 다이얼로그 열기
  const openSrtPicker = useCallback(() => {
    if (srtInputRef.current) {
      srtInputRef.current.click();
    }
  }, []);

  // 대본에서 가져오기 (ScriptVoiceGenerator에서 생성된 파일들 로드)
  const handleInsertFromScript = useCallback(async () => {
    setIsLoading(true);
    try {
      // videoSaveFolder 설정에서 기본 경로 가져오기
      const videoSaveFolder = await getSetting("videoSaveFolder");
      console.log("[대본에서 가져오기] videoSaveFolder:", videoSaveFolder);

      if (!videoSaveFolder) {
        showError("비디오 저장 폴더가 설정되지 않았습니다. 설정 탭에서 먼저 폴더를 설정해주세요.");
        return;
      }

      // 파일 경로 구성
      const srtPath = `${videoSaveFolder}/scripts/subtitle.srt`;
      const audioPartsFolder = `${videoSaveFolder}/audio/parts`;

      console.log("[대본에서 가져오기] 구성된 경로:", { srtPath, audioPartsFolder });

      let loadedSrt = false;
      let loadedMp3 = false;

      // SRT 파일 로드
      try {
        console.log("[SRT 로드] 파일 존재 확인 시작:", srtPath);
        const srtExists = await window.api?.checkPathExists?.(srtPath);
        console.log("[SRT 로드] 파일 존재 확인 결과:", srtExists);
        if (srtExists?.exists && srtExists?.isFile) {
          const content = await readTextAny(srtPath);
          const parsedScenes = parseSrtToScenes(content);

          if (parsedScenes.length > 0) {
            // 각 씬에 audioPath 추가 (audio/parts/scene-XXX.mp3)
            const scenesWithAudio = parsedScenes.map((scene, index) => {
              const sceneNumber = String(index + 1).padStart(3, "0");
              const audioPath = `${videoSaveFolder}\\audio\\parts\\scene-${sceneNumber}.mp3`;
              return {
                ...scene,
                audioPath: audioPath,
                audioGenerated: true
              };
            });

            setScenes(scenesWithAudio);
            setSrtConnected(true);
            setSrtFilePath(srtPath);
            loadedSrt = true;
            console.log("[SRT 로드] audioPath가 추가된 씬:", scenesWithAudio[0]);
          }
        } else {
          console.warn("SRT 파일이 존재하지 않음:", srtPath);
        }
      } catch (error) {
        console.error("SRT 로드 실패:", error);
      }

      // 개별 MP3 파일 로드
      try {
        console.log("[MP3 로드] 개별 오디오 파일 확인 시작:", audioPartsFolder);
        const folderExists = await window.api?.checkPathExists?.(audioPartsFolder);

        if (folderExists?.exists && folderExists?.isDirectory) {
          // 씬 개수만큼 개별 오디오 파일 확인
          let foundAudioFiles = 0;
          let totalDuration = 0;

          for (let i = 0; i < (scenes.length || 10); i++) {
            const sceneNumber = String(i + 1).padStart(3, "0");
            const audioPath = `${audioPartsFolder}/scene-${sceneNumber}.mp3`;
            const audioExists = await window.api?.checkPathExists?.(audioPath);

            if (audioExists?.exists && audioExists?.isFile) {
              foundAudioFiles++;
              try {
                const duration = await getMp3DurationSafe(audioPath);
                totalDuration += duration;
              } catch (error) {
                console.warn(`씬 ${i + 1} 오디오 길이 측정 실패:`, error);
              }
            }
          }

          if (foundAudioFiles > 0) {
            setMp3Connected(true);
            setMp3FilePath(audioPartsFolder); // 폴더 경로 저장
            setAudioDur(totalDuration);
            loadedMp3 = true;
            console.log(`[MP3 로드] ${foundAudioFiles}개 오디오 파일 발견, 총 길이: ${totalDuration.toFixed(2)}초`);
          } else {
            console.warn("개별 오디오 파일이 존재하지 않음:", audioPartsFolder);
          }
        } else {
          console.warn("오디오 폴더가 존재하지 않음:", audioPartsFolder);
        }
      } catch (error) {
        console.error("MP3 로드 실패:", error);
      }

      console.log("[대본에서 가져오기] 최종 결과:", { loadedSrt, loadedMp3 });

      if (loadedSrt && loadedMp3) {
        showSuccess("자막 파일과 오디오 파일을 가져왔습니다.");
      } else if (loadedSrt) {
        showSuccess("자막 파일을 가져왔습니다. (오디오 파일은 대본 탭에서 생성해주세요)");
      } else if (loadedMp3) {
        showSuccess("오디오 파일을 찾았습니다. 자막 파일을 업로드해주세요.");
      } else {
        showError("가져올 파일이 없습니다. 대본 탭에서 먼저 대본을 생성하세요.");
      }
    } catch (error) {
      console.error("대본에서 가져오기 오류:", error);
      showError("파일을 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 전체 초기화
  const handleReset = useCallback(async () => {
    setScenes([]);
    setSrtConnected(false);
    setMp3Connected(false);
    setAudioDur(0);
    setSrtFilePath("");
    setMp3FilePath("");

    // 파일 입력 필드 초기화
    if (srtInputRef.current) srtInputRef.current.value = "";

    // 설정에 저장된 키워드도 삭제
    try {
      await window.api.setSetting("extractedKeywords", []);
      console.log("✅ 저장된 키워드 설정 삭제 완료");

      // 설정 변경 이벤트 강제 트리거 (캐시 문제 방지)
      window.dispatchEvent(new CustomEvent("settingsChanged", {
        detail: { key: "extractedKeywords", value: [] }
      }));
    } catch (error) {
      console.error("키워드 설정 삭제 실패:", error);
    }

    // 대본 생성 페이지도 초기화
    window.dispatchEvent(new CustomEvent("reset-script-generation"));

    // 키워드 추출 상태도 초기화
    window.dispatchEvent(new CustomEvent("reset-keyword-extraction"));

    // 미디어 다운로드 페이지도 초기화
    window.dispatchEvent(new CustomEvent("reset-media-download"));

    showSuccess("모든 파일이 초기화되었습니다.");
  }, []);

  return {
    // State
    scenes,
    srtConnected,
    mp3Connected,
    audioDur,
    isLoading,
    srtFilePath,
    mp3FilePath,

    // Refs
    srtInputRef,

    // Handlers
    handleSrtUpload,
    openSrtPicker,
    handleInsertFromScript,
    handleReset,
    getFileInfo,

    // Setters for external use
    setScenes,
    setSrtConnected,
    setMp3Connected,
    setAudioDur,
    setSrtFilePath,
    setMp3FilePath,
  };
};

export default useFileManagement;