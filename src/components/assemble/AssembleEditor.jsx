import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  tokens,
  Body1,
  Body2,
  Text,
  Caption1,
  Spinner,
  Badge,
} from "@fluentui/react-components";
import { StandardCard, PrimaryButton } from "../common";
import { Target24Regular, MusicNote2Regular, TextDescriptionRegular } from "@fluentui/react-icons";

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
 * AssembleEditor (Sleek v2, hover 효과 제거)
 * - 기능 변경 없이 UI/UX만 정돈
 * - 드롭존 hover/out 효과 제거 → 안정된 박스 디자인 유지
 */
export default function AssembleEditor() {
  const containerStyles = useContainerStyles();
  const headerStyles = useHeaderStyles();
  const layoutStyles = useLayoutStyles();

  // State management
  const [scenes, setScenes] = useState([]);
  const [assets, setAssets] = useState([]);
  const [srtConnected, setSrtConnected] = useState(false);
  const [mp3Connected, setMp3Connected] = useState(false);
  const [audioDur, setAudioDur] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(-1);

  // Refs for hidden file inputs
  const srtInputRef = useRef(null);
  const mp3InputRef = useRef(null);

  // Computed values
  const totalDur = useMemo(
    () => (scenes.length ? (Number(scenes[scenes.length - 1].end) || 0) - (Number(scenes[0].start) || 0) : 0),
    [scenes]
  );

  const addAssets = (items) => setAssets((prev) => [...prev, ...items]);

  // Dev helper
  useEffect(() => { window.__scenes = scenes; }, [scenes]);

  /* ============================= SRT load & parse ============================= */
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
          const { message } = handleError(e, "assemble_srt_loading", { metadata: { action: "load_srt", cancelled } });
          console.warn("SRT loading failed:", message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [srtConnected]);

  /* ============================== MP3 duration =============================== */
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
          const { message } = handleError(e, "assemble_audio_loading", { metadata: { action: "load_audio_duration", cancelled } });
          console.warn("MP3 duration query failed:", message);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [mp3Connected]);

  /* ============================== Handlers =================================== */
  const handleSrtUpload = async (file) => {
    console.log("SRT file uploaded:", file);
  };

  const handleMp3Upload = async (file) => {
    console.log("MP3 file uploaded:", file);
  };

  const openSrtPicker = useCallback(() => srtInputRef.current?.click(), []);
  const openMp3Picker = useCallback(() => mp3InputRef.current?.click(), []);

  /* ============================== UI Helpers ================================= */
  const DropZone = ({ icon, label, caption, connected, onClick, inputRef, accept, onChange }) => {
    return (
      <div className={layoutStyles.verticalStack}>
        <Text size={400} weight="semibold" style={{ display: "block" }}>{label}</Text>
        <div
          role="button"
          tabIndex={0}
          aria-label={label}
          onClick={onClick}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick?.()}
          style={{
            border: `1px dashed ${tokens.colorNeutralStroke2}`,
            borderRadius: tokens.borderRadiusMedium,
            padding: tokens.spacingVerticalL,
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: connected ? tokens.colorPaletteLightGreenBackground2 : tokens.colorNeutralBackground2,
            transition: "background-color 120ms ease",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) onChange?.(e.target.files[0]); }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: tokens.spacingVerticalS }}>
            {icon}
            <Body1>{connected ? "✅ 연결됨" : "파일 업로드"}</Body1>
          </div>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{caption}</Caption1>
        </div>
      </div>
    );
  };

  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Header */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <Target24Regular />
          영상 구성
          {srtConnected && (<Badge appearance="filled" color="success" style={{ marginLeft: 8 }}>SRT</Badge>)}
          {mp3Connected && (<Badge appearance="filled" color="success" style={{ marginLeft: 6 }}>AUDIO</Badge>)}
        </div>
        <div className={headerStyles.pageDescription}>SRT 파일과 오디오를 결합하여 완성된 영상을 만드세요</div>
        <div className={headerStyles.divider} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={layoutStyles.centerFlex} style={{ minHeight: 300 }}>
          <div className={layoutStyles.verticalStack}>
            <Spinner size="large" />
            <Body1>프로젝트를 불러오는 중...</Body1>
          </div>
        </div>
      )}

      {/* Main */}
      {!isLoading && (
        <div className={layoutStyles.verticalStack} style={{ gap: tokens.spacingVerticalL }}>
          {/* Upload Section */}
          <StandardCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tokens.spacingVerticalS }}>
              <Text size={400} weight="semibold">파일 업로드</Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>클릭으로 파일 선택</Caption1>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: tokens.spacingHorizontalL,
              marginBottom: tokens.spacingVerticalL,
            }}>
              <DropZone
                icon={<TextDescriptionRegular />}
                label="SRT 자막 파일"
                caption={srtConnected ? `${scenes.length}개 씬 로드됨` : "SRT 파일 업로드 (.srt)"}
                connected={srtConnected}
                onClick={openSrtPicker}
                inputRef={srtInputRef}
                accept=".srt"
                onChange={handleSrtUpload}
              />

              <DropZone
                icon={<MusicNote2Regular />}
                label="MP3 오디오 파일"
                caption={mp3Connected && audioDur > 0 ? `${audioDur.toFixed(1)}초 길이` : "MP3, WAV, M4A 지원"}
                connected={mp3Connected}
                onClick={openMp3Picker}
                inputRef={mp3InputRef}
                accept=".mp3,.wav,.m4a"
                onChange={handleMp3Upload}
              />
            </div>

            {/* 연결 상태 */}
            <div style={{
              padding: tokens.spacingVerticalM,
              backgroundColor: tokens.colorNeutralBackground2,
              borderRadius: tokens.borderRadiusMedium,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
            }}>
              <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS, display: "block" }}>연결 상태</Text>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: tokens.spacingHorizontalM,
              }}>
                <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                  <Body2>SRT 파일</Body2>
                  <Badge appearance={srtConnected ? "filled" : "ghost"} color={srtConnected ? "success" : "brand"}>
                    {srtConnected ? "연결됨" : "미연결"}
                  </Badge>
                </div>
                <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                  <Body2>MP3 파일</Body2>
                  <Badge appearance={mp3Connected ? "filled" : "ghost"} color={mp3Connected ? "success" : "brand"}>
                    {mp3Connected ? "연결됨" : "미연결"}
                  </Badge>
                </div>
                <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                  <Body2>씬 수</Body2>
                  <Body2>{scenes.length}개</Body2>
                </div>
                {audioDur > 0 && (
                  <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                    <Body2>오디오 길이</Body2>
                    <Body2>{audioDur.toFixed(1)}초</Body2>
                  </div>
                )}
              </div>
            </div>
          </StandardCard>

          {/* AI 키워드 추출 */}
          <StandardCard>
            <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS, display: "block" }}>AI 키워드 추출</Text>
            <Body2 style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
              SRT 파일에서 키워드를 추출하여 영상 소스를 찾습니다
            </Body2>

            <div className={layoutStyles.verticalStack}>
              <PrimaryButton
                size="large"
                style={{ height: 48, maxWidth: 420, alignSelf: "center" }}
                disabled={!srtConnected}
              >
                🤖 키워드 추출 시작
              </PrimaryButton>

              {/* 결과 영역 */}
              <div style={{
                minHeight: 260,
                border: `1px dashed ${tokens.colorNeutralStroke2}`,
                borderRadius: tokens.borderRadiusMedium,
                padding: tokens.spacingVerticalL,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tokens.colorNeutralBackground1,
              }}>
                {assets.length > 0 ? (
                  <div style={{ textAlign: "center", width: "100%" }}>
                    <Body1 style={{ color: tokens.colorBrandForeground1, fontWeight: 600, marginBottom: tokens.spacingVerticalM }}>
                      ✅ {assets.length}개 키워드 추출 완료
                    </Body1>
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: tokens.spacingHorizontalS,
                      justifyContent: "center",
                      maxWidth: 880,
                      margin: "0 auto",
                    }}>
                      {assets.slice(0, 18).map((asset, index) => (
                        <div key={index} style={{
                          padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
                          backgroundColor: tokens.colorBrandBackground2,
                          color: tokens.colorBrandForeground1,
                          borderRadius: tokens.borderRadiusSmall,
                          fontSize: tokens.fontSizeBase200,
                        }}>
                          {asset.keyword || `키워드 ${index + 1}`}
                        </div>
                      ))}
                      {assets.length > 18 && (
                        <div style={{
                          padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
                          backgroundColor: tokens.colorNeutralBackground3,
                          color: tokens.colorNeutralForeground2,
                          borderRadius: tokens.borderRadiusSmall,
                          fontSize: tokens.fontSizeBase200,
                        }}>
                          +{assets.length - 18}개 더
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <Body2 style={{ color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalS }}>
                      {srtConnected ? "키워드 추출 버튼을 눌러 시작하세요" : "SRT 파일을 업로드한 후 키워드 추출이 가능합니다"}
                    </Body2>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      추출된 키워드로 영상 소스를 자동으로 검색합니다
                    </Caption1>
                  </div>
                )}
              </div>

              {/* 분석 정보 */}
              {srtConnected && scenes.length > 0 && (
                <div style={{
                  padding: tokens.spacingVerticalM,
                  backgroundColor: tokens.colorNeutralBackground2,
                  borderRadius: tokens.borderRadiusMedium,
                  border: `1px solid ${tokens.colorNeutralStroke2}`,
                  maxWidth: 680,
                  alignSelf: "center",
                }}>
                  <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalXS, textAlign: "center", display: "block" }}>📊 분석 정보</Text>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: tokens.spacingHorizontalS,
                    textAlign: "center",
                  }}>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>씬 수: {scenes.length}개</Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>영상 길이: {totalDur.toFixed(1)}초</Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>예상 키워드: {Math.min(scenes.length * 2, 20)}개</Caption1>
                  </div>
                </div>
              )}
            </div>
          </StandardCard>
        </div>
      )}
    </div>
  );
}
