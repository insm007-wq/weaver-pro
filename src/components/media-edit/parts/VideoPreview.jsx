import React, { useRef, useEffect, useCallback, useState } from "react";
import { Text, Button, Card, Badge } from "@fluentui/react-components";
import {
  PlayRegular,
  PauseRegular,
  CheckmarkCircleRegular,
} from "@fluentui/react-icons";

function VideoPreview({
  selectedScene,
  selectedSceneIndex,
  videoUrl,
  videoRef, // 외부에서 전달받은 ref
}) {
  // 내부 상태 관리
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(null);
  const animationFrameRef = useRef(null);
  const progressBarRef = useRef(null);

  // 시간 포맷 헬퍼
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 비디오 재생/일시정지 토글 (에러 핸들링 강화)
  const handleVideoToggle = useCallback(() => {
    if (!videoRef?.current) {
      console.warn("[비디오 재생] 비디오 ref가 없습니다");
      return;
    }

    const video = videoRef.current;

    // 비디오 상태 확인
    if (video.readyState < 2) {
      console.warn("[비디오 재생] 비디오가 아직 로드되지 않았습니다");
      return;
    }

    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          console.log("[비디오 재생] 재생 시작됨");
        })
        .catch((error) => {
          console.error("[비디오 재생] 재생 실패:", error);
          setIsPlaying(false);
          // 사용자에게 에러 알림을 주지 않고 콘솔에만 로그
        });
    } else {
      try {
        video.pause();
        setIsPlaying(false);
        console.log("[비디오 재생] 일시정지됨");
      } catch (error) {
        console.error("[비디오 재생] 일시정지 실패:", error);
      }
    }
  }, [videoRef]);

  // 부드러운 시간 계산 헬퍼
  const calculateTimeFromPosition = useCallback((clientX, progressBarElement) => {
    if (!selectedScene || !progressBarElement) return null;

    const rect = progressBarElement.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    const sceneDuration = selectedScene.end - selectedScene.start;
    const newTime = selectedScene.start + (sceneDuration * percentage);

    return Math.max(selectedScene.start, Math.min(selectedScene.end, newTime));
  }, [selectedScene]);

  // 최적화된 드래그 업데이트
  const updateDragTime = useCallback((clientX, progressBarElement) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const newTime = calculateTimeFromPosition(clientX, progressBarElement);
      if (newTime !== null) {
        setDragTime(newTime);
      }
    });
  }, [calculateTimeFromPosition]);

  // 마우스 다운 핸들러 (드래그 시작)
  const handleMouseDown = useCallback((event) => {
    event.preventDefault();
    setIsDragging(true);

    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const newTime = calculateTimeFromPosition(clientX, progressBarRef.current);
    if (newTime !== null) {
      setDragTime(newTime);
    }
  }, [calculateTimeFromPosition]);

  // 마우스 무브 핸들러 (드래그 중)
  const handleMouseMove = useCallback((event) => {
    if (!isDragging) return;

    event.preventDefault();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    updateDragTime(clientX, progressBarRef.current);
  }, [isDragging, updateDragTime]);

  // 마우스 업 핸들러 (드래그 종료)
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragTime !== null) {
      // 드래그 종료 시 실제 비디오 시간 업데이트
      setCurrentTime(dragTime);
      if (videoRef?.current) {
        videoRef.current.currentTime = dragTime;
      }
    }

    setIsDragging(false);
    setDragTime(null);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isDragging, dragTime, videoRef]);

  // 클릭 핸들러 (빠른 탐색)
  const handleClick = useCallback((event) => {
    if (isDragging) return; // 드래그 중에는 클릭 무시

    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const newTime = calculateTimeFromPosition(clientX, progressBarRef.current);

    if (newTime !== null) {
      setCurrentTime(newTime);
      if (videoRef?.current) {
        videoRef.current.currentTime = newTime;
      }
    }
  }, [isDragging, calculateTimeFromPosition, videoRef]);

  // 전역 마우스 이벤트 리스너 (드래그 중 마우스가 요소 밖으로 나가도 추적)
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 컴포넌트 언마운트 시 애니메이션 프레임 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 비디오 URL이 변경되면 이벤트 리스너 설정
  useEffect(() => {
    if (videoUrl && videoRef?.current) {
      const video = videoRef.current;

      const handleLoadedData = () => {
        console.log("[비디오 재생] 자동 재생 시작");
        video
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.error("[비디오 재생] 자동 재생 실패:", error);
            setIsPlaying(false);
          });
      };

      // 시간 업데이트 이벤트 핸들러 (실시간 동기화 및 범위 제한)
      const handleTimeUpdate = () => {
        const videoCurrentTime = video.currentTime;
        setCurrentTime(videoCurrentTime);

        // 씬 시간 범위 체크
        if (selectedScene) {
          if (videoCurrentTime >= selectedScene.end) {
            // 씬 끝 시간에 도달하면 정지
            video.pause();
            video.currentTime = selectedScene.end;
            setCurrentTime(selectedScene.end);
            setIsPlaying(false);
            console.log(`[시간 제한] 씬 ${selectedSceneIndex + 1} 종료 시간 도달 (${selectedScene.end}초)`);
          } else if (videoCurrentTime < selectedScene.start) {
            // 씬 시작 시간보다 이전이면 시작 시간으로 이동
            video.currentTime = selectedScene.start;
            setCurrentTime(selectedScene.start);
          }
        }
      };

      // 재생 상태 변경 이벤트 핸들러
      const handlePlay = () => {
        setIsPlaying(true);
      };
      const handlePause = () => {
        setIsPlaying(false);
      };

      // 이벤트 리스너 추가
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);

      // 비디오가 이미 로드되었다면 바로 재생
      if (video.readyState >= 2) {
        handleLoadedData();
      } else {
        // 아직 로드되지 않았다면 로드 이벤트를 기다림
        video.addEventListener("loadeddata", handleLoadedData, { once: true });
      }

      return () => {
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
      };
    }
  }, [videoUrl, videoRef, selectedScene, selectedSceneIndex]);

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
      {/* 프리뷰 영역 - 16:9 비율 */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%)",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
      >
        {selectedScene ? (
          videoUrl && selectedScene.asset?.type === "video" ? (
            // 실제 비디오 표시 (자막 오버레이 포함)
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <video
                ref={videoRef}
                key={videoUrl}
                src={videoUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 16,
                  cursor: "pointer",
                }}
                controls={false}
                autoPlay={false}
                muted={false}
                playsInline
                onClick={handleVideoToggle}
                onError={(e) => {
                  console.error("[비디오 재생] 오류:", e);
                  console.error("[비디오 재생] 비디오 URL:", videoUrl);
                }}
                onLoadedData={() => {
                  console.log("[비디오 재생] 로드됨:", videoUrl);
                }}
              />
              {/* 자막 오버레이 */}
              {selectedScene.text && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "24px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(20, 20, 20, 0.9) 100%)",
                    backdropFilter: "blur(8px)",
                    color: "white",
                    padding: "16px 24px",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: "500",
                    lineHeight: "1.5",
                    maxWidth: "85%",
                    textAlign: "center",
                    pointerEvents: "none",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {selectedScene.text}
                </div>
              )}
              {/* 재생/일시정지 아이콘 오버레이 */}
              {!isPlaying && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 240, 240, 0.95) 100%)",
                    backdropFilter: "blur(12px)",
                    borderRadius: "50%",
                    width: "72px",
                    height: "72px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    transition: "all 0.3s ease",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.3)",
                    border: "2px solid rgba(255, 255, 255, 0.4)",
                  }}
                >
                  <PlayRegular style={{ fontSize: 28, color: "#333", marginLeft: "4px" }} />
                </div>
              )}
            </div>
          ) : (
            // 텍스트 기반 프리뷰 (비디오가 없거나 이미지인 경우)
            <div style={{ textAlign: "center", color: "white", padding: 32 }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(8px)",
                marginBottom: "24px"
              }}>
                <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 16, display: "block", color: "#f0f0f0" }}>
                  🎬 씬 {selectedSceneIndex + 1}
                </Text>
                <Text style={{
                  fontSize: 17,
                  opacity: 0.95,
                  display: "block",
                  lineHeight: "1.6",
                  color: "#e0e0e0",
                  fontWeight: "400"
                }}>
                  {selectedScene.text}
                </Text>
              </div>
              {selectedScene.asset?.path ? (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <Badge appearance="filled" color="success" size="medium">
                      <CheckmarkCircleRegular style={{ fontSize: 14, marginRight: 6 }} />
                      {selectedScene.asset.type === "image" ? "이미지" : "영상"} 연결됨
                    </Badge>
                    {selectedScene.asset.keyword && (
                      <Badge appearance="outline" color="brand" size="medium">
                        키워드: {selectedScene.asset.keyword}
                      </Badge>
                    )}
                  </div>
                  {selectedScene.asset.resolution && (
                    <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
                      {selectedScene.asset.resolution} · {selectedScene.asset.provider || "unknown"}
                    </Text>
                  )}
                  {selectedScene.asset.type === "video" && !videoUrl && (
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>영상 로딩 중...</Text>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>연결된 미디어가 없습니다</Text>
                </div>
              )}
            </div>
          )
        ) : (
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)",
              borderRadius: "16px",
              padding: "32px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(8px)",
            }}>
              <Text style={{
                color: "#e0e0e0",
                fontSize: 18,
                fontWeight: "500",
                opacity: 0.8,
                display: "block",
                marginBottom: "8px"
              }}>
                🎭 프리뷰 대기 중
              </Text>
              <Text style={{
                color: "#c0c0c0",
                fontSize: 14,
                opacity: 0.6
              }}>
                좌측에서 씬을 선택해주세요
              </Text>
            </div>
          </div>
        )}
      </div>

      {/* 플레이어 컨트롤 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button
          appearance="primary"
          icon={isPlaying ? <PauseRegular /> : <PlayRegular />}
          onClick={handleVideoToggle}
          disabled={!selectedScene || !videoUrl}
        >
          {isPlaying ? "일시정지" : "재생"}
        </Button>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <Text size={200}>{formatTime(dragTime !== null ? dragTime : currentTime)}</Text>
          <div
            ref={progressBarRef}
            style={{
              flex: 1,
              height: 8,
              backgroundColor: "#e1e1e1",
              borderRadius: 4,
              position: "relative",
              cursor: isDragging ? "grabbing" : "pointer",
              transition: isDragging ? "none" : "height 0.2s ease",
              userSelect: "none",
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onTouchStart={handleMouseDown}
            onMouseEnter={(e) => {
              if (!isDragging) e.currentTarget.style.height = "10px";
            }}
            onMouseLeave={(e) => {
              if (!isDragging) e.currentTarget.style.height = "8px";
            }}
          >
            <div
              style={{
                width: selectedScene
                  ? `${(((dragTime !== null ? dragTime : currentTime) - selectedScene.start) / (selectedScene.end - selectedScene.start)) * 100}%`
                  : "0%",
                height: "100%",
                background: "linear-gradient(90deg, #0078d4 0%, #005a9e 100%)",
                borderRadius: 4,
                transition: isDragging ? "none" : "all 0.15s ease",
              }}
            />
            {/* 시간 인디케이터 */}
            {selectedScene && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${(((dragTime !== null ? dragTime : currentTime) - selectedScene.start) / (selectedScene.end - selectedScene.start)) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: isDragging ? "16px" : "14px",
                  height: isDragging ? "16px" : "14px",
                  backgroundColor: isDragging ? "#005a9e" : "#0078d4",
                  borderRadius: "50%",
                  border: "2px solid white",
                  boxShadow: isDragging
                    ? "0 4px 8px rgba(0,0,0,0.3)"
                    : "0 2px 4px rgba(0,0,0,0.2)",
                  transition: isDragging ? "none" : "all 0.15s ease",
                  cursor: isDragging ? "grabbing" : "grab",
                  zIndex: isDragging ? 10 : 5,
                }}
              />
            )}
          </div>
          <Text size={200}>{selectedScene ? formatTime(selectedScene.end) : "00:00"}</Text>
        </div>
      </div>
    </Card>
  );
}

export default React.forwardRef(function VideoPreviewWithRef(props, ref) {
  return <VideoPreview {...props} videoRef={ref} />;
});