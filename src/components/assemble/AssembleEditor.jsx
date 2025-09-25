import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  tokens,
  Body1,
  Body2,
  Text,
  Caption1,
  Spinner,
  Badge,
  Card,
  CardHeader,
  CardFooter,
  Button,
  Field,
  useId,
} from "@fluentui/react-components";
import { PrimaryButton } from "../common";
import {
  Target24Regular,
  MusicNote2Regular,
  TextDescriptionRegular,
  CheckmarkCircle20Filled,
  PlugDisconnected20Regular,
  ArrowUpload24Regular,
  LightbulbFilament24Regular,
  LinkSquare24Regular,
  FolderOpen24Regular,
  DismissCircle24Regular,
} from "@fluentui/react-icons";

// Hooks
import { useFileManagement, useKeywordExtraction } from "../../hooks";

// Utils
import { parseSrtToScenes } from "../../utils/parseSrt";
import { getSetting, setSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
import { handleError } from "@utils";
import { useContainerStyles, useHeaderStyles, useLayoutStyles } from "../../styles/commonStyles";
import { showSuccess, showError } from "../common/GlobalToast";
import FileSelection from "./parts/FileSelection";
import KeywordExtraction from "./parts/KeywordExtraction";

/**
 * AssembleEditor (UI 개선: 모던, 간결, 시각적 위계 강화)
 * - Card 컴포넌트 활용 섹션 분리
 * - DropZone 디자인 간소화 및 상태 명확화
 * - 통계 칩 디자인 및 레이아웃 개선
 */
export default function AssembleEditor() {
  const containerStyles = useContainerStyles();
  const headerStyles = useHeaderStyles();
  const layoutStyles = useLayoutStyles();
  const srtInputId = useId("srt-input");
  const mp3InputId = useId("mp3-input");

  // Custom Hooks
  const fileManagement = useFileManagement();
  const keywordExtraction = useKeywordExtraction();

  // Local state (remaining after hooks extraction)
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(-1);

  // Derived values using hook data
  const totalDur = useMemo(() => {
    if (!fileManagement.scenes.length) return 0;
    const first = Number(fileManagement.scenes[0].start) || 0;
    const last = Number(fileManagement.scenes[fileManagement.scenes.length - 1].end) || 0;
    return Math.max(0, last - first);
  }, [fileManagement.scenes]);

  // 키워드를 프로젝트 설정에 저장하는 함수
  const saveKeywordsToProject = async (keywords) => {
    try {
      const currentProjectId = await getSetting("currentProjectId");
      if (!currentProjectId) {
        console.warn("[키워드 저장] 현재 프로젝트 ID를 찾을 수 없습니다.");
        return false;
      }

      const projects = (await getSetting("projects")) || [];
      const projectIndex = projects.findIndex((p) => p.id === currentProjectId);

      if (projectIndex === -1) {
        console.warn("[키워드 저장] 현재 프로젝트를 찾을 수 없습니다.");
        return false;
      }

      // 키워드 데이터 구조화
      const keywordData = {
        keywords: keywords.map((asset) => asset.keyword),
        extractedAt: new Date().toISOString(),
        totalCount: keywords.length,
        sourceScenes: scenes.length,
      };

      // 프로젝트에 키워드 데이터 추가/업데이트
      projects[projectIndex].extractedKeywords = keywordData;

      // 설정 저장
      await window.api.invoke("settings:update", { projects });
      console.log("[키워드 저장] 성공:", keywords.length, "개 키워드 저장됨");
      return true;
    } catch (error) {
      console.error("[키워드 저장] 실패:", error);
      return false;
    }
  };

  // 프로젝트에서 저장된 키워드를 로드하는 함수
  const loadKeywordsFromProject = async () => {
    try {
      const currentProjectId = await getSetting("currentProjectId");
      if (!currentProjectId) return null;

      const projects = (await getSetting("projects")) || [];
      const currentProject = projects.find((p) => p.id === currentProjectId);

      if (!currentProject?.extractedKeywords) return null;

      const keywordData = currentProject.extractedKeywords;
      const loadedAssets = keywordData.keywords.map((keyword) => ({ keyword }));

      console.log("[키워드 로드] 성공:", loadedAssets.length, "개 키워드 로드됨");
      return {
        assets: loadedAssets,
        extractedAt: keywordData.extractedAt,
        totalCount: keywordData.totalCount,
        sourceScenes: keywordData.sourceScenes,
      };
    } catch (error) {
      console.error("[키워드 로드] 실패:", error);
      return null;
    }
  };

  // Dev helper
  useEffect(() => {
    window.__scenes = scenes;
    // 테스트용 assets 추가 (UI 테스트 목적)
    // if (scenes.length && assets.length === 0) {
    //   addAssets([
    //     { keyword: "역사" }, { keyword: "문화" }, { keyword: "여행" }, { keyword: "기술" }, { keyword: "혁신" },
    //     { keyword: "미래" }, { keyword: "디자인" }, { keyword: "예술" }, { keyword: "교육" }, { keyword: "과학" },
    //     { keyword: "환경" }, { keyword: "지구" }, { keyword: "우주" }, { keyword: "컴퓨터" }, { keyword: "인공지능" },
    //     { keyword: "음악" }, { keyword: "스포츠" }, { keyword: "건강" }, { keyword: "경제" }, { keyword: "정치" },
    //     { keyword: "사회" }, { keyword: "개발" }, { keyword: "프론트엔드" }, { keyword: "리액트" }, { keyword: "플루언트UI" },
    //     { keyword: "스타일" }, { keyword: "성장" },
    //   ]);
    // }
  }, [scenes, assets.length]);

  /* ============================= SRT load & parse (로직 유지) ============================= */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const srtPath = await getSetting("paths.srt");
        if (!srtPath) return;
        if (!cancelled) setSrtFilePath(srtPath); // 파일 경로 상태 설정
        const raw = await readTextAny(srtPath);
        if (cancelled) return;
        const parsed = parseSrtToScenes(raw || "");
        if (!cancelled && parsed.length) {
          setScenes(parsed);
          setSelectedSceneIdx(0);
          setSrtConnected(true);
          console.log("[assemble] SRT scenes:", parsed.length);
        }
      } catch (e) {
        if (!cancelled) {
          const { message } = handleError(e, "assemble_srt_loading", {
            metadata: { action: "load_srt", cancelled },
          });
          console.warn("SRT loading failed:", message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [srtConnected]);

  /* ============================== MP3 duration (로직 유지) =============================== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mp3Path = await getSetting("paths.mp3");
        if (!mp3Path) {
          console.log("[assemble] No MP3 path found");
          setAudioDur(0);
          setMp3Connected(false);
          setMp3FilePath(""); // 파일 경로 초기화
          return;
        }
        if (!cancelled) setMp3FilePath(mp3Path); // 파일 경로 상태 설정
        const dur = await getMp3DurationSafe(mp3Path);
        if (!cancelled && dur) {
          setAudioDur(Number(dur));
          setMp3Connected(true);
          console.log("[assemble] MP3 duration:", dur);
        } else if (!cancelled) {
          setMp3Connected(false);
          setAudioDur(0);
        }
      } catch (e) {
        if (!cancelled) {
          const { message } = handleError(e, "assemble_audio_loading", {
            metadata: { action: "load_audio_duration", cancelled },
          });
          console.warn("MP3 duration query failed:", message);
          setMp3Connected(false);
          setAudioDur(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ============================== LLM Model Loading =============================== */
  useEffect(() => {
    const loadLlmModel = async () => {
      try {
        const llmModel = await getSetting("llmModel");
        setCurrentLlmModel(llmModel || "anthropic");
      } catch (error) {
        console.warn("LLM 모델 로드 실패:", error);
        setCurrentLlmModel("anthropic"); // 기본값
      }
    };

    loadLlmModel();

    // 설정 변경 이벤트 리스너
    const handleSettingsChanged = () => {
      loadLlmModel();
    };

    window.addEventListener("settingsChanged", handleSettingsChanged);

    return () => {
      window.removeEventListener("settingsChanged", handleSettingsChanged);
    };
  }, []); // 의존성 배열을 빈 배열로 변경하고, 수동으로 트리거하는 방식 사용

  /* ============================== Keywords Loading =============================== */
  useEffect(() => {
    const loadSavedKeywords = async () => {
      try {
        const keywordData = await loadKeywordsFromProject();
        if (keywordData && keywordData.assets.length > 0) {
          setAssets(keywordData.assets);

          // 저장된 키워드 로드 성공 메시지
          const extractedDate = new Date(keywordData.extractedAt).toLocaleDateString("ko-KR");
          showSuccess(`이전에 추출된 키워드 ${keywordData.totalCount}개를 불러왔습니다. (${extractedDate})`);

          console.log("[키워드 복원] 성공:", {
            count: keywordData.totalCount,
            extractedAt: keywordData.extractedAt,
            sourceScenes: keywordData.sourceScenes,
          });
        }
      } catch (error) {
        console.warn("[키워드 복원] 실패:", error);
      }
    };

    // 컴포넌트 마운트 시 약간의 지연 후 키워드 로드
    const timeoutId = setTimeout(loadSavedKeywords, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  // MP3 상태 재확인 함수
  const recheckMp3Status = async () => {
    try {
      const mp3Path = await getSetting("paths.mp3");
      if (!mp3Path) {
        setAudioDur(0);
        setMp3Connected(false);
        setMp3FilePath(""); // 파일 경로 초기화
        return;
      }
      setMp3FilePath(mp3Path); // 파일 경로 상태 설정
      const dur = await getMp3DurationSafe(mp3Path);
      if (dur) {
        setAudioDur(Number(dur));
        setMp3Connected(true);
        console.log("[assemble] MP3 재확인 완료 - duration:", dur);
      } else {
        setMp3Connected(false);
        setAudioDur(0);
      }
    } catch (error) {
      console.warn("MP3 상태 재확인 실패:", error);
      setMp3Connected(false);
      setAudioDur(0);
    }
  };

  // SRT 상태 재확인 함수
  const recheckSrtStatus = async () => {
    try {
      const srtPath = await getSetting("paths.srt");
      if (!srtPath) {
        setScenes([]);
        setSrtConnected(false);
        setSrtFilePath(""); // 파일 경로 초기화
        return;
      }
      setSrtFilePath(srtPath); // 파일 경로 상태 설정
      const raw = await readTextAny(srtPath);
      const parsed = parseSrtToScenes(raw || "");
      if (parsed.length) {
        setScenes(parsed);
        setSelectedSceneIdx(0);
        setSrtConnected(true);
        console.log("[assemble] SRT 재확인 완료 - scenes:", parsed.length);
      } else {
        setSrtConnected(false);
        setScenes([]);
      }
    } catch (error) {
      console.warn("SRT 상태 재확인 실패:", error);
      setSrtConnected(false);
      setScenes([]);
    }
  };

  /* ============================== Handlers =================================== */
  const handleSrtUpload = async (file) => {
    try {
      console.log("SRT 파일 업로드:", file.name);
      console.log("파일 경로:", file.path);

      // 파일 경로가 있는지 확인
      if (!file.path) {
        console.error("파일 경로가 없습니다:", file);
        return;
      }

      // 파일 경로를 설정에 저장
      await setSetting({ key: "paths.srt", value: file.path });
      setSrtFilePath(file.path); // 파일 경로 상태 설정

      // 상태 재확인
      await recheckSrtStatus();

      console.log("✅ SRT 파일이 성공적으로 연결되었습니다:", file.path);
    } catch (error) {
      console.error("SRT 파일 업로드 실패:", error);
      const { message } = handleError(error, "srt_upload_error", {
        metadata: { fileName: file.name, filePath: file.path },
      });
    }
  };

  const handleMp3Upload = async (file) => {
    try {
      console.log("MP3 파일 업로드:", file.name);
      console.log("파일 경로:", file.path);

      // 파일 경로가 있는지 확인
      if (!file.path) {
        console.error("파일 경로가 없습니다:", file);
        return;
      }

      // 파일 경로를 설정에 저장
      await setSetting({ key: "paths.mp3", value: file.path });
      setMp3FilePath(file.path); // 파일 경로 상태 설정

      // 상태 재확인
      await recheckMp3Status();

      console.log("✅ MP3 파일이 성공적으로 연결되었습니다:", file.path);
    } catch (error) {
      console.error("MP3 파일 업로드 실패:", error);
      const { message } = handleError(error, "mp3_upload_error", {
        metadata: { fileName: file.name, filePath: file.path },
      });
    }
  };

  const handleInsertFromScript = async () => {
    try {
      console.log("🔗 대본에서 파일 가져오기 시작...");

      // videoSaveFolder에서 대본 생성된 파일들 찾기
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

      if (!videoSaveFolder) {
        console.warn("⚠️ 영상 저장 폴더가 설정되지 않았습니다.");
        return;
      }

      console.log("📁 영상 저장 폴더:", videoSaveFolder);

      // 예상되는 파일 경로들 확인
      const expectedSrtPath = `${videoSaveFolder}/scripts/subtitle.srt`;
      const expectedMp3Path = `${videoSaveFolder}/audio/default.mp3`;

      let foundSrt = null;
      let foundMp3 = null;

      // SRT 파일 확인
      console.log("🔍 SRT 파일 경로 확인:", expectedSrtPath);
      try {
        const srtExists = await window.api.invoke("files:exists", expectedSrtPath);
        console.log("📄 SRT 파일 존재 여부:", srtExists);
        if (srtExists) {
          foundSrt = expectedSrtPath;
          console.log("✅ SRT 파일 발견:", foundSrt);
        }
      } catch (error) {
        console.log("SRT 파일 확인 중 오류:", error);
      }

      // MP3 파일 확인
      console.log("🔍 MP3 파일 경로 확인:", expectedMp3Path);
      try {
        const mp3Exists = await window.api.invoke("files:exists", expectedMp3Path);
        console.log("🎵 MP3 파일 존재 여부:", mp3Exists);
        if (mp3Exists) {
          foundMp3 = expectedMp3Path;
          console.log("✅ MP3 파일 발견:", foundMp3);
        }
      } catch (error) {
        console.log(`MP3 파일 확인 중 오류 (${expectedMp3Path}):`, error);
      }

      // 파일이 발견되면 설정에 저장
      let insertedCount = 0;

      if (foundSrt) {
        await setSetting({ key: "paths.srt", value: foundSrt });
        await recheckSrtStatus();
        insertedCount++;
        console.log("🎯 SRT 파일 연결 완료:", foundSrt);
      }

      if (foundMp3) {
        await setSetting({ key: "paths.mp3", value: foundMp3 });
        await recheckMp3Status();
        insertedCount++;
        console.log("🎯 MP3 파일 연결 완료:", foundMp3);
      }

      if (insertedCount === 0) {
        console.warn("⚠️ 대본에서 생성된 파일을 찾을 수 없습니다.");
        console.log("예상 경로들:");
        console.log("- SRT:", expectedSrtPath);
        console.log("- MP3:", expectedMp3Path);
        showError("파일을 찾을 수 없습니다.\n예상 위치:\n• audio/default.mp3\n• scripts/subtitle.srt");
      } else {
        console.log(`✅ ${insertedCount}개 파일이 성공적으로 연결되었습니다.`);
        showSuccess(`${insertedCount}개 파일이 성공적으로 연결되었습니다.`);
      }
    } catch (error) {
      console.error("❌ 대본 파일 가져오기 실패:", error);
      const { message } = handleError(error, "script_import_error", {
        metadata: { action: "import_from_script" },
      });
      showError("대본 파일 가져오기에 실패했습니다. 다시 시도해주세요.");
    }
  };

  // 프로젝트명 가져오기 헬퍼 함수
  const getProjectName = async () => {
    try {
      const projectName = await window.api.getSetting("projectName");
      return projectName?.value || projectName || "project";
    } catch (error) {
      console.warn("프로젝트명 가져오기 실패:", error);
      return "project";
    }
  };

  // 저장된 키워드를 프로젝트에서 삭제하는 함수
  const clearKeywordsFromProject = async () => {
    try {
      const currentProjectId = await getSetting("currentProjectId");
      if (!currentProjectId) return false;

      const projects = (await getSetting("projects")) || [];
      const projectIndex = projects.findIndex((p) => p.id === currentProjectId);

      if (projectIndex === -1) return false;

      // 프로젝트에서 키워드 데이터 삭제
      if (projects[projectIndex].extractedKeywords) {
        delete projects[projectIndex].extractedKeywords;

        // 설정 저장
        await window.api.invoke("settings:update", { projects });
        console.log("[키워드 삭제] 저장된 키워드 데이터가 삭제되었습니다.");
        return true;
      }
      return false;
    } catch (error) {
      console.error("[키워드 삭제] 실패:", error);
      return false;
    }
  };

  // 초기화 함수
  const handleReset = async () => {
    try {
      console.log("🔄 파일 연결 초기화 시작...");

      // 설정에서 경로 제거
      await setSetting({ key: "paths.srt", value: "" });
      await setSetting({ key: "paths.mp3", value: "" });

      // 저장된 키워드 데이터 삭제
      await clearKeywordsFromProject();

      // 상태 초기화
      setSrtConnected(false);
      setMp3Connected(false);
      setScenes([]);
      setAssets([]);
      setAudioDur(0);
      setSelectedSceneIdx(-1);

      console.log("✅ 파일 연결이 초기화되었습니다.");
    } catch (error) {
      console.error("❌ 초기화 실패:", error);
      const { message } = handleError(error, "reset_error", {
        metadata: { action: "reset_file_connections" },
      });
    }
  };

  const handleExtractKeywords = async () => {
    if (!srtConnected || isExtracting) return;
    setIsExtracting(true);
    setAssets([]);

    try {
      console.log("[키워드 추출] 시작:", scenes.length, "개 씬");

      // IPC로 키워드 추출 요청
      const result = await window.api.invoke("ai:extractKeywords", {
        subtitles: scenes.map((scene, index) => ({
          index: index,
          text: scene.text,
          start: scene.start,
          end: scene.end,
        })),
      });

      // 성공 여부 확인
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      if (result.keywords && Object.keys(result.keywords).length > 0) {
        const extractedAssets = [];

        // 결과를 assets 형태로 변환
        Object.entries(result.keywords).forEach(([index, keywords]) => {
          if (Array.isArray(keywords)) {
            keywords.forEach((keyword) => {
              if (keyword && keyword.trim()) {
                extractedAssets.push({ keyword: keyword.trim() });
              }
            });
          }
        });

        // 중복 제거
        const uniqueAssets = extractedAssets.filter((asset, index, self) => index === self.findIndex((a) => a.keyword === asset.keyword));

        const duration = result.duration ? ` (${Math.round(result.duration / 1000)}초 소요)` : "";
        console.log("[키워드 추출] 완료:", uniqueAssets.length, "개 키워드", duration);

        addAssets(uniqueAssets);

        // 키워드를 프로젝트에 자동 저장
        const saveResult = await saveKeywordsToProject(uniqueAssets);
        if (saveResult) {
          showSuccess(`${uniqueAssets.length}개 키워드가 추출되어 저장되었습니다.${duration}`);
        } else {
          showSuccess(`${uniqueAssets.length}개 키워드가 추출되었습니다.${duration} (저장 실패)`);
        }
      } else {
        console.warn("[키워드 추출] 키워드가 추출되지 않았습니다.");
        showError("키워드가 추출되지 않았습니다. 자막 내용을 확인해주세요.");
      }
    } catch (error) {
      console.error("[키워드 추출] 실패:", error);
      const errorMessage = error.message || "알 수 없는 오류가 발생했습니다.";
      showError(`키워드 추출에 실패했습니다.\n${errorMessage}\n\n전역 설정 > 기본 설정에서 LLM 모델과 API 키를 확인해주세요.`);
    } finally {
      setIsExtracting(false);
    }
  };

  const openSrtPicker = useCallback(() => srtInputRef.current?.click(), []);
  const openMp3Picker = useCallback(() => mp3InputRef.current?.click(), []);

  /* ============================== UI Helpers ================================= */

  // StatChip은 컴포넌트 구조를 위해 인라인 스타일 대신 클래스/유틸리티 스타일을 더 활용하거나
  // Card 내부의 세련된 리스트 아이템으로 대체합니다. 여기서는 CardFooter와 함께 사용하도록 수정합니다.
  const StatItem = ({ label, value, icon, color, isLast }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacingVerticalXXS,
        flex: "1 1 100px",
        padding: tokens.spacingVerticalXS,
        borderRight: isLast ? "none" : `1px solid ${tokens.colorNeutralStroke2}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {icon}
        <Caption1 style={{ fontWeight: "600", color: tokens.colorNeutralForeground2 }}>{label}</Caption1>
      </div>
      <Body2
        style={{
          fontWeight: "700",
          color: color || tokens.colorNeutralForeground1,
        }}
      >
        {value}
      </Body2>
    </div>
  );

  const DropZone = ({ icon, label, caption, connected, onClick, inputRef, accept, onChange, inputId }) => {
    // 더 생생한 색상으로 개선
    const iconColor = connected ? tokens.colorPaletteGreenForeground1 : tokens.colorBrandForeground1;
    const hoverBg = connected ? tokens.colorPaletteGreenBackground3 : tokens.colorBrandBackground2;
    const ringColor = connected ? tokens.colorPaletteGreenBorderActive : tokens.colorBrandStroke1;
    const cardBg = connected ? tokens.colorPaletteGreenBackground1 : tokens.colorNeutralBackground1;
    const textColor = connected ? tokens.colorPaletteGreenForeground2 : tokens.colorBrandForeground1;

    // 드래그 앤 드롭 상태
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        // 파일 확장자 체크
        const acceptedTypes = accept.split(",").map((type) => type.trim().toLowerCase());
        const fileName = files[0].name.toLowerCase();
        const fileExtension = "." + fileName.split(".").pop();

        if (acceptedTypes.includes(fileExtension)) {
          onChange?.(files[0]);
        } else {
          console.warn(`지원하지 않는 파일 형식입니다. 허용된 형식: ${accept}`);
        }
      }
    };

    return (
      <Card
        appearance="outline"
        style={{
          height: "100%",

          boxShadow: isDragOver
            ? `0 0 0 3px ${tokens.colorBrandStroke1}, 0 8px 32px rgba(0, 120, 212, 0.25)`
            : connected
            ? `0 0 0 2px ${ringColor}, 0 4px 16px rgba(34, 139, 34, 0.15)`
            : `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 2px 8px rgba(0, 0, 0, 0.08)`,
          transition: "all 200ms cubic-bezier(0.23, 1, 0.32, 1)",
          cursor: "pointer",
          backgroundColor: isDragOver ? tokens.colorBrandBackground2 : cardBg,
          display: "flex",
          flexDirection: "column",
          transform: isDragOver ? "scale(1.02)" : "translateY(0)",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={onClick}
        tabIndex={0}
        aria-labelledby={inputId}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseEnter={(e) => {
          if (!isDragOver) {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = connected
              ? `0 0 0 2px ${ringColor}, 0 8px 24px rgba(34, 139, 34, 0.2)`
              : `0 0 0 1px ${tokens.colorBrandStroke1}, 0 6px 20px rgba(0, 0, 0, 0.12)`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragOver) {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = connected
              ? `0 0 0 2px ${ringColor}, 0 4px 16px rgba(34, 139, 34, 0.15)`
              : `0 0 0 1px ${tokens.colorNeutralStroke2}, 0 2px 8px rgba(0, 0, 0, 0.08)`;
          }
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
            minHeight: "200px",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                onChange?.(e.target.files[0]);
                e.target.value = null;
              }
            }}
            id={inputId}
          />
          <div
            style={{
              color: isDragOver ? tokens.colorBrandForeground1 : iconColor,
              marginBottom: tokens.spacingVerticalS,
              transition: "all 200ms ease",
              fontSize: "24px",
              filter: connected
                ? "drop-shadow(0 2px 4px rgba(34, 139, 34, 0.3))"
                : isDragOver
                ? "drop-shadow(0 2px 8px rgba(0, 120, 212, 0.4))"
                : "none",
              transform: isDragOver ? "scale(1.1)" : "scale(1)",
            }}
          >
            {connected ? <CheckmarkCircle20Filled /> : <ArrowUpload24Regular />}
          </div>
          <Text
            size={400}
            weight="semibold"
            id={inputId}
            style={{
              marginBottom: tokens.spacingVerticalS,
              color: isDragOver ? tokens.colorBrandForeground1 : textColor,
              transition: "color 200ms ease",
            }}
          >
            {isDragOver ? "파일을 여기에 드롭하세요" : label}
          </Text>
          <Caption1
            style={{
              color: isDragOver
                ? tokens.colorBrandForeground2
                : connected
                ? tokens.colorPaletteGreenForeground3
                : tokens.colorNeutralForeground3,
              textAlign: "center",
              transition: "color 200ms ease",
            }}
          >
            {isDragOver ? `${accept} 파일만 지원됩니다` : caption}
          </Caption1>
        </div>
        <CardFooter>
          <Button
            appearance={connected ? "primary" : "outline"}
            size="small"
            icon={connected ? <CheckmarkCircle20Filled /> : icon}
            onClick={onClick}
            style={{
              width: "100%",
              minWidth: "200px",
              backgroundColor: connected ? tokens.colorPaletteGreenBackground1 : "transparent",
              borderColor: connected ? tokens.colorPaletteGreenBorderActive : tokens.colorBrandStroke1,
              color: connected ? tokens.colorPaletteGreenForeground1 : textColor,
              fontWeight: 600,
              transition: "all 200ms ease",
            }}
          >
            {connected ? "연결 완료" : "파일 선택"}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const ChipsWrap = ({ items }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
        justifyContent: "center",
        alignItems: "start",
        maxWidth: "100%",
        margin: "0 auto",
        padding: `0 ${tokens.spacingHorizontalS}`,
      }}
    >
      {items}
    </div>
  );

  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Header */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <Target24Regular />
          미디어 준비
        </div>
        <div className={headerStyles.pageDescription}>자막과 오디오 파일을 업로드하고 AI로 키워드를 추출하여 영상 제작을 준비하세요.</div>
        <div className={headerStyles.divider} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 300,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacingVerticalM,
              alignItems: "center",
            }}
          >
            <Spinner size="large" />
            <Body1 style={{ fontWeight: 600 }}>프로젝트를 불러오는 중입니다...</Body1>
          </div>
        </div>
      )}

      {/* Main */}
      {!isLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacingVerticalXXL,
          }}
        >
          {/* 파일 선택 섹션 */}
          <FileSelection
            DropZone={DropZone}
            srtConnected={fileManagement.srtConnected}
            srtFilePath={fileManagement.srtFilePath}
            scenes={fileManagement.scenes}
            totalDur={totalDur}
            getFileInfo={fileManagement.getFileInfo}
            openSrtPicker={fileManagement.openSrtPicker}
            srtInputRef={fileManagement.srtInputRef}
            handleSrtUpload={fileManagement.handleSrtUpload}
            srtInputId={srtInputId}
            mp3Connected={fileManagement.mp3Connected}
            mp3FilePath={fileManagement.mp3FilePath}
            audioDur={fileManagement.audioDur}
            openMp3Picker={fileManagement.openMp3Picker}
            mp3InputRef={fileManagement.mp3InputRef}
            handleMp3Upload={fileManagement.handleMp3Upload}
            mp3InputId={mp3InputId}
            handleInsertFromScript={fileManagement.handleInsertFromScript}
            handleReset={fileManagement.handleReset}
          />

          {/* 통계 요약 카드 */}
          <Card
            style={{
              padding: "12px 16px",
              borderRadius: "16px",
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              height: "fit-content",
            }}
          >
            <CardFooter
              style={{
                borderTop: "none",
                padding: tokens.spacingVerticalS,
                backgroundColor: tokens.colorNeutralBackground2,
                display: "flex",
                justifyContent: "space-around",
                gap: tokens.spacingHorizontalS,
              }}
            >
              <StatItem
                label="SRT 자막 파일"
                value={fileManagement.srtConnected ? "완료" : "미연결"}
                color={fileManagement.srtConnected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
                icon={
                  fileManagement.srtConnected ? (
                    <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} />
                  ) : (
                    <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />
                  )
                }
              />
              <StatItem
                label="MP3 파일"
                value={fileManagement.mp3Connected ? "완료" : "미연결"}
                color={fileManagement.mp3Connected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
                icon={
                  fileManagement.mp3Connected ? (
                    <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} />
                  ) : (
                    <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />
                  )
                }
              />
              <StatItem
                label="씬 수"
                value={`${fileManagement.scenes.length}개`}
                color={fileManagement.scenes.length > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
              />
              <StatItem
                label="총 영상 길이"
                value={fileManagement.scenes.length > 0 ? `${totalDur.toFixed(1)}초` : "0초"}
                color={fileManagement.scenes.length > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
                isLast={true}
              />
            </CardFooter>
          </Card>

          {/* 키워드 추출 섹션 */}
          <KeywordExtraction
            srtConnected={fileManagement.srtConnected}
            isExtracting={keywordExtraction.isExtracting}
            handleExtractKeywords={() => keywordExtraction.handleExtractKeywords(fileManagement.scenes)}
            assets={keywordExtraction.assets}
            scenes={fileManagement.scenes}
            currentLlmModel={keywordExtraction.currentLlmModel}
            getLlmDisplayName={keywordExtraction.getLlmDisplayName}
            ChipsWrap={ChipsWrap}
          />
        </div>
      )}
    </div>
  );
}
