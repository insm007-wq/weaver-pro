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
 * @returns {Promise<Array>} 생성된 오디오 파일들
 */
export async function generateAudioStep(scriptData, form, addLog, setFullVideoState, api) {
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
 * @returns {Promise<Array>} 생성된 이미지 파일들
 */
export async function generateImagesStep(scriptData, form, addLog, updateFullVideoState, api) {
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

        const imageResult = await api.invoke("replicate:generate", {
          prompt: imagePrompt,
          style: form.imageStyle || "photo",
          width: 1920,
          height: 1080,
          aspectRatio: "16:9",
        });

        console.log(`🔍 Replicate 응답 (장면 ${sceneNum}):`, imageResult);

        // Replicate 응답 구조 확인
        const isSuccess = imageResult.ok || imageResult.success;
        const imageUrls = imageResult.images || [];

        if (isSuccess && imageUrls.length > 0) {
          const imageUrl = imageUrls[0]; // 첫 번째 이미지 사용
          // 프로젝트 폴더에 이미지 파일명 생성
          const imageFileName = `scene_${String(sceneNum).padStart(3, "0")}.jpg`;
          const imagePathResult = await api.invoke("project:getFilePath", {
            category: "images",
            filename: imageFileName,
          });

          if (imagePathResult.success) {
            images.push({
              sceneIndex: i,
              sceneNumber: sceneNum,
              imagePath: imagePathResult.filePath,
              imageUrl: imageUrl, // Replicate에서 받은 실제 URL
              prompt: imagePrompt,
              fileName: imageFileName,
              provider: "Replicate",
            });

            addLog(`✅ 이미지 ${sceneNum} 생성 완료: ${imageUrl}`);
          } else {
            addLog(`❌ 이미지 ${sceneNum} 경로 생성 실패: ${imagePathResult.message}`, "error");
          }
        } else {
          const errorMsg = imageResult.message || "알 수 없는 오류";
          addLog(`❌ 이미지 ${sceneNum} 생성 실패: ${errorMsg}`, "error");
          console.error(`Replicate 실패 상세 (장면 ${sceneNum}):`, {
            success: isSuccess,
            imageCount: imageUrls.length,
            fullResponse: imageResult,
          });
        }
      } catch (error) {
        addLog(`⚠️ 이미지 ${sceneNum} 생성 오류: ${error.message}`, "warning");
        images.push({
          sceneIndex: i,
          sceneNumber: sceneNum,
          imagePath: null,
          imageUrl: null,
          prompt: imagePrompt,
          error: error.message,
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
 * @returns {Promise<Object>} 생성된 영상 정보
 */
export async function generateVideoStep(scriptData, audioFiles, imageFiles, addLog, setFullVideoState, api) {
  try {
    addLog("🎬 FFmpeg 영상 합성 시작...");

    // 프로젝트 매니저에서 출력 파일 경로 생성
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const videoFileName = `video_${timestamp}.mp4`;
    const videoPathResult = await api.invoke("project:getFilePath", {
      category: "output",
      filename: videoFileName,
    });

    if (!videoPathResult.success) {
      throw new Error("출력 파일 경로 생성 실패: " + videoPathResult.message);
    }

    const outputPath = videoPathResult.filePath;
    addLog(`📁 출력 경로: ${outputPath}`);

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
      outputPath: outputPath,
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const mergedFileName = `merged_audio_${timestamp}.mp3`;
    const outputPathResult = await api.invoke("project:getFilePath", {
      category: "audio",
      filename: mergedFileName,
    });

    if (outputPathResult.success) {
      const audioFilePaths = audioFiles.map(f => f.audioUrl).filter(url => url && url !== "pending");
      const mergeResult = await api.invoke("audio/mergeFiles", {
        audioFiles: audioFilePaths,
        outputPath: outputPathResult.filePath
      });

      if (mergeResult.success) {
        addLog(`✅ 통합 음성 파일 생성 완료: ${mergedFileName}`);
        // 합쳐진 파일 정보를 audioFiles에 추가
        audioFiles.push({
          fileName: mergedFileName,
          audioUrl: outputPathResult.filePath,
          merged: true
        });
      } else {
        addLog(`❌ 음성 파일 합치기 실패: ${mergeResult.message}`, "error");
      }
    }
  } catch (error) {
    addLog(`❌ 음성 파일 합치기 오류: ${error.message}`, "error");
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