import React, { useRef, useEffect, useCallback, useState, memo } from "react";
import { Text, Button, Card, Badge } from "@fluentui/react-components";
import {
  PlayRegular,
  PauseRegular,
  CheckmarkCircleRegular,
} from "@fluentui/react-icons";

const VideoPreview = memo(function VideoPreview({
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

  // TTS 오디오 관리
  const audioRef = useRef(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // 시간 포맷 헬퍼
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 비디오와 TTS 오디오 동시 재생/일시정지 토글
  const handleVideoToggle = useCallback(() => {
    const video = videoRef?.current;
    const audio = audioRef?.current;

    if (!video && !audio) {
      console.warn("[재생] 비디오와 오디오가 모두 없습니다");
      return;
    }

    const shouldPlay = video ? video.paused : (audio ? audio.paused : true);

    if (shouldPlay) {
      // 재생 시작
      const playPromises = [];

      if (video && video.readyState >= 2) {
        playPromises.push(
          video.play().catch((error) => {
            console.error("[비디오 재생] 재생 실패:", error);
          })
        );
      }

      if (audio && audio.readyState >= 2) {
        playPromises.push(
          audio.play().catch((error) => {
            console.error("[TTS 재생] 재생 실패:", error);
          })
        );
      }

      Promise.allSettled(playPromises).then(() => {
        setIsPlaying(true);
        console.log("[재생] 비디오/오디오 재생 시작");
      });
    } else {
      // 일시정지
      try {
        if (video) video.pause();
        if (audio) audio.pause();
        setIsPlaying(false);
        console.log("[재생] 비디오/오디오 일시정지");
      } catch (error) {
        console.error("[재생] 일시정지 실패:", error);
      }
    }
  }, []); // videoRef와 audioRef는 ref이므로 의존성 배열에서 제외 가능

  // 부드러운 시간 계산 헬퍼 (음성 duration 기준)
  const calculateTimeFromPosition = useCallback((clientX, progressBarElement) => {
    if (!progressBarElement || audioDuration <= 0) return null;

    const rect = progressBarElement.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    const newTime = audioDuration * percentage;

    return Math.max(0, Math.min(audioDuration, newTime));
  }, [audioDuration]);

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
      // 드래그 종료 시 실제 비디오/오디오 시간 업데이트
      setCurrentTime(dragTime);
      const video = videoRef?.current;
      const audio = audioRef?.current;
      if (video) video.currentTime = dragTime;
      if (audio) audio.currentTime = dragTime;
    }

    setIsDragging(false);
    setDragTime(null);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isDragging, dragTime]); // ref는 의존성에서 제외

  // 클릭 핸들러 (빠른 탐색)
  const handleClick = useCallback((event) => {
    if (isDragging) return; // 드래그 중에는 클릭 무시

    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const newTime = calculateTimeFromPosition(clientX, progressBarRef.current);

    if (newTime !== null) {
      setCurrentTime(newTime);
      const video = videoRef?.current;
      const audio = audioRef?.current;
      if (video) video.currentTime = newTime;
      if (audio) audio.currentTime = newTime;
    }
  }, [isDragging, calculateTimeFromPosition]); // ref는 의존성에서 제외

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

  // 오디오 duration이 로드되면 비디오 duration과 비교
  useEffect(() => {
    if (audioDuration > 0 && videoDuration > 0) {
      if (videoDuration < audioDuration) {
        console.log(`[비디오 루프] 비디오(${videoDuration.toFixed(2)}초)가 오디오(${audioDuration.toFixed(2)}초)보다 짧아 ${Math.ceil(audioDuration / videoDuration)}회 루프됩니다`);
      } else if (videoDuration > audioDuration) {
        console.log(`[비디오 재생] 비디오(${videoDuration.toFixed(2)}초)가 오디오(${audioDuration.toFixed(2)}초)보다 길어 ${(videoDuration - audioDuration).toFixed(2)}초에서 정지됩니다`);
      } else {
        console.log(`[비디오 재생] 비디오와 오디오 길이가 동일합니다 (${audioDuration.toFixed(2)}초)`);
      }
    }
  }, [audioDuration, videoDuration]);

  // 비디오 URL이 변경되면 이벤트 리스너 설정
  useEffect(() => {
    if (videoUrl && videoRef?.current) {
      const video = videoRef.current;

      const handleLoadedData = () => {
        console.log("[비디오 재생] 비디오 로드 완료");

        // 비디오 duration 추적
        if (video.duration && isFinite(video.duration)) {
          setVideoDuration(video.duration);
          console.log(`[비디오 재생] 비디오 duration: ${video.duration.toFixed(2)}초`);
        }

        // 비디오 시작 시간을 0으로 설정
        video.currentTime = 0;
        setCurrentTime(0);

        // 비디오 자동 재생
        if (video.readyState >= 2) {
          video.play()
            .then(() => {
              console.log("[비디오 재생] 비디오 재생 시작");
              setIsPlaying(true);

              // 오디오도 함께 재생 (이미 로드되어 있다면)
              const audio = audioRef.current;
              if (audio && audio.readyState >= 2 && audio.paused) {
                audio.currentTime = 0;
                audio.play().catch((error) => {
                  console.error("[TTS 재생] 오디오 재생 실패:", error);
                });
              }
            })
            .catch((error) => {
              console.error("[비디오 재생] 자동 재생 실패:", error);
            });
        }
      };

      // 시간 업데이트 이벤트 핸들러 (비디오 기준)
      const handleTimeUpdate = () => {
        const videoCurrentTime = video.currentTime;

        // 오디오와 비디오 중 더 진행된 시간을 표시
        const audio = audioRef.current;
        const audioCurrentTime = audio && !audio.paused ? audio.currentTime : 0;
        const maxTime = Math.max(videoCurrentTime, audioCurrentTime);

        setCurrentTime(maxTime);
      };

      // 재생 상태 변경 이벤트 핸들러
      const handlePlay = () => {
        setIsPlaying(true);
      };
      const handlePause = () => {
        setIsPlaying(false);
      };

      // 비디오 종료 이벤트 핸들러 (오디오 중심 루프)
      const handleVideoEnded = () => {
        const audio = audioRef.current;

        // 오디오가 아직 재생 중이면 비디오를 처음부터 다시 재생
        if (audio && !audio.paused && !audio.ended) {
          console.log("[비디오 루프] 오디오가 아직 재생 중이므로 비디오를 처음부터 다시 재생합니다");

          // requestAnimationFrame으로 다음 프레임에서 재생하여 충돌 방지
          requestAnimationFrame(() => {
            if (audio && !audio.paused && !audio.ended) {
              video.currentTime = 0;
              video.play().catch((error) => {
                // pause()와의 충돌은 무시 (정상적인 상황)
                if (!error.message.includes("interrupted")) {
                  console.error("[비디오 루프] 재생 실패:", error);
                }
              });
            }
          });
        } else {
          // 오디오가 끝났거나 없으면 재생 중지
          console.log("[비디오 종료] 오디오가 끝났으므로 재생을 중지합니다");
          setIsPlaying(false);
        }
      };

      // 이벤트 리스너 추가
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("ended", handleVideoEnded);

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
        video.removeEventListener("ended", handleVideoEnded);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]); // videoRef는 ref이므로 의존성에서 제외

  // TTS 오디오 로딩 (씬별 음성 파일 로드)
  useEffect(() => {
    let isMounted = true; // cleanup을 위한 플래그

    const loadTtsAudio = async () => {
      console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 로딩 시작:`, {
        audioPath: selectedScene?.audioPath,
        hasAudioPath: !!selectedScene?.audioPath
      });

      // 씬 변경 시 이전 오디오 정지
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        console.log(`[TTS 오디오] 이전 오디오 정지`);
      }

      // 씬 변경 시 duration과 currentTime 초기화
      setAudioDuration(0);
      setVideoDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);

      if (!selectedScene?.audioPath) {
        console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} audioPath가 없습니다.`);
        if (isMounted) {
          setTtsAudioUrl(null);
          setHasAudio(false);
        }
        return;
      }

      try {
        console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 음성 로딩 시도:`, selectedScene.audioPath);

        // 파일 존재 여부 확인
        const pathCheck = await window.api?.checkPathExists?.(selectedScene.audioPath);

        if (!isMounted) return; // 컴포넌트가 언마운트되었으면 중단

        console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 파일 존재:`, pathCheck);

        if (!pathCheck?.exists || !pathCheck?.isFile) {
          console.warn(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 파일이 존재하지 않습니다:`, selectedScene.audioPath);
          if (isMounted) {
            setTtsAudioUrl(null);
            setHasAudio(false);
          }
          return;
        }

        const audioUrl = await window.api?.videoPathToUrl?.(selectedScene.audioPath);

        if (!isMounted) return; // 컴포넌트가 언마운트되었으면 중단

        console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} URL 생성:`, audioUrl);

        if (audioUrl && isMounted) {
          console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} setTtsAudioUrl 호출:`, audioUrl);
          setTtsAudioUrl(audioUrl);
          setHasAudio(true);
          console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} state 업데이트 완료`);
        }
      } catch (error) {
        if (isMounted) {
          console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 로딩 실패:`, error);
          setTtsAudioUrl(null);
          setHasAudio(false);
        }
      }
    };

    loadTtsAudio();

    // Cleanup: 컴포넌트 언마운트 또는 씬 변경 시
    return () => {
      isMounted = false;
    };
  }, [selectedScene?.audioPath, selectedSceneIndex]);

  // 오디오 이벤트 핸들러들 (메모이제이션)
  const handleAudioLoadedData = useCallback((e) => {
    console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 음성 로드 완료 (HTML)`);
    const audio = e.target;
    if (audio.duration && isFinite(audio.duration)) {
      setAudioDuration(audio.duration);
      console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} duration (HTML):`, audio.duration);
    }

    // 비디오가 이미 재생 중이면 오디오도 함께 재생
    const video = videoRef?.current;
    if (video && !video.paused) {
      audio.currentTime = video.currentTime;
      audio.play().then(() => {
        console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 비디오와 동기화하여 재생 시작`);
      }).catch((error) => {
        console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 동기화 재생 실패:`, error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]); // videoRef는 ref이므로 의존성에서 제외

  const handleAudioLoadedMetadata = useCallback((e) => {
    console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 메타데이터 로드 완료`);
    const audio = e.target;
    if (audio.duration && isFinite(audio.duration)) {
      setAudioDuration(audio.duration);
      console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} duration (metadata):`, audio.duration);
    }
  }, [selectedSceneIndex]);

  const handleAudioCanPlay = useCallback(() => {
    console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 재생 준비 완료`);
  }, [selectedSceneIndex]);

  const handleAudioError = useCallback((e) => {
    console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 재생 오류:`, e);
  }, [selectedSceneIndex]);

  const handleAudioEnded = useCallback(() => {
    console.log(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 재생 완료`);
    // 오디오가 끝나면 비디오도 정지
    const video = videoRef?.current;
    if (video && !video.paused) {
      video.pause();
      console.log("[TTS 오디오] 오디오 종료로 인해 비디오도 정지됨");
    }
    setIsPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]); // videoRef는 ref이므로 의존성에서 제외

  // 씬 선택 시 자동 재생
  useEffect(() => {
    // selectedSceneIndex가 유효하지 않으면 종료
    if (selectedSceneIndex < 0) return;

    const video = videoRef?.current;
    const audio = audioRef?.current;

    // 먼저 현재 재생 중인 비디오와 오디오를 정지
    if (video && !video.paused) {
      video.pause();
      video.currentTime = 0;
    }
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }

    // 약간의 딜레이를 두어 비디오와 오디오가 모두 로드될 시간을 줌
    const timeoutId = setTimeout(() => {
      const playPromises = [];

      // 비디오 재생
      if (video && video.readyState >= 2) {
        video.currentTime = 0;
        setCurrentTime(0);
        playPromises.push(
          video.play().catch((error) => {
            console.error("[씬 선택] 비디오 자동 재생 실패:", error);
          })
        );
      }

      // 오디오 재생
      if (audio && audio.readyState >= 2) {
        audio.currentTime = 0;
        playPromises.push(
          audio.play().catch((error) => {
            console.error("[씬 선택] 오디오 자동 재생 실패:", error);
          })
        );
      }

      if (playPromises.length > 0) {
        Promise.allSettled(playPromises).then(() => {
          setIsPlaying(true);
          console.log(`[씬 선택] 씬 ${selectedSceneIndex + 1} 자동 재생 시작`);
        });
      }
    }, 300); // 300ms 딜레이

    // Cleanup: 타이머 정리
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]); // videoRef는 ref이므로 의존성에서 제외

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
          selectedScene.asset?.path && videoUrl ? (
            selectedScene.asset.type === "video" ? (
              // 비디오 표시 (자막 오버레이 포함)
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <video
                  ref={videoRef}
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
                  muted={true}
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
            ) : selectedScene.asset.type === "image" ? (
              // 이미지 표시 (자막 오버레이 포함)
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <img
                  src={videoUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: 16,
                  }}
                  onError={(e) => {
                    console.error("[이미지 표시] 오류:", e);
                    console.error("[이미지 표시] 이미지 URL:", videoUrl);
                  }}
                  onLoad={() => {
                    console.log("[이미지 표시] 로드됨:", videoUrl);
                  }}
                  alt={selectedScene.asset.filename || "Scene image"}
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
              </div>
            ) : null
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

      {/* 숨겨진 TTS 오디오 엘리먼트 */}
      {ttsAudioUrl && (
        <audio
          ref={audioRef}
          src={ttsAudioUrl}
          style={{ display: "none" }}
          preload="auto"
          onLoadedData={handleAudioLoadedData}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onCanPlay={handleAudioCanPlay}
          onError={handleAudioError}
          onEnded={handleAudioEnded}
        />
      )}

      {/* 플레이어 컨트롤 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button
          appearance="primary"
          icon={isPlaying ? <PauseRegular /> : <PlayRegular />}
          onClick={handleVideoToggle}
          disabled={!selectedScene || (!videoUrl && !hasAudio)}
        >
          {isPlaying ? "일시정지" : hasAudio && !videoUrl ? "음성 재생" : "재생"}
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
                width: audioDuration > 0
                  ? `${Math.min(100, ((dragTime !== null ? dragTime : currentTime) / audioDuration) * 100)}%`
                  : "0%",
                height: "100%",
                background: "linear-gradient(90deg, #0078d4 0%, #005a9e 100%)",
                borderRadius: 4,
                transition: isDragging ? "none" : "all 0.15s ease",
              }}
            />
            {/* 시간 인디케이터 */}
            {audioDuration > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${Math.min(100, ((dragTime !== null ? dragTime : currentTime) / audioDuration) * 100)}%`,
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
          <Text size={200}>{audioDuration > 0 ? formatTime(audioDuration) : "00:00"}</Text>
        </div>
      </div>
    </Card>
  );
});

export default React.forwardRef(function VideoPreviewWithRef(props, ref) {
  return <VideoPreview {...props} videoRef={ref} />;
});