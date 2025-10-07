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
 * @version 1.1.0
 */

const MIN_SCENE_SEC = 1.2; // ✅ 너무 빨리 넘어가던 문제 완화 (영상 최소 1.2s)
const MIN_SUBTITLE_SEC = 1.2; // ✅ 자막도 동일 최소값으로 맞춤

/**
 * 자동화 모드용 오디오 생성 단계
 */
export async function generateAudioStep(scriptData, form, addLog, setFullVideoState, api, outputPath = null) {
  addLog("🎤 음성 생성 중...");

  try {
    if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
      throw new Error("대본 데이터가 없습니다.");
    }

    // TTS 엔진과 음성 설정 확인
    const ttsEngine = form.ttsEngine || "google";
    const voiceId = form.voiceId;

    if (!voiceId) throw new Error("음성을 선택해주세요.");

    addLog(`🎙️ ${ttsEngine} 엔진으로 음성 생성 시작...`);
    addLog(`🔄 ${scriptData.scenes.length}개 장면의 음성 생성 중...`);

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
      if (window.electronAPI?.on) window.electronAPI.on("tts:progress", ttsProgressListener);
    } catch (e) {
      console.warn("TTS 진행률 리스너 설정 실패:", e);
    }

    // 실제 합성
    const audioResult = await api.invoke(
      "tts:synthesize",
      {
        scenes: scriptData.scenes,
        ttsEngine,
        voiceId,
        speed: form.speed || "1.0",
        outputPath,
      },
      {
        timeout: Math.max(60000, scriptData.scenes.length * 10000),
      }
    );

    const ttsData = audioResult.data || audioResult;
    if (!ttsData.ok) {
      const errorMsg = ttsData.error || audioResult.error || audioResult.message || "알 수 없는 오류";
      throw new Error(`음성 생성 실패: ${errorMsg}`);
    }

    addLog(`✅ 음성 생성 완료: ${ttsData.audioFiles?.length || 0}개 파일`);
    const audioFiles = ttsData.audioFiles || [];
    if (audioFiles.length === 0) throw new Error("생성된 음성 파일이 없습니다.");

    // 오디오 파일 존재 확인/합치기
    const savedAudioFiles = [];
    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i];
      const fileName = audioFile.fileName || audioFile.filename || `scene-${String(i + 1).padStart(3, "0")}.mp3`;
      const audioUrl = audioFile.audioUrl;
      if (!audioUrl) {
        addLog(`⚠️ 오디오 파일 ${fileName} 경로 없음`, "warning");
        continue;
      }
      const exists = await api.invoke("files:exists", audioUrl).catch(() => false);
      if (exists) {
        savedAudioFiles.push({ fileName, audioUrl, filePath: audioUrl });
        addLog(`✅ 기존 파일 확인됨: ${fileName} (${audioUrl})`);
      } else {
        addLog(`❌ 파일이 존재하지 않음: ${audioUrl}`, "error");
      }
    }

    // 개별 음성 파일 생성 완료 (default.mp3 생성하지 않음)
    if (savedAudioFiles.length === 0) {
      throw new Error("저장된 음성 파일이 없습니다.");
    }

    // 1차 자막 파일 생성 (대략)
    await generateSubtitleFile(scriptData, api, addLog);

    addLog(`🎵 === TTS 단계 완료 ===`);
    addLog(`✅ 개별 음성 파일 생성 완료: ${savedAudioFiles.length}개`);

    return audioFiles;
  } catch (error) {
    addLog(`❌ 음성 생성 실패: ${error.message}`, "error");
    throw error;
  } finally {
    try {
      if (window.electronAPI?.off) window.electronAPI.off("tts:progress");
    } catch {}
  }
}

/**
 * 자동화 모드용 이미지 생성 단계
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
        scene.visual_description || `${(scene.text || "").substring(0, 100)}을 표현하는 ${form.imageStyle || "photo"} 스타일 이미지`;

      try {
        let imageResult = null;
        let retry = 0;
        const maxRetries = 2;

        while (retry <= maxRetries) {
          try {
            if (retry > 0) {
              addLog(`🔄 이미지 ${sceneNum} 재시도... (${retry}/${maxRetries})`, "info");
              await new Promise((r) => setTimeout(r, 2000 * retry));
            }

            imageResult = await api.invoke("replicate:generate", {
              prompt: imagePrompt,
              style: form.imageStyle || "photo",
              width: 1920,
              height: 1080,
              aspectRatio: "16:9",
              outputPath,
            });
            break;
          } catch (e) {
            retry++;
            if (retry > maxRetries) throw e;
          }
        }

        const ok = imageResult.ok || imageResult.success;
        const imageUrls = imageResult.images || imageResult.data?.images || [];
        if (ok && imageUrls.length > 0) {
          const imageUrl = imageUrls[0];
          const urlExtension = imageUrl.split(".").pop().split("?")[0];
          const finalExt = ["jpg", "jpeg", "png", "webp"].includes((urlExtension || "").toLowerCase()) ? urlExtension : "jpg";

          const imageFileName = `scene_${String(sceneNum).padStart(3, "0")}.${finalExt}`;

          const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
          const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
          const imagesFolder = `${videoSaveFolder}\\images`;
          await api.invoke("fs:mkDirRecursive", { dirPath: imagesFolder });

          const imageFilePath = `${imagesFolder}\\${imageFileName}`;
          const downloadResult = await api.invoke("files:writeUrl", { url: imageUrl, filePath: imageFilePath });

          const savedPath = downloadResult?.data?.path;
          if (downloadResult.success && downloadResult.data?.ok && savedPath) {
            images.push({
              sceneIndex: i,
              sceneNumber: sceneNum,
              imagePath: savedPath,
              imageUrl,
              localPath: savedPath,
              prompt: imagePrompt,
              fileName: imageFileName,
              provider: "Replicate",
            });
            addLog(`✅ 이미지 ${sceneNum} 저장 완료`);
          } else {
            addLog(`❌ 이미지 ${sceneNum} 저장 실패`, "error");
            images.push({
              sceneIndex: i,
              sceneNumber: sceneNum,
              imagePath: null,
              imageUrl,
              prompt: imagePrompt,
              fileName: imageFileName,
              provider: "Replicate",
              error: downloadResult?.message,
            });
          }
        } else {
          addLog(`❌ 이미지 ${sceneNum} 생성 실패`, "error");
        }
      } catch (e) {
        addLog(`⚠️ 이미지 ${sceneNum} 생성 오류: ${e.message}`, "warning");
        images.push({
          sceneIndex: i,
          sceneNumber: sceneNum,
          imagePath: null,
          imageUrl: null,
          prompt: imagePrompt,
          fileName: `scene_${String(sceneNum).padStart(3, "0")}.jpg`,
          provider: "Replicate",
          error: e.message,
        });
      }

      const progress = Math.round(((i + 1) / total) * 100);
      updateFullVideoState({ progress: { images: progress } });
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
 */
export async function generateVideoStep(scriptData, audioFiles, imageFiles, addLog, setFullVideoState, api, outputPath = null) {
  try {
    addLog("🎬 FFmpeg 영상 합성 시작...");

    // output 경로
    const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
    const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
    if (!videoSaveFolder) throw new Error("videoSaveFolder 설정이 없습니다.");

    const outputFolder = `${videoSaveFolder}\\output`;
    await api.invoke("fs:mkDirRecursive", { dirPath: outputFolder }).catch(() => {});
    const finalOutputPath = `${outputFolder}\\final_video.mp4`;
    addLog(`📁 영상 파일 저장 위치: ${finalOutputPath}`);

    // 개별 음성 파일 경로 구성
    const audioFolder = `${videoSaveFolder}\\audio\\parts`;
    const audioFilePaths = [];
    for (let i = 0; i < (scriptData?.scenes?.length || 0); i++) {
      const sceneNum = i + 1;
      const fileName = `scene-${String(sceneNum).padStart(3, "0")}.mp3`;
      const filePath = `${audioFolder}\\${fileName}`;
      const exists = await api.invoke("files:exists", filePath).catch(() => false);
      if (exists) {
        audioFilePaths.push(filePath);
      } else {
        addLog(`⚠️ 음성 파일 없음: ${filePath}`, "warning");
      }
    }
    if (audioFilePaths.length === 0) throw new Error("사용 가능한 음성 파일이 없습니다.");
    addLog(`🎵 개별 음성 파일 ${audioFilePaths.length}개 확인됨`);

    // 이미지 파일 유효 경로
    const validImageFiles = (imageFiles || []).map((img) => img.localPath).filter(Boolean);
    const existingImageFiles = [];
    for (const p of validImageFiles) {
      const exists = await api.invoke("files:exists", p).catch(() => false);
      if (exists) existingImageFiles.push(p);
      else addLog(`⚠️ 이미지 파일 없음: ${p}`, "warning");
    }
    if (existingImageFiles.length === 0) throw new Error("실제로 존재하는 이미지 파일이 없습니다.");

    // === 씬/이미지 개수 정렬 ===
    const scenes = scriptData?.scenes || [];
    const usedCount = Math.min(existingImageFiles.length, scenes.length);
    if (usedCount === 0) throw new Error("사용할 씬/이미지 개수가 0입니다.");
    addLog(`🔍 사용할 개수: ${usedCount}개 (이미지: ${existingImageFiles.length}, 씬: ${scenes.length})`);

    // 개별 오디오 파일 길이 측정
    addLog("🎵 개별 오디오 파일 길이 측정 중...");
    const audioDurations = [];
    let totalAudioDurationSec = 0;

    for (let i = 0; i < audioFilePaths.length; i++) {
      const audioPath = audioFilePaths[i];
      try {
        const durationResult = await api.invoke("ffmpeg:duration", audioPath);
        const actualResult = durationResult?.data || durationResult;
        const seconds = actualResult?.seconds;

        if (durationResult?.success && actualResult?.success && seconds > 0) {
          audioDurations.push(seconds);
          totalAudioDurationSec += seconds;
          addLog(`✅ ${i + 1}번 오디오: ${seconds.toFixed(2)}초`);
        } else {
          addLog(`⚠️ ${i + 1}번 오디오 길이 측정 실패, 기본값 1초 사용`, "warning");
          audioDurations.push(1);
          totalAudioDurationSec += 1;
        }
      } catch (error) {
        addLog(`❌ ${i + 1}번 오디오 길이 측정 오류: ${error.message}`, "error");
        audioDurations.push(1);
        totalAudioDurationSec += 1;
      }
    }

    if (totalAudioDurationSec === 0) {
      totalAudioDurationSec = 10;
      addLog(`⚠️ 오디오 길이 측정 실패, 기본값 10초 사용`, "warning");
    }

    const totalAudioMs = Math.max(1000, Math.floor(totalAudioDurationSec * 1000));
    addLog(`🎵 총 오디오 길이: ${totalAudioDurationSec.toFixed(2)}초 (개별 파일 합산)`);

    // 텍스트 길이를 기반으로 씬 시간 분배 (최소 1.2초 보장)
    const usedScenes = scenes.slice(0, usedCount);
    const rawTextLens = usedScenes.map((s) => (s.text || s.narration || "").replace(/\s+/g, "").length || 1);
    const lensSum = rawTextLens.reduce((a, b) => a + b, 0);
    let sceneDurationsMs = rawTextLens.map((len) => Math.floor((len / lensSum) * totalAudioMs));

    // 최소 길이 적용(1.2s)
    const minMs = Math.floor(MIN_SCENE_SEC * 1000);
    // 우선 최소값 미달 씬에 보정량 합산
    let deficit = 0;
    sceneDurationsMs = sceneDurationsMs.map((ms) => {
      if (ms < minMs) {
        deficit += minMs - ms;
        return minMs;
      }
      return ms;
    });
    if (deficit > 0) {
      // 남는 씬에서 비율대로 차감해 총합을 다시 totalAudioMs로 맞춤
      let reducibleTotal = sceneDurationsMs.reduce((a, b) => a + b, 0) - minMs * usedCount;
      reducibleTotal = Math.max(1, reducibleTotal);
      const adjustableIdx = sceneDurationsMs.map((ms, i) => ({ i, over: Math.max(0, ms - minMs) }));
      for (const { i, over } of adjustableIdx) {
        if (deficit <= 0) break;
        if (over <= 0) continue;
        const take = Math.min(over, Math.ceil(deficit * (over / reducibleTotal)));
        sceneDurationsMs[i] -= take;
        deficit -= take;
      }
      // 잔여 deficit은 마지막 씬에서 차감
      if (deficit > 0) sceneDurationsMs[sceneDurationsMs.length - 1] -= deficit;
    }

    // 최종 합계 보정
    const sumNow = sceneDurationsMs.reduce((a, b) => a + b, 0);
    sceneDurationsMs[sceneDurationsMs.length - 1] += totalAudioMs - sumNow;

    addLog(`⏱️ 씬별 길이(초): ${sceneDurationsMs.map((ms) => (ms / 1000).toFixed(2)).join(", ")}`);
    addLog(`✅ 총합(초): ${(sceneDurationsMs.reduce((a, b) => a + b, 0) / 1000).toFixed(2)} (오디오와 일치)`);

    // === SRT 재생성(완전 동일 타이밍) ===
    await (async function regenerateSRT() {
      addLog("📝 정확 타이밍으로 SRT 재생성...");
      const cues = [];
      let t = 0;
      for (let i = 0; i < usedCount; i++) {
        const txt = (usedScenes[i].text || usedScenes[i].narration || `Scene ${i + 1}`).trim();
        const dur = Math.max(sceneDurationsMs[i], Math.floor(MIN_SUBTITLE_SEC * 1000)); // 자막도 최소 1.2s
        const start = t;
        const end = t + dur;
        t = end;
        cues.push({ start, end, text: txt });
      }
      const srt = await createSrtFromCues(cues);
      const subtitleFilePath = `${videoSaveFolder}\\scripts\\subtitle.srt`;
      await api.invoke("fs:mkDirRecursive", { dirPath: `${videoSaveFolder}\\scripts` }).catch(() => {});
      await api.invoke("files:writeText", { filePath: subtitleFilePath, content: srt });
      addLog("✅ SRT 재생성 완료");
    })();

    // 진행률 리스너
    let removeProgressListener = null;
    try {
      if (window.electronAPI?.onceAny) {
        removeProgressListener = window.electronAPI.onceAny("ffmpeg:progress", (progress) => {
          setFullVideoState((prev) => ({ ...prev, progress: { ...prev.progress, video: Math.round(progress) } }));
          addLog(`📹 영상 합성 진행률: ${Math.round(progress)}%`);
        });
      }
    } catch {}

    // 합성 실행
    const subtitleFilePath = `${videoSaveFolder}\\scripts\\subtitle.srt`;
    const compositionTimeout = Math.max(240000, usedCount * 20000 + 120000);

    const result = await api.invoke(
      "ffmpeg:compose",
      {
        audioFiles: audioFilePaths,
        imageFiles: existingImageFiles.slice(0, usedCount),
        outputPath: finalOutputPath,
        subtitlePath: subtitleFilePath,
        sceneDurationsMs,
        options: { fps: 24, videoCodec: "libx264", audioCodec: "aac" },
      },
      { timeout: compositionTimeout }
    );

    if (removeProgressListener && typeof removeProgressListener === "function") removeProgressListener();

    const ok = result.success && result.data?.success !== false;
    if (!ok) {
      const errorMessage = result.data?.message || result.message || result.error || "영상 합성 실패";
      throw new Error(errorMessage);
    }

    const actualVideoPath = result.videoPath || finalOutputPath;
    addLog(`✅ 영상 합성 완료: ${actualVideoPath}`);
    addLog(`📊 영상 길이: ${result.duration ? Math.round(result.duration) + "초" : "정보 없음"}`);

    // 파일 존재 체크
    const fileExists = await api.invoke("files:exists", actualVideoPath).catch(() => false);
    if (!fileExists) addLog(`⚠️ 영상 파일이 생성되지 않았습니다: ${actualVideoPath}`, "warning");

    return { videoPath: actualVideoPath, duration: result.duration, size: result.size };
  } catch (error) {
    addLog(`❌ 영상 합성 실패: ${error.message}`, "error");
    throw error;
  }
}


/** 자동화 모드용 자막 파일 생성(1차, 대략값) */
async function generateSubtitleFile(scriptData, api, addLog) {
  try {
    addLog("📝 SRT 자막 생성 시작...");

    if (!scriptData?.scenes?.length) {
      addLog("❌ scriptData.scenes가 없습니다", "error");
      return;
    }

    // 개별 오디오 파일 길이 합산
    let totalAudioDurationSec = 10;
    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
      if (videoSaveFolder) {
        const audioFolder = `${videoSaveFolder}/audio/parts`;
        let totalDuration = 0;
        let measuredFiles = 0;

        for (let i = 0; i < scriptData.scenes.length; i++) {
          const sceneNum = i + 1;
          const fileName = `scene-${String(sceneNum).padStart(3, "0")}.mp3`;
          const filePath = `${audioFolder}/${fileName}`;

          try {
            const durationResult = await api.invoke("ffmpeg:duration", filePath);
            const actualResult = durationResult?.data || durationResult;
            const seconds = actualResult?.seconds;

            if (durationResult?.success && actualResult?.success && seconds > 0) {
              totalDuration += seconds;
              measuredFiles++;
            }
          } catch {}
        }

        if (measuredFiles > 0) {
          totalAudioDurationSec = totalDuration;
        }
      }
    } catch {}

    const totalAudioMs = Math.floor(totalAudioDurationSec * 1000);
    const texts = scriptData.scenes.map((s) => s.text || s.narration || "");
    const lens = texts.map((t) => t.replace(/\s+/g, "").length || 1);
    const lensSum = lens.reduce((a, b) => a + b, 0);

    // 비율 기반 분배 + 최소 1.2s
    let sceneDurationsMs = lens.map((len) => Math.floor((len / lensSum) * totalAudioMs));
    const minMs = Math.floor(MIN_SUBTITLE_SEC * 1000);
    let deficit = 0;
    sceneDurationsMs = sceneDurationsMs.map((ms) => {
      if (ms < minMs) {
        deficit += minMs - ms;
        return minMs;
      }
      return ms;
    });
    if (deficit > 0) {
      let reducibleTotal = sceneDurationsMs.reduce((a, b) => a + b, 0) - minMs * sceneDurationsMs.length;
      reducibleTotal = Math.max(1, reducibleTotal);
      const adjustableIdx = sceneDurationsMs.map((ms, i) => ({ i, over: Math.max(0, ms - minMs) }));
      for (const { i, over } of adjustableIdx) {
        if (deficit <= 0) break;
        if (over <= 0) continue;
        const take = Math.min(over, Math.ceil(deficit * (over / reducibleTotal)));
        sceneDurationsMs[i] -= take;
        deficit -= take;
      }
      if (deficit > 0) sceneDurationsMs[sceneDurationsMs.length - 1] -= deficit;
    }
    // 합계 보정
    const sumNow = sceneDurationsMs.reduce((a, b) => a + b, 0);
    sceneDurationsMs[sceneDurationsMs.length - 1] += totalAudioMs - sumNow;

    const cues = [];
    let t = 0;
    for (let i = 0; i < scriptData.scenes.length; i++) {
      const dur = sceneDurationsMs[i] || minMs;
      const start = t;
      const end = t + dur;
      t = end;
      const text = texts[i].trim();
      if (!text) continue;
      cues.push({ start, end, text });
    }

    const srtContent = await createSrtFromCues(cues);

    // 저장
    let srtFilePath = null;
    try {
      const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
      const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
      srtFilePath = `${videoSaveFolder}/scripts/subtitle.srt`;
      await api.invoke("fs:mkDirRecursive", { dirPath: `${videoSaveFolder}/scripts` }).catch(() => {});
    } catch {}
    if (!srtFilePath) srtFilePath = null; // electron이 기본 경로 처리

    await api.invoke("files:writeText", { filePath: srtFilePath, content: srtContent });
    addLog(`✅ SRT 자막 생성 완료: ${srtFilePath}`);
  } catch (error) {
    addLog(`❌ 자막 생성 오류: ${error.message}`, "error");
  }
}

/** 공용 SRT 생성 */
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
    parts.push("");
  }
  return parts.join("\n");
}
