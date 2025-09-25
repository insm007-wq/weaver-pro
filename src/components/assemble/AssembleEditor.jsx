import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  tokens,
  Body1,
  Body2,
  Text,
  Caption1,
  Spinner,
  Badge,
  // Card 및 CardHeader, CardFooter 등을 활용하여 더 세련된 섹션 구성
  Card,
  CardHeader,
  CardFooter,
  Button, // PrimaryButton 대신 Fluent Button 사용 권장 (혹은 기존 Common 컴포넌트 유지)
  Field,
  useId,
} from "@fluentui/react-components";
import { PrimaryButton } from "../common"; // 기존 컴포넌트 유지
import {
  Target24Regular,
  MusicNote2Regular,
  TextDescriptionRegular,
  CheckmarkCircle20Filled, // 연결 성공 아이콘 (Filled로 강조)
  PlugDisconnected20Regular, // 미연결 아이콘
  ArrowUpload24Regular, // 업로드 아이콘
  LightbulbFilament24Regular, // AI 아이콘 변경
  LinkSquare24Regular, // 대본 연결 아이콘
  FolderOpen24Regular, // 파일 선택 아이콘
  DismissCircle24Regular, // 초기화 아이콘
} from "@fluentui/react-icons";

// Utils
import { parseSrtToScenes } from "../../utils/parseSrt";
import { getSetting, setSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
import { handleError } from "@utils";
import { useContainerStyles, useHeaderStyles, useLayoutStyles } from "../../styles/commonStyles";
import { showSuccess, showError } from "../common/GlobalToast";

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

  // State
  const [scenes, setScenes] = useState([]);
  const [assets, setAssets] = useState([]);
  const [srtConnected, setSrtConnected] = useState(false);
  const [mp3Connected, setMp3Connected] = useState(false);
  const [audioDur, setAudioDur] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false); // 키워드 추출 로딩 상태 추가
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(-1);
  const [srtFilePath, setSrtFilePath] = useState(""); // SRT 파일 경로
  const [mp3FilePath, setMp3FilePath] = useState(""); // MP3 파일 경로
  const [currentLlmModel, setCurrentLlmModel] = useState(""); // 현재 LLM 모델

  // Refs
  const srtInputRef = useRef(null);
  const mp3InputRef = useRef(null);

  // Derived
  const totalDur = useMemo(() => {
    if (!scenes.length) return 0;
    // ... 기존 로직 유지
    const first = Number(scenes[0].start) || 0;
    const last = Number(scenes[scenes.length - 1].end) || 0;
    return Math.max(0, last - first);
  }, [scenes]);

  const addAssets = (items) => setAssets((prev) => [...prev, ...items]);

  // 파일명과 경로 정보를 가져오는 헬퍼 함수
  const getFileInfo = (filePath) => {
    if (!filePath) return { fileName: "", folderPath: "", displayPath: "" };

    const normalizedPath = filePath.replace(/\\/g, "/");
    const fileName = normalizedPath.split("/").pop() || "";
    const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
    const displayPath = folderPath.length > 50 ? "..." + folderPath.slice(-47) : folderPath;

    return { fileName, folderPath, displayPath };
  };

  // LLM 모델명을 사용자 친화적으로 표시하는 헬퍼 함수
  const getLlmDisplayName = (model) => {
    const modelMap = {
      anthropic: "🤖 Anthropic Claude",
      openai: "🤖 OpenAI GPT",
      "openai-gpt5mini": "🤖 OpenAI GPT-4o Mini",
      "google-gemini": "🤖 Google Gemini",
      gemini: "🤖 Google Gemini",
    };
    return modelMap[model] || `🤖 ${model}`;
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

  // 초기화 함수
  const handleReset = async () => {
    try {
      console.log("🔄 파일 연결 초기화 시작...");

      // 설정에서 경로 제거
      await setSetting({ key: "paths.srt", value: "" });
      await setSetting({ key: "paths.mp3", value: "" });

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
        showSuccess(`${uniqueAssets.length}개 키워드가 추출되었습니다.${duration}`);
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
        display: "flex",
        flexWrap: "wrap",
        gap: tokens.spacingHorizontalS,
        justifyContent: "center",
        maxWidth: "100%",
        margin: "0 auto",
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
          영상 구성
        </div>
        <div className={headerStyles.pageDescription}>SRT 파일과 오디오를 결합하여 완성된 영상을 만드세요.</div>
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
          {/* 파일 업로드 섹션 */}
          <Card
            style={{
              padding: "12px 16px",
              borderRadius: "16px",
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              height: "fit-content",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ marginBottom: tokens.spacingVerticalS }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FolderOpen24Regular />
                  <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
                    파일 선택
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: tokens.spacingHorizontalS,
                    alignItems: "center",
                  }}
                >
                  <Button
                    appearance="subtle"
                    icon={<LinkSquare24Regular />}
                    onClick={handleInsertFromScript}
                    size="medium"
                    style={{
                      color: tokens.colorBrandForeground1,
                      fontWeight: 600,
                      height: "36px",
                      minHeight: "36px",
                      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
                      alignItems: "center",
                      display: "flex",
                      minWidth: "160px",
                    }}
                  >
                    대본에서 가져오기
                  </Button>
                  <Button
                    appearance="subtle"
                    icon={<DismissCircle24Regular />}
                    onClick={handleReset}
                    size="medium"
                    style={{
                      color: tokens.colorNeutralForeground3,
                      fontWeight: 600,
                      height: "36px",
                      minHeight: "36px",
                      padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
                      alignItems: "center",
                      display: "flex",
                    }}
                  >
                    초기화
                  </Button>
                </div>
              </div>
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground3,
                  marginTop: 4,
                  display: "block",
                }}
              >
                파일을 드래그하거나 버튼을 클릭하여 업로드하세요
              </Text>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: tokens.spacingHorizontalL,
                padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
              }}
            >
              <DropZone
                icon={<TextDescriptionRegular />}
                label="SRT 자막 파일"
                caption={
                  srtConnected && srtFilePath ? (
                    <div style={{ whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.3, fontSize: "13px" }}>
                      {`📁 ${getFileInfo(srtFilePath).displayPath}\n📄 ${getFileInfo(srtFilePath).fileName} (${
                        scenes.length
                      }개 씬, ${totalDur.toFixed(1)}초)`}
                    </div>
                  ) : (
                    "SRT 파일 업로드 (.srt)"
                  )
                }
                connected={srtConnected}
                onClick={openSrtPicker}
                inputRef={srtInputRef}
                accept=".srt"
                onChange={handleSrtUpload}
                inputId={srtInputId}
              />

              <DropZone
                icon={<MusicNote2Regular />}
                label="오디오 파일 (MP3/WAV/M4A)"
                caption={
                  mp3Connected && mp3FilePath && audioDur > 0 ? (
                    <div style={{ whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.3, fontSize: "13px" }}>
                      {`📁 ${getFileInfo(mp3FilePath).displayPath}\n🎵 ${getFileInfo(mp3FilePath).fileName} (${audioDur.toFixed(1)}초)`}
                    </div>
                  ) : (
                    "MP3, WAV, M4A 지원"
                  )
                }
                connected={mp3Connected}
                onClick={openMp3Picker}
                inputRef={mp3InputRef}
                accept=".mp3,.wav,.m4a"
                onChange={handleMp3Upload}
                inputId={mp3InputId}
              />
            </div>

            {/* 통계 요약 (CardFooter 활용) */}
            <CardFooter
              style={{
                borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
                padding: tokens.spacingVerticalS,
                backgroundColor: tokens.colorNeutralBackground2,
                display: "flex",
                justifyContent: "space-around",
                gap: tokens.spacingHorizontalS,
              }}
            >
              <StatItem
                label="SRT 자막 파일"
                value={srtConnected ? "완료" : "미연결"}
                color={srtConnected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
                icon={
                  srtConnected ? (
                    <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} />
                  ) : (
                    <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />
                  )
                }
              />
              <StatItem
                label="MP3 파일"
                value={mp3Connected ? "완료" : "미연결"}
                color={mp3Connected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
                icon={
                  mp3Connected ? (
                    <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} />
                  ) : (
                    <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />
                  )
                }
              />
              <StatItem
                label="씬 수"
                value={`${scenes.length}개`}
                color={scenes.length > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
              />
              <StatItem
                label="총 영상 길이"
                value={scenes.length > 0 ? `${totalDur.toFixed(1)}초` : "0초"}
                color={scenes.length > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
                isLast={true}
              />
            </CardFooter>
          </Card>

          {/* AI 키워드 추출 섹션 */}
          <Card
            style={{
              padding: "12px 16px",
              borderRadius: "16px",
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              height: "fit-content",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ marginBottom: tokens.spacingVerticalS }}>
              {" "}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <LightbulbFilament24Regular />
                  <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
                    AI 키워드 추출
                  </Text>
                </div>
                {currentLlmModel && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      backgroundColor: tokens.colorBrandBackground2,
                      border: `1px solid ${tokens.colorBrandStroke1}`,
                      borderRadius: tokens.borderRadiusMedium,
                      fontSize: "12px",
                      fontWeight: 600,
                      color: tokens.colorBrandForeground1,
                    }}
                  >
                    <div style={{ fontSize: "14px" }}>🤖</div>
                    <Text size={200} weight="semibold" style={{ color: "inherit" }}>
                      {getLlmDisplayName(currentLlmModel).replace("🤖 ", "")}
                    </Text>
                  </div>
                )}
              </div>
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground3,
                  marginTop: 4,
                  display: "block",
                }}
              >
                SRT 내용을 분석하여 자동으로 영상 소스 검색 키워드를 추출합니다.
              </Text>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacingVerticalL,
              }}
            >
              <PrimaryButton
                size="large"
                style={{ height: 48, maxWidth: 480, alignSelf: "center" }}
                disabled={!srtConnected || isExtracting}
                onClick={handleExtractKeywords}
              >
                {isExtracting ? (
                  <>
                    <Spinner size="tiny" style={{ marginRight: tokens.spacingHorizontalS }} />
                    키워드 추출 중...
                  </>
                ) : (
                  "🤖 키워드 추출 시작"
                )}
              </PrimaryButton>

              {/* 결과 영역 */}
              <div
                style={{
                  minHeight: 200,
                  border: `1px solid ${tokens.colorNeutralStroke2}`,
                  borderRadius: tokens.borderRadiusLarge,
                  padding: tokens.spacingVerticalL,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.colorNeutralBackground2, // 배경색을 더 밝게 변경
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
                }}
              >
                {assets.length > 0 ? (
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <Body1
                      style={{
                        color: tokens.colorBrandForeground1,
                        fontWeight: 600,
                        marginBottom: tokens.spacingVerticalM,
                      }}
                    >
                      ✅ {assets.length}개 키워드 추출 완료
                    </Body1>

                    <ChipsWrap
                      items={assets
                        .slice(0, 30)
                        .map(
                          (
                            asset,
                            index // 한 줄에 더 많은 칩 표시 가능하도록 갯수 조정
                          ) => (
                            <Badge
                              key={index}
                              appearance="tint" // 칩을 Badge로 대체하여 통일된 디자인 사용
                              color="brand"
                              size="medium"
                              style={{
                                cursor: "default",
                                fontSize: tokens.fontSizeBase200,
                                lineHeight: 1,
                              }}
                            >
                              {asset.keyword || `키워드 ${index + 1}`}
                            </Badge>
                          )
                        )
                        .concat(
                          assets.length > 30
                            ? [
                                <Badge
                                  key="more"
                                  appearance="outline"
                                  color="neutral"
                                  size="medium"
                                  style={{
                                    cursor: "default",
                                    fontSize: tokens.fontSizeBase200,
                                    lineHeight: 1,
                                  }}
                                >
                                  +{assets.length - 30}개 더
                                </Badge>,
                              ]
                            : []
                        )}
                    />
                  </div>
                ) : isExtracting ? (
                  // 추출 중 상태
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: tokens.spacingVerticalM,
                      alignItems: "center",
                    }}
                  >
                    <Spinner size="medium" />
                    <Body1 style={{ color: tokens.colorBrandForeground1 }}>키워드를 정밀하게 분석 중입니다...</Body1>
                  </div>
                ) : (
                  // 초기 상태
                  <div style={{ textAlign: "center", maxWidth: 520, width: "100%", margin: "0 auto" }}>
                    <Body2
                      style={{
                        color: tokens.colorNeutralForeground3,
                        marginBottom: tokens.spacingVerticalM,
                        display: "block",
                        textAlign: "center",
                      }}
                    >
                      {srtConnected
                        ? "키워드 추출 버튼을 눌러 영상 소스 검색을 시작하세요"
                        : "SRT 파일을 먼저 업로드해야 키워드 추출이 가능합니다"}
                    </Body2>
                    <Caption1
                      style={{
                        color: tokens.colorNeutralForeground3,
                        display: "block",
                        marginTop: tokens.spacingVerticalS,
                        textAlign: "center",
                      }}
                    >
                      추출된 키워드를 기반으로 영상 제작에 필요한 소스를 자동으로 검색 및 추천합니다.
                    </Caption1>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
