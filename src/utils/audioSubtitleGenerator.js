/**
 * 오디오 및 자막 생성 유틸리티
 *
 * @description
 * 대본으로부터 음성 파일과 SRT 자막을 생성하는 통합 유틸리티
 *
 * @features
 * - 🎤 TTS를 통한 개별 씬 음성 파일 생성
 * - 📝 SRT 자막 파일 생성
 * - 📊 진행률 추적 및 업데이트
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 */

/**
 * 대본으로부터 음성과 자막을 생성하는 메인 함수
 *
 * @param {Object} scriptData - 생성된 대본 데이터
 * @param {string} mode - 실행 모드
 * @param {Object} options - 생성 옵션
 * @param {Object} options.form - 폼 설정 (TTS 엔진, 음성 ID 등)
 * @param {Array} options.voices - 사용 가능한 음성 목록
 * @param {Function} options.setFullVideoState - 상태 업데이트 함수
 * @param {Function} options.api - API 호출 함수
 * @param {Object} options.toast - 토스트 알림 객체
 * @param {Function} options.addLog - 로그 추가 함수
 * @param {string} outputPath - 파일 출력 경로 (선택사항)
 */
export async function generateAudioAndSubtitles(scriptData, mode = "script_mode", options, outputPath = null) {
  const { form, voices, setFullVideoState, api, toast, addLog, abortSignal } = options;

  // TTS 실제 duration 데이터를 저장할 변수
  let ttsDurations = null;

  // 컴포넌트 마운트 상태 추적 (탭 전환 시 안전성)
  let isMounted = true;

  // 중단 체크 함수
  const checkAborted = () => {
    if (abortSignal?.aborted) {
      throw new Error("작업이 취소되었습니다.");
    }
  };

  // 안전한 상태 업데이트 함수
  const safeSetState = (updater) => {
    if (isMounted && setFullVideoState) {
      try {
        setFullVideoState(updater);
      } catch (err) {
        console.warn("상태 업데이트 실패 (컴포넌트 언마운트됨):", err);
      }
    }
  };

  try {
    checkAborted(); // 시작 전 체크

    // 2단계: 음성 생성 시작
    safeSetState(prev => ({
      ...prev,
      progress: { ...prev.progress, audio: 25 }
    }));

    // videoSaveFolder에 직접 음성 파일 저장
    let audioFolderPath = null;
    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
      if (videoSaveFolder) {
        audioFolderPath = videoSaveFolder;
        addLog(`📁 음성 파일 저장 위치: ${audioFolderPath}`);
      }
    } catch (pathError) {
      console.warn("videoSaveFolder 가져오기 실패:", pathError);
    }

    // TTS 생성 (장면 수와 엔진에 따라 동적 타임아웃 설정)
    const sceneCount = scriptData.scenes?.length || 1;
    const ttsEngine = form.ttsEngine || "google";

    // Google TTS 타임아웃 설정
    const estimatedTimeSeconds = Math.max(30, sceneCount * 8); // 최소 30초, 장면당 8초

    const timeoutMs = estimatedTimeSeconds * 1000;

    if (addLog) {
      addLog(`🎤 ${sceneCount}개 장면의 음성 생성 중... (${ttsEngine})`);
      addLog(`⏳ 예상 소요 시간: 약 ${estimatedTimeSeconds}초 (Google TTS)`);
    }

    // TTS 진행률 리스너 설정
    let ttsProgressListener = null;
    let ttsFallbackListener = null;
    try {
      ttsProgressListener = (data) => {
        const { current, total, progress } = data;
        safeSetState((prev) => ({
          ...prev,
          progress: { ...prev.progress, audio: progress },
        }));

        if (addLog) {
          addLog(`🎤 음성 생성 진행률: ${current + 1}/${total} (${progress}%)`);
        }
      };

      // TTS 자동 전환 리스너 추가
      ttsFallbackListener = (data) => {
        const { original, fallback, reason, message } = data;

        if (addLog) {
          addLog(`⚠️ ${original} ${reason === 'quota_exceeded' ? '크레딧 부족' : '오류'}으로 ${fallback}로 자동 전환`, "warning");
          addLog(`🔄 ${message}`, "info");
        }

        console.warn(`${original} → ${fallback} 자동 전환: ${reason === 'quota_exceeded' ? '크레딧 부족' : '오류 발생'}`);
        console.warn("🔄 TTS 자동 전환:", data);
      };

      if (window.electronAPI?.on) {
        window.electronAPI.on("tts:progress", ttsProgressListener);
        window.electronAPI.on("tts:fallback", ttsFallbackListener);
      }
    } catch (listenerError) {
      console.warn("TTS 리스너 설정 실패:", listenerError);
    }

    checkAborted(); // TTS 호출 전 체크

    let audioResult;
    try {
      audioResult = await api.invoke("tts:synthesize", {
        scenes: scriptData.scenes,
        ttsEngine: form.ttsEngine || "google",
        voiceId: form.voice || voices[0]?.id,
        speed: form.speed || "1.0",
        outputPath: audioFolderPath,
      }, {
        timeout: timeoutMs
      });

      checkAborted(); // TTS 완료 후 체크
    } finally {
      // 리스너들 제거
      try {
        if (ttsProgressListener && window.electronAPI?.off) {
          window.electronAPI.off("tts:progress", ttsProgressListener);
        }
        if (ttsFallbackListener && window.electronAPI?.off) {
          window.electronAPI.off("tts:fallback", ttsFallbackListener);
        }
      } catch (cleanupError) {
        console.warn("TTS 리스너 정리 실패:", cleanupError);
      }
    }

    if (audioResult && audioResult.data && audioResult.data.ok) {
      // 음성 생성 완료
      safeSetState(prev => ({
        ...prev,
        progress: { ...prev.progress, audio: 75 }
      }));

      const audioFiles = audioResult.data.audioFiles;

      // 📋 관리자 페이지에 TTS 작업 로그 기록
      if (window.api?.logActivity) {
        window.api.logActivity({
          type: "tts",
          title: "음성 합성",
          detail: `${sceneCount}개 장면 (${form.ttsEngine}) - ${audioFiles?.length || 0}개 파일 생성`,
          status: "success",
          metadata: {
            sceneCount: sceneCount,
            fileCount: audioFiles?.length || 0,
            engine: form.ttsEngine,
            voice: form.voice
          }
        });
      }

      // TTS 실제 duration 데이터 저장 (자막 생성에 사용)
      ttsDurations = audioFiles.map(file => ({
        sceneIndex: file.sceneIndex,
        duration: file.duration || 0
      }));

      // 먼저 base64 오디오 파일들을 디스크에 저장
      const savedAudioFiles = [];

      if (audioFiles && audioFiles.length > 0) {
        if (addLog) {
          addLog(`💾 ${audioFiles.length}개 음성 파일을 디스크에 저장 중...`);
        }

        for (let i = 0; i < audioFiles.length; i++) {
          const audioFile = audioFiles[i];
          const { fileName, base64, audioUrl } = audioFile;

          // 이미 audioUrl이 있는 경우 (파일이 이미 저장된 경우)
          if (audioUrl && typeof audioUrl === 'string' && audioUrl.trim() !== '') {
            savedAudioFiles.push({
              fileName: fileName,
              audioUrl: audioUrl,
              filePath: audioUrl
            });
            continue;
          }

          if (!base64) {
            console.warn(`⚠️ 오디오 파일 ${fileName}에 base64 데이터가 없습니다`);
            continue;
          }

          try {
            // videoSaveFolder에 개별 음성 파일 저장
            let filePath;
            try {
              const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
              const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
              if (videoSaveFolder) {
                // audio 폴더 생성 확인
                const audioFolder = `${videoSaveFolder}\\audio`;
                try {
                  await api.invoke("fs:mkDirRecursive", { dirPath: audioFolder });
                } catch (dirError) {
                  console.warn("개별 음성 파일용 audio 폴더 생성 실패:", dirError);
                }
                // 크로스 플랫폼 경로 (슬래시 사용, electron이 자동 변환)
                filePath = `${audioFolder}/${fileName}`;
              } else {
                // 백엔드에서 기본 경로 처리
                filePath = null; // electron이 처리
              }
            } catch (error) {
              console.warn("설정 가져오기 실패, electron이 기본 경로 처리");
              filePath = null; // electron이 처리
            }

            // base64를 Buffer로 변환
            const buffer = Buffer.from(base64, 'base64');

            // 새로운 files:writeBuffer API 사용 (지정된 경로에 저장)
            const saveResult = await api.invoke("files:writeBuffer", {
              buffer: buffer,
              filePath: filePath
            });


            if (saveResult.success && saveResult.data?.ok) {
              const savedPath = saveResult.data.path;

              if (savedPath && typeof savedPath === 'string' && savedPath.trim() !== '') {
                const fileInfo = {
                  fileName: fileName,
                  audioUrl: savedPath,
                  filePath: savedPath
                };
                savedAudioFiles.push(fileInfo);

                if (addLog) {
                  addLog(`✅ 음성 파일 저장: ${fileName} → ${savedPath}`);
                }
              } else {
                console.error(`❌ 음성 파일 저장 성공했지만 경로가 유효하지 않음: ${fileName}, path: ${savedPath}`);
                if (addLog) {
                  addLog(`❌ 음성 파일 저장 성공했지만 경로가 유효하지 않음: ${fileName}`, "error");
                }
              }
            } else {
              console.error(`❌ 음성 파일 저장 실패: ${fileName}`, saveResult);
              if (addLog) {
                addLog(`❌ 음성 파일 저장 실패: ${fileName} - ${saveResult.message || '알 수 없는 오류'}`, "error");
              }
            }
          } catch (error) {
            console.error(`❌ 음성 파일 ${fileName} 저장 오류:`, error);
            if (addLog) {
              addLog(`❌ 음성 파일 ${fileName} 저장 오류: ${error.message}`, "error");
            }
          }
        }
      } else {
        console.warn("⚠️ audioFiles가 비어있거나 유효하지 않음");
        console.warn("⚠️ audioFiles:", audioFiles);
        console.warn("⚠️ audioFiles 조건:", audioFiles && audioFiles.length > 0);
        if (addLog) {
          addLog(`⚠️ 저장할 음성 파일이 없습니다`, "warning");
        }
      }

      // 개별 음성 파일 저장 완료
      if (savedAudioFiles && savedAudioFiles.length > 0) {
        if (addLog) {
          addLog(`✅ ${savedAudioFiles.length}개 음성 파일 저장 완료`);
        }
      }
    } else {
      console.error("❌ === TTS 결과 조건 실패 ===");
      console.error("❌ audioResult && audioResult.data && audioResult.data.ok 조건이 실패했습니다");
      console.error("❌ audioResult:", audioResult);
      console.error("❌ 개별 파일 저장을 건너뜁니다");

      // 📋 관리자 페이지에 TTS 실패 로그 기록
      if (window.api?.logActivity) {
        window.api.logActivity({
          type: "tts",
          title: "음성 합성",
          detail: `${sceneCount}개 장면 (${form.ttsEngine}) - 생성 실패`,
          status: "error",
          metadata: {
            sceneCount: sceneCount,
            engine: form.ttsEngine,
            error: audioResult?.data?.error || "알 수 없는 오류"
          }
        });
      }

      if (addLog) {
        addLog(`❌ TTS 결과 처리 실패 - 조건 체크 실패`, "error");
        if (audioResult) {
          addLog(`🔍 audioResult.data: ${JSON.stringify(audioResult.data)}`, "error");
        } else {
          addLog(`🔍 audioResult가 null/undefined입니다`, "error");
        }
      }
    }

    // 자막 생성 (script_mode에서만, TTS duration 데이터 사용)
    if (mode === "script_mode" && ttsDurations && ttsDurations.length > 0) {
      checkAborted(); // 자막 생성 전 체크

      safeSetState(prev => ({
        ...prev,
        progress: { ...prev.progress, subtitle: 0 }
      }));

      await generateSubtitleFile(scriptData, mode, { api, toast, setFullVideoState, addLog }, ttsDurations);

      safeSetState(prev => ({
        ...prev,
        progress: { ...prev.progress, subtitle: 100 }
      }));
    }

    // 모든 단계 완료 - 모드별 메시지
    handleCompletionByMode(mode, { setFullVideoState, toast, addLog });

  } catch (error) {
    console.error("음성/자막 생성 오류:", error);

    // 오류 발생 시 상태 초기화
    safeSetState(prev => ({
      ...prev,
      isGenerating: false,
      currentStep: "error"
    }));

    throw error;
  } finally {
    // 함수 종료 시 마운트 상태 해제 (탭 전환 후 상태 업데이트 방지)
    isMounted = false;
  }
}

/**
 * SRT 자막 파일을 생성하는 함수
 *
 * @param {Object} scriptData - 대본 데이터
 * @param {string} mode - 실행 모드
 * @param {Object} options - 옵션 객체
 * @param {Array} ttsDurations - TTS 실제 duration 데이터 (선택사항)
 */
async function generateSubtitleFile(scriptData, mode, { api, toast, setFullVideoState, addLog }, ttsDurations = null) {
  const safeSetState = setFullVideoState;

  if (addLog) {
    addLog("📝 SRT 자막 파일을 생성하는 중...");
  }

  try {
    // TTS duration 데이터가 있으면 ttsMarks로 전달
    const payload = { doc: scriptData };
    if (ttsDurations && ttsDurations.length > 0) {
      payload.ttsMarks = ttsDurations;
      if (addLog) {
        addLog("⏱️ TTS 실제 오디오 길이를 자막에 반영합니다");
      }
    }

    const srtResult = await api.invoke("script/toSrt", payload);

    // 응답 구조에 맞게 수정
    const srtData = srtResult?.success && srtResult?.data ? srtResult.data : srtResult;

    if (srtData && srtData.srt) {
      const srtFileName = `subtitle.srt`;

      // scripts 폴더에 자막 파일 저장 (프로젝트 기반)
      let srtFilePath = null;
      try {
        const pathResult = await api.invoke("script:getSubtitlePath", {
          filename: srtFileName
        });

        if (pathResult?.success && pathResult?.data?.filePath) {
          srtFilePath = pathResult.data.filePath;
        } else {
          // 폴백: videoSaveFolder 사용
          const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
          const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
          if (videoSaveFolder) {
            srtFilePath = `${videoSaveFolder}\\${srtFileName}`;
          }
        }
      } catch (error) {
        console.warn("경로 설정 실패:", error);
      }

      if (addLog) {
        addLog(`📝 자막 파일 생성 시작`);
        addLog(`📂 저장 경로: ${srtFilePath}`);
        addLog(`📄 파일명: ${srtFileName}`);
      }

      if (srtFilePath) {
        const writeResult = await api.invoke("files:writeText", {
          filePath: srtFilePath,
          content: srtData.srt
        });

        if (writeResult.success) {
          if (addLog) {
            addLog("✅ SRT 자막 파일 생성 완료!");
            addLog("📁 파일명: subtitle.srt");
          }

          // 📋 관리자 페이지에 자막 생성 성공 로그 기록
          if (window.api?.logActivity) {
            const sceneCount = scriptData.scenes?.length || 0;
            window.api.logActivity({
              type: "subtitle",
              title: "자막 생성",
              detail: `${sceneCount}개 장면 - SRT 자막 파일 생성 완료`,
              status: "success",
              metadata: {
                sceneCount: sceneCount,
                fileName: srtFileName,
                filePath: srtFilePath
              }
            });
          }
        } else {
          if (addLog) {
            addLog(`❌ SRT 파일 쓰기 실패: ${writeResult.message}`, "error");
          }

          // 📋 관리자 페이지에 자막 생성 실패 로그 기록
          if (window.api?.logActivity) {
            const sceneCount = scriptData.scenes?.length || 0;
            window.api.logActivity({
              type: "subtitle",
              title: "자막 생성",
              detail: `${sceneCount}개 장면 - 자막 파일 저장 실패: ${writeResult.message}`,
              status: "error",
              metadata: {
                sceneCount: sceneCount,
                error: writeResult.message
              }
            });
          }

          console.error("❌ 파일 쓰기 실패:", writeResult.message);
          console.error(`SRT 파일 쓰기 실패: ${writeResult.message}`);
        }
      } else {
        console.error("❌ scripts 폴더 경로 생성 실패");
        console.error(`자막 경로 생성 실패`);
      }
    } else {
      console.warn("⚠️ SRT 변환 결과가 없음:", srtResult);

      if (srtResult?.success === false) {
        console.error("❌ SRT 변환 실패:", srtResult.error || srtResult.message);
        console.error(`SRT 변환 실패: ${srtResult.error || srtResult.message || '알 수 없는 오류'}`);
      } else {
        console.warn("SRT 자막을 생성할 수 없습니다. 대본 데이터를 확인해주세요.");
      }
    }
  } catch (error) {
    console.error("❌ SRT 자막 생성 오류:", error);
    console.error(`SRT 자막 생성 오류: ${error.message}`);
  }
}

/**
 * 모드별 완료 처리 함수
 *
 * @param {string} mode - 실행 모드
 * @param {Object} options - 옵션 객체
 */
function handleCompletionByMode(mode, { setFullVideoState, toast, addLog }) {
  if (setFullVideoState) {
    setFullVideoState(prev => ({
      ...prev,
      isGenerating: false,
      currentStep: "completed",
      progress: { ...prev.progress, subtitle: 100 }
    }));
  }

  if (addLog) {
    addLog("🎉 모든 작업이 완료되었습니다!");
    addLog("📂 생성된 파일들을 확인해보세요.");
    addLog("✅ 닫기 버튼을 클릭하여 창을 닫을 수 있습니다.");
  }
}