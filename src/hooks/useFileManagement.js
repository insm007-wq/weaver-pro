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
  const mp3InputRef = useRef(null);

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

      setScenes(parsedScenes);
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

  // MP3 파일 업로드 처리
  const handleMp3Upload = useCallback(async (fileOrEvent) => {
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
    const validExtensions = [".mp3", ".wav", ".m4a"];
    const isValid = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isValid) {
      showError("MP3, WAV, M4A 파일만 업로드 가능합니다.");
      return;
    }

    setIsLoading(true);
    try {
      const duration = await getMp3DurationSafe(file.path);

      setMp3Connected(true);
      setMp3FilePath(file.path);
      setAudioDur(duration);

      // 설정 저장
      await setSetting({ key: "paths.mp3", value: file.path });

      showSuccess(`오디오 파일이 업로드되었습니다. (${duration.toFixed(1)}초)`);
    } catch (error) {
      console.error("오디오 업로드 오류:", error);
      showError("오디오 파일 업로드 중 오류가 발생했습니다.");
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

  const openMp3Picker = useCallback(() => {
    if (mp3InputRef.current) {
      mp3InputRef.current.click();
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
      const mp3Path = `${videoSaveFolder}/audio/default.mp3`;

      console.log("[대본에서 가져오기] 구성된 경로:", { srtPath, mp3Path });

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
            setScenes(parsedScenes);
            setSrtConnected(true);
            setSrtFilePath(srtPath);
            loadedSrt = true;
          }
        } else {
          console.warn("SRT 파일이 존재하지 않음:", srtPath);
        }
      } catch (error) {
        console.error("SRT 로드 실패:", error);
      }

      // MP3 파일 로드
      try {
        console.log("[MP3 로드] 파일 존재 확인 시작:", mp3Path);
        const mp3Exists = await window.api?.checkPathExists?.(mp3Path);
        console.log("[MP3 로드] 파일 존재 확인 결과:", mp3Exists);
        if (mp3Exists?.exists && mp3Exists?.isFile) {
          const duration = await getMp3DurationSafe(mp3Path);
          setMp3Connected(true);
          setMp3FilePath(mp3Path);
          setAudioDur(duration);
          loadedMp3 = true;
        } else {
          console.warn("MP3 파일이 존재하지 않음:", mp3Path);
        }
      } catch (error) {
        console.error("MP3 로드 실패:", error);
      }

      console.log("[대본에서 가져오기] 최종 결과:", { loadedSrt, loadedMp3 });

      if (loadedSrt && loadedMp3) {
        showSuccess("대본에서 파일들을 성공적으로 가져왔습니다.");
      } else if (loadedSrt || loadedMp3) {
        showSuccess("일부 파일을 가져왔습니다. 나머지는 수동으로 업로드해주세요.");
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
  const handleReset = useCallback(() => {
    setScenes([]);
    setSrtConnected(false);
    setMp3Connected(false);
    setAudioDur(0);
    setSrtFilePath("");
    setMp3FilePath("");

    // 파일 입력 필드 초기화
    if (srtInputRef.current) srtInputRef.current.value = "";
    if (mp3InputRef.current) mp3InputRef.current.value = "";

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
    mp3InputRef,

    // Handlers
    handleSrtUpload,
    handleMp3Upload,
    openSrtPicker,
    openMp3Picker,
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