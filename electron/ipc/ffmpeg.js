// electron/ipc/ffmpeg.js
// ============================================================================
// FFmpeg 영상 합성 IPC 핸들러
// ============================================================================

const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const store = require('../services/store');

// FFmpeg 경로 설정
const ffmpegPath = path.join(__dirname, '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

function register() {
  // 영상 합성 (이미지 + 음성 → 비디오)
  ipcMain.handle('ffmpeg:compose', async (event, { 
    audioFiles, 
    imageFiles, 
    outputPath, 
    options = {} 
  }) => {
    try {
      console.log('🎬 FFmpeg 영상 합성 시작...');
      console.log('- 오디오 파일:', audioFiles);
      console.log('- 이미지 파일:', imageFiles);
      console.log('- 출력 경로:', outputPath);

      // 설정에서 영상 품질 옵션들 가져오기
      const videoQuality = store.get('videoQuality', 'balanced');
      const videoPreset = store.get('videoPreset', 'fast');
      const videoCrf = store.get('videoCrf', 23);

      // 협력업체보다 더 빠른 품질 설정
      let qualitySettings = { crf: 23, preset: 'veryfast' }; // 기본값 (매우 빠른 처리)

      if (videoQuality === 'high') {
        qualitySettings = { crf: 18, preset: 'fast' }; // 고품질도 빠르게
      } else if (videoQuality === 'medium') {
        qualitySettings = { crf: 21, preset: 'veryfast' };
      } else if (videoQuality === 'low') {
        qualitySettings = { crf: 28, preset: 'ultrafast' };
      }

      // 개별 설정이 있으면 사용
      if (videoPreset) qualitySettings.preset = videoPreset;
      if (videoCrf !== undefined) qualitySettings.crf = videoCrf;

      const defaultOptions = {
        fps: 24,
        videoCodec: 'libx264',
        audioCodec: 'aac',
        ...qualitySettings,
        format: 'mp4'
      };

      const finalOptions = { ...defaultOptions, ...options };

      console.log(`📊 사용 중인 영상 품질 설정: CRF=${finalOptions.crf}, Preset=${finalOptions.preset}`);

      // FFmpeg 명령어 구성
      const ffmpegArgs = await buildFFmpegCommand(
        audioFiles, 
        imageFiles, 
        outputPath, 
        finalOptions
      );

      console.log('FFmpeg 명령어:', ffmpegArgs.join(' '));

      // FFmpeg 실행
      const result = await runFFmpeg(ffmpegArgs, (progress) => {
        // 진행률 전송
        event.sender.send('ffmpeg:progress', progress);
      });

      if (result.success) {
        console.log('✅ 영상 합성 완료:', outputPath);
        return { 
          success: true, 
          videoPath: outputPath,
          duration: result.duration,
          size: result.size 
        };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('❌ FFmpeg 영상 합성 실패:', error);
      return { 
        success: false, 
        message: error.message,
        error: error.toString()
      };
    }
  });

  // FFmpeg 설치 확인
  ipcMain.handle('ffmpeg:check', async () => {
    try {
      const result = await runFFmpeg(['-version'], null, true);
      return { 
        success: true, 
        installed: result.success,
        version: result.output 
      };
    } catch (error) {
      return { 
        success: false, 
        installed: false, 
        message: error.message 
      };
    }
  });

  console.log('[ipc] ffmpeg: registered');
}

// FFmpeg 명령어 구성 (협력업체 수준 최적화)
async function buildFFmpegCommand(audioFiles, imageFiles, outputPath, options) {
  const args = [
    '-y', // 기존 파일 덮어쓰기
    '-hide_banner', // 불필요한 로그 숨기기
    '-loglevel', 'warning' // 로그 레벨 최적화
  ];

  // 입력 파일들 추가
  if (imageFiles && imageFiles.length > 0) {
    for (const imageFile of imageFiles) {
      args.push('-i', imageFile);
    }
  }

  if (audioFiles && audioFiles.length > 0) {
    for (const audioFile of audioFiles) {
      args.push('-i', audioFile);
    }
  }

  // 협력업체 수준의 최적화된 필터 체인
  if (imageFiles && imageFiles.length > 0) {
    const totalAudioDuration = await getTotalAudioDuration(audioFiles);
    const imageDuration = totalAudioDuration / imageFiles.length;

    console.log(`⚡ 협력업체 수준 최적화: 총 ${totalAudioDuration}초, 이미지당 ${imageDuration.toFixed(1)}초`);

    // 더 효율적인 필터 체인 구성
    let filterComplex = '';

    if (imageFiles.length === 1) {
      // 단일 이미지: 가장 간단한 처리
      filterComplex = `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=${options.fps}[v]`;
    } else {
      // 다중 이미지: 배치 처리로 최적화
      for (let i = 0; i < imageFiles.length; i++) {
        const duration = imageDuration.toFixed(3);
        filterComplex += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=${options.fps},trim=duration=${duration}[v${i}];`;
      }
      filterComplex += imageFiles.map((_, i) => `[v${i}]`).join('') + `concat=n=${imageFiles.length}:v=1[v]`;
    }

    args.push('-filter_complex', filterComplex);
    args.push('-map', '[v]');
  }

  // 오디오 매핑
  if (audioFiles && audioFiles.length > 0) {
    args.push('-map', `${imageFiles.length}:a`);
  }

  // 협력업체보다 더 빠른 인코딩 설정
  args.push(
    '-c:v', options.videoCodec,
    '-profile:v', 'main', // 호환성 최적화
    '-pix_fmt', 'yuv420p', // 픽셀 포맷 고정
    '-crf', options.crf.toString(),
    '-preset', options.preset,
    '-tune', 'fastdecode', // 디코딩 최적화
    '-threads', '0' // 멀티스레드 최대 활용
  );

  if (audioFiles && audioFiles.length > 0) {
    args.push('-c:a', options.audioCodec);
  }

  args.push(
    '-movflags', '+faststart', // 웹 최적화
    '-avoid_negative_ts', 'make_zero', // 타임스탬프 최적화
    outputPath
  );

  return args;
}

// 오디오 파일들의 총 지속 시간 계산
async function getTotalAudioDuration(audioFiles) {
  if (!audioFiles || audioFiles.length === 0) return 10; // 기본값

  try {
    let totalDuration = 0;
    for (const audioFile of audioFiles) {
      const duration = await getAudioDuration(audioFile);
      totalDuration += duration;
    }
    return totalDuration;
  } catch (error) {
    console.warn('오디오 지속시간 계산 실패, 기본값 사용:', error.message);
    return audioFiles.length * 5; // 파일당 5초로 추정
  }
}

// 개별 오디오 파일 지속 시간 측정
function getAudioDuration(audioFile) {
  return new Promise((resolve, reject) => {
    // ffprobe가 없으므로 기본값 반환
    console.warn('ffprobe 없음, 기본 지속시간 5초 사용');
    resolve(5);
  });
}

// FFmpeg 실행
function runFFmpeg(args, progressCallback = null, isCheck = false) {
  return new Promise((resolve, reject) => {
    // 타임아웃 설정: 체크 시 10초, 일반 처리 시 5분
    const timeoutMs = isCheck ? 10000 : 300000; // 5분으로 증가
    let timeoutId;

    const ffmpegProcess = spawn(ffmpegPath, args);

    let output = '';
    let errorOutput = '';
    let isCompleted = false;

    // 타임아웃 타이머 설정
    timeoutId = setTimeout(() => {
      if (!isCompleted) {
        console.warn(`⚠️ FFmpeg 타임아웃 (${timeoutMs}ms), 프로세스 종료 중...`);
        ffmpegProcess.kill('SIGKILL');
        resolve({
          success: false,
          error: `FFmpeg 처리 시간이 너무 오래 걸려서 중단되었습니다 (${timeoutMs / 1000}초 초과)`
        });
      }
    }, timeoutMs);

    ffmpegProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffmpegProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      
      // 진행률 파싱 (progressCallback이 있을 때만)
      if (progressCallback && !isCheck) {
        const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseInt(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          
          // 대략적인 진행률 계산 (전체 시간을 모르므로 추정)
          const estimatedProgress = Math.min(90, currentTime * 10); // 최대 90%
          progressCallback(estimatedProgress);
        }
      }
    });

    ffmpegProcess.on('close', (code) => {
      if (isCompleted) return;
      isCompleted = true;
      clearTimeout(timeoutId);

      if (code === 0 || isCheck) {
        resolve({
          success: code === 0,
          output: output || errorOutput,
          duration: extractDuration(errorOutput),
          size: 0 // 파일 크기는 별도로 계산 가능
        });
      } else {
        resolve({
          success: false,
          error: errorOutput || `FFmpeg exited with code ${code}`
        });
      }
    });

    ffmpegProcess.on('error', (error) => {
      if (isCompleted) return;
      isCompleted = true;
      clearTimeout(timeoutId);

      resolve({
        success: false,
        error: error.message
      });
    });
  });
}

// 출력에서 지속 시간 추출
function extractDuration(output) {
  const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseInt(durationMatch[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

module.exports = { register };