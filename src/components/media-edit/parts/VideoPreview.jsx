import React, { useRef, useEffect, useCallback, useState, memo, useMemo } from "react";
import { Text, Button, Card, Badge } from "@fluentui/react-components";
import {
  PlayRegular,
  PauseRegular,
  CheckmarkCircleRegular,
} from "@fluentui/react-icons";
import { splitBalancedLines } from "../../refine/utils/metrics";
import { checkFileExists } from "../../../utils/fileManager";

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

  // 전역 자막 설정 관리
  const [subtitleSettings, setSubtitleSettings] = useState(null);

  // 프리뷰 컨테이너 크기 측정 (동적 SCALE_FACTOR 계산용)
  const previewContainerRef = useRef(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  // 시간 포맷 헬퍼 (메모이제이션)
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // 프리뷰 컨테이너 크기 측정 (동적 스케일 팩터 계산용)
  useEffect(() => {
    const measureContainer = () => {
      if (previewContainerRef.current) {
        const rect = previewContainerRef.current.getBoundingClientRect();
        setPreviewWidth(rect.width);
      }
    };

    measureContainer();
    window.addEventListener("resize", measureContainer);

    return () => window.removeEventListener("resize", measureContainer);
  }, []);

  // 전역 자막 설정 로드
  useEffect(() => {
    const loadSubtitleSettings = async () => {
      try {
        const settings = await window.api?.getSetting("subtitleSettings");

        if (settings) {
          setSubtitleSettings(settings);
        } else {
          // 기본값 (SubtitleTab의 defaultSettings와 동일)
          const defaultSettings = {
            enableSubtitles: true, // ✅ 자막 사용 (기본값)
            fontFamily: "noto-sans",
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: 0,
            textColor: "#FFFFFF",
            backgroundColor: "#000000",
            backgroundOpacity: 80,
            outlineColor: "#000000",
            outlineWidth: 2,
            shadowColor: "#000000",
            shadowOffset: 2,
            shadowBlur: 4,
            position: "bottom",
            horizontalAlign: "center",
            verticalPadding: 40,
            horizontalPadding: 20,
            maxWidth: 80,
            useBackground: true,
            backgroundRadius: 8,
            useOutline: true,
            useShadow: true,
            maxLines: 2,
          };
          setSubtitleSettings(defaultSettings);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("자막 설정 로드 실패:", error);
        }
        setSubtitleSettings({
          enableSubtitles: true, // ✅ 자막 사용 (기본값)
          fontFamily: "noto-sans",
          fontSize: 24,
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: 0,
          textColor: "#FFFFFF",
          backgroundColor: "#000000",
          backgroundOpacity: 80,
          outlineColor: "#000000",
          outlineWidth: 2,
          shadowColor: "#000000",
          shadowOffset: 2,
          shadowBlur: 4,
          position: "bottom",
          horizontalAlign: "center",
          verticalPadding: 40,
          horizontalPadding: 20,
          maxWidth: 80,
          useBackground: true,
          backgroundRadius: 8,
          useOutline: true,
          useShadow: true,
          maxLines: 2,
        });
      }
    };

    loadSubtitleSettings();

    // 설정 변경 이벤트 리스너 (메모이제이션)
    const handleSettingsChanged = () => {
      loadSubtitleSettings();
    };

    window.addEventListener("settingsChanged", handleSettingsChanged);

    return () => {
      window.removeEventListener("settingsChanged", handleSettingsChanged);
    };
  }, []);

  // 비디오와 TTS 오디오 동시 재생/일시정지 토글
  const handleVideoToggle = useCallback(() => {
    const video = videoRef?.current;
    const audio = audioRef?.current;

    if (!video && !audio) {
      return;
    }

    const shouldPlay = video ? video.paused : (audio ? audio.paused : true);

    if (shouldPlay) {
      // 재생 시작
      const playPromises = [];

      if (video && video.readyState >= 2) {
        playPromises.push(
          video.play().catch((error) => {
            if (process.env.NODE_ENV === 'development') {
              console.error("[비디오 재생] 재생 실패:", error);
            }
          })
        );
      }

      if (audio && audio.readyState >= 2) {
        playPromises.push(
          audio.play().catch((error) => {
            if (process.env.NODE_ENV === 'development') {
              console.error("[TTS 재생] 재생 실패:", error);
            }
          })
        );
      }

      Promise.allSettled(playPromises).then(() => {
        setIsPlaying(true);
      });
    } else {
      // 일시정지
      try {
        if (video) video.pause();
        if (audio) audio.pause();
        setIsPlaying(false);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("[재생] 일시정지 실패:", error);
        }
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
    const newTime = calculateTimeFromPosition(clientX, progressBarRef?.current);
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
    const newTime = calculateTimeFromPosition(clientX, progressBarRef?.current);

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

  // 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      // 애니메이션 프레임 정리
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // 오디오 정리
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      // blob URL 정리 (메모리 누수 방지)
      if (ttsAudioUrl && ttsAudioUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(ttsAudioUrl);
        } catch (e) {
          // blob URL 해제 실패 (무시)
        }
      }
    };
  }, [ttsAudioUrl]);


  // 비디오 URL이 변경되면 이벤트 리스너 설정
  useEffect(() => {
    if (videoUrl && videoRef?.current) {
      const video = videoRef.current;

      const handleLoadedData = () => {
        // 비디오 duration 추적
        if (video.duration && isFinite(video.duration)) {
          setVideoDuration(video.duration);
        }

        // 비디오 시작 시간을 0으로 설정
        video.currentTime = 0;
        setCurrentTime(0);

        // 비디오 자동 재생
        if (video.readyState >= 2) {
          video.play()
            .then(() => {
              setIsPlaying(true);

              // 오디오도 함께 재생 (이미 로드되어 있다면)
              const audio = audioRef.current;
              if (audio && audio.readyState >= 2 && audio.paused) {
                audio.currentTime = 0;
                audio.play().catch((error) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.error("[TTS 재생] 오디오 재생 실패:", error);
                  }
                });
              }
            })
            .catch((error) => {
              if (process.env.NODE_ENV === 'development') {
                console.error("[비디오 재생] 자동 재생 실패:", error);
              }
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
    let retryTimeout = null; // 재시도 timeout 참조

    const loadTtsAudio = async () => {
      // 씬 변경 시 이전 오디오 정지
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      // 씬 변경 시 duration과 currentTime 초기화
      setAudioDuration(0);
      setVideoDuration(0);
      setCurrentTime(0);
      setIsPlaying(false);

      if (!selectedScene?.audioPath) {
        if (isMounted) {
          setTtsAudioUrl(null);
          setHasAudio(false);
        }
        return;
      }

      try {
        // 파일 존재 여부 확인
        const pathCheck = await checkFileExists(selectedScene.audioPath);

        if (!isMounted) return; // 컴포넌트가 언마운트되었으면 중단

        if (!pathCheck?.exists || !pathCheck?.isFile) {
          if (isMounted) {
            setTtsAudioUrl(null);
            setHasAudio(false);
          }
          return;
        }

        // audioUpdatedAt이 있으면 캐시 무효화 (TTS 재생성된 경우)
        let useCache = true;
        if (selectedScene.audioUpdatedAt) {
          if (window.api?.revokeVideoUrl) {
            window.api.revokeVideoUrl(selectedScene.audioPath);
          }
          useCache = false;
        }

        const audioUrl = await window.api?.videoPathToUrl?.(selectedScene.audioPath, { cache: useCache });

        if (!isMounted) return; // 컴포넌트가 언마운트되었으면 중단

        if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.startsWith('blob:')) {
          // 재시도: 캐시 제거 후 다시 시도
          if (window.api?.revokeVideoUrl) {
            window.api.revokeVideoUrl(selectedScene.audioPath);
          }

          // 100ms 후 재시도 (cleanup에서 취소 가능)
          retryTimeout = setTimeout(async () => {
            if (!isMounted) return;

            try {
              const retryUrl = await window.api?.videoPathToUrl?.(selectedScene.audioPath, { cache: false });

              if (retryUrl && retryUrl.startsWith('blob:') && isMounted) {
                setTtsAudioUrl(retryUrl);
                setHasAudio(true);
              } else {
                if (isMounted) {
                  setTtsAudioUrl(null);
                  setHasAudio(false);
                }
              }
            } catch (retryError) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 재시도 실패:`, retryError);
              }
            }
          }, 100);

          return;
        }

        if (isMounted) {
          setTtsAudioUrl(audioUrl);
          setHasAudio(true);
        }
      } catch (error) {
        if (isMounted) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 로딩 실패:`, error);
          }
          setTtsAudioUrl(null);
          setHasAudio(false);
        }
      }
    };

    loadTtsAudio();

    // Cleanup: 컴포넌트 언마운트 또는 씬 변경 시
    return () => {
      isMounted = false;

      // 재시도 timeout 취소
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }

      // 이전 오디오 정리
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [selectedScene?.audioPath, selectedScene?.audioUpdatedAt, selectedSceneIndex]);

  // ttsAudioUrl이 변경되면 오디오 엘리먼트 강제 리로드
  useEffect(() => {
    if (ttsAudioUrl && audioRef.current) {
      const audio = audioRef.current;
      // 오디오 엘리먼트 강제 리로드
      audio.load();
    }
  }, [ttsAudioUrl]);


  // 오디오 이벤트 핸들러들 (메모이제이션)
  const handleAudioLoadedData = useCallback((e) => {
    const audio = e.target;
    if (audio.duration && isFinite(audio.duration)) {
      setAudioDuration(audio.duration);
    }

    // 비디오가 이미 재생 중이면 오디오도 함께 재생
    const video = videoRef?.current;
    if (video && !video.paused) {
      audio.currentTime = video.currentTime;
      audio.play().catch((error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[TTS 오디오] 동기화 재생 실패:`, error);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]); // videoRef는 ref이므로 의존성에서 제외

  const handleAudioLoadedMetadata = useCallback((e) => {
    const audio = e.target;
    if (audio.duration && isFinite(audio.duration)) {
      setAudioDuration(audio.duration);
    }
  }, [selectedSceneIndex]);

  const handleAudioCanPlay = useCallback(() => {
    // 재생 준비 완료 (로그 불필요)
  }, [selectedSceneIndex]);

  const handleAudioError = useCallback(async (e) => {
    const audio = e.target;
    const error = audio.error;

    let errorMessage = "알 수 없는 오류";
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = "오디오 로드가 중단되었습니다";
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = "네트워크 오류로 오디오를 로드할 수 없습니다";
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = "오디오 디코딩 오류";
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "오디오 형식이 지원되지 않거나 파일을 찾을 수 없습니다";
          break;
        default:
          errorMessage = `오류 코드: ${error.code}`;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 재생 오류:`, {
        message: errorMessage,
        src: audio.src,
        error: error,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    }

    // blob URL이 만료된 경우 자동으로 재생성 시도
    if (error && error.code === error.MEDIA_ERR_SRC_NOT_SUPPORTED && selectedScene?.audioPath) {
      try {
        // 캐시 제거
        if (window.api?.revokeVideoUrl) {
          window.api.revokeVideoUrl(selectedScene.audioPath);
        }

        // 새로운 blob URL 생성
        const newAudioUrl = await window.api?.videoPathToUrl?.(selectedScene.audioPath, { cache: false });

        if (newAudioUrl && newAudioUrl.startsWith('blob:')) {
          setTtsAudioUrl(newAudioUrl);
          setHasAudio(true);
          return; // 재생성 성공하면 초기화하지 않음
        }
      } catch (retryError) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[TTS 오디오] 씬 ${selectedSceneIndex + 1} 재생성 실패:`, retryError);
        }
      }
    }

    // 오디오 상태 초기화
    setHasAudio(false);
    setAudioDuration(0);
  }, [selectedSceneIndex, selectedScene]);

  const handleAudioTimeUpdate = useCallback((e) => {
    const audio = e.target;
    const audioCurrentTime = audio.currentTime;

    // 비디오가 있으면 비디오와 오디오 중 더 진행된 시간 사용
    const video = videoRef?.current;
    const videoCurrentTime = video && !video.paused ? video.currentTime : 0;
    const maxTime = Math.max(videoCurrentTime, audioCurrentTime);

    setCurrentTime(maxTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]); // videoRef는 ref이므로 의존성에서 제외

  const handleAudioEnded = useCallback(() => {
    // 오디오가 끝나면 비디오도 정지
    const video = videoRef?.current;
    if (video && !video.paused) {
      video.pause();
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
            if (process.env.NODE_ENV === 'development') {
              console.error("[씬 선택] 비디오 자동 재생 실패:", error);
            }
          })
        );
      }

      // 오디오 재생
      if (audio && audio.readyState >= 2) {
        audio.currentTime = 0;
        playPromises.push(
          audio.play().catch((error) => {
            if (process.env.NODE_ENV === 'development') {
              console.error("[씬 선택] 오디오 자동 재생 실패:", error);
            }
          })
        );
      }

      if (playPromises.length > 0) {
        Promise.allSettled(playPromises).then(() => {
          setIsPlaying(true);
        });
      }
    }, 300); // 300ms 딜레이

    // Cleanup: 타이머 정리
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex]); // videoRef는 ref이므로 의존성에서 제외

  // 자막 오버레이 렌더링 헬퍼 함수 (메모이제이션: 불필요한 재계산 방지)
  const renderSubtitleOverlay = useMemo(() => () => {
    if (!selectedScene?.text || !subtitleSettings) return null;

    // enableSubtitles가 false면 자막 렌더링하지 않음
    if (subtitleSettings.enableSubtitles === false) {
      return null;
    }

    // 전역 설정 값 추출
    const {
      fontSize = 24,
      position = "bottom",
      horizontalAlign = "center",
      useOutline = true,
      outlineWidth = 2,
      useShadow = false,
      verticalPadding = 40,
      maxLines = 2,
      fontFamily = "noto-sans",
      fontWeight = 600,
      lineHeight = 1.4,
      letterSpacing = 0,
      textColor = "#FFFFFF",
      backgroundColor = "#000000",
      backgroundOpacity = 80,
      outlineColor = "#000000",
      shadowColor = "#000000",
      shadowOffset = 2,
      shadowBlur = 4,
      useBackground = true,
      backgroundRadius = 8,
      maxWidth = 80,
    } = subtitleSettings;

    // 프리뷰 크기 비율 계산 (1920x1080 기준 -> 프리뷰 크기로 스케일링)
    // 실제 프리뷰 컨테이너 크기를 기반으로 동적 계산
    // previewWidth가 0이면 기본값 0.3 사용 (초기 로드 시)
    const SCALE_FACTOR = previewWidth > 0 ? previewWidth / 1920 : 0.3;

    const scaledFontSize = fontSize * SCALE_FACTOR;
    const scaledOutlineWidth = outlineWidth * SCALE_FACTOR;
    const scaledShadowOffset = shadowOffset * SCALE_FACTOR;
    const scaledShadowBlur = shadowBlur * SCALE_FACTOR;
    const scaledVerticalPadding = verticalPadding * SCALE_FACTOR;
    const scaledBackgroundRadius = backgroundRadius * SCALE_FACTOR;
    const scaledLetterSpacing = letterSpacing * SCALE_FACTOR;

    // 폰트 패밀리 매핑
    const fontFamilyMap = {
      "noto-sans": "'Noto Sans KR', sans-serif",
      "malgun-gothic": "'Malgun Gothic', sans-serif",
      "apple-sd-gothic": "'Apple SD Gothic Neo', sans-serif",
      "nanumgothic": "'Nanum Gothic', sans-serif",
      "arial": "Arial, sans-serif",
      "helvetica": "Helvetica, sans-serif",
      "roboto": "'Roboto', sans-serif"
    };
    const fontFamilyStyle = fontFamilyMap[fontFamily] || "'Noto Sans KR', sans-serif";

    // 외곽선 스타일 (사용자 설정 색상 적용 + 스케일링)
    const textShadowParts = [];
    if (useOutline && scaledOutlineWidth > 0) {
      // 8방향 외곽선 효과
      for (let angle = 0; angle < 360; angle += 45) {
        const x = Math.cos((angle * Math.PI) / 180) * scaledOutlineWidth;
        const y = Math.sin((angle * Math.PI) / 180) * scaledOutlineWidth;
        textShadowParts.push(`${x}px ${y}px 0 ${outlineColor}`);
      }
    }
    if (useShadow) {
      textShadowParts.push(`${scaledShadowOffset}px ${scaledShadowOffset}px ${scaledShadowBlur}px ${shadowColor}`);
    }
    const textShadow = textShadowParts.length > 0 ? textShadowParts.join(", ") : "none";

    // 배경색 스타일 (투명도 적용)
    const bgOpacity = backgroundOpacity / 100;
    const bgColorRgb = backgroundColor.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [0, 0, 0];
    const backgroundColorStyle = useBackground
      ? `rgba(${bgColorRgb[0]}, ${bgColorRgb[1]}, ${bgColorRgb[2]}, ${bgOpacity})`
      : "transparent";

    // 위치 계산 (스케일링 적용)
    const positionStyle = {};
    if (position === "bottom") {
      positionStyle.bottom = `${scaledVerticalPadding}px`;
    } else if (position === "top") {
      positionStyle.top = `${scaledVerticalPadding}px`;
    } else {
      positionStyle.top = "50%";
      positionStyle.transform = horizontalAlign === "center" ? "translate(-50%, -50%)" : "translateY(-50%)";
    }

    // 정렬 스타일
    const textAlignStyle = horizontalAlign === "left" ? "left" : horizontalAlign === "right" ? "right" : "center";
    const leftStyle = horizontalAlign === "center" ? "50%" : horizontalAlign === "right" ? "auto" : "0";
    const rightStyle = horizontalAlign === "right" ? "0" : "auto";
    const transformStyle = horizontalAlign === "center" ? "translateX(-50%)" : "";

    return (
      <div
        style={{
          position: "absolute",
          ...positionStyle,
          left: leftStyle,
          right: rightStyle,
          transform: transformStyle,
          pointerEvents: "none",
          display: "flex",
          justifyContent: textAlignStyle,
          maxWidth: `${maxWidth}%`,
        }}
      >
        <div
          style={{
            color: textColor,
            fontFamily: fontFamilyStyle,
            fontSize: `${scaledFontSize}px`,
            fontWeight,
            textAlign: textAlignStyle,
            textShadow,
            lineHeight,
            letterSpacing: `${scaledLetterSpacing}px`,
            backgroundColor: backgroundColorStyle,
            padding: useBackground ? `${8 * SCALE_FACTOR}px ${12 * SCALE_FACTOR}px` : "0",
            borderRadius: useBackground ? `${scaledBackgroundRadius}px` : "0",
            backdropFilter: useBackground ? "blur(8px)" : "none",
            boxShadow: useBackground ? "0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)" : "none",
            border: useBackground ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
          }}
        >
          {splitBalancedLines(selectedScene.text, maxLines, fontSize).map((line, i) => (
            <div key={i} style={{
              whiteSpace: "nowrap",
              overflow: "visible"
            }}>{line}</div>
          ))}
        </div>
      </div>
    );
  }, [selectedScene?.text, subtitleSettings, previewWidth, selectedSceneIndex]);

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
        ref={previewContainerRef}
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
                    if (process.env.NODE_ENV === 'development') {
                      console.error("[비디오 재생] 오류:", e);
                      console.error("[비디오 재생] 비디오 URL:", videoUrl);
                    }
                  }}
                  onLoadedData={() => {
                    if (process.env.NODE_ENV === 'development') {
                      console.log("[비디오 재생] 로드됨:", videoUrl);
                    }
                  }}
                />
                {/* 자막 오버레이 */}
                {renderSubtitleOverlay()}
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
              // 이미지 표시 (자막 오버레이 포함, 음성 재생/정지 가능)
              <div
                style={{ position: "relative", width: "100%", height: "100%", cursor: "pointer" }}
                onClick={handleVideoToggle}
              >
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
                {renderSubtitleOverlay()}
                {/* 재생/일시정지 아이콘 오버레이 (음성 제어용) */}
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
          onTimeUpdate={handleAudioTimeUpdate}
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