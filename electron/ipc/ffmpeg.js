// electron/ipc/ffmpeg.js
// ============================================================================
// FFmpeg 영상 합성 IPC 핸들러
// ============================================================================

const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

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

      // 기본 옵션 설정
      const defaultOptions = {
        fps: 24,
        videoCodec: 'libx264',
        audioCodec: 'aac',
        crf: 18, // 높은 품질
        preset: 'medium',
        format: 'mp4'
      };
      
      const finalOptions = { ...defaultOptions, ...options };

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

// FFmpeg 명령어 구성
async function buildFFmpegCommand(audioFiles, imageFiles, outputPath, options) {
  const args = ['-y']; // 기존 파일 덮어쓰기

  // 이미지 입력 설정
  if (imageFiles && imageFiles.length > 0) {
    // 이미지 시퀀스로 처리
    args.push('-framerate', options.fps.toString());
    
    // 각 이미지의 지속 시간 계산
    const totalAudioDuration = await getTotalAudioDuration(audioFiles);
    const imageDuration = totalAudioDuration / imageFiles.length;
    
    // 이미지들을 concat 필터로 연결
    let filterComplex = '';
    const inputs = [];
    
    for (let i = 0; i < imageFiles.length; i++) {
      args.push('-i', imageFiles[i]);
      inputs.push(`[${i}:v]`);
      
      // 각 이미지를 비디오로 변환하고 지속시간 설정
      filterComplex += `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,loop=-1:size=1:start=0[v${i}];`;
    }
    
    // 비디오 연결
    filterComplex += inputs.map((_, i) => `[v${i}]`).join('') + `concat=n=${imageFiles.length}:v=1:a=0[outv];`;
    
    args.push('-filter_complex', filterComplex);
    args.push('-map', '[outv]');
  }

  // 오디오 입력 설정
  if (audioFiles && audioFiles.length > 0) {
    for (const audioFile of audioFiles) {
      args.push('-i', audioFile);
    }
    
    if (audioFiles.length > 1) {
      // 여러 오디오 파일 연결
      const audioInputs = audioFiles.map((_, i) => `[${i + imageFiles.length}:a]`).join('');
      args.push('-filter_complex', `${audioInputs}concat=n=${audioFiles.length}:v=0:a=1[outa]`);
      args.push('-map', '[outa]');
    } else {
      args.push('-map', `${imageFiles.length}:a`);
    }
  }

  // 출력 옵션
  args.push('-c:v', options.videoCodec);
  if (audioFiles && audioFiles.length > 0) {
    args.push('-c:a', options.audioCodec);
  }
  args.push('-crf', options.crf.toString());
  args.push('-preset', options.preset);
  args.push('-movflags', '+faststart'); // 웹 최적화
  
  // 출력 파일
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
    const ffmpegProcess = spawn(ffmpegPath, args);
    
    let output = '';
    let errorOutput = '';

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