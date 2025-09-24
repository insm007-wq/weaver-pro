import React, { useMemo, useState, useEffect } from "react";
import {
  tokens,
  Body1,
  Body2,
  Text,
  Caption1,
  Spinner,
} from "@fluentui/react-components";
import {
  StandardCard,
  PrimaryButton
} from "../common";
import {
  Target24Regular,
} from "@fluentui/react-icons";


// Utils
import { parseSrtToScenes } from "../../utils/parseSrt";
import { getSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
import { handleError } from "@utils";
import {
  useContainerStyles,
  useHeaderStyles,
  useLayoutStyles
} from "../../styles/commonStyles";

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

  // Computed values
  const totalDur = useMemo(
    () => (scenes.length ? (Number(scenes[scenes.length - 1].end) || 0) - (Number(scenes[0].start) || 0) : 0),
    [scenes]
  );

  const addAssets = (items) => setAssets((prev) => [...prev, ...items]);

  // Development helper
  useEffect(() => {
    window.__scenes = scenes;
  }, [scenes]);

  // SRT loading and parsing
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
            metadata: { action: "load_srt", cancelled }
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

  // MP3 duration query
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
            metadata: { action: "load_audio_duration", cancelled }
          });
          console.warn("MP3 duration query failed:", message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mp3Connected]);


  // File upload handlers
  const handleSrtUpload = async (file) => {
    // TODO: SRT 파일 업로드 처리
    console.log("SRT file uploaded:", file);
  };

  const handleMp3Upload = async (file) => {
    // TODO: MP3 파일 업로드 처리
    console.log("MP3 file uploaded:", file);
  };


  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <Target24Regular />
          영상 구성
        </div>
        <div className={headerStyles.pageDescription}>SRT 파일과 오디오를 결합하여 완성된 영상을 만드세요</div>
        <div className={headerStyles.divider} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={layoutStyles.centerFlex} style={{ minHeight: "300px" }}>
          <div className={layoutStyles.verticalStack}>
            <Spinner size="large" />
            <Body1>프로젝트를 불러오는 중...</Body1>
          </div>
        </div>
      )}


      {/* 메인 컨텐츠 - 1열 구조 */}
      {!isLoading && (
        <div className={layoutStyles.verticalStack}>
          {/* 파일 업로드 섹션 */}
          <StandardCard>
            <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS, display: "block" }}>파일 업로드</Text>

            {/* 파일 업로드 영역 - 2열 그리드 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: tokens.spacingHorizontalL,
              marginBottom: tokens.spacingVerticalL
            }}>
              {/* SRT 파일 업로드 */}
              <div className={layoutStyles.verticalStack}>
                <Text size={400} weight="semibold" style={{ display: "block" }}>SRT 자막 파일</Text>
                <div
                  style={{
                    border: `2px dashed ${tokens.colorNeutralStroke2}`,
                    borderRadius: tokens.borderRadiusMedium,
                    padding: tokens.spacingVerticalL,
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: srtConnected ? tokens.colorPaletteLightGreenBackground2 : tokens.colorNeutralBackground2,
                    transition: "all 0.2s ease"
                  }}
                  onClick={() => document.getElementById('srt-input').click()}
                >
                  <input
                    id="srt-input"
                    type="file"
                    accept=".srt"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleSrtUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>
                    {srtConnected ? "✅ SRT 연결됨" : "📁 SRT 파일 업로드"}
                  </Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    {srtConnected ? `${scenes.length}개 씬 로드됨` : "클릭하거나 파일을 드래그하세요"}
                  </Caption1>
                </div>
              </div>

              {/* MP3 파일 업로드 */}
              <div className={layoutStyles.verticalStack}>
                <Text size={400} weight="semibold" style={{ display: "block" }}>MP3 오디오 파일</Text>
                <div
                  style={{
                    border: `2px dashed ${tokens.colorNeutralStroke2}`,
                    borderRadius: tokens.borderRadiusMedium,
                    padding: tokens.spacingVerticalL,
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: mp3Connected ? tokens.colorPaletteLightGreenBackground2 : tokens.colorNeutralBackground2,
                    transition: "all 0.2s ease"
                  }}
                  onClick={() => document.getElementById('mp3-input').click()}
                >
                  <input
                    id="mp3-input"
                    type="file"
                    accept=".mp3,.wav,.m4a"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleMp3Upload(e.target.files[0]);
                      }
                    }}
                  />
                  <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>
                    {mp3Connected ? "✅ 오디오 연결됨" : "🎵 오디오 파일 업로드"}
                  </Body1>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    {mp3Connected && audioDur > 0
                      ? `${audioDur.toFixed(1)}초 길이`
                      : "MP3, WAV, M4A 지원"}
                  </Caption1>
                </div>
              </div>
            </div>

            {/* 파일 상태 */}
            <div style={{
              padding: tokens.spacingVerticalM,
              backgroundColor: tokens.colorNeutralBackground2,
              borderRadius: tokens.borderRadiusMedium,
              border: `1px solid ${tokens.colorNeutralStroke2}`
            }}>
              <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS, display: "block" }}>
                연결 상태
              </Text>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: tokens.spacingHorizontalM
              }}>
                <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                  <Body2>SRT 파일:</Body2>
                  <Body2 style={{ color: srtConnected ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForeground3 }}>
                    {srtConnected ? "연결됨" : "미연결"}
                  </Body2>
                </div>
                <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                  <Body2>MP3 파일:</Body2>
                  <Body2 style={{ color: mp3Connected ? tokens.colorPaletteGreenForeground1 : tokens.colorNeutralForeground3 }}>
                    {mp3Connected ? "연결됨" : "미연결"}
                  </Body2>
                </div>
                <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                  <Body2>씬 수:</Body2>
                  <Body2>{scenes.length}개</Body2>
                </div>
                {audioDur > 0 && (
                  <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
                    <Body2>오디오 길이:</Body2>
                    <Body2>{audioDur.toFixed(1)}초</Body2>
                  </div>
                )}
              </div>
            </div>
          </StandardCard>

          {/* AI 키워드 추출 섹션 */}
          <StandardCard>
            <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS, display: "block" }}>AI 키워드 추출</Text>
            <Body2 style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
              SRT 파일에서 키워드를 추출하여 영상 소스를 찾습니다
            </Body2>

            <div className={layoutStyles.verticalStack}>
              {/* 키워드 추출 버튼 */}
              <PrimaryButton
                size="large"
                style={{ height: "48px", maxWidth: "400px", alignSelf: "center" }}
                disabled={!srtConnected}
              >
                🤖 키워드 추출 시작
              </PrimaryButton>

              {/* 추출 결과 영역 */}
              <div style={{
                minHeight: "300px",
                border: `1px dashed ${tokens.colorNeutralStroke2}`,
                borderRadius: tokens.borderRadiusMedium,
                padding: tokens.spacingVerticalL,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tokens.colorNeutralBackground1
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
                      maxWidth: "800px",
                      margin: "0 auto"
                    }}>
                      {assets.slice(0, 15).map((asset, index) => (
                        <div
                          key={index}
                          style={{
                            padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
                            backgroundColor: tokens.colorBrandBackground2,
                            color: tokens.colorBrandForeground1,
                            borderRadius: tokens.borderRadiusSmall,
                            fontSize: tokens.fontSizeBase200
                          }}
                        >
                          {asset.keyword || `키워드 ${index + 1}`}
                        </div>
                      ))}
                      {assets.length > 15 && (
                        <div style={{
                          padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
                          backgroundColor: tokens.colorNeutralBackground3,
                          color: tokens.colorNeutralForeground2,
                          borderRadius: tokens.borderRadiusSmall,
                          fontSize: tokens.fontSizeBase200
                        }}>
                          +{assets.length - 15}개 더
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <Body2 style={{ color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalS }}>
                      {srtConnected
                        ? "키워드 추출 버튼을 눌러 시작하세요"
                        : "SRT 파일을 업로드한 후 키워드 추출이 가능합니다"
                      }
                    </Body2>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      추출된 키워드로 영상 소스를 자동으로 검색합니다
                    </Caption1>
                  </div>
                )}
              </div>

              {/* 추가 정보 */}
              {srtConnected && scenes.length > 0 && (
                <div style={{
                  padding: tokens.spacingVerticalM,
                  backgroundColor: tokens.colorNeutralBackground2,
                  borderRadius: tokens.borderRadiusMedium,
                  border: `1px solid ${tokens.colorNeutralStroke2}`,
                  maxWidth: "600px",
                  alignSelf: "center"
                }}>
                  <Text size={400} weight="semibold" style={{ marginBottom: tokens.spacingVerticalXS, textAlign: "center", display: "block" }}>
                    📊 분석 정보
                  </Text>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: tokens.spacingHorizontalS,
                    textAlign: "center"
                  }}>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                      씬 수: {scenes.length}개
                    </Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                      영상 길이: {totalDur.toFixed(1)}초
                    </Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                      예상 키워드: {Math.min(scenes.length * 2, 20)}개
                    </Caption1>
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