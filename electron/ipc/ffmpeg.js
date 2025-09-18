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
    subtitlePath = null, // 자막 파일 경로 추가
    options = {}
  }) => {
    try {
      console.log('🎬 FFmpeg 영상 합성 시작...');
      console.log('- 오디오 파일:', audioFiles);
      console.log('- 이미지 파일:', imageFiles);
      console.log('- 출력 경로:', outputPath);
      console.log('- 자막 파일:', subtitlePath);

      // 설정에서 영상 품질 옵션들 가져오기
      const videoQuality = store.get('videoQuality', 'balanced');
      const videoPreset = store.get('videoPreset', 'fast');
      const videoCrf = store.get('videoCrf', 23);

      // 자막 설정 가져오기
      const subtitleSettings = store.get('subtitleSettings', null);

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
        finalOptions,
        subtitleSettings, // 자막 설정 전달
        subtitlePath // 자막 파일 경로 전달
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

// FFmpeg 명령어 구성 (협력업체 완전 복제 + 개선)
async function buildFFmpegCommand(audioFiles, imageFiles, outputPath, options, subtitleSettings = null, subtitlePath = null) {
  const path = require('path');
  const fs = require('fs').promises;
  const { app } = require('electron');

  // 임시 폴더 생성 (기존 파일들 정리)
  const tempDir = path.join(app.getPath('userData'), 'ffmpeg-temp');
  try {
    await fs.mkdir(tempDir, { recursive: true });
    // 기존 임시 파일들 정리
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      if (file.startsWith('concat_') || file.startsWith('clip_')) {
        try {
          await fs.unlink(path.join(tempDir, file));
          console.log(`🗑️ 기존 임시 파일 삭제: ${file}`);
        } catch (e) {}
      }
    }
  } catch (e) {}

  const args = [
    '-y', // 기존 파일 덮어쓰기
    '-hide_banner', // 협력업체와 동일
    '-f', 'concat', // 협력업체 핵심: concat demuxer 사용
    '-safe', '0',
  ];

  // 협력업체 방식: concat 리스트 파일 생성
  if (imageFiles && imageFiles.length > 0) {
    const totalAudioDuration = await getTotalAudioDuration(audioFiles);
    const imageDuration = totalAudioDuration / imageFiles.length;

    console.log(`🔥 concat demuxer 방식 적용, 총 ${totalAudioDuration}초`);

    // 각 이미지를 개별 비디오 클립으로 변환해서 리스트 파일 생성
    const listFile = path.join(tempDir, `concat_${Date.now()}.txt`);
    const videoClips = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const tempVideo = path.join(tempDir, `clip_${i}_${Date.now()}.mp4`);

      // 각 이미지를 비디오 클립으로 변환 (협력업체 스타일)
      const clipArgs = [
        '-y', '-hide_banner',
        '-loop', '1',
        '-i', imageFiles[i],
        '-t', imageDuration.toFixed(3),
        '-vf', `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-r', options.fps.toString(),
        tempVideo
      ];

      console.log(`📹 클립 ${i+1}/${imageFiles.length} 생성 중... (${imageDuration.toFixed(1)}초)`);

      // 동기적으로 각 클립 생성
      await new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const ffmpegPath = path.join(__dirname, '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
        const proc = spawn(ffmpegPath, clipArgs, { windowsHide: true });

        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`클립 생성 실패: ${code}`));
        });

        proc.on('error', reject);
      });

      videoClips.push(tempVideo);
    }

    // concat 리스트 파일 생성 (협력업체와 동일)
    const concatContent = videoClips
      .map(clip => `file '${clip.replace(/'/g, "'\\''")}'`)
      .join('\n');

    await fs.writeFile(listFile, concatContent, 'utf8');

    args.push('-i', listFile);
  }

  // 오디오 추가 (모든 입력을 먼저 정의)
  if (audioFiles && audioFiles.length > 0) {
    args.push('-i', audioFiles[0]); // 첫 번째 오디오 파일
  }

  // 매핑 설정
  if (audioFiles && audioFiles.length > 0) {
    args.push('-map', '0:v', '-map', '1:a'); // 비디오와 오디오 매핑
  } else {
    args.push('-map', '0:v');
  }

  // 자막 처리를 고려한 비디오 필터 구성
  console.log('🔍 자막 파일 경로 체크:', subtitlePath);
  let videoFilter = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p';

  if (subtitlePath) {
    const fs = require('fs');
    const fileExists = fs.existsSync(subtitlePath);
    console.log('🔍 자막 파일 존재 여부:', fileExists);

    if (fileExists) {
      // 파일 내용 확인
      try {
        const content = fs.readFileSync(subtitlePath, 'utf8');
        console.log('🔍 자막 파일 크기:', content.length, '자');
        console.log('🔍 자막 파일 첫 200자:', content.substring(0, 200));
      } catch (readError) {
        console.error('❌ 자막 파일 읽기 실패:', readError.message);
      }

      console.log('🎬 자막을 하드서브로 적용 중...', subtitlePath);

      // Windows 경로를 FFmpeg 호환 경로로 변환 + 콜론 이스케이프
      const os = require('os');
      let srtForFfmpeg = os.platform() === "win32" ? subtitlePath.replace(/\\/g, "/") : subtitlePath;
      // 콜론을 이스케이프 처리 (Windows 드라이브 문자 때문)
      srtForFfmpeg = srtForFfmpeg.replace(/:/g, '\\:');
      console.log('🔍 FFmpeg용 경로:', srtForFfmpeg);

      // 자막 필터를 비디오 필터 체인 앞에 추가
      videoFilter = `subtitles='${srtForFfmpeg.replace(/'/g, "'\\''")}',${videoFilter}`;
      console.log('📝 최종 비디오 필터:', videoFilter);
    } else {
      console.warn('⚠️ 자막 파일이 존재하지 않음, 자막 없이 진행');
    }
  } else {
    console.log('⚠️ 자막 파일 경로가 지정되지 않음');
  }

  // 완성된 비디오 필터를 args에 추가
  args.push('-vf', videoFilter);

  // 협력업체와 동일한 인코딩 설정
  args.push(
    '-c:v', 'libx264',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-b:v', '1200k', // 협력업체는 비트레이트 방식
    '-preset', 'veryfast',
    '-movflags', '+faststart'
  );

  if (audioFiles && audioFiles.length > 0) {
    args.push('-c:a', options.audioCodec || 'aac');
  }

  args.push(outputPath);

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