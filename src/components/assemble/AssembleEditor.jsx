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
} from "@fluentui/react-icons";

// Utils
import { parseSrtToScenes } from "../../utils/parseSrt";
import { getSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
import { handleError } from "@utils";
import {
  useContainerStyles,
  useHeaderStyles,
  useLayoutStyles,
} from "../../styles/commonStyles";

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
        if (mp3Connected === false) {
          console.log("[assemble] MP3 connection cleared, skipping load");
          setAudioDur(0);
          return;
        }
        const mp3Path = await getSetting("paths.mp3");
        if (!mp3Path) {
          console.log("[assemble] No MP3 path found");
          setAudioDur(0);
          return;
        }
        const dur = await getMp3DurationSafe(mp3Path);
        if (!cancelled && dur) {
          setAudioDur(Number(dur));
          setMp3Connected(true);
          console.log("[assemble] MP3 duration:", dur);
        }
      } catch (e) {
        if (!cancelled) {
          const { message } = handleError(e, "assemble_audio_loading", {
            metadata: { action: "load_audio_duration", cancelled },
          });
          console.warn("MP3 duration query failed:", message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mp3Connected]);

  /* ============================== Handlers =================================== */
  const handleSrtUpload = async (file) => {
    // 실제 파일 업로드 및 로직 연결
    console.log("SRT file uploaded:", file);
  };

  const handleMp3Upload = async (file) => {
    // 실제 파일 업로드 및 로직 연결
    console.log("MP3 file uploaded:", file);
  };

  const handleExtractKeywords = () => {
    if (!srtConnected || isExtracting) return;
    setIsExtracting(true);
    setAssets([]); // 추출 시작 시 기존 결과 초기화

    // ************* 실제 키워드 추출 로직 (가상 구현) *************
    setTimeout(() => {
      const mockAssets = scenes.slice(0, 10).map((scene, index) => ({
        keyword: `키워드-${index + 1}-${scene.text.slice(0, 4)}`,
      }));
      addAssets(mockAssets);
      setIsExtracting(false);
    }, 2000); // 2초간 로딩 시뮬레이션
    // *************************************************************
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
        gap: tokens.spacingVerticalXS,
        flex: "1 1 120px",
        padding: tokens.spacingVerticalS,
        borderRight: isLast ? "none" : `1px solid ${tokens.colorNeutralStroke2}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {icon}
        <Body2 style={{ fontWeight: "600", color: tokens.colorNeutralForeground2 }}>{label}</Body2>
      </div>
      <Body1 style={{ fontWeight: "700", color: color || tokens.colorNeutralForeground1 }}>{value}</Body1>
    </div>
  );

  const DropZone = ({ icon, label, caption, connected, onClick, inputRef, accept, onChange, inputId }) => {
    const iconColor = connected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3;
    const hoverBg = connected ? tokens.colorPaletteLightGreenBackground3 : tokens.colorNeutralBackground3;
    const ringColor = connected ? tokens.colorPaletteLightGreenBorderActive : tokens.colorBrandStroke1;
    const cardBg = connected ? tokens.colorPaletteLightGreenBackground2 : tokens.colorNeutralBackground1;

    return (
      <Card
        appearance="outline"
        style={{
          height: "100%",
          boxShadow: connected ? `0 0 0 1px ${tokens.colorPaletteLightGreenBorderActive}` : tokens.shadow2,
          transition: "all 150ms ease-out",
          cursor: "pointer",
          backgroundColor: cardBg,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={onClick}
        tabIndex={0}
        aria-labelledby={inputId}
      >
        <div // CardContent
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: tokens.spacingVerticalL,
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
                // 파일 선택 후 input 리셋 (같은 파일 다시 선택 가능하도록)
                e.target.value = null;
              }
            }}
            id={inputId}
          />
          <div style={{
            color: iconColor,
            marginBottom: tokens.spacingVerticalS,
            transition: "transform 150ms ease",
          }}>
            {connected ? <CheckmarkCircle20Filled /> : <ArrowUpload24Regular />}
          </div>
          <Text size={400} weight="semibold" id={inputId} style={{ marginBottom: tokens.spacingVerticalS }}>
            {label}
          </Text>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, textAlign: "center" }}>
            {caption}
          </Caption1>
        </div>
        <CardFooter>
          <Button
            appearance={connected ? "primary" : "outline"}
            size="small"
            icon={connected ? <CheckmarkCircle20Filled /> : icon}
            onClick={onClick}
            style={{ width: "100%" }}
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
          <Text size={700} weight="bold">영상 구성 에디터</Text>
          {srtConnected && (<Badge size="extra-small" appearance="filled" color="success" style={{ marginLeft: 8 }}>SRT 연결됨</Badge>)}
          {mp3Connected && (<Badge size="extra-small" appearance="filled" color="success" style={{ marginLeft: 6 }}>오디오 연결됨</Badge>)}
        </div>
        <div className={headerStyles.pageDescription}>SRT 파일과 오디오를 결합하여 완성된 영상을 만드세요.</div>
        <div className={headerStyles.divider} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, alignItems: "center" }}>
            <Spinner size="large" />
            <Body1 style={{ fontWeight: 600 }}>프로젝트를 불러오는 중입니다...</Body1>
          </div>
        </div>
      )}

      {/* Main */}
      {!isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL }}>

          {/* 파일 업로드 섹션 */}
          <Card style={{ padding: 0 }}>
            <CardHeader
              header={<Text size={500} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>파일 연결</Text>}
              description={<Caption1 style={{ color: tokens.colorNeutralForeground3 }}>SRT 자막 파일과 오디오 파일을 연결하여 분석을 준비합니다.</Caption1>}
              style={{ padding: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalM }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: tokens.spacingHorizontalL,
                padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
              }}
            >
              <DropZone
                icon={<TextDescriptionRegular />}
                label="SRT 자막 파일"
                caption={srtConnected ? `${scenes.length}개 씬 로드됨. 총 길이: ${totalDur.toFixed(1)}초` : "SRT 파일 업로드 (.srt)"}
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
                caption={mp3Connected && audioDur > 0 ? `${audioDur.toFixed(1)}초 길이` : "MP3, WAV, M4A 지원"}
                connected={mp3Connected}
                onClick={openMp3Picker}
                inputRef={mp3InputRef}
                accept=".mp3,.wav,.m4a"
                onChange={handleMp3Upload}
                inputId={mp3InputId}
              />
            </div>

            {/* 통계 요약 (CardFooter 활용) */}
            <CardFooter style={{
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
              padding: tokens.spacingVerticalM,
              backgroundColor: tokens.colorNeutralBackground2,
              display: "flex",
              justifyContent: "space-around",
              gap: tokens.spacingHorizontalS,
            }}>
              <StatItem
                label="SRT 자막 파일"
                value={srtConnected ? "완료" : "미연결"}
                color={srtConnected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
                icon={srtConnected ? <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} /> : <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />}
              />
              <StatItem
                label="MP3 파일"
                value={mp3Connected ? "완료" : "미연결"}
                color={mp3Connected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
                icon={mp3Connected ? <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} /> : <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />}
              />
              <StatItem
                label="씬 수"
                value={`${scenes.length}개`}
                color={scenes.length > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
              />
              <StatItem
                label="총 영상 길이"
                value={scenes.length > 0 ? `${totalDur.toFixed(1)}초` : '0초'}
                color={scenes.length > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
                isLast={true}
              />
            </CardFooter>
          </Card>

          {/* AI 키워드 추출 섹션 */}
          <Card style={{ padding: 0 }}>
            <CardHeader
              header={<Text size={500} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}><LightbulbFilament24Regular /> AI 키워드 추출</Text>}
              description={<Caption1 style={{ color: tokens.colorNeutralForeground3 }}>SRT 내용을 분석하여 자동으로 영상 소스 검색 키워드를 추출합니다.</Caption1>}
              style={{ padding: tokens.spacingVerticalL, paddingBottom: tokens.spacingVerticalM }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL, padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}` }}>
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
                      items={assets.slice(0, 30).map((asset, index) => ( // 한 줄에 더 많은 칩 표시 가능하도록 갯수 조정
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
                      )).concat(
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
                  <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, alignItems: "center" }}>
                    <Spinner size="medium" />
                    <Body1 style={{ color: tokens.colorBrandForeground1 }}>키워드를 정밀하게 분석 중입니다...</Body1>
                  </div>
                ) : (
                  // 초기 상태
                  <div style={{ textAlign: "center", maxWidth: 520 }}>
                    <Body2 style={{ color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalS }}>
                      {srtConnected ? "키워드 추출 버튼을 눌러 영상 소스 검색을 시작하세요" : "SRT 파일을 먼저 업로드해야 키워드 추출이 가능합니다"}
                    </Body2>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
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