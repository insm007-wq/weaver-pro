/**
 * 오디오 및 자막 생성 유틸리티
 *
 * @description
 * 대본으로부터 음성 파일과 SRT 자막을 생성하는 통합 유틸리티
 * 대본 생성 모드와 자동화 모드를 모두 지원합니다.
 *
 * @features
 * - 🎤 TTS를 통한 음성 파일 생성
 * - 📝 SRT 자막 파일 생성
 * - 🔀 여러 음성 파일 자동 합치기
 * - 📊 진행률 추적 및 업데이트
 * - 🎯 모드별 분기 처리 (script_mode vs automation_mode)
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 */

/**
 * 대본으로부터 음성과 자막을 생성하는 메인 함수
 *
 * @param {Object} scriptData - 생성된 대본 데이터
 * @param {string} mode - 실행 모드 ("script_mode" | "automation_mode")
 * @param {Object} options - 생성 옵션
 * @param {Object} options.form - 폼 설정 (TTS 엔진, 음성 ID 등)
 * @param {Array} options.voices - 사용 가능한 음성 목록
 * @param {Function} options.setFullVideoState - 상태 업데이트 함수
 * @param {Function} options.api - API 호출 함수
 * @param {Object} options.toast - 토스트 알림 객체
 * @param {Function} options.addLog - 로그 추가 함수
 * @param {string} outputPath - 파일 출력 경로 (선택사항)
 * @returns {Promise<void>}
 */
export async function generateAudioAndSubtitles(scriptData, mode = "script_mode", options, outputPath = null) {
3  const { form, voices, setFullVideoState, api, toast, addLog } = options;

  try {
    // 모드별 진행 상황 업데이트
    setFullVideoState(prev => ({
      ...prev,
      progress: { ...prev.progress, audio: 10 }
    }));

    if (mode === "script_mode") {
      console.log("🎤 대본 생성 모드 - 음성 및 자막 생성 시작...");
    } else {
      console.log("🚀 자동화 모드 - 음성 생성 시작...");
    }

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

    // ElevenLabs는 더 오래 걸림 (각 요청 사이 1초 대기 + 처리 시간)
    let estimatedTimeSeconds;
    if (ttsEngine === "elevenlabs") {
      estimatedTimeSeconds = Math.max(60, sceneCount * 15); // 최소 60초, 장면당 15초
    } else {
      estimatedTimeSeconds = Math.max(30, sceneCount * 8); // Google: 최소 30초, 장면당 8초
    }

    const timeoutMs = estimatedTimeSeconds * 1000;

    if (addLog) {
      addLog(`🎤 ${sceneCount}개 장면의 음성 생성 중... (${ttsEngine})`);
      addLog(`⏳ 예상 소요 시간: 약 ${estimatedTimeSeconds}초 (${ttsEngine === 'elevenlabs' ? 'ElevenLabs는 품질을 위해 더 오래 걸립니다' : 'Google TTS'})`);
    }

    // TTS 진행률 리스너 설정
    let ttsProgressListener = null;
    let ttsFallbackListener = null;
    try {
      ttsProgressListener = (data) => {
        const { current, total, progress } = data;
        setFullVideoState((prev) => ({
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

    let audioResult;
    try {
      audioResult = await api.invoke("tts:synthesize", {
        scenes: scriptData.scenes,
        ttsEngine: form.ttsEngine || "google",
        voiceId: form.voiceId || voices[0]?.id,
        speed: form.speed || "1.0",
        outputPath: audioFolderPath, // 프로젝트 audio 폴더 경로 전달
      }, {
        timeout: timeoutMs
      });
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
      setFullVideoState(prev => ({
        ...prev,
        progress: { ...prev.progress, audio: 50 }
      }));

      const audioFiles = audioResult.data.audioFiles;
      console.log("✅ 음성 생성 완료:", audioFiles);
      console.log("🔍 audioFiles 구조 확인:", JSON.stringify(audioFiles, null, 2));
      console.log(`🎵 음성 파일 ${audioFiles.length}개가 생성되었습니다!`);

      // 먼저 base64 오디오 파일들을 디스크에 저장
      const savedAudioFiles = [];
      if (audioFiles && audioFiles.length > 0) {
        if (addLog) {
          addLog(`💾 ${audioFiles.length}개 음성 파일을 디스크에 저장 중...`);
        }

        for (let i = 0; i < audioFiles.length; i++) {
          const audioFile = audioFiles[i];
          const { fileName, base64 } = audioFile;

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
                  console.log("📁 개별 음성 파일용 audio 폴더 생성/확인 완료:", audioFolder);
                } catch (dirError) {
                  console.warn("개별 음성 파일용 audio 폴더 생성 실패:", dirError);
                }
                filePath = `${audioFolder}\\${fileName}`;
              } else {
                filePath = `C:\\WeaverPro\\audio\\${fileName}`;
              }
            } catch (error) {
              console.warn("설정 가져오기 실패, 기본 경로 사용:", error);
              filePath = `C:\\WeaverPro\\audio\\${fileName}`;
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
                savedAudioFiles.push({
                  fileName: fileName,
                  audioUrl: savedPath,
                  filePath: savedPath
                });
                if (addLog) {
                  addLog(`✅ 음성 파일 저장: ${fileName} → ${savedPath}`);
                }
                console.log(`💾 음성 파일 저장 완료: ${savedPath}`);
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
      }

      // 저장된 음성 파일들을 하나로 합치기
      if (savedAudioFiles && savedAudioFiles.length > 1) {
        if (addLog) {
          addLog(`🔄 ${savedAudioFiles.length}개 저장된 음성 파일을 하나로 합치는 중...`);
        }
        console.log("🎵 mergeAudioFiles 함수 호출 시작...");
        console.log("🎵 savedAudioFiles 전달 전 확인:", savedAudioFiles);
        console.log("🎵 savedAudioFiles 개수:", savedAudioFiles.length);
        console.log("🎵 savedAudioFiles 구조:", JSON.stringify(savedAudioFiles, null, 2));
        await mergeAudioFiles(savedAudioFiles, mode, { api, toast, setFullVideoState, addLog });
        console.log("🎵 mergeAudioFiles 함수 호출 완료");
      } else if (savedAudioFiles && savedAudioFiles.length === 1 && addLog) {
        addLog(`✅ 단일 음성 파일 저장 완료: ${savedAudioFiles[0].fileName}`);
      } else {
        console.warn("⚠️ 저장된 audioFiles가 비어있거나 형식이 잘못됨:", savedAudioFiles);
        if (addLog) {
          addLog(`⚠️ 저장된 음성 파일이 없습니다. 원본 응답: ${audioFiles?.length || 0}개`, "warning");
        }
      }
    }

    // SRT 자막 생성
    await generateSubtitleFile(scriptData, mode, { api, toast, setFullVideoState, addLog });

    // 모든 단계 완료 - 모드별 메시지
    handleCompletionByMode(mode, { setFullVideoState, toast, addLog });

  } catch (error) {
    console.error("음성/자막 생성 오류:", error);

    // 오류 발생 시 상태 초기화
    setFullVideoState(prev => ({
      ...prev,
      isGenerating: false,
      currentStep: "error"
    }));

    console.error(`음성/자막 생성 실패: ${error.message}`);
  }
}

/**
 * 여러 음성 파일을 하나로 합치는 함수
 *
 * @param {Array} audioFiles - 합칠 음성 파일들
 * @param {string} mode - 실행 모드
 * @param {Object} options - 옵션 객체
 */
async function mergeAudioFiles(audioFiles, mode, { api, toast, setFullVideoState, addLog }) {
  try {
    console.log("🎵 === mergeAudioFiles 함수 시작 ===");
    console.log("🎵 입력 audioFiles:", audioFiles);
    console.log("🎵 입력 mode:", mode);

    // 프로젝트명으로 간단한 파일명 생성
    let projectName = 'default';
    try {
      const currentProjectIdResult = await window.api.getSetting('currentProjectId');
      console.log("🔍 currentProjectIdResult:", currentProjectIdResult);

      if (currentProjectIdResult && currentProjectIdResult.value) {
        projectName = currentProjectIdResult.value;
      } else {
        const defaultProjectNameResult = await window.api.getSetting('defaultProjectName');
        console.log("🔍 defaultProjectNameResult:", defaultProjectNameResult);
        if (defaultProjectNameResult && defaultProjectNameResult.value) {
          projectName = defaultProjectNameResult.value;
        }
      }
    } catch (error) {
      console.warn('프로젝트 정보 가져오기 실패, 기본값 사용:', error.message);
    }

    console.log("🔍 최종 projectName:", projectName);

    const mergedFileName = `${projectName}.mp3`;

    // 간단하게 현재 프로젝트 설정 사용
    let outputPath = `C:\\WeaverPro\\${projectName}\\audio\\${mergedFileName}`;

    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

      if (videoSaveFolder && typeof videoSaveFolder === 'string' && videoSaveFolder.trim() !== '') {
        // audio 폴더 생성 확인
        const audioFolder = `${videoSaveFolder}\\audio`;
        try {
          await api.invoke("fs:mkDirRecursive", { dirPath: audioFolder });
          console.log("📁 audio 폴더 생성/확인 완료:", audioFolder);
        } catch (dirError) {
          console.warn("audio 폴더 생성 실패:", dirError);
        }
        outputPath = `${audioFolder}\\${mergedFileName}`;
      }
    } catch (error) {
      console.warn("설정 가져오기 실패, 기본 경로 사용:", error);
    }

    console.log("🔍 디버그 - 최종 outputPath:", outputPath);

    console.log("🎵 합본 오디오 파일 경로:", outputPath);

    if (addLog) {
      addLog(`📁 음성 합본 파일 생성 시작`);
      addLog(`📂 저장 경로: ${outputPath}`);
      addLog(`📄 파일명: ${mergedFileName}`);
    }

    if (outputPath) {
      console.log("🔍 디버그 - 입력 audioFiles:", audioFiles);
      console.log("🔍 디버그 - 입력 audioFiles 길이:", audioFiles.length);
      console.log("🔍 디버그 - 입력 audioFiles 구조:", JSON.stringify(audioFiles, null, 2));

      const audioFilePaths = audioFiles
        .map((f, index) => {
          console.log(`🔍 디버그 - 개별 파일 ${index}:`, f);
          console.log(`🔍 디버그 - 개별 파일 ${index} 모든 속성:`, Object.keys(f));
          console.log(`🔍 디버그 - 개별 파일 ${index} audioUrl:`, f.audioUrl);
          console.log(`🔍 디버그 - 개별 파일 ${index} filePath:`, f.filePath);
          console.log(`🔍 디버그 - 개별 파일 ${index} fileName:`, f.fileName);
          const path = f.audioUrl || f.filePath || f.path;
          console.log(`🔍 디버그 - 개별 파일 ${index} 최종 경로:`, path);
          return path;
        })
        .filter((url, index) => {
          const isValid = url && typeof url === 'string' && url !== "pending" && url.trim() !== '';
          console.log(`🔍 디버그 - 파일 경로 유효성 ${index}:`, url, "->", isValid);
          if (!isValid) {
            console.error(`❌ 유효하지 않은 파일 경로 발견 ${index}:`, url, typeof url);
          }
          return isValid;
        });

      console.log("🎵 합칠 오디오 파일들:", audioFilePaths);
      console.log("🎵 합칠 오디오 파일들 개수:", audioFilePaths.length);

      if (addLog) {
        addLog(`🎵 ${audioFilePaths.length}개 음성 파일 합치기 시작`);
        addLog(`📝 합칠 파일 목록:`);
        audioFilePaths.forEach((file, index) => {
          addLog(`  ${index + 1}. ${file}`);
        });
      }

      if (audioFilePaths.length === 0) {
        if (addLog) {
          addLog(`⚠️ 합칠 음성 파일이 없습니다`, "warning");
          addLog(`🔍 원본 audioFiles 개수: ${audioFiles.length}`, "warning");
          addLog(`🔍 원본 audioFiles:`, "warning");
          audioFiles.forEach((file, index) => {
            addLog(`  ${index + 1}. fileName: ${file.fileName}, audioUrl: ${file.audioUrl}, filePath: ${file.filePath}`, "warning");
          });
        }
        console.warn("⚠️ audioFilePaths가 비어있습니다. 원본 audioFiles:", audioFiles);
        return;
      }

      // 최종 검증: 모든 경로가 유효한 문자열인지 확인
      const invalidPaths = audioFilePaths.filter(path => !path || typeof path !== 'string' || path.trim() === '');
      if (invalidPaths.length > 0) {
        console.error("❌ FFmpeg 호출 전 최종 검증 실패 - 유효하지 않은 경로들:", invalidPaths);
        if (addLog) {
          addLog(`❌ FFmpeg 호출 전 최종 검증 실패 - ${invalidPaths.length}개의 유효하지 않은 경로 발견`, "error");
          addLog(`🔍 유효하지 않은 경로들: ${JSON.stringify(invalidPaths)}`, "error");
        }
        return;
      }

      console.log("✅ FFmpeg 호출 전 최종 검증 통과 - 모든 경로가 유효함");
      if (addLog) {
        addLog(`✅ FFmpeg 호출 전 최종 검증 통과 - ${audioFilePaths.length}개 모든 경로가 유효함`);
      }

      const mergeResult = await api.invoke("audio/mergeFiles", {
        audioFiles: audioFilePaths,
        outputPath: outputPath
      });

      console.log("🔍 음성 합본 결과:", mergeResult);

      if (mergeResult.success) {
        if (addLog) {
          addLog(`✅ 음성 파일 합치기 완료!`);
          addLog(`📁 통합 파일명: ${mergedFileName}`);
          addLog(`📂 저장된 경로: ${outputPath}`);
          addLog(`📊 합본 결과: ${mergeResult.outputPath || '경로 정보 없음'}`);
        }

        // 대본 생성 모드에서만 자막 단계로 진행
        if (mode === "script_mode") {
          setFullVideoState(prev => ({
            ...prev,
            progress: { ...prev.progress, audio: 100 },
            currentStep: "subtitle"
          }));

          console.log("✅ 2단계 완료: 음성 파일 합치기 완료:", mergeResult.outputPath);
          console.log(`🎵 2단계 완료: 통합 음성 파일이 생성되었습니다!`);
          console.log("📝 3단계 시작: 자막을 생성합니다...");
        } else {
          // 자동화 모드에서는 음성 생성 완료
          setFullVideoState(prev => ({
            ...prev,
            progress: { ...prev.progress, audio: 100 }
          }));

          console.log("✅ 자동화 모드 - 음성 파일 합치기 완료:", mergeResult.outputPath);
          console.log(`🎵 음성 파일 합치기 완료: 통합 음성 파일이 생성되었습니다!`);
        }
      } else {
        if (addLog) {
          addLog(`❌ 음성 파일 합치기 실패`, "error");
          addLog(`📝 실패 원인: ${mergeResult.message || '알 수 없음'}`);
          addLog(`📊 전체 응답: ${JSON.stringify(mergeResult)}`);
        }
        console.error("❌ 음성 파일 합치기 실패:", mergeResult);
        console.error(`음성 파일 합치기 실패: ${mergeResult.message || '알 수 없는 오류'}`);
      }
    }
  } catch (error) {
    console.error("❌ 음성 파일 합치기 오류:", error);
    console.error(`음성 파일 합치기 오류: ${error.message}`);
  }
}

/**
 * SRT 자막 파일을 생성하는 함수
 *
 * @param {Object} scriptData - 대본 데이터
 * @param {string} mode - 실행 모드
 * @param {Object} options - 옵션 객체
 */
async function generateSubtitleFile(scriptData, mode, { api, toast, setFullVideoState, addLog }) {
  // SRT 자막 생성 - 모드별 진행률 업데이트
  if (mode === "script_mode") {
    setFullVideoState(prev => ({
      ...prev,
      progress: { ...prev.progress, subtitle: 10 }
    }));
  }

  console.log("🚀🚀🚀 === SRT 자막 생성 단계 시작 === 🚀🚀🚀");

  if (addLog) {
    addLog("📝 SRT 자막 파일을 생성하는 중...");
  }

  try {
    console.log("🎬 SRT 자막 생성 시작...");

    const srtResult = await api.invoke("script/toSrt", {
      doc: scriptData
    });

    console.log("📝 SRT 변환 결과:", srtResult);

    // 응답 구조에 맞게 수정
    const srtData = srtResult?.success && srtResult?.data ? srtResult.data : srtResult;

    if (srtData && srtData.srt) {
      console.log("✅ SRT 조건문 통과! 파일 생성 시작...");
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

      console.log("📁 자막 파일 저장 경로:", srtFilePath);

      if (addLog) {
        addLog(`📝 자막 파일 생성 시작`);
        addLog(`📂 저장 경로: ${srtFilePath}`);
        addLog(`📄 파일명: ${srtFileName}`);
      }

      if (srtFilePath) {
        console.log("💾 SRT 파일 쓰기 시작:", srtFilePath);

        const writeResult = await api.invoke("files:writeText", {
          filePath: srtFilePath,
          content: srtData.srt
        });

        if (writeResult.success) {
          // 대본 생성 모드에서 자막 진행률 업데이트
          if (mode === "script_mode") {
            setFullVideoState(prev => ({
              ...prev,
              progress: { ...prev.progress, subtitle: 100 }
            }));
          }

          if (addLog) {
            addLog("✅ SRT 자막 파일 생성 완료!");
            addLog("📁 파일명: subtitle.srt");
          }

          console.log("✅ SRT 자막 파일 생성 완료:", srtFilePath);
          console.log(`SRT 자막 파일이 생성되었습니다: subtitle.srt`);
        } else {
          if (addLog) {
            addLog(`❌ SRT 파일 쓰기 실패: ${writeResult.message}`, "error");
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
  if (mode === "script_mode") {
    setFullVideoState(prev => ({
      ...prev,
      isGenerating: false,
      currentStep: "completed",
      progress: { ...prev.progress, subtitle: 100 }
    }));

    console.log("🎉 대본 생성 모드 완료!");

    if (addLog) {
      addLog("🎉 모든 작업이 완료되었습니다!");
      addLog("📂 생성된 파일들을 확인해보세요.");
      addLog("✅ 닫기 버튼을 클릭하여 창을 닫을 수 있습니다.");
    }

    console.log("🎉 3단계 완료: 대본, 음성, 자막이 모두 생성되었습니다!");

  } else {
    // 자동화 모드는 음성 생성까지만 여기서 처리
    setFullVideoState(prev => ({
      ...prev,
      progress: { ...prev.progress, audio: 100 }
    }));

    console.log("🎉 자동화 모드 - 음성 생성 완료!");
    console.log("🎵 2단계 완료: 음성이 생성되었습니다. 다음 단계를 진행해주세요.");
  }
}