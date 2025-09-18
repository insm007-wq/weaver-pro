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
          outputPath: outputPath,
        },
        {
          timeout: Math.max(60000, scriptData.scenes.length * 10000),
        }
      );

      const ttsData = audioResult.data || audioResult;

      if (!ttsData.ok) {
        console.error("TTS 응답 상세:", audioResult);
        const errorMsg = ttsData.error || audioResult.error || audioResult.message || "알 수 없는 오류";
        throw new Error(`음성 생성 실패: ${errorMsg}`);
      }

      addLog(`✅ 음성 생성 완료: ${ttsData.audioFiles?.length || 0}개 파일`);

      const audioFiles = ttsData.audioFiles || [];

      if (audioFiles.length === 0) {
        throw new Error("생성된 음성 파일이 없습니다.");
      }

      // 오디오 파일들을 디스크에 저장하고 합치기
      addLog(`🎵 === TTS 결과 처리 단계 ===`);
      addLog(`📊 TTS에서 받은 오디오 파일 개수: ${audioFiles?.length || 0}`);

      const savedAudioFiles = [];
      if (audioFiles && audioFiles.length > 0) {
        addLog(`💾 ${audioFiles.length}개 음성 파일을 디스크에 저장 중...`);

        // TTS 결과 구조 확인
        console.log("🔍 TTS audioFiles 구조:", JSON.stringify(audioFiles, null, 2));

        for (let i = 0; i < audioFiles.length; i++) {
          const audioFile = audioFiles[i];
          addLog(`📝 처리 중인 파일 ${i + 1}:`);
          addLog(`🔍 파일 구조: ${JSON.stringify(audioFile, null, 2)}`);

          const fileName = audioFile.fileName || audioFile.filename || `scene-${String(i + 1).padStart(3, '0')}.mp3`;
          const audioUrl = audioFile.audioUrl; // 이미 저장된 파일 경로

          if (!audioUrl) {
            addLog(`⚠️ 오디오 파일 ${fileName}에 파일 경로가 없습니다`, "warning");
            addLog(`🔧 사용 가능한 필드: ${Object.keys(audioFile).join(', ')}`, "info");
            continue;
          }

          addLog(`✅ 파일 경로 확인: ${audioUrl}`);

          // 파일이 실제로 존재하는지 확인
          try {
            const exists = await api.invoke("files:exists", audioUrl);
            if (exists) {
              savedAudioFiles.push({
                fileName: fileName,
                audioUrl: audioUrl,
                filePath: audioUrl
              });
              addLog(`✅ 기존 파일 확인됨: ${fileName} (${audioUrl})`);
            } else {
              addLog(`❌ 파일이 존재하지 않음: ${audioUrl}`, "error");
            }
          } catch (error) {
            addLog(`❌ 파일 존재 확인 실패: ${error.message}`, "error");
          }
        }
      }

      // 저장된 음성 파일들을 하나로 합치기
      addLog(`🎵 === 오디오 합본 단계 ===`);
      addLog(`📊 저장된 음성 파일 개수: ${savedAudioFiles.length}`);

      if (savedAudioFiles.length > 0) {
        addLog(`📝 저장된 파일 목록:`);
        savedAudioFiles.forEach((file, index) => {
          addLog(`  ${index + 1}. ${file.fileName} (${file.filePath})`);
        });
      }

      if (savedAudioFiles && savedAudioFiles.length > 1) {
        addLog(`🔄 ${savedAudioFiles.length}개 저장된 음성 파일을 하나로 합치는 중...`);
        await mergeAudioFiles(savedAudioFiles, api, addLog);
      } else if (savedAudioFiles && savedAudioFiles.length === 1) {
        addLog(`🔄 단일 음성 파일을 default.mp3로 복사 중...`);
        await renameSingleAudioFile(savedAudioFiles[0], api, addLog);
      } else {
        addLog(`❌ 저장된 음성 파일이 없습니다!`, "error");
        addLog(`🔧 TTS 생성 단계에서 문제가 발생했습니다.`, "warning");
        addLog(`🛑 오디오 합본 단계를 중단합니다.`, "error");
        throw new Error("저장된 음성 파일이 없어서 합본을 진행할 수 없습니다.");
      }

      // 자막 파일 생성
      await generateSubtitleFile(scriptData, api, addLog);

      // TTS 단계 성공 확인
      addLog(`🎵 === TTS 단계 완료 ===`);
      addLog(`✅ TTS 성공: ${audioFiles.length}개 파일 생성`);
      addLog(`✅ 오디오 저장 성공: ${savedAudioFiles.length}개 파일 저장`);
      addLog(`✅ 합본/복사 완료: default.mp3 생성`);

      return audioFiles;
    } catch (ttsError) {
      throw ttsError;
    } finally {
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

      const imagePrompt =
        scene.visual_description || `${scene.text.substring(0, 100)}을 표현하는 ${form.imageStyle || "photo"} 스타일 이미지`;

      try {
        addLog(`🎨 Replicate로 이미지 생성: "${imagePrompt}"`);

        let imageResult = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              addLog(`🔄 이미지 ${sceneNum} 재시도 중... (${retryCount}/${maxRetries})`, "info");
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }

            imageResult = await api.invoke("replicate:generate", {
              prompt: imagePrompt,
              style: form.imageStyle || "photo",
              width: 1920,
              height: 1080,
              aspectRatio: "16:9",
              outputPath: outputPath,
            });

            break;
          } catch (retryError) {
            retryCount++;
            console.warn(`재시도 ${retryCount} 실패:`, retryError.message);

            if (retryCount > maxRetries) {
              throw retryError;
            }
          }
        }

        const isSuccess = imageResult.ok || imageResult.success;
        const imageUrls = imageResult.images || imageResult.data?.images || [];

        if (isSuccess && imageUrls.length > 0) {
          const imageUrl = imageUrls[0];
          addLog(`✅ 이미지 ${sceneNum} URL 획득: ${imageUrl.substring(0, 50)}...`);

          const urlExtension = imageUrl.split('.').pop().split('?')[0];
          const finalExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(urlExtension.toLowerCase())
            ? urlExtension
            : 'jpg';

          const imageFileName = `scene_${String(sceneNum).padStart(3, "0")}.${finalExtension}`;

          try {
            const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
            const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

            const imagesFolder = `${videoSaveFolder}\\images`;
            await api.invoke("fs:mkDirRecursive", { dirPath: imagesFolder });

            const imageFilePath = `${imagesFolder}\\${imageFileName}`;

            const downloadResult = await api.invoke("files:writeUrl", {
              url: imageUrl,
              filePath: imageFilePath
            });

            const isSuccess = downloadResult.success && downloadResult.data && downloadResult.data.ok;
            const savedPath = downloadResult.data?.path;

            if (isSuccess && savedPath) {
              images.push({
                sceneIndex: i,
                sceneNumber: sceneNum,
                imagePath: savedPath,
                imageUrl: imageUrl,
                localPath: savedPath,
                prompt: imagePrompt,
                fileName: imageFileName,
                provider: "Replicate",
              });

              addLog(`✅ 이미지 ${sceneNum} 생성 및 저장 완료`);
            } else {
              addLog(`❌ 이미지 ${sceneNum} 저장 실패`);
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
          const errorMsg = imageResult.message || imageResult.details || "알 수 없는 오류";
          addLog(`❌ 이미지 ${sceneNum} 생성 실패: ${errorMsg}`, "error");
        }
      } catch (error) {
        addLog(`⚠️ 이미지 ${sceneNum} 생성 오류: ${error.message}`, "warning");
        images.push({
          sceneIndex: i,
          sceneNumber: sceneNum,
          imagePath: null,
          imageUrl: null,
          prompt: imagePrompt,
          fileName: `scene_${String(sceneNum).padStart(3, "0")}.jpg`,
          provider: "Replicate",
          error: error.message,
        });
      }

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
 * @param {Array} imageFiles - 이미지 파일들 (수정: generateImagesStep의 결과로 받은 파일 목록 사용)
 * @param {Function} addLog - 로그 추가 함수
 * @param {Function} setFullVideoState - 상태 업데이트 함수
 * @param {Function} api - API 호출 함수
 * @param {string} outputPath - 파일 출력 경로 (선택사항)
 * @returns {Promise<Object>} 생성된 영상 정보
 */
export async function generateVideoStep(scriptData, audioFiles, imageFiles, addLog, setFullVideoState, api, outputPath = null) {
  try {
    addLog("🎬 FFmpeg 영상 합성 시작...");

    // 프로젝트 output 폴더에 영상 파일 생성 (고정된 이름으로 덮어쓰기)
    const videoFileName = `final_video.mp4`;

    // videoSaveFolder의 output 폴더에 영상 파일 저장
    const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
    const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
    if (!videoSaveFolder) {
      throw new Error("videoSaveFolder 설정이 없습니다.");
    }

    // output 폴더 생성 확인
    const outputFolder = `${videoSaveFolder}\\output`;
    try {
      await api.invoke("fs:mkDirRecursive", { dirPath: outputFolder });
      console.log("📁 output 폴더 생성/확인 완료:", outputFolder);
    } catch (dirError) {
      console.warn("output 폴더 생성 실패:", dirError);
    }

    const finalOutputPath = `${outputFolder}\\${videoFileName}`;
    addLog(`📁 영상 파일 저장 위치: ${finalOutputPath}`);

    // 음성 파일 경로 설정 (audio/default.mp3 사용)
    let audioFilePath;
    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
      if (videoSaveFolder) {
        audioFilePath = `${videoSaveFolder}\\audio\\default.mp3`;
      } else {
        audioFilePath = "C:\\WeaverPro\\default\\audio\\default.mp3";
      }
    } catch (error) {
      console.warn("설정 가져오기 실패, 기본 음성 경로 사용:", error);
      audioFilePath = "C:\\WeaverPro\\default\\audio\\default.mp3";
    }

    console.log("🎵 사용할 음성 파일:", audioFilePath);
    addLog(`🎵 음성 파일: ${audioFilePath}`);

    // 💡 변경된 부분: imageFiles 매개변수에서 직접 파일 경로 추출
    const validImageFiles = imageFiles.map((img) => img.localPath).filter((path) => path);

    // 이미지 파일이 실제로 존재하는지 확인 (기존 로직 유지)
    const existingImageFiles = [];
    for (const imagePath of validImageFiles) {
      try {
        const exists = await api.invoke("files:exists", imagePath);
        if (exists) {
          existingImageFiles.push(imagePath);
        } else {
          addLog(`⚠️ 이미지 파일 없음: ${imagePath}`, "warning");
        }
      } catch (error) {
        console.warn(`⚠️ 파일 존재 확인 실패: ${imagePath}`, error);
      }
    }

    if (existingImageFiles.length === 0) {
      addLog(`❌ 실제로 존재하는 이미지 파일이 없습니다.`, "error");
      throw new Error(`실제로 존재하는 이미지 파일이 없습니다. 확인된 경로들: ${validImageFiles.join(", ")}`);
    }

    // 존재하는 파일들만 사용
    const finalImageFiles = existingImageFiles;

    // 음성 파일 존재 확인
    let audioExists = false;
    try {
      audioExists = await api.invoke("files:exists", audioFilePath);
      if (audioExists) {
        addLog(`✅ 음성 파일 확인됨: ${audioFilePath}`);
      } else {
        addLog(`❌ 음성 파일 없음: ${audioFilePath}`, "error");
        addLog(`🔧 합본 파일이 생성되지 않았을 가능성이 있습니다.`, "warning");
      }
    } catch (error) {
      console.warn("음성 파일 존재 확인 실패:", error);
    }

    if (!audioExists) {
      throw new Error(`음성 파일이 존재하지 않습니다: ${audioFilePath}`);
    }

    const validAudioFiles = [audioFilePath]; // 단일 합본 음성 파일 사용

    // 자막 파일 경로 설정 (scripts 폴더에서 subtitle.srt 사용)
    let subtitleFilePath;
    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
      if (videoSaveFolder) {
        subtitleFilePath = `${videoSaveFolder}\\scripts\\subtitle.srt`;
      } else {
        subtitleFilePath = "C:\\WeaverPro\\default\\scripts\\subtitle.srt";
      }
    } catch (error) {
      console.warn("설정 가져오기 실패, 기본 자막 경로 사용:", error);
      subtitleFilePath = "C:\\WeaverPro\\default\\scripts\\subtitle.srt";
    }

    console.log("📝 사용할 자막 파일:", subtitleFilePath);
    addLog(`📝 자막 파일: ${subtitleFilePath}`);

    addLog(`🎵 음성 파일: ${validAudioFiles.length}개`);
    addLog(`🖼️ 이미지 파일: ${finalImageFiles.length}개 (실제 존재 확인됨)`);
    addLog(`🎬 FFmpeg 합성 시작 - 예상 시간: ${Math.ceil((finalImageFiles.length * 10 + 60) / 60)}분`);

    // FFmpeg 진행률 리스너 설정 (안전하게 처리)
    let removeProgressListener = null;
    try {
      if (window.electronAPI && window.electronAPI.onceAny) {
        removeProgressListener = window.electronAPI.onceAny("ffmpeg:progress", (progress) => {
          setFullVideoState((prev) => ({
            ...prev,
            progress: { ...prev.progress, video: Math.round(progress) },
          }));
          addLog(`📹 영상 합성 진행률: ${Math.round(progress)}%`);
        });
      } else {
        console.warn("⚠️ electronAPI.onceAny가 사용 불가능합니다. 진행률 업데이트가 생략됩니다.");
      }
    } catch (listenerError) {
      console.warn("⚠️ 진행률 리스너 설정 실패:", listenerError);
    }

    // FFmpeg 영상 합성 실행 (API 호출 방식으로 변경)
    let result;
    try {
      if (window.electronAPI && window.electronAPI.ffmpeg && window.electronAPI.ffmpeg.compose) {
        result = await window.electronAPI.ffmpeg.compose({
          audioFiles: validAudioFiles,
          imageFiles: finalImageFiles, // 💡 변경된 부분
          outputPath: finalOutputPath,
          options: {
            fps: 24,
            videoCodec: "libx264",
            audioCodec: "aac",
            crf: 18,
            preset: "medium",
          },
        });
      } else {
        // fallback: IPC API 사용
        console.log("🔄 electronAPI.ffmpeg가 없어서 IPC API 사용");
        addLog(`🔄 FFmpeg IPC API 사용해서 영상 합성 중...`);
        // 영상 합성용 긴 타임아웃 설정 (이미지 수 × 20초 + 기본 120초)
        const compositionTimeout = Math.max(240000, finalImageFiles.length * 20000 + 120000); // 최소 4분
        addLog(`⏱️ FFmpeg 타임아웃 설정: ${compositionTimeout / 1000}초`);

        result = await api.invoke("ffmpeg:compose", {
          audioFiles: validAudioFiles,
          imageFiles: finalImageFiles,
          outputPath: finalOutputPath,
          subtitlePath: subtitleFilePath, // 자막 파일 경로 전달
          options: {
            fps: 24,
            videoCodec: "libx264",
            audioCodec: "aac",
            // crf, preset은 설정에서 자동으로 가져옴 (ffmpeg.js에서 처리)
          },
        }, {
          timeout: compositionTimeout // 타임아웃 설정 추가
        });
      }
    } catch (composeError) {
      console.error("❌ 영상 합성 실행 오류:", composeError);
      throw composeError;
    }

    // 진행률 리스너 제거
    try {
      if (removeProgressListener && typeof removeProgressListener === "function") {
        removeProgressListener();
      }
    } catch (cleanupError) {
      console.warn("⚠️ 진행률 리스너 정리 실패:", cleanupError);
    }

    console.log("🔍 FFmpeg 전체 결과:", JSON.stringify(result, null, 2));

    // FFmpeg 결과 구조 확인: result.data.success도 체크
    const isSuccess = result.success && result.data?.success !== false;

    if (!isSuccess) {
      const errorMessage = result.data?.message || result.message || result.error || "영상 합성 실패";
      console.error("❌ FFmpeg 실행 실패:", errorMessage);
      addLog(`❌ FFmpeg 실행 실패: ${errorMessage}`, "error");
      throw new Error(errorMessage);
    }

    // result.videoPath가 undefined일 경우 우리가 설정한 경로 사용
    const actualVideoPath = result.videoPath || finalOutputPath;

    console.log("🔍 FFmpeg 결과 구조:", JSON.stringify(result, null, 2));
    console.log("🔍 최종 비디오 경로:", actualVideoPath);

    addLog(`✅ 영상 합성 완료: ${actualVideoPath}`);
    addLog(`📊 영상 정보: ${result.duration ? Math.round(result.duration) + "초" : "정보 없음"}`);

    // 파일 존재 여부 확인
    try {
      const fileExists = await api.invoke("files:exists", actualVideoPath);
      if (fileExists) {
        addLog(`✅ 영상 파일 확인됨: ${actualVideoPath}`);
      } else {
        addLog(`⚠️ 영상 파일이 생성되지 않았습니다: ${actualVideoPath}`, "warning");
      }
    } catch (checkError) {
      console.warn("파일 존재 확인 실패:", checkError);
    }

    return {
      videoPath: actualVideoPath,
      duration: result.duration,
      size: result.size,
    };
  } catch (error) {
    addLog(`❌ 영상 합성 실패: ${error.message}`, "error");
    throw error;
  }
}

/**
 * 여러 음성 파일을 하나로 합치는 함수 (자동화 모드용)
 */
async function mergeAudioFiles(audioFiles, api, addLog) {
  try {
    addLog(`🎵 === 오디오 합본 프로세스 시작 ===`);
    console.log("🎵 mergeAudioFiles 함수 시작");

    // 합본 파일명을 default.mp3로 고정
    const mergedFileName = `default.mp3`;
    addLog(`📝 합본 파일명: ${mergedFileName}`);

    // 간단하게 현재 프로젝트 설정 사용
    let outputPath = `C:\\WeaverPro\\default\\audio\\${mergedFileName}`;

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

    addLog(`📁 음성 합본 파일 생성: ${outputPath}`);

    const audioFilePaths = audioFiles
      .map(f => f.audioUrl || f.filePath)
      .filter(url => url && typeof url === 'string' && url.trim() !== '');

    if (audioFilePaths.length === 0) {
      addLog(`⚠️ 합칠 음성 파일이 없습니다`, "warning");
      return;
    }

    addLog(`🎵 ${audioFilePaths.length}개 음성 파일 합치기 시작`);
    addLog(`🔧 디버깅: audioFilePaths = ${JSON.stringify(audioFilePaths)}`);
    addLog(`🔧 디버깅: outputPath = ${outputPath}`);

    const mergeResult = await api.invoke("audio/mergeFiles", {
      audioFiles: audioFilePaths,
      outputPath: outputPath
    });

    addLog(`🔧 디버깅: mergeResult = ${JSON.stringify(mergeResult)}`);

    if (mergeResult.success) {
      addLog(`✅ 음성 파일 합치기 완료: ${mergedFileName}`);
      addLog(`📁 저장 경로: ${outputPath}`);

      // 파일이 실제로 생성되었는지 확인
      try {
        const exists = await api.invoke("files:exists", outputPath);
        if (exists) {
          addLog(`✅ 합본 파일 생성 확인됨: default.mp3`);
        } else {
          addLog(`❌ 합본 파일이 생성되지 않았습니다!`, "error");
        }
      } catch (checkError) {
        addLog(`❌ 파일 존재 확인 실패: ${checkError.message}`, "error");
      }
    } else {
      addLog(`❌ 음성 파일 합치기 실패: ${mergeResult.message}`, "error");
      addLog(`🔧 FFmpeg 오류 가능성 - 원본 파일 경로를 확인하세요`, "warning");
    }
  } catch (error) {
    console.error("❌ 음성 파일 합치기 오류:", error);
    addLog(`❌ 음성 파일 합치기 오료: ${error.message}`, "error");
  }
}

/**
 * 단일 음성 파일을 프로젝트명으로 복사하는 함수
 */
async function renameSingleAudioFile(audioFile, api, addLog) {
  try {
    addLog(`🎵 === 단일 오디오 파일 복사 시작 ===`);
    console.log("🎵 renameSingleAudioFile 함수 시작");

    // 파일명을 default.mp3로 고정
    const targetFileName = `default.mp3`;
    addLog(`📝 대상 파일명: ${targetFileName}`);

    // 출력 경로 설정
    let outputPath;
    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
      if (videoSaveFolder) {
        const audioFolder = `${videoSaveFolder}\\audio`;
        await api.invoke("fs:mkDirRecursive", { dirPath: audioFolder });
        outputPath = `${audioFolder}\\${targetFileName}`;
      } else {
        outputPath = `C:\\WeaverPro\\default\\audio\\${targetFileName}`;
      }
    } catch (error) {
      console.warn("설정 가져오기 실패, 기본 경로 사용:", error);
      outputPath = `C:\\WeaverPro\\default\\audio\\${targetFileName}`;
    }

    // 단일 파일이면 합본 과정을 거치지 않고 FFmpeg로 복사
    addLog(`🔧 디버깅: 단일 파일 복사 - 원본: ${audioFile.filePath}`);
    addLog(`🔧 디버깅: 단일 파일 복사 - 대상: ${outputPath}`);

    const copyResult = await api.invoke("audio/mergeFiles", {
      audioFiles: [audioFile.filePath], // 단일 파일 배열
      outputPath: outputPath
    });

    addLog(`🔧 디버깅: 단일 파일 복사 결과 = ${JSON.stringify(copyResult)}`);

    if (!copyResult.success) {
      addLog(`❌ 파일 복사 실패: ${copyResult.message}`, "error");
      throw new Error(`파일 복사 실패: ${copyResult.message}`);
    }

    addLog(`✅ 음성 파일 복사 완료: ${targetFileName}`);
    addLog(`📁 저장 경로: ${outputPath}`);

    // 파일이 실제로 생성되었는지 확인
    try {
      const exists = await api.invoke("files:exists", outputPath);
      if (exists) {
        addLog(`✅ 복사 파일 생성 확인됨: default.mp3`);
      } else {
        addLog(`❌ 복사 파일이 생성되지 않았습니다!`, "error");
      }
    } catch (checkError) {
      addLog(`❌ 파일 존재 확인 실패: ${checkError.message}`, "error");
    }
  } catch (error) {
    console.error("❌ 음성 파일 복사 오류:", error);
    addLog(`❌ 음성 파일 복사 오류: ${error.message}`, "error");
  }
}

/**
 * 자막 파일을 생성하는 함수 (협력업체 방식으로 변경)
 */
async function generateSubtitleFile(scriptData, api, addLog) {
  try {
    addLog("📝 SRT 자막 생성 시작...");
    console.log("🔍 자막 생성 함수 호출됨", scriptData);

    // 스크립트 데이터 검증
    if (!scriptData) {
      addLog("❌ scriptData가 없습니다", "error");
      return;
    }

    if (!scriptData.scenes || !Array.isArray(scriptData.scenes)) {
      addLog("❌ scriptData.scenes가 없거나 배열이 아닙니다", "error");
      console.log("🔍 scriptData 구조:", Object.keys(scriptData));
      return;
    }

    addLog(`🔍 ${scriptData.scenes.length}개 씬 발견`);

    // 스크립트에서 cue 데이터 추출
    const cues = [];
    let currentTime = 0;

    for (let i = 0; i < scriptData.scenes.length; i++) {
      const scene = scriptData.scenes[i];
      addLog(`🔍 씬 ${i+1} 처리 중...`);

      // scene.text 필드 사용 (실제 데이터 구조에 맞춤)
      if (scene.text && scene.text.trim()) {
        // 텍스트 길이 기반으로 대략적인 지속시간 계산
        const words = scene.text.trim().split(/\s+/).length;
        const estimatedDuration = Math.max(2000, words * 400); // 단어당 400ms, 최소 2초

        cues.push({
          start: currentTime,
          end: currentTime + estimatedDuration,
          text: scene.text.trim()
        });

        addLog(`  ✅ 자막 추가: "${scene.text.trim().substring(0, 30)}..." (${estimatedDuration}ms)`);
        currentTime += estimatedDuration + 200; // 200ms 간격
      } else {
        addLog(`  ⚠️ 씬 ${i+1}에 text가 없음`);
        console.log("🔍 씬 구조:", Object.keys(scene));
      }
    }

    if (cues.length === 0) {
      addLog("⚠️ 자막으로 변환할 텍스트가 없습니다.", "warn");
      return;
    }

    addLog(`✅ ${cues.length}개 자막 구간 추출 완료`);

    // SRT 생성
    const srtContent = await createSrtFromCues(cues);
    addLog(`📝 SRT 내용 생성 완료 (${srtContent.length}자)`);
    console.log("🔍 생성된 SRT 내용:", srtContent.substring(0, 200) + "...");

    // 파일 저장 경로 설정
    let srtFilePath = null;
    try {
      addLog("🔍 저장 경로 설정 중...");
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

      addLog(`🔍 videoSaveFolder: ${videoSaveFolder}`);

      if (videoSaveFolder) {
        const scriptsFolder = `${videoSaveFolder}\\scripts`;
        addLog(`🔍 scripts 폴더 생성: ${scriptsFolder}`);

        const mkdirResult = await api.invoke("fs:mkDirRecursive", { dirPath: scriptsFolder });
        addLog(`🔍 폴더 생성 결과: ${JSON.stringify(mkdirResult)}`);

        srtFilePath = `${scriptsFolder}\\subtitle.srt`;
        addLog(`🔍 자막 파일 경로: ${srtFilePath}`);
      } else {
        addLog("⚠️ videoSaveFolder가 설정되지 않음, 기본 경로 사용");
      }
    } catch (error) {
      console.warn("설정 가져오기 실패:", error);
      addLog(`❌ 설정 가져오기 실패: ${error.message}`, "error");
    }

    // 기본 경로 사용
    if (!srtFilePath) {
      srtFilePath = "C:\\WeaverPro\\default\\scripts\\subtitle.srt";
      addLog(`🔍 기본 경로 사용: ${srtFilePath}`);

      try {
        const defaultScriptsFolder = "C:\\WeaverPro\\default\\scripts";
        await api.invoke("fs:mkDirRecursive", { dirPath: defaultScriptsFolder });
        addLog(`🔍 기본 폴더 생성 완료: ${defaultScriptsFolder}`);
      } catch (error) {
        addLog(`❌ 기본 폴더 생성 실패: ${error.message}`, "error");
      }
    }

    if (srtFilePath) {
      addLog(`📝 자막 파일 저장 시도: ${srtFilePath}`);

      try {
        const writeResult = await api.invoke("files:writeText", {
          filePath: srtFilePath,
          content: srtContent
        });

        addLog(`🔍 파일 쓰기 결과: ${JSON.stringify(writeResult)}`);

        if (writeResult && writeResult.success) {
          addLog("✅ SRT 자막 생성 완료!");
          addLog(`📁 자막 파일: ${srtFilePath}`);
          addLog(`🎬 ${cues.length}개 자막 구간 생성됨`);

          // 파일 존재 확인
          try {
            const existsResult = await api.invoke("files:exists", { filePath: srtFilePath });
            addLog(`🔍 파일 존재 확인: ${JSON.stringify(existsResult)}`);
          } catch (existsError) {
            addLog(`⚠️ 파일 존재 확인 실패: ${existsError.message}`, "warn");
          }
        } else {
          const errorMsg = writeResult?.message || writeResult?.error || "알 수 없는 오류";
          throw new Error(`자막 파일 저장 실패: ${errorMsg}`);
        }
      } catch (writeError) {
        addLog(`❌ 파일 쓰기 오류: ${writeError.message}`, "error");
        throw writeError;
      }
    } else {
      addLog("❌ 자막 파일 경로가 설정되지 않았습니다", "error");
    }
  } catch (error) {
    console.error("❌ 자막 생성 오류:", error);
    addLog(`❌ 자막 생성 오류: ${error.message}`, "error");
  }
}

/**
 * 협력업체와 동일한 SRT 생성 함수
 */
async function createSrtFromCues(cues) {
  const msToSrt = (ms) => {
    const total = Math.max(0, Math.floor(ms));
    const h = String(Math.floor(total / 3600000)).padStart(2, "0");
    const m = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
    const ms3 = String(total % 1000).padStart(3, "0");
    return `${h}:${m}:${s},${ms3}`;
  };

  let idx = 1;
  const parts = [];
  for (const cue of cues || []) {
    parts.push(String(idx++));
    parts.push(`${msToSrt(cue.start)} --> ${msToSrt(cue.end)}`);
    parts.push((cue.text || "").replace(/\r?\n/g, "\n"));
    parts.push(""); // 빈 줄
  }

  return parts.join("\n");
}
