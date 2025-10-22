import { useState, useCallback, useRef } from "react";
import { parseSrtToScenes, parseTxtToScenes } from "../utils/parseSrt";
import { getSetting, setSetting } from "../utils/ipcSafe";
import { checkFileExists, readTextFile, getAudioDuration, loadProjectScriptFiles } from "../utils/fileManager";
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
  const [srtSource, setSrtSource] = useState(null); // "auto" | "manual" | null

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
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".srt") && !fileName.endsWith(".txt")) {
      showError("SRT 또는 TXT 파일만 업로드 가능합니다.");
      return;
    }

    setIsLoading(true);
    try {
      const content = await readTextFile(file.path);

      // 내용이 SRT 형식인지 먼저 확인 (타임코드 패턴 검사)
      const hasSrtTimeCode = /\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{1,3}/.test(content);

      // 자막 형식(타임코드)이 없으면 거부
      if (!hasSrtTimeCode) {
        showError("자막 형식이 아닙니다. SRT 형식의 타임코드가 포함된 파일만 업로드할 수 있습니다.\n\n예시:\n1\n00:00:00,000 --> 00:00:05,000\n자막 텍스트");
        return;
      }

      // SRT 형식으로 파싱
      const parsedScenes = parseSrtToScenes(content);

      if (parsedScenes.length === 0) {
        showError("유효한 SRT 형식이 아닙니다. 자막 내용을 확인해주세요.");
        return;
      }

      // 자막 길이 제한 체크 (30분 59초)
      const lastScene = parsedScenes[parsedScenes.length - 1];
      const maxMs = (30 * 60 + 59) * 1000; // 30분 59초 = 1859초
      if (lastScene.end > maxMs) {
        const totalSeconds = Math.floor(lastScene.end / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        showError(`⏱️ 자막이 너무 깁니다!\n\n지원 최대: 30분 59초\n현재: ${minutes}분 ${seconds}초\n\n더 짧은 자막을 사용해주세요.`);
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
      setSrtSource("manual"); // 수동 업로드

      // 설정 저장
      await setSetting({ key: "paths.srt", value: file.path });

      showSuccess(`자막 파일이 업로드되었습니다. (${parsedScenes.length}개 씬)`);
    } catch (error) {
      showError("자막 파일 업로드 중 오류가 발생했습니다.");
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
  // isAutoLoad: true면 자동 로드 (조용히 실패), false면 사용자 클릭 (에러 메시지 표시)
  const handleInsertFromScript = useCallback(async (isAutoLoad = false) => {
    setIsLoading(true);

    try {
      // ✅ 1단계: videoSaveFolder 설정에서 가져오기
      let videoSaveFolder = await getSetting("videoSaveFolder");

      // ✅ 2단계: 설정이 없으면 현재 프로젝트에서 가져오기 (exe 환경에서 타이밍 이슈 해결)
      if (!videoSaveFolder) {
        console.warn("[handleInsertFromScript] videoSaveFolder 설정이 없음. 현재 프로젝트 확인 중...");

        // 현재 프로젝트 ID 확인
        const currentProjectId = await getSetting("currentProjectId");
        if (currentProjectId) {
          // 프로젝트 목록에서 현재 프로젝트 찾기
          const projects = await getSetting("projects");
          if (Array.isArray(projects)) {
            const currentProject = projects.find(p => p.id === currentProjectId);
            if (currentProject && currentProject.paths && currentProject.paths.root) {
              videoSaveFolder = currentProject.paths.root;
              console.log(`✅ [handleInsertFromScript] 프로젝트 경로 복구: ${videoSaveFolder}`);
            }
          }
        }
      }

      // 폴더가 여전히 설정되지 않았으면 에러
      if (!videoSaveFolder) {
        if (!isAutoLoad) {
          showError("프로젝트 저장 폴더가 설정되지 않았습니다. 설정 탭에서 폴더를 지정해주세요.");
        }
        return;
      }

      // fileManager의 통합 함수 사용
      const result = await loadProjectScriptFiles(videoSaveFolder);
      const { srt, mp3Files, audioFolderPath, loadedSrt, loadedMp3, totalAudioDuration, debugInfo } = result;

      // 상태 업데이트
      if (loadedSrt && srt.length > 0) {
        setScenes(srt);
        setSrtConnected(true);
        setSrtFilePath(`${videoSaveFolder}/scripts/subtitle.srt`);
        setSrtSource("auto");
      }

      if (loadedMp3 && mp3Files.length > 0) {
        setMp3Connected(true);
        setMp3FilePath(audioFolderPath);
        setAudioDur(totalAudioDuration);
      }

      // 결과 표시
      if (loadedSrt && loadedMp3) {
        showSuccess("자막 파일과 오디오 파일을 가져왔습니다.");
      } else if (loadedSrt) {
        showSuccess("자막 파일을 가져왔습니다. (오디오 파일은 대본 탭에서 생성해주세요)");
      } else if (loadedMp3) {
        showSuccess("오디오 파일을 찾았습니다. 자막 파일을 업로드해주세요.");
      } else {
        // 자동 로드면 조용히 실패, 수동 클릭이면 에러 메시지 표시
        if (!isAutoLoad) {
          showError(`가져올 파일이 없습니다.\n\n📍 경로: ${videoSaveFolder}\n\n대본 탭에서 먼저 대본을 생성하세요.`);
          console.debug("[handleInsertFromScript] 디버그 정보:", debugInfo);
        }
      }
    } catch (error) {
      console.error("[handleInsertFromScript] 전체 오류:", error);
      if (!isAutoLoad) {
        showError(`파일을 가져오는 중 오류가 발생했습니다.\n\n❌ ${error.message}`);
      }
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
    setSrtSource(null); // 초기화

    // 파일 입력 필드 초기화
    if (srtInputRef.current) srtInputRef.current.value = "";

    // 대본 생성 페이지도 초기화
    window.dispatchEvent(new CustomEvent("reset-script-generation"));

    // 키워드 추출 상태도 초기화
    window.dispatchEvent(new CustomEvent("reset-keyword-extraction"));

    // 미디어 다운로드 페이지도 초기화
    window.dispatchEvent(new CustomEvent("reset-media-download"));

    // 영상 완성 페이지도 초기화
    window.dispatchEvent(new CustomEvent("reset-media-edit"));
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
    srtSource,

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
    setSrtSource,
  };
};

export default useFileManagement;