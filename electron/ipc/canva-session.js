// electron/ipc/canva-session.js
// ============================================================================
// Canva 세션 기반 다운로드 (협력 업체 방식)
// - 로그인 후 세션 유지
// - 키워드별 영상 목록 표시
// - 사용자가 선택한 영상만 다운로드
// ============================================================================

const { ipcMain, BrowserWindow } = require("electron");
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs").promises;
const axios = require("axios");
const crypto = require("crypto");

class CanvaSessionManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.sessionActive = false;
    this.canvaHeaders = {};
    this.videoDocTypeId = null;
    this.cookieString = null;
    this.profileDir = path.join(process.cwd(), "chrome_profile_canva");
  }

  // 시스템 Chrome 찾기
  async findSystemChrome() {
    const possiblePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    ];

    for (const chromePath of possiblePaths) {
      try {
        await fs.access(chromePath);
        console.log(`✅ Chrome 발견: ${chromePath}`);
        return chromePath;
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  // 세션 초기화 (로그인 창 열기)
  async initializeSession() {
    try {
      console.log("🚀 캔바 세션 초기화 중...");

      const systemChrome = await this.findSystemChrome();
      
      this.browser = await puppeteer.launch({
        headless: false,
        executablePath: systemChrome,
        args: [
          "--disable-blink-features=AutomationControlled",
          `--user-data-dir=${this.profileDir}`,
          "--no-sandbox",
          "--disable-dev-shm-usage",
        ],
        userDataDir: this.profileDir,
        defaultViewport: null,
      });

      this.page = await this.browser.newPage();
      
      // 네트워크 모니터링 시작
      await this.setupNetworkMonitoring();
      
      // 캔바 로그인 페이지로 이동
      await this.page.goto("https://www.canva.com/ko_kr/login", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("✅ 로그인 페이지 로드 완료");
      console.log("💡 브라우저에서 로그인을 완료해주세요.");

      return { success: true, message: "로그인 창이 열렸습니다. 로그인을 완료해주세요." };
      
    } catch (error) {
      console.error("❌ 세션 초기화 실패:", error);
      throw error;
    }
  }

  // 네트워크 모니터링 설정
  async setupNetworkMonitoring() {
    const client = await this.page.target().createCDPSession();
    await client.send("Network.enable");
    
    client.on("Network.requestWillBeSent", (params) => {
      const headers = params.request.headers;
      const url = params.request.url;
      
      if (url.includes("canva.com")) {
        // 캔바 헤더 수집
        for (const key in headers) {
          if (key.toLowerCase().startsWith("x-canva")) {
            this.canvaHeaders[key] = headers[key];
          }
        }
      }
    });
  }

  // 로그인 확인 및 세션 설정
  async confirmLogin() {
    try {
      if (!this.page) {
        return { success: false, message: "브라우저가 열려있지 않습니다." };
      }
      
      const currentUrl = await this.page.url();
      console.log(`📍 현재 URL: ${currentUrl}`);
      
      if (currentUrl.includes("login")) {
        return { success: false, message: "아직 로그인되지 않았습니다." };
      }

      // 쿠키 추출
      const cookies = await this.page.cookies();
      this.cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");
      console.log(`🍪 쿠키 추출 완료: ${cookies.length}개`);
      
      // 네트워크 헤더 수집을 위해 템플릿 페이지로 이동
      console.log("📋 템플릿 페이지로 이동하여 헤더 수집...");
      await this.page.goto("https://www.canva.com/templates/", { waitUntil: "networkidle2" });
      await this.page.waitForTimeout(2000);
      
      // docType ID 추출 (브라우저 컨텍스트에서)
      await this.getVideoDocTypeId();
      
      if (this.videoDocTypeId) {
        this.sessionActive = true;
        console.log("✅ 세션 활성화 완료!");
        console.log(`📊 수집된 캔바 헤더: ${Object.keys(this.canvaHeaders).join(", ")}`);
        
        // 로그인 후 브라우저 창 닫기
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log("🔒 브라우저 닫힘, 세션은 유지됨");
        
        return { 
          success: true, 
          message: "로그인 성공! 세션이 저장되었습니다.",
          sessionActive: true 
        };
      }
      
      return { success: false, message: "세션 설정 실패" };
      
    } catch (error) {
      console.error("❌ 로그인 확인 실패:", error);
      return { success: false, message: error.message };
    }
  }

  // 비디오 docType ID 가져오기
  async getVideoDocTypeId() {
    try {
      if (this.page) {
        // 브라우저 컨텍스트에서 실행
        const result = await this.page.evaluate(async () => {
          const response = await fetch("https://www.canva.com/_ajax/home/home-subpage-init?page=LAUNCHPAD", {
            credentials: "include",
          });
          
          if (response.ok) {
            const text = await response.text();
            return text;
          }
          return null;
        });
        
        if (result) {
          // 보안 prefix 제거
          let cleanText = result;
          const prefixes = ["'\"])}while(1);</x>//"];
          for (const prefix of prefixes) {
            if (cleanText.startsWith(prefix)) {
              cleanText = cleanText.substring(prefix.length);
              break;
            }
          }
          
          const data = JSON.parse(cleanText);
          this.videoDocTypeId = this.findDocTypeId(data);
          console.log(`📺 Video docType ID: ${this.videoDocTypeId}`);
        }
      } else {
        // 브라우저 닫힌 후 axios 사용
        console.log("🌐 브라우저 없이 API로 docType ID 가져오기");
        const response = await axios.get(
          "https://www.canva.com/_ajax/home/home-subpage-init?page=LAUNCHPAD",
          {
            headers: {
              Cookie: this.cookieString,
              "accept": "*/*",
              "x-canva-app": "home",
              "x-canva-locale": "ko-KR",
              "x-canva-request": "gethomesubpageinit",
              "referer": "https://www.canva.com/templates/",
              "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              ...this.canvaHeaders,
            },
          }
        );
        
        let responseData = response.data;
        if (typeof responseData === "string") {
          const prefixes = ["'\"])}while(1);</x>//"];
          for (const prefix of prefixes) {
            if (responseData.startsWith(prefix)) {
              responseData = JSON.parse(responseData.substring(prefix.length));
              break;
            }
          }
        }
        
        this.videoDocTypeId = this.findDocTypeId(responseData);
        console.log(`📺 Video docType ID: ${this.videoDocTypeId}`);
      }
    } catch (error) {
      console.error("docType ID 추출 실패:", error);
    }
  }

  // docType.id 찾기 헬퍼
  findDocTypeId(obj) {
    if (typeof obj === "object" && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (key === "docType.name" && value === "동영상") {
          if (obj["docType.id"]) return obj["docType.id"];
        }
        const result = this.findDocTypeId(value);
        if (result) return result;
      }
    }
    return null;
  }

  // 비디오 검색 (영상 목록 가져오기)
  async searchVideos(keyword, limit = 50) {
    try {
      console.log(`🔍 비디오 검색: "${keyword}"`);
      
      if (!this.videoDocTypeId) {
        throw new Error("docType ID가 없습니다. 로그인을 확인해주세요.");
      }

      if (!this.cookieString) {
        throw new Error("세션이 없습니다. 로그인을 확인해주세요.");
      }

      const url = `https://www.canva.com/_ajax/search/content2?query=${encodeURIComponent(
        keyword
      )}&contentTypes=H&doctype=${this.videoDocTypeId}&limit=${limit}`;
      
      console.log(`📡 API 요청: ${url}`);
      console.log(`🍪 쿠키 길이: ${this.cookieString.length}`);
      console.log(`📋 헤더 개수: ${Object.keys(this.canvaHeaders).length}`);
      
      const response = await axios.get(url, {
        headers: {
          Cookie: this.cookieString,
          "accept": "*/*",
          "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "x-canva-app": "editor",
          "x-canva-request": "searchcontent2api",
          "x-canva-locale": "ko-KR",
          "referer": "https://www.canva.com/design/",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...this.canvaHeaders,
        },
      });

      let responseData = response.data;
      
      // 보안 prefix 제거
      if (typeof responseData === "string") {
        const prefixes = ["'\"])}while(1);</x>//"];
        for (const prefix of prefixes) {
          if (responseData.startsWith(prefix)) {
            responseData = JSON.parse(responseData.substring(prefix.length));
            break;
          }
        }
      }

      const videos = this.extractVideoInfo(responseData, keyword);
      console.log(`✅ ${videos.length}개 비디오 발견`);
      
      return videos;
      
    } catch (error) {
      console.error(`❌ 비디오 검색 실패: ${error.message}`);
      throw error;
    }
  }

  // 비디오 정보 추출
  extractVideoInfo(searchData, keyword) {
    const videos = [];
    const videoItems = searchData?.A || [];
    
    for (const item of videoItems) {
      const videoId = item.K;
      const title = item.M || "";
      const videoData = item.N || {};
      const thumbnailUrl = videoData.A || "";
      const videoInfo = videoData.J || {};
      const videoUrl = videoInfo.url || "";
      
      if (videoId && videoUrl) {
        videos.push({
          id: videoId,
          title: title,
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl,
          keyword: keyword,
        });
      }
    }
    
    return videos;
  }

  // 고화질 비디오 정보 가져오기 (다중 엔드포인트 시도)
  async getHighQualityVideoInfo(videoId) {
    try {
      console.log(`🎥 고화질 비디오 정보 요청: ${videoId}`);
      
      // 기본 비디오 정보 API
      const primaryUrl = `https://www.canva.com/_ajax/video/?type=IDS&includeFiles&includePosterframes&includeTimelines&containers=A&containers=B&containers=D&ids=${videoId}&mintVideoUrls=false&mintVideoFiles=false`;
      
      // 대안 API 엔드포인트들
      const alternativeUrls = [
        `https://www.canva.com/_ajax/video/?type=IDS&includeFiles&includePosterframes&containers=A&containers=B&containers=C&containers=D&ids=${videoId}&mintVideoUrls=true&mintVideoFiles=true`,
        `https://www.canva.com/_ajax/video/download-info?ids=${videoId}&includeFiles=true&quality=high`,
        `https://www.canva.com/_ajax/media/video-files?ids=${videoId}&quality=best`
      ];
      
      const urls = [primaryUrl, ...alternativeUrls];
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          console.log(`📡 시도 ${i + 1}/${urls.length}: ${url.includes('download-info') ? 'Download Info API' : url.includes('video-files') ? 'Video Files API' : 'Standard API'}`);
          
          const response = await axios.get(url, {
            headers: {
              Cookie: this.cookieString,
              "accept": "*/*",
              "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
              "x-canva-app": "editor",
              "x-canva-request": "findvideosapi",
              "x-canva-locale": "ko-KR",
              "referer": "https://www.canva.com/design/",
              "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              ...this.canvaHeaders,
            },
            timeout: 15000,
          });

          let responseData = response.data;
          
          // 보안 prefix 처리
          if (typeof responseData === "string") {
            const prefixes = ["'\"])}while(1);</x>//", "for(;;);", ")]}'"];
            for (const prefix of prefixes) {
              if (responseData.startsWith(prefix)) {
                responseData = JSON.parse(responseData.substring(prefix.length));
                break;
              }
            }
          }
          
          // 응답 데이터 구조 분석
          console.log(`📋 API ${i + 1} 응답 구조:`, Object.keys(responseData || {}));
          
          const hqUrl = this.extractHqUrl(responseData);
          if (hqUrl) {
            console.log(`✅ API ${i + 1}에서 고화질 URL 획득`);
            return hqUrl;
          } else {
            console.log(`⚠️ API ${i + 1}에서 고화질 URL 추출 실패`);
          }
          
        } catch (apiError) {
          console.warn(`❌ API ${i + 1} 실패: ${apiError.message}`);
          continue;
        }
      }
      
      console.warn(`🔍 모든 고화질 API 시도 실패, 기본 URL 사용`);
      return null;
      
    } catch (error) {
      console.warn(`고화질 정보 요청 실패: ${error.message}`);
      return null;
    }
  }

  // 고화질 URL 추출 (개선된 품질 선택 알고리즘)
  extractHqUrl(hqInfo) {
    try {
      const videoItems = hqInfo?.A || [];
      if (!videoItems.length) return null;
      
      const videoFiles = videoItems[0]?.c || [];
      if (!videoFiles.length) return null;
      
      console.log(`📊 발견된 비디오 파일 수: ${videoFiles.length}`);
      
      // 모든 비디오 파일 정보 로깅
      videoFiles.forEach((file, index) => {
        const width = file.A || 0;
        const height = file.B || 0;
        const fileSize = file.F || 0; // 파일 크기
        const bitrate = file.G || 0; // 비트레이트 (있다면)
        const format = file.D || 'unknown'; // 포맷
        const url = file.E || '';
        
        console.log(`🎹 파일 ${index + 1}: ${width}x${height}, 크기: ${Math.round(fileSize / (1024*1024))}MB, 포맷: ${format}`);
        console.log(`🔗 URL: ${url.substring(0, 80)}...`);
      });
      
      // 품질 점수 계산 함수
      const calculateQualityScore = (file) => {
        const width = file.A || 0;
        const height = file.B || 0;
        const fileSize = file.F || 0;
        const bitrate = file.G || 0;
        
        // 해상도 점수 (4K > 1080p > 720p > 480p)
        let resolutionScore = 0;
        const totalPixels = width * height;
        
        if (totalPixels >= 3840 * 2160) resolutionScore = 1000; // 4K
        else if (totalPixels >= 1920 * 1080) resolutionScore = 800; // 1080p
        else if (totalPixels >= 1280 * 720) resolutionScore = 600; // 720p
        else if (totalPixels >= 854 * 480) resolutionScore = 400; // 480p
        else resolutionScore = totalPixels / 1000; // 기타
        
        // 파일 크기 점수 (큰 파일일수록 고화질일 가능성)
        const fileSizeScore = Math.min(fileSize / (1024 * 1024 * 10), 100); // 10MB 기준으로 정규화
        
        // 비트레이트 점수
        const bitrateScore = Math.min(bitrate / 1000, 100); // 1000kbps 기준으로 정규화
        
        // 종합 점수 (해상도가 가장 중요함)
        const totalScore = resolutionScore + (fileSizeScore * 0.3) + (bitrateScore * 0.2);
        
        return {
          score: totalScore,
          resolution: `${width}x${height}`,
          pixels: totalPixels,
          fileSize,
          bitrate,
          width,
          height
        };
      };
      
      // 모든 파일의 품질 점수 계산
      const scoredFiles = videoFiles.map((file, index) => ({
        ...file,
        index,
        quality: calculateQualityScore(file)
      }));
      
      // 점수 순으로 정렬 (높은 점수가 먼저)
      scoredFiles.sort((a, b) => b.quality.score - a.quality.score);
      
      // 최고 품질 파일 선택
      const bestFile = scoredFiles[0];
      
      console.log(`🏆 최고 품질 선택: ${bestFile.quality.resolution}, 점수: ${bestFile.quality.score.toFixed(1)}`);
      console.log(`📊 상세: 크기 ${Math.round(bestFile.quality.fileSize / (1024*1024))}MB, 비트레이트 ${bestFile.quality.bitrate}kbps`);
      
      // 품질 비교 로그 (상위 3개)
      console.log("📈 품질 순위:");
      scoredFiles.slice(0, 3).forEach((file, rank) => {
        console.log(`  ${rank + 1}. ${file.quality.resolution} (점수: ${file.quality.score.toFixed(1)})`);
      });
      
      return bestFile.E;
      
    } catch (error) {
      console.warn(`고화질 URL 추출 실패: ${error.message}`);
      return null;
    }
  }

  // 비디오 다운로드
  async downloadVideo(videoUrl, filePath) {
    try {
      console.log(`📥 다운로드 시작: ${path.basename(filePath)}`);
      console.log(`🔗 URL: ${videoUrl.substring(0, 100)}...`);
      
      // 디렉토리 생성
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      const response = await axios({
        method: "GET",
        url: videoUrl,
        responseType: "stream",
        headers: {
          Cookie: this.cookieString,
          "Accept": "*/*",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Referer": "https://www.canva.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Range": "bytes=0-",  // Range 헤더 추가
        },
        timeout: 60000,
        maxRedirects: 5,  // 리다이렉트 허용
      });

      const writer = require("fs").createWriteStream(filePath);
      
      // 다운로드 진행률 추적
      const totalSize = parseInt(response.headers["content-length"] || "0", 10);
      let downloadedSize = 0;
      
      response.data.on("data", (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          if (percent % 10 === 0) {  // 10% 단위로 로그
            console.log(`📊 다운로드 진행: ${percent}%`);
          }
        }
      });
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          const fileSize = require("fs").statSync(filePath).size;
          console.log(`✅ 다운로드 완료: ${path.basename(filePath)} (${Math.round(fileSize / (1024*1024))}MB)`);
          resolve({ success: true, filePath, size: fileSize });
        });
        writer.on("error", (error) => {
          console.error(`❌ 파일 쓰기 오류: ${error.message}`);
          reject(error);
        });
      });
      
    } catch (error) {
      console.error(`❌ 다운로드 실패: ${error.message}`);
      if (error.response) {
        console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      throw error;
    }
  }

  // 세션 정리
  async cleanup() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
    this.sessionActive = false;
  }
}

// 전역 인스턴스
let canvaSession = null;

// IPC 핸들러 등록
function register() {
  // 세션 초기화 (로그인 창 열기)
  ipcMain.handle("canva:session:init", async () => {
    try {
      if (!canvaSession) {
        canvaSession = new CanvaSessionManager();
      }
      return await canvaSession.initializeSession();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 로그인 확인
  ipcMain.handle("canva:session:confirmLogin", async () => {
    try {
      if (!canvaSession) {
        return { success: false, message: "세션이 초기화되지 않았습니다." };
      }
      return await canvaSession.confirmLogin();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 비디오 검색 (목록 가져오기)
  ipcMain.handle("canva:session:search", async (event, { keyword, limit }) => {
    try {
      if (!canvaSession || !canvaSession.sessionActive) {
        return { success: false, message: "세션이 활성화되지 않았습니다. 먼저 로그인해주세요." };
      }
      
      const videos = await canvaSession.searchVideos(keyword, limit);
      return { success: true, videos };
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 선택한 비디오 다운로드
  ipcMain.handle("canva:session:download", async (event, { videoId, videoUrl, outputPath }) => {
    try {
      if (!canvaSession || !canvaSession.sessionActive) {
        return { success: false, message: "세션이 활성화되지 않았습니다." };
      }

      // 고화질 URL 시도 (더 적극적인 품질 개선)
      let downloadUrl = videoUrl;
      let qualityInfo = "기본 품질";
      
      if (videoId) {
        console.log(`🔍 ${videoId}에 대한 고화질 URL 검색 중...`);
        const hqUrl = await canvaSession.getHighQualityVideoInfo(videoId);
        if (hqUrl && hqUrl !== videoUrl) {
          downloadUrl = hqUrl;
          qualityInfo = "고화질 (HQ)";
          console.log(`✨ 고화질 URL로 업그레이드: ${hqUrl.substring(0, 80)}...`);
        } else if (hqUrl) {
          console.log(`ℹ️ 기존 URL이 이미 최고 품질입니다`);
        } else {
          console.log(`⚠️ 고화질 URL을 찾을 수 없어 기본 URL 사용`);
        }
      }
      
      console.log(`🎬 다운로드 품질: ${qualityInfo}`);

      const result = await canvaSession.downloadVideo(downloadUrl, outputPath);
      return result;
      
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 테스트용 임의 영상 다운로드
  ipcMain.handle("canva:session:testDownload", async () => {
    try {
      if (!canvaSession || !canvaSession.sessionActive) {
        return { success: false, message: "세션이 활성화되지 않았습니다." };
      }

      console.log("🧪 테스트 다운로드 시작 - 인기 영상 검색 중...");

      // 인기 키워드들로 검색 시도
      const testKeywords = ["business", "nature", "technology", "modern", "abstract"];
      let testVideos = [];
      
      for (const keyword of testKeywords) {
        try {
          console.log(`🔍 테스트 검색: ${keyword}`);
          const videos = await canvaSession.searchVideos(keyword, 5);
          if (videos && videos.length > 0) {
            testVideos = videos;
            console.log(`✅ "${keyword}"에서 ${videos.length}개 영상 발견`);
            break;
          }
        } catch (error) {
          console.log(`⚠️ "${keyword}" 검색 실패: ${error.message}`);
          continue;
        }
      }

      if (testVideos.length === 0) {
        return { success: false, message: "테스트용 영상을 찾을 수 없습니다." };
      }

      // 첫 번째 영상 다운로드
      const testVideo = testVideos[0];
      console.log(`🎬 테스트 영상 선택: ${testVideo.title} (${testVideo.id})`);

      // 다운로드 경로 생성
      const testDir = path.join("C:", "ContentWeaver", "test_download");
      const fileName = `canva_test_${testVideo.id}_${Date.now()}.mp4`;
      const outputPath = path.join(testDir, fileName);

      // 고화질 URL 시도
      let downloadUrl = testVideo.videoUrl;
      let qualityInfo = "기본 품질";
      try {
        const hqUrl = await canvaSession.getHighQualityVideoInfo(testVideo.id);
        if (hqUrl && hqUrl !== testVideo.videoUrl) {
          downloadUrl = hqUrl;
          qualityInfo = "고화질 (HQ 업그레이드)";
          console.log("🎯 고화질 URL 사용 (HQ 업그레이드)");
        } else if (hqUrl) {
          qualityInfo = "최고 품질 (이미 HQ)";
          console.log("🎯 기존 URL이 이미 최고 품질");
        } else {
          console.log("⚠️ 고화질 URL 실패, 기본 URL 사용");
        }
      } catch (error) {
        console.log("⚠️ 고화질 URL 실패, 기본 URL 사용:", error.message);
      }
      
      console.log(`🎬 테스트 다운로드 품질: ${qualityInfo}`);

      // 다운로드 실행
      console.log(`📥 테스트 다운로드 시작: ${fileName}`);
      const result = await canvaSession.downloadVideo(downloadUrl, outputPath);

      if (result.success) {
        return {
          success: true,
          message: `테스트 다운로드 완료: ${fileName}`,
          video: testVideo,
          filePath: result.filePath,
          size: result.size
        };
      } else {
        return { success: false, message: "다운로드 실패" };
      }

    } catch (error) {
      console.error("❌ 테스트 다운로드 오류:", error);
      return { success: false, message: error.message };
    }
  });

  // 세션 상태 확인
  ipcMain.handle("canva:session:status", async () => {
    return {
      active: canvaSession?.sessionActive || false,
      hasDocTypeId: !!canvaSession?.videoDocTypeId,
      hasCookies: !!canvaSession?.cookieString,
      headersCount: Object.keys(canvaSession?.canvaHeaders || {}).length,
      debug: {
        cookieLength: canvaSession?.cookieString?.length || 0,
        videoDocTypeId: canvaSession?.videoDocTypeId,
        canvaHeaders: canvaSession?.canvaHeaders || {},
      }
    };
  });

  // 세션 종료
  ipcMain.handle("canva:session:cleanup", async () => {
    try {
      if (canvaSession) {
        await canvaSession.cleanup();
        canvaSession = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  console.log("[ipc] canva-session: registered");
}

module.exports = { register };