/**
 * 자동화 모드 생성 단계 유틸리티
 *
 * @description
 * 완전 자동화 영상 생성을 위한 각 단계별 처리 함수들
 * 대본 → 음성 → 이미지 → 영상 합성의 전체 워크플로우를 담당합니다.
 *
 * @features
 * - 🎤 배치 음성 생성 및 합치기
 * - 🖼️ 씬별 이미지 생성 (Replicate 연동)
 * - 🎬 FFmpeg 기반 영상 합성
 * - 📊 단계별 진행률 추적
 * - 📝 자동 자막 생성
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 */

/**
 * 자동화 모드용 오디오 생성 단계
 *
 * @param {Object} scriptData - 스크립트 데이터
 * @param {Object} form - 폼 설정
 * @param {Function} addLog - 로그 추가 함수
 * @param {Function} setFullVideoState - 상태 업데이트 함수
 * @param {Function} api - API 호출 함수
 * @param {string} outputPath - 파일 출력 경로 (선택사항)
 * @returns {Promise<Array>} 생성된 오디오 파일들
 */
export async function generateAudioStep(scriptData, form, addLog, setFullVideoState, api, outputPath = null) {
  addLog("🎤 음성 생성 중...");

  try {
    if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
      throw new Error("대본 데이터가 없습니다.");
    }

    // TTS 엔진과 음성 설정 확인
    const ttsEngine = form.ttsEngine || "elevenlabs";
    const voiceId = form.voiceId;

    if (!voiceId) {
      throw new Error("음성을 선택해주세요.");
    }

    addLog(`🎙️ ${ttsEngine} 엔진으로 음성 생성 시작...`);
    addLog(`🔄 ${scriptData.scenes.length}개 장면의 음성 생성 중... (예상 시간: ${Math.ceil(scriptData.scenes.length * 2)}초)`);

    // TTS 진행률 리스너 설정
    let ttsProgressListener = null;
    try {
      ttsProgressListener = (data) => {
        const { current, total, progress } = data;
        setFullVideoState((prev) => ({
          ...prev,
          progress: { ...prev.progress, audio: progress },
        }));
        addLog(`🎤 음성 생성 진행률: ${current + 1}/${total} (${progress}%)`);
      };

      if (window.electronAPI?.on) {
        window.electronAPI.on("tts:progress", ttsProgressListener);
      }
    } catch (listenerError) {
      console.warn("TTS 진행률 리스너 설정 실패:", listenerError);
    }

    let audioResult;
    try {
      audioResult = await api.invoke(
        "tts:synthesize",
        {
          scenes: scriptData.scenes,
          ttsEngine: ttsEngine,
          voiceId: voiceId,
          speed: form.speed || "1.0",
          outputPath: outputPath, // 직접 파일 생성 경로 전달
        },
        {
          timeout: Math.max(60000, scriptData.scenes.length * 10000), // 최소 60초, 장면당 10초 추가
        }
      );

      // 중첩된 응답 구조 처리
      const ttsData = audioResult.data || audioResult;

      if (!ttsData.ok) {
        console.error("TTS 응답 상세:", audioResult);
        const errorMsg = ttsData.error || audioResult.error || audioResult.message || "알 수 없는 오류";
        throw new Error(`음성 생성 실패: ${errorMsg}`);
      }

      console.log("TTS 성공 응답:", audioResult);
      addLog(`✅ 음성 생성 완료: ${ttsData.audioFiles?.length || 0}개 파일`);

      const audioFiles = ttsData.audioFiles || [];

      if (audioFiles.length === 0) {
        throw new Error("생성된 음성 파일이 없습니다.");
      }

      addLog(`💾 음성 파일들: ${audioFiles.map((f) => f.fileName).join(", ")}`);

      // 음성 파일들을 하나로 합치기
      if (audioFiles.length > 1) {
        await mergeAudioFilesForAutomation(audioFiles, addLog, api);
      }

      // SRT 자막 파일 생성
      await generateSubtitleForAutomation(scriptData, addLog, api);

      return audioFiles;
    } catch (ttsError) {
      throw ttsError;
    } finally {
      // 진행률 리스너 제거 (성공/실패 관계없이)
      try {
        if (ttsProgressListener && window.electronAPI?.off) {
          window.electronAPI.off("tts:progress", ttsProgressListener);
        }
      } catch (cleanupError) {
        console.warn("TTS 진행률 리스너 정리 실패:", cleanupError);
      }
    }
  } catch (error) {
    addLog(`❌ 음성 생성 실패: ${error.message}`, "error");
    throw error;
  }
}

/**
 * 자동화 모드용 이미지 생성 단계
 *
 * @param {Object} scriptData - 스크립트 데이터
 * @param {Object} form - 폼 설정
 * @param {Function} addLog - 로그 추가 함수
 * @param {Function} updateFullVideoState - 상태 업데이트 함수
 * @param {Function} api - API 호출 함수
 * @param {string} outputPath - 파일 출력 경로 (선택사항)
 * @returns {Promise<Array>} 생성된 이미지 파일들
 */
export async function generateImagesStep(scriptData, form, addLog, updateFullVideoState, api, outputPath = null) {
  addLog("🖼️ 이미지 생성 중...");

  try {
    if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
      throw new Error("대본 데이터가 없습니다.");
    }

    const images = [];
    const total = scriptData.scenes.length;

    for (let i = 0; i < scriptData.scenes.length; i++) {
      const scene = scriptData.scenes[i];
      const sceneNum = i + 1;

      addLog(`🎨 이미지 ${sceneNum}/${total} 생성 중...`);

      // visual_description이 있으면 사용, 없으면 text 기반으로 프롬프트 생성
      const imagePrompt =
        scene.visual_description || `${scene.text.substring(0, 100)}을 표현하는 ${form.imageStyle || "photo"} 스타일 이미지`;

      try {
        // Replicate API를 사용한 이미지 생성
        addLog(`🎨 Replicate로 이미지 생성: "${imagePrompt}"`);

        // API 호출 전 상태 로그
        console.log(`🚀 Replicate API 호출 시작 (장면 ${sceneNum})`, {
          prompt: imagePrompt,
          style: form.imageStyle || "photo",
          aspectRatio: "16:9"
        });

        // 재시도 로직이 포함된 이미지 생성
        let imageResult = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              addLog(`🔄 이미지 ${sceneNum} 재시도 중... (${retryCount}/${maxRetries})`, "info");
              // 재시도 전 잠시 대기
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }

            imageResult = await api.invoke("replicate:generate", {
              prompt: imagePrompt,
              style: form.imageStyle || "photo",
              width: 1920,
              height: 1080,
              aspectRatio: "16:9",
              outputPath: outputPath, // 직접 파일 생성 경로 전달
            });

            // 성공하면 루프 탈출
            break;
          } catch (retryError) {
            retryCount++;
            console.warn(`재시도 ${retryCount} 실패:`, retryError.message);

            if (retryCount > maxRetries) {
              throw retryError; // 최대 재시도 횟수 초과 시 오류 전파
            }
          }
        }

        // API 호출 후 즉시 상태 로그
        console.log(`📥 Replicate API 응답 수신 (장면 ${sceneNum})`, {
          success: !!imageResult.success,
          ok: !!imageResult.ok,
          hasData: !!imageResult.data,
          hasImages: !!imageResult.images,
          error: imageResult.error || imageResult.message
        });

        console.log(`🔍 Replicate 응답 (장면 ${sceneNum}):`, imageResult);
        console.log(`📊 응답 구조 분석:`, {
          hasOk: !!imageResult.ok,
          hasSuccess: !!imageResult.success,
          hasImages: !!imageResult.images,
          hasDataImages: !!imageResult.data?.images,
          dataStructure: imageResult.data ? Object.keys(imageResult.data) : 'no data field'
        });

        // Replicate 응답 구조 확인 (여러 가지 형태 지원)
        const isSuccess = imageResult.ok || imageResult.success;
        const imageUrls = imageResult.images || imageResult.data?.images || [];

        console.log(`🎯 파싱 결과:`, {
          isSuccess,
          imageUrlsCount: imageUrls.length,
          firstImageUrl: imageUrls[0]
        });

        if (isSuccess && imageUrls.length > 0) {
          const imageUrl = imageUrls[0]; // 첫 번째 이미지 사용
          addLog(`✅ 이미지 ${sceneNum} URL 획득: ${imageUrl.substring(0, 50)}...`);

          // 이미지 URL에서 확장자 추출 (webp 등 지원)
          const urlExtension = imageUrl.split('.').pop().split('?')[0]; // URL 파라미터 제거
          const finalExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(urlExtension.toLowerCase())
            ? urlExtension
            : 'jpg'; // 기본값

          const imageFileName = `scene_${String(sceneNum).padStart(3, "0")}.${finalExtension}`;
          addLog(`🎨 이미지 ${sceneNum} 파일 형식: ${finalExtension.toUpperCase()}`);

          addLog(`📁 이미지 ${sceneNum} 경로 생성 중... (파일명: ${imageFileName})`);
          const imagePathResult = await api.invoke("project:getFilePath", {
            category: "images",
            filename: imageFileName,
          });

          console.log(`🔍 이미지 경로 결과 (장면 ${sceneNum}):`, imagePathResult);

          if (imagePathResult.success) {
            // 이미지를 실제로 다운로드해서 로컬 폴더에 저장
            try {
              addLog(`💾 이미지 ${sceneNum} 다운로드 시작...`);
              console.log(`🌐 다운로드 요청 (장면 ${sceneNum}):`, {
                url: imageUrl,
                category: "images",
                fileName: imageFileName
              });

              const downloadResult = await api.invoke("files/saveUrlToProject", {
                url: imageUrl,
                category: "images",
                fileName: imageFileName
              });

              console.log(`📥 다운로드 결과 (장면 ${sceneNum}):`, downloadResult);

              if (downloadResult.ok) {
                images.push({
                  sceneIndex: i,
                  sceneNumber: sceneNum,
                  imagePath: downloadResult.path, // 실제 저장된 경로
                  imageUrl: imageUrl, // 원본 Replicate URL
                  localPath: downloadResult.path, // 로컬 저장 경로
                  prompt: imagePrompt,
                  fileName: imageFileName,
                  provider: "Replicate",
                });

                addLog(`✅ 이미지 ${sceneNum} 생성 및 저장 완료: ${downloadResult.path}`);
                addLog(`📂 이미지 저장 경로: ${downloadResult.path}`, "info");
              } else {
                addLog(`❌ 이미지 ${sceneNum} 다운로드 실패: ${downloadResult.message}`, "error");
                console.error(`다운로드 실패 상세 (장면 ${sceneNum}):`, downloadResult);
                // 다운로드 실패해도 URL은 기록
                images.push({
                  sceneIndex: i,
                  sceneNumber: sceneNum,
                  imagePath: null,
                  imageUrl: imageUrl,
                  prompt: imagePrompt,
                  fileName: imageFileName,
                  provider: "Replicate",
                  error: downloadResult.message,
                });
              }
            } catch (downloadError) {
              addLog(`❌ 이미지 ${sceneNum} 다운로드 오류: ${downloadError.message}`, "error");
              images.push({
                sceneIndex: i,
                sceneNumber: sceneNum,
                imagePath: null,
                imageUrl: imageUrl,
                prompt: imagePrompt,
                fileName: imageFileName,
                provider: "Replicate",
                error: downloadError.message,
              });
            }
          } else {
            addLog(`❌ 이미지 ${sceneNum} 경로 생성 실패: ${imagePathResult.message}`, "error");
          }
        } else {
          const errorMsg = imageResult.message || imageResult.details || "알 수 없는 오류";

          // 상세한 오류 정보 로그
          console.error(`❌ Replicate 실패 상세 (장면 ${sceneNum}):`);
          console.error(`  - 메시지: ${imageResult.message || '없음'}`);
          console.error(`  - 상세: ${imageResult.details || '없음'}`);
          console.error(`  - 상태: ${imageResult.status || '없음'}`);
          console.error(`  - 전체 응답:`, imageResult);

          // 사용자 친화적 오류 메시지
          let userErrorMsg = errorMsg;
          if (imageResult.message === "no_replicate_token") {
            userErrorMsg = "Replicate API 토큰이 설정되지 않았습니다";
            addLog(`⚠️ 설정 → API 키에서 Replicate 토큰을 설정해주세요`, "warning");
          } else if (imageResult.message && imageResult.message.includes('크레딧')) {
            userErrorMsg = "Replicate 크레딧이 부족합니다";
            addLog(`💳 https://replicate.com/account에서 크레딧을 충전해주세요`, "info");
          } else if (imageResult.message === "timeout") {
            userErrorMsg = "이미지 생성 시간이 초과되었습니다 (2분)";
            addLog(`⏱️ 더 간단한 프롬프트를 사용하거나 잠시 후 재시도해주세요`, "info");
          } else if (imageResult.error) {
            // 구체적인 Replicate 오류가 있는 경우
            userErrorMsg = `Replicate 서비스 오류: ${imageResult.error}`;
            if (imageResult.error.includes('quota') || imageResult.error.includes('credit')) {
              addLog(`💳 크레딧이 부족합니다. Replicate 계정을 확인해주세요`, "info");
            } else if (imageResult.error.includes('rate limit')) {
              addLog(`⏳ 요청 한도 초과. 잠시 후 다시 시도해주세요`, "info");
            } else if (imageResult.error.includes('unauthorized')) {
              addLog(`🔑 API 토큰을 다시 확인해주세요`, "warning");
            }
          } else if (errorMsg === "알 수 없는 오류") {
            // 완전히 알 수 없는 경우 더 구체적인 정보 제공
            userErrorMsg = "이미지 생성 서비스 연결 실패";
            addLog(`🔄 네트워크 연결을 확인하고 잠시 후 다시 시도해주세요`, "info");
            addLog(`📞 문제가 지속되면 Replicate 서비스 상태를 확인해주세요: https://status.replicate.com`, "info");
          }

          addLog(`❌ 이미지 ${sceneNum} 생성 실패: ${userErrorMsg}`, "error");
        }
      } catch (error) {
        // 자세한 오류 분석
        console.error(`❌ 이미지 생성 전체 오류 (장면 ${sceneNum}):`, error);

        let errorMessage = error.message || "알 수 없는 오류";
        let userFriendlyMessage = errorMessage;

        // 일반적인 Replicate 오류 패턴 분석
        if (errorMessage.includes('interrupted') || errorMessage.includes('aborted')) {
          userFriendlyMessage = "이미지 생성이 중단되었습니다. 네트워크 연결 또는 Replicate 서버 상태를 확인해주세요.";
          addLog(`🔄 이미지 ${sceneNum}: 생성 중단됨 - 재시도 권장`, "warning");
        } else if (errorMessage.includes('timeout')) {
          userFriendlyMessage = "이미지 생성 시간이 초과되었습니다.";
          addLog(`⏰ 이미지 ${sceneNum}: 생성 시간 초과 - 더 간단한 프롬프트 사용 권장`, "warning");
        } else if (errorMessage.includes('credit') || errorMessage.includes('billing') || errorMessage.includes('quota')) {
          userFriendlyMessage = "Replicate 계정의 크레딧이 부족합니다.";
          addLog(`💳 이미지 ${sceneNum}: Replicate 크레딧 부족 - 계정을 확인해주세요`, "warning");
        } else if (errorMessage.includes('token') || errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
          userFriendlyMessage = "Replicate API 토큰이 유효하지 않습니다.";
          addLog(`🔑 이미지 ${sceneNum}: API 토큰 문제 - 설정에서 토큰을 확인해주세요`, "warning");
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          userFriendlyMessage = "네트워크 연결 문제가 발생했습니다.";
          addLog(`🌐 이미지 ${sceneNum}: 네트워크 오류 - 인터넷 연결을 확인해주세요`, "warning");
        }

        addLog(`⚠️ 이미지 ${sceneNum} 생성 오류: ${userFriendlyMessage}`, "warning");

        images.push({
          sceneIndex: i,
          sceneNumber: sceneNum,
          imagePath: null,
          imageUrl: null,
          prompt: imagePrompt,
          fileName: `scene_${String(sceneNum).padStart(3, "0")}.jpg`,
          provider: "Replicate",
          error: errorMessage,
          userError: userFriendlyMessage,
        });
      }

      // 진행률 업데이트
      const progress = Math.round((sceneNum / total) * 100);
      updateFullVideoState({
        progress: { images: progress },
      });
    }

    addLog(`✅ 이미지 생성 완료: ${images.filter((img) => img.imageUrl).length}/${total}개 성공`);
    return images;
  } catch (error) {
    addLog(`❌ 이미지 생성 실패: ${error.message}`, "error");
    throw error;
  }
}

/**
 * 자동화 모드용 영상 합성 단계
 *
 * @param {Object} scriptData - 스크립트 데이터
 * @param {Array} audioFiles - 오디오 파일들
 * @param {Array} imageFiles - 이미지 파일들
 * @param {Function} addLog - 로그 추가 함수
 * @param {Function} setFullVideoState - 상태 업데이트 함수
 * @param {Function} api - API 호출 함수
 * @param {string} outputPath - 파일 출력 경로 (선택사항)
 * @returns {Promise<Object>} 생성된 영상 정보
 */
export async function generateVideoStep(scriptData, audioFiles, imageFiles, addLog, setFullVideoState, api, outputPath = null) {
  try {
    addLog("🎬 FFmpeg 영상 합성 시작...");

    // 직접 출력 파일 경로 생성 (프로젝트 매니저 사용 안함)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const videoFileName = `video_${timestamp}.mp4`;

    let finalOutputPath;
    if (outputPath) {
      // 직접 경로가 제공된 경우
      finalOutputPath = `${outputPath}\\${videoFileName}`;
      addLog(`📁 직접 파일 생성 경로: ${finalOutputPath}`);
    } else {
      // 프로젝트 매니저 사용 (기존 방식)
      const videoPathResult = await api.invoke("project:getFilePath", {
        category: "output",
        filename: videoFileName,
      });

      if (!videoPathResult.success) {
        throw new Error("출력 파일 경로 생성 실패: " + videoPathResult.message);
      }

      finalOutputPath = videoPathResult.filePath;
      addLog(`📁 프로젝트 출력 경로: ${finalOutputPath}`);
    }

    // 유효한 파일들만 필터링
    const validAudioFiles = audioFiles.filter((audio) => audio.audioUrl && audio.audioUrl !== "pending").map((audio) => audio.audioUrl);
    const validImageFiles = imageFiles.filter((img) => img.imageUrl && img.imageUrl !== "pending").map((img) => img.imageUrl);

    if (validAudioFiles.length === 0) {
      throw new Error("생성된 음성 파일이 없습니다.");
    }

    if (validImageFiles.length === 0) {
      throw new Error("생성된 이미지 파일이 없습니다.");
    }

    addLog(`🎵 음성 파일: ${validAudioFiles.length}개`);
    addLog(`🖼️ 이미지 파일: ${validImageFiles.length}개`);

    // FFmpeg 진행률 리스너 설정
    const removeProgressListener = window.electronAPI.onceAny("ffmpeg:progress", (progress) => {
      setFullVideoState((prev) => ({
        ...prev,
        progress: { ...prev.progress, video: Math.round(progress) },
      }));
      addLog(`📹 영상 합성 진행률: ${Math.round(progress)}%`);
    });

    // FFmpeg 영상 합성 실행
    const result = await window.electronAPI.ffmpeg.compose({
      audioFiles: validAudioFiles,
      imageFiles: validImageFiles,
      outputPath: finalOutputPath,
      options: {
        fps: 24,
        videoCodec: "libx264",
        audioCodec: "aac",
        crf: 18,
        preset: "medium",
      },
    });

    // 진행률 리스너 제거
    if (removeProgressListener) removeProgressListener();

    if (!result.success) {
      throw new Error(result.message || "영상 합성 실패");
    }

    addLog(`✅ 영상 합성 완료: ${result.videoPath}`);
    addLog(`📊 영상 정보: ${result.duration ? Math.round(result.duration) + "초" : "정보 없음"}`);

    return {
      videoPath: result.videoPath,
      duration: result.duration,
      size: result.size,
    };
  } catch (error) {
    addLog(`❌ 영상 합성 실패: ${error.message}`, "error");
    throw error;
  }
}

/**
 * 자동화 모드용 음성 파일 합치기
 */
async function mergeAudioFilesForAutomation(audioFiles, addLog, api) {
  try {
    addLog(`🔄 ${audioFiles.length}개 음성 파일을 하나로 합치는 중...`);

    // 프로젝트명 가져오기 (대본 생성 모드와 동일한 방식)
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
    } catch (settingError) {
      console.warn("설정 읽기 실패, 기본값 사용:", settingError);
    }

    console.log("🔍 최종 projectName:", projectName);
    const mergedFileName = `${projectName}.mp3`;

    // 합본 파일을 위한 경로 생성 (대본 생성 모드와 동일한 방식)
    let outputPath;
    try {
      const audioPathResult = await api.invoke("script:getAudioPath", {
        fileName: mergedFileName
      });
      console.log("🔍 audioPathResult:", audioPathResult);
      outputPath = audioPathResult.data.filePath;
    } catch (pathError) {
      console.warn("오디오 경로 생성 실패, 기본 경로 사용:", pathError);
      outputPath = `C:\\WeaverPro\\${projectName}\\audio\\${mergedFileName}`;
    }

    console.log("🔍 합본 음성 출력 경로:", outputPath);
    addLog(`📁 저장 경로: ${outputPath}`);

    const audioFilePaths = audioFiles.map(f => f.audioUrl).filter(url => url && url !== "pending");
    console.log("🔍 합칠 음성 파일들:", audioFilePaths);

    if (audioFilePaths.length === 0) {
      addLog(`⚠️ 합칠 음성 파일이 없습니다.`, "warning");
      return;
    }

    const mergeResult = await api.invoke("audio/mergeFiles", {
      audioFiles: audioFilePaths,
      outputPath: outputPath
    });

    console.log("🔍 mergeResult:", mergeResult);

    if (mergeResult.success) {
      addLog(`✅ 통합 음성 파일 생성 완료: ${mergedFileName}`);
      addLog(`📁 저장 위치: ${outputPath}`);

      // 합쳐진 파일 정보를 audioFiles에 추가
      audioFiles.push({
        fileName: mergedFileName,
        audioUrl: outputPath,
        merged: true
      });
    } else {
      addLog(`❌ 음성 파일 합치기 실패: ${mergeResult.message}`, "error");
    }
  } catch (error) {
    addLog(`❌ 음성 파일 합치기 오류: ${error.message}`, "error");
    console.error("음성 파일 합치기 오류:", error);
  }
}

/**
 * 자동화 모드용 자막 생성
 */
async function generateSubtitleForAutomation(scriptData, addLog, api) {
  console.log("🚀 === 배치 SRT 자막 생성 단계 시작 ===");

  try {
    addLog("📝 SRT 자막 파일 생성 중...");
    const srtResult = await api.invoke("script/toSrt", {
      doc: scriptData
    });

    console.log("📝 배치 SRT 변환 결과:", srtResult);

    const batchSrtData = srtResult?.success && srtResult?.data ? srtResult.data : srtResult;

    if (batchSrtData && batchSrtData.srt) {
      const srtFileName = `subtitle.srt`;

      // API를 통해 자막 파일 경로 생성
      const srtPathResult = await api.invoke("script:getSubtitlePath", {
        filename: srtFileName
      });

      if (srtPathResult && srtPathResult.success && srtPathResult.data && srtPathResult.data.filePath) {
        await api.invoke("files:writeText", {
          filePath: srtPathResult.data.filePath,
          content: batchSrtData.srt
        });
        addLog(`✅ SRT 자막 파일 생성 완료: ${srtFileName}`);
      } else {
        addLog(`❌ 자막 경로 생성 실패: ${srtPathResult.data?.message || srtPathResult.message}`, "error");
      }
    } else {
      addLog("⚠️ SRT 변환 결과가 없음", "warn");

      if (srtResult?.success === false) {
        addLog(`❌ 배치 SRT 변환 실패: ${srtResult.error || srtResult.message || '알 수 없는 오류'}`, "error");
      }
    }
  } catch (error) {
    addLog(`❌ SRT 자막 생성 오류: ${error.message}`, "error");
    console.error("❌ 배치 SRT 자막 생성 오류:", error);
  }
}