import React, { useState, useEffect } from "react";
import { Text, Button, Card, Spinner, ProgressBar, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from "@fluentui/react-components";
import {
  SettingsRegular,
  ArrowExportRegular,
  CheckmarkCircle24Filled,
} from "@fluentui/react-icons";
import { showSuccess, showError, showInfo } from "../../common/GlobalToast";

function SceneEditor({ scenes, onSceneSelect, isVideoExporting, setIsVideoExporting }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [audioDurations, setAudioDurations] = useState({});
  const [exportStartTime, setExportStartTime] = useState(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState("");

  // FFmpeg 진행률 이벤트 리스너 (진행률만 업데이트)
  useEffect(() => {
    const handleProgress = (progress) => {
      setExportProgress(progress);
    };

    if (window.api?.on) {
      window.api.on("ffmpeg:progress", handleProgress);
    }

    return () => {
      if (window.api?.off) {
        window.api.off("ffmpeg:progress", handleProgress);
      }
    };
  }, []);

  // 카운트다운 타이머 (1초마다 감소)
  useEffect(() => {
    if (!isExporting || estimatedTimeRemaining === null) return;

    const interval = setInterval(() => {
      setEstimatedTimeRemaining(prev => {
        if (prev === null || prev <= 0) return 0;
        return Math.max(0, prev - 1);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExporting, estimatedTimeRemaining !== null]);

  // 오디오 파일 길이 로드
  useEffect(() => {
    const loadAudioDurations = async () => {
      if (!scenes || scenes.length === 0) return;

      try {
        const filePaths = scenes.map(scene => scene.audioPath).filter(Boolean);

        if (filePaths.length === 0) return;

        const result = await window.api?.invoke("audio:getDurations", { filePaths });

        if (result?.success && result?.results) {
          const durationsMap = {};
          result.results.forEach((item, index) => {
            if (item.success && item.duration) {
              // audioPath로 매핑
              const audioPath = filePaths[index];
              durationsMap[audioPath] = item.duration;
            }
          });
          setAudioDurations(durationsMap);
        }
      } catch (error) {
        console.error("오디오 길이 로드 실패:", error);
      }
    };

    loadAudioDurations();
  }, [scenes]);

  // 프로젝트 통계 계산
  const getProjectStats = () => {
    if (!scenes || scenes.length === 0) {
      return {
        totalScenes: 0,
        completedScenes: 0,
        missingMedia: 0,
        missingAudio: 0,
        missingMediaScenes: [],
        missingAudioScenes: [],
        estimatedDuration: 0
      };
    }

    let completedScenes = 0;
    let missingMedia = 0;
    let missingAudio = 0;
    let missingMediaScenes = [];
    let missingAudioScenes = [];
    let estimatedDuration = 0;

    scenes.forEach((scene, index) => {
      const hasMedia = scene.asset?.path;
      const hasAudio = scene.audioPath;

      if (hasMedia && hasAudio) {
        completedScenes++;
      }
      if (!hasMedia) {
        missingMedia++;
        missingMediaScenes.push(index);
      }
      if (!hasAudio) {
        missingAudio++;
        missingAudioScenes.push(index);
      }

      // 예상 길이 계산: 실제 오디오 파일 길이 사용 (소수점 한 자리로 반올림)
      if (scene.audioPath && audioDurations[scene.audioPath]) {
        estimatedDuration += parseFloat(audioDurations[scene.audioPath].toFixed(1));
      } else if (scene.start !== undefined && scene.end !== undefined && scene.end > scene.start) {
        // 오디오 길이를 못 가져온 경우 SRT 시간으로 fallback
        estimatedDuration += parseFloat((scene.end - scene.start).toFixed(1));
      } else {
        // 둘 다 없으면 기본 3초
        estimatedDuration += 3.0;
      }
    });

    return {
      totalScenes: scenes.length,
      completedScenes,
      missingMedia,
      missingAudio,
      missingMediaScenes,
      missingAudioScenes,
      estimatedDuration
    };
  };

  const stats = getProjectStats();

  // 전체 영상 내보내기
  const handleExportProject = async () => {
    if (!scenes || scenes.length === 0) {
      showError("내보낼 씬이 없습니다.");
      return;
    }

    // 모든 씬에 미디어와 오디오가 있는지 확인
    const incompleteScenesCount = scenes.filter(scene => !scene.asset?.path || !scene.audioPath).length;
    if (incompleteScenesCount > 0) {
      showError(`${incompleteScenesCount}개 씬에 미디어 또는 오디오가 없습니다. 모든 씬을 완성해주세요.`);
      return;
    }

    // 영상 길이 기반 예상 인코딩 시간 계산
    // 실제 인코딩 시간 = 영상 길이의 65% (35% 감소)
    const videoDuration = stats.estimatedDuration; // 초 단위
    const estimatedEncodingTime = Math.ceil(videoDuration * 0.65);

    setIsExporting(true);
    setIsVideoExporting?.(true);
    setExportProgress(0);
    setExportStartTime(Date.now());
    setEstimatedTimeRemaining(estimatedEncodingTime);
    showInfo("영상 내보내기를 시작합니다...");

    try {
      const result = await window.api?.exportVideo?.(scenes);

      if (result?.success) {
        setExportedFilePath(result.outputPath || "");
        setCompletionDialogOpen(true);
      } else {
        showError(result?.error || "영상 내보내기에 실패했습니다.");
      }
    } catch (error) {
      console.error("영상 내보내기 오류:", error);
      showError("영상 내보내기 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
      setIsVideoExporting?.(false);
      setExportProgress(0);
      setExportStartTime(null);
      setEstimatedTimeRemaining(null);
    }
  };

  // 영상 내보내기 취소
  const handleCancelExport = async () => {
    try {
      await window.api?.cancelExport?.();
      showInfo("영상 내보내기를 취소했습니다.");
    } catch (error) {
      console.error("취소 실패:", error);
      showError("취소 중 오류가 발생했습니다.");
    }
  };

  return (
    <Card
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SettingsRegular style={{ fontSize: 18 }} />
        <Text size={400} weight="semibold">
          씬 편집
        </Text>
      </div>

      {/* 영상 내보내기 (항상 표시) */}
      <div>
        <Text size={400} weight="medium" style={{ marginBottom: 12, fontSize: "15px" }}>
          영상 내보내기
        </Text>

        {/* 프로젝트 정보 */}
        <div style={{
          padding: 12,
          backgroundColor: "#fafafa",
          borderRadius: 8,
          border: "1px solid #e0e0e0",
          marginBottom: 12
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>총 씬</Text>
              <Text size={200} weight="semibold">{stats.totalScenes}개</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>완성된 씬</Text>
              <Text size={200} weight="semibold" style={{ color: stats.completedScenes === stats.totalScenes ? "#0f7b0f" : "#d13438" }}>
                {stats.completedScenes}/{stats.totalScenes}
              </Text>
            </div>
            {stats.missingMedia > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text size={200} style={{ color: "#d13438" }}>미디어 없음</Text>
                  <Text size={200} weight="semibold" style={{ color: "#d13438" }}>{stats.missingMedia}개</Text>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, 38px)",
                  gap: 4,
                  marginLeft: 4,
                  maxHeight: "80px",
                  overflowY: "auto",
                  padding: "2px"
                }}>
                  {stats.missingMediaScenes.map(sceneIndex => (
                    <button
                      key={sceneIndex}
                      onClick={() => onSceneSelect?.(sceneIndex)}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        backgroundColor: "#fef0f0",
                        color: "#d13438",
                        border: "1px solid #ffcccb",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 500,
                        transition: "all 0.2s",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#d13438";
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef0f0";
                        e.currentTarget.style.color = "#d13438";
                      }}
                    >
                      #{sceneIndex + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {stats.missingAudio > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text size={200} style={{ color: "#d13438" }}>오디오 없음</Text>
                  <Text size={200} weight="semibold" style={{ color: "#d13438" }}>{stats.missingAudio}개</Text>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, 38px)",
                  gap: 4,
                  marginLeft: 4,
                  maxHeight: "80px",
                  overflowY: "auto",
                  padding: "2px"
                }}>
                  {stats.missingAudioScenes.map(sceneIndex => (
                    <button
                      key={sceneIndex}
                      onClick={() => onSceneSelect?.(sceneIndex)}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        backgroundColor: "#fef0f0",
                        color: "#d13438",
                        border: "1px solid #ffcccb",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 500,
                        transition: "all 0.2s",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#d13438";
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef0f0";
                        e.currentTarget.style.color = "#d13438";
                      }}
                    >
                      #{sceneIndex + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>예상 길이</Text>
              <Text size={200} weight="semibold">
                {Math.floor(stats.estimatedDuration / 60)}분 {Math.floor(stats.estimatedDuration % 60)}초
              </Text>
            </div>
          </div>
        </div>

        {/* 모든 씬이 완성되었을 때 알림 */}
        {stats.completedScenes === stats.totalScenes && stats.totalScenes > 0 && !isExporting && (
          <div style={{
            padding: 12,
            backgroundColor: "#f0fdf4",
            borderRadius: 8,
            border: "1px solid #86efac",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <CheckmarkCircle24Filled style={{ color: "#0f7b0f", fontSize: 20 }} />
            <div>
              <Text size={300} weight="semibold" style={{ display: "block", color: "#0f7b0f" }}>
                준비 완료!
              </Text>
              <Text size={200} style={{ color: "#166534" }}>
                모든 씬이 완성되었습니다. 영상 내보내기를 진행할 수 있습니다.
              </Text>
            </div>
          </div>
        )}

        {isExporting ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            backgroundColor: "#f3f9ff",
            borderRadius: 8,
            border: "1px solid #b3d6fc"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Spinner size="small" />
              <Text size={300} weight="medium">영상을 생성하는 중...</Text>
            </div>
            <ProgressBar value={exportProgress / 100} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>
                {exportProgress.toFixed(1)}% 완료
              </Text>
              {estimatedTimeRemaining !== null && (
                <Text size={200} style={{ color: "#666" }}>
                  {estimatedTimeRemaining <= 0
                    ? "거의 완료 중..."
                    : `남은 시간: ${Math.floor(estimatedTimeRemaining / 60)}분 ${Math.floor(estimatedTimeRemaining % 60)}초`}
                </Text>
              )}
            </div>
            {estimatedTimeRemaining !== null && estimatedTimeRemaining > 30 && (
              <Text size={200} style={{ color: "#999", fontStyle: "italic", textAlign: "center" }}>
                💡 예상 시간은 대략적인 값이며 실제와 다를 수 있습니다
              </Text>
            )}
            <Button
              appearance="secondary"
              onClick={handleCancelExport}
              style={{ width: "100%", marginTop: 8 }}
            >
              취소
            </Button>
          </div>
        ) : (
          <Button
            appearance="primary"
            icon={<ArrowExportRegular />}
            onClick={handleExportProject}
            disabled={!scenes || scenes.length === 0}
            style={{ width: "100%" }}
          >
            영상 내보내기
          </Button>
        )}

        <Text size={200} style={{ color: "#666", marginTop: 8, display: "block" }}>
          모든 씬을 하나의 영상으로 합성합니다
        </Text>
      </div>

      {/* 완료 다이얼로그 */}
      <Dialog open={completionDialogOpen} onOpenChange={(e, data) => setCompletionDialogOpen(data.open)}>
        <DialogSurface style={{ maxWidth: "540px" }}>
          <DialogBody>
            <DialogTitle style={{
              fontSize: "18px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 12
            }}>
              <CheckmarkCircle24Filled style={{ color: "#0f7b0f" }} />
              영상 내보내기 완료
            </DialogTitle>
            <DialogContent style={{ paddingTop: 16, paddingBottom: 24 }}>
              <div style={{
                padding: 16,
                backgroundColor: "#f3f9ff",
                borderRadius: 8,
                border: "1px solid #b3d6fc",
                marginBottom: 16
              }}>
                <Text size={300} weight="semibold" style={{ display: "block", marginBottom: 8 }}>
                  🎉 영상이 성공적으로 생성되었습니다!
                </Text>
                <Text size={200} style={{ display: "block", color: "#666", marginBottom: 8 }}>
                  생성된 영상 파일:
                </Text>
                <Text
                  size={200}
                  weight="semibold"
                  style={{
                    display: "block",
                    color: "#242424",
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                    backgroundColor: "#fafafa",
                    padding: "8px 12px",
                    borderRadius: 4,
                    border: "1px solid #e1dfdd"
                  }}
                >
                  {exportedFilePath}
                </Text>
              </div>
              <Text size={300} style={{ display: "block", color: "#666" }}>
                파일 탐색기에서 영상을 확인하시겠습니까?
              </Text>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setCompletionDialogOpen(false)}
              >
                닫기
              </Button>
              <Button
                appearance="primary"
                onClick={async () => {
                  if (exportedFilePath && window.api?.invoke) {
                    try {
                      await window.api.invoke("shell:showInFolder", { filePath: exportedFilePath });
                    } catch (error) {
                      console.error("파일 탐색기 열기 실패:", error);
                    }
                  }
                  setCompletionDialogOpen(false);
                }}
              >
                파일 위치 열기
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Card>
  );
}

export default SceneEditor;