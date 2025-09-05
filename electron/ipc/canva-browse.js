// electron/ipc/canva-browse.js
// ============================================================================
// Canva 브라우저 자동화 (Remote Chrome + Puppeteer-Core 아키텍처)
// - 1회 로그인 후 세션 유지 (Chrome --remote-debugging-port=9222)
// - CDP 네트워크 모니터링으로 MP4 URL 실시간 포착
// - 80개 키워드 무인 처리 파이프라인
// - 스트림 다운로드 (서명 URL 만료 전 즉시 저장)
// - 진행 이벤트: "canva:progress", 완료 이벤트: "canva:downloaded"
// - 파일 규칙: C:\ContentWeaver\YYYY-MM-DD\키워드_번호_1920x1080.mp4
// ============================================================================

const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const http = require("http");
const crypto = require("crypto");
const axios = require("axios");
const { spawn, exec } = require("child_process");
const { app, ipcMain } = require("electron");

let puppeteer; // 지연 로드 (puppeteer-core)
let playwright; // 지연 로드 (playwright)
let remoteBrowser; // Remote Chrome 브라우저 인스턴스
let remotePage; // 재사용할 페이지 인스턴스

// ============================== 설정 기본값 ==============================
const DEFAULTS = {
  remotePort: 9222, // Chrome 원격 디버깅 포트
  downloadFormat: "MP4", // "MP4", "PNG" 등
  resolutionLabel: "1920 × 1080", // Canva UI 라벨 기준
  perKeywordLimit: 1, // 키워드당 다운로드 개수
  waitAfterEach: 1000, // 각 다운로드 후 대기(ms)
  maxRetries: 3, // 실패 시 재시도 횟수
  downloadTimeout: 30000, // 다운로드 타임아웃 (30초)
  pageTimeout: 15000, // 페이지 로딩 타임아웃 (15초)
};

// 🚫 강력한 중복 방지 시스템 (협력업체 로직 통합)
let duplicateTracker = {
  videoIds: new Set(),
  urlHashes: new Set(),
  fileHashes: new Set(),
  titleHashes: new Set(),
};
let downloadMetadataFile = null;
let loadedMetadata = null;

// 중복 방지 유틸 함수들
function calculateUrlHash(url) {
  return crypto.createHash("md5").update(url).digest("hex");
}

function calculateTitleHash(title) {
  const normalized = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    } catch (error) {
      resolve(null);
    }
  });
}

// 메타데이터 로드
async function loadDownloadMetadata() {
  if (loadedMetadata) return loadedMetadata;

  try {
    const data = fs.readFileSync(downloadMetadataFile, "utf8");
    loadedMetadata = JSON.parse(data);

    // 메타데이터에서 중복 추적기 초기화
    if (loadedMetadata.videos) {
      for (const video of loadedMetadata.videos) {
        if (video.videoId) duplicateTracker.videoIds.add(video.videoId);
        if (video.urlHash) duplicateTracker.urlHashes.add(video.urlHash);
        if (video.fileHash) duplicateTracker.fileHashes.add(video.fileHash);
        if (video.titleHash) duplicateTracker.titleHashes.add(video.titleHash);
      }
    }

    console.log(`📊 메타데이터 로드 완료: ${loadedMetadata.videos?.length || 0}개 영상 정보 로드`);
  } catch (error) {
    console.log("📄 메타데이터 파일 없음 - 새로 생성");
    loadedMetadata = { videos: [], lastUpdated: new Date().toISOString() };
  }

  return loadedMetadata;
}

// 메타데이터 저장
async function saveDownloadMetadata() {
  try {
    const dir = path.dirname(downloadMetadataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    loadedMetadata.lastUpdated = new Date().toISOString();
    fs.writeFileSync(downloadMetadataFile, JSON.stringify(loadedMetadata, null, 2));
    console.log(`💾 메타데이터 저장 완료: ${loadedMetadata.videos.length}개 영상`);
  } catch (error) {
    console.error("❌ 메타데이터 저장 실패:", error.message);
  }
}

// 중복 영상 체크
async function isDuplicateVideo(videoData, videoUrl) {
  await loadDownloadMetadata();

  // 1. 비디오 ID 체크
  if (videoData.id && duplicateTracker.videoIds.has(videoData.id)) {
    console.log(`🚫 중복 영상 스킵 (ID): ${videoData.title} [${videoData.id}]`);
    return true;
  }

  // 2. URL 해시 체크
  const urlHash = calculateUrlHash(videoUrl);
  if (duplicateTracker.urlHashes.has(urlHash)) {
    console.log(`🚫 중복 영상 스킵 (URL): ${videoData.title} [${urlHash.substring(0, 8)}...]`);
    return true;
  }

  // 3. 제목 해시 체크
  const titleHash = calculateTitleHash(videoData.title || "Unknown");
  if (duplicateTracker.titleHashes.has(titleHash)) {
    console.log(`🚫 중복 영상 스킵 (제목): ${videoData.title} [${titleHash.substring(0, 8)}...]`);
    return true;
  }

  return false;
}

// 영상 정보를 메타데이터에 추가
async function addVideoToMetadata(videoData, videoUrl, filePath) {
  await loadDownloadMetadata();

  const urlHash = calculateUrlHash(videoUrl);
  const titleHash = calculateTitleHash(videoData.title || "Unknown");
  const fileHash = await calculateFileHash(filePath);

  const videoMetadata = {
    videoId: videoData.id || `temp_${Date.now()}`,
    title: videoData.title || "Unknown",
    url: videoUrl,
    urlHash: urlHash,
    titleHash: titleHash,
    filePath: filePath,
    fileHash: fileHash,
    downloadedAt: new Date().toISOString(),
    fileSize: 0,
  };

  try {
    const stats = fs.statSync(filePath);
    videoMetadata.fileSize = stats.size;
  } catch (error) {
    console.warn("파일 크기 확인 실패:", error.message);
  }

  // 메타데이터에 추가
  loadedMetadata.videos.push(videoMetadata);

  // 중복 추적기에 추가
  if (videoData.id) duplicateTracker.videoIds.add(videoData.id);
  duplicateTracker.urlHashes.add(urlHash);
  duplicateTracker.titleHashes.add(titleHash);
  if (fileHash) duplicateTracker.fileHashes.add(fileHash);

  console.log(`📝 메타데이터 추가: ${videoData.title} [${videoData.id || "temp"}]`);

  // 메타데이터 저장
  await saveDownloadMetadata();
}

// ============================== 경로 유틸 ==============================
function getChromeProfileDir() {
  // Chrome 원격 세션용 프로필 디렉토리
  return path.join(process.env.APPDATA || app.getPath("userData"), "AI-Video-Generator", "ChromeProfile");
}

function getOutRoot() {
  // 요청 선호: C:\ContentWeaver\YYYY-MM-DD
  const root = "C:\\ContentWeaver";
  const day = new Date();
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  const out = path.join(root, `${yyyy}-${mm}-${dd}`);
  fs.mkdirSync(out, { recursive: true });

  // 메타데이터 파일 경로 초기화
  if (!downloadMetadataFile) {
    downloadMetadataFile = path.join(out, "download_metadata.json");
  }

  return out;
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();
}

// Chrome 실행 파일 경로 찾기 (Windows)
function findChromeExecutable() {
  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    path.join(process.env.PROGRAMFILES || "", "Google\\Chrome\\Application\\chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google\\Chrome\\Application\\chrome.exe"),
  ];

  for (const chromePath of possiblePaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error("Chrome 실행 파일을 찾을 수 없습니다. Google Chrome을 설치해주세요.");
}

// ============================== Remote Chrome 세션 관리 ==============================
let chromeProcess = null;

// Remote Chrome 시작
async function startRemoteChrome(port = DEFAULTS.remotePort) {
  const profileDir = getChromeProfileDir();
  const chromeExecutable = findChromeExecutable();

  // 프로필 디렉토리 생성
  fs.mkdirSync(profileDir, { recursive: true });

  console.log(`[canva-browse] 🚀 Remote Chrome 시작: 포트 ${port}, 프로필: ${profileDir}`);

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=TranslateUI,VizDisplayCompositor",
    "--disable-ipc-flooding-protection",
    "--disable-web-security", // CORS 우회
    "--disable-features=VizDisplayCompositor",
    "--no-sandbox", // 샌드박스 비활성화
    "https://www.canva.com", // 초기 페이지
  ];

  return new Promise((resolve, reject) => {
    chromeProcess = spawn(chromeExecutable, args, {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    chromeProcess.stdout.on("data", (data) => {
      console.log(`[chrome] ${data.toString().trim()}`);
    });

    chromeProcess.stderr.on("data", (data) => {
      console.log(`[chrome] ${data.toString().trim()}`);
    });

    chromeProcess.on("error", (error) => {
      console.error("[canva-browse] ❌ Chrome 프로세스 오류:", error);
      reject(error);
    });

    chromeProcess.on("exit", (code) => {
      console.log(`[canva-browse] 🔚 Chrome 프로세스 종료: ${code}`);
      chromeProcess = null;
    });

    // Chrome이 시작되고 디버깅 포트가 열릴 때까지 대기
    setTimeout(async () => {
      try {
        // 디버깅 포트 연결 테스트
        const response = await fetch(`http://localhost:${port}/json/version`);
        if (response.ok) {
          console.log("[canva-browse] ✅ Remote Chrome 디버깅 포트 연결 성공");
          resolve(chromeProcess);
        } else {
          throw new Error("디버깅 포트 연결 실패");
        }
      } catch (error) {
        reject(new Error(`Chrome 디버깅 포트(${port}) 연결 실패: ${error.message}`));
      }
    }, 3000);
  });
}

// Remote Chrome 중지
async function stopRemoteChrome() {
  if (chromeProcess && !chromeProcess.killed) {
    console.log("[canva-browse] 🛑 Remote Chrome 중지 중...");

    chromeProcess.kill("SIGTERM");

    // 강제 종료 대기
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (chromeProcess && !chromeProcess.killed) {
          console.log("[canva-browse] 💀 Chrome 강제 종료");
          chromeProcess.kill("SIGKILL");
        }
        resolve();
      }, 5000);

      if (chromeProcess) {
        chromeProcess.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });
  }
}

// Puppeteer로 Remote Chrome에 연결
async function connectToRemoteChrome(port = DEFAULTS.remotePort) {
  if (!puppeteer) {
    try {
      puppeteer = require("puppeteer-core");
    } catch (error) {
      throw new Error("puppeteer-core가 설치되지 않았습니다. npm install puppeteer-core를 실행하세요.");
    }
  }

  console.log(`[canva-browse] 🔗 Remote Chrome 연결: localhost:${port}`);

  try {
    // 이미 연결된 브라우저가 있으면 재사용
    if (remoteBrowser && remoteBrowser.isConnected()) {
      console.log("[canva-browse] ♻️ 기존 Remote Chrome 연결 재사용");
      return remoteBrowser;
    }

    // Remote Chrome에 연결
    remoteBrowser = await puppeteer.connect({
      browserURL: `http://localhost:${port}`,
      ignoreHTTPSErrors: true,
    });

    console.log("[canva-browse] ✅ Remote Chrome 연결 성공");

    // 연결 해제 이벤트 처리
    remoteBrowser.on("disconnected", () => {
      console.log("[canva-browse] 🔌 Remote Chrome 연결 해제됨");
      remoteBrowser = null;
      remotePage = null;
    });

    return remoteBrowser;
  } catch (error) {
    throw new Error(`Remote Chrome 연결 실패: ${error.message}`);
  }
}

// 재사용 가능한 페이지 가져오기/생성
async function getReusablePage() {
  if (!remoteBrowser || !remoteBrowser.isConnected()) {
    throw new Error("Remote Chrome이 연결되지 않았습니다.");
  }

  if (remotePage && !remotePage.isClosed()) {
    console.log("[canva-browse] ♻️ 기존 페이지 재사용");
    return remotePage;
  }

  console.log("[canva-browse] 📄 새로운 페이지 생성");
  remotePage = await remoteBrowser.newPage();

  // 페이지 기본 설정
  await remotePage.setViewport({ width: 1920, height: 1080 });
  await remotePage.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  return remotePage;
}

// ============================== CDP 네트워크 모니터링 시스템 ==============================
// 캐치된 MP4 URL 저장소
let caughtVideoUrls = new Set();
let networkMonitorActive = false;

// CDP 네트워크 모니터링 시작
async function startNetworkMonitoring(page) {
  if (networkMonitorActive) {
    console.log("[canva-browse] 🕸️ 네트워크 모니터링 이미 활성화됨");
    return;
  }

  console.log("[canva-browse] 🕸️ CDP 네트워크 모니터링 시작");
  networkMonitorActive = true;
  caughtVideoUrls.clear();

  // CDP 네트워크 도메인 활성화
  const client = page._client;
  await client.send("Network.enable");
  await client.send("Runtime.enable");

  // 응답 이벤트 리스너
  client.on("Network.responseReceived", async (event) => {
    const { response, requestId } = event;
    const { url, status, mimeType, headers } = response;

    // MP4 또는 비디오 관련 응답 감지
    if (
      status === 200 &&
      (url.includes(".mp4") ||
        url.includes("video") ||
        url.includes("export") ||
        url.includes("download") ||
        mimeType?.includes("video") ||
        headers["content-type"]?.includes("video"))
    ) {
      console.log(`[canva-browse] 🎬 비디오 URL 감지: ${url}`);
      console.log(`[canva-browse] 📊 상태: ${status}, MIME: ${mimeType}`);

      // 서명된 URL 패턴 확인 (AWS/CloudFront 등)
      if (
        url.includes("amazonaws") ||
        url.includes("cloudfront") ||
        url.includes("canva") ||
        url.includes("X-Amz-") ||
        url.includes("signature")
      ) {
        caughtVideoUrls.add(url);
        console.log(`[canva-browse] 🎯 서명된 비디오 URL 포착: ${url.substring(0, 100)}...`);

        // 🚫 중복 방지 체크 (협력업체 로직 통합)
        const videoData = {
          id: `url_${Date.now()}`,
          title: `Video_${caughtVideoUrls.size}`,
          url: url,
        };

        // 중복 체크 (비동기로 처리)
        isDuplicateVideo(videoData, url)
          .then((isDuplicate) => {
            if (isDuplicate) {
              console.log(`🚫 중복 비디오 URL 스킵: ${url.substring(0, 50)}...`);
              return;
            }

            // 즉시 다운로드 시작 (URL 만료 전)
            setTimeout(() => {
              downloadCaughtVideo(url).catch(console.error);
            }, 100);
          })
          .catch(console.error);
      }
    }

    // Export API 응답 처리
    if (url.includes("/api/v1/exports") || url.includes("/export")) {
      console.log(`[canva-browse] 📡 Export API 응답 감지: ${url}`);

      try {
        const responseBody = await client.send("Network.getResponseBody", { requestId });

        if (responseBody?.body) {
          const extractedUrl = extractVideoUrlFromResponse(responseBody.body);
          if (extractedUrl) {
            caughtVideoUrls.add(extractedUrl);
            console.log(`[canva-browse] 🎯 Export API에서 비디오 URL 추출: ${extractedUrl}`);

            // 즉시 다운로드
            setTimeout(() => {
              downloadCaughtVideo(extractedUrl).catch(console.error);
            }, 100);
          }
        }
      } catch (e) {
        console.log(`[canva-browse] ⚠️ Export API 응답 분석 실패: ${e.message}`);
      }
    }
  });

  console.log("[canva-browse] ✅ CDP 네트워크 모니터링 활성화 완료");
}

// 네트워크 모니터링 중지
async function stopNetworkMonitoring(page) {
  if (!networkMonitorActive) return;

  console.log("[canva-browse] 🛑 CDP 네트워크 모니터링 중지");
  networkMonitorActive = false;

  try {
    const client = page._client;
    client.removeAllListeners("Network.responseReceived");
    await client.send("Network.disable");
  } catch (e) {
    console.log(`[canva-browse] ⚠️ 네트워크 모니터링 중지 중 오류: ${e.message}`);
  }
}

// CDN에서 비디오 파일 다운로드 (진행률 콜백 지원)
async function downloadFromCDN(url, destPath, progressCallback) {
  if (!url || !destPath) return { success: false, error: "잘못된 매개변수" };

  console.log(`[canva-browse] 🌐 CDN 다운로드 시작: ${path.basename(destPath)}`);

  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const timeoutMs = DEFAULTS.downloadTimeout;

    const req = client.get(url, (res) => {
      // 리다이렉트 처리
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        console.log(`[canva-browse] 🔄 리다이렉트: ${redirectUrl}`);
        return downloadFromCDN(redirectUrl, destPath, progressCallback).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        const error = `HTTP ${res.statusCode}: ${res.statusMessage}`;
        reject(new Error(error));
        return;
      }

      const totalSize = parseInt(res.headers["content-length"] || "0", 10);
      let downloadedSize = 0;
      const startTime = Date.now();

      const fileStream = fs.createWriteStream(destPath);

      res.on("data", (chunk) => {
        downloadedSize += chunk.length;

        // 진행률 콜백 호출
        if (progressCallback && typeof progressCallback === "function") {
          const progress = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
          progressCallback({
            progress,
            downloadedSize,
            totalSize,
            speed: downloadedSize / ((Date.now() - startTime) / 1000) / (1024 * 1024),
          });
        }

        // 진행률 로깅 (1MB마다)
        if (downloadedSize % (1024 * 1024) === 0 || downloadedSize === totalSize) {
          const elapsed = Date.now() - startTime;
          const speed = downloadedSize / (elapsed / 1000) / (1024 * 1024); // MB/s
          console.log(
            `[canva-browse] 📥 CDN 다운로드 중: ${Math.round(downloadedSize / 1024 / 1024)}MB / ${Math.round(
              totalSize / 1024 / 1024
            )}MB (${speed.toFixed(1)} MB/s)`
          );
        }
      });

      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        const elapsed = Date.now() - startTime;
        const speed = downloadedSize / (elapsed / 1000) / (1024 * 1024);
        console.log(
          `[canva-browse] ✅ CDN 다운로드 완료: ${path.basename(destPath)} (${Math.round(downloadedSize / 1024 / 1024)}MB, ${speed.toFixed(
            1
          )} MB/s)`
        );

        // 🚫 다운로드 완료 후 메타데이터에 추가 (협력업체 로직 통합)
        const videoData = {
          id: `canva_${Date.now()}`,
          title: path.basename(destPath, path.extname(destPath)),
          url: url,
        };

        addVideoToMetadata(videoData, url, destPath).catch(console.error);

        resolve({
          success: true,
          filePath: destPath,
          fileName: path.basename(destPath),
          size: downloadedSize,
          duration: elapsed,
          speed: speed,
        });
      });

      fileStream.on("error", (err) => {
        fs.unlink(destPath, () => {}); // 실패시 임시 파일 삭제
        reject(err);
      });
    });

    req.on("error", (error) => {
      console.error(`[canva-browse] ❌ CDN 다운로드 네트워크 오류: ${error.message}`);
      reject(error);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`CDN 다운로드 타임아웃 (${timeoutMs}ms)`));
    });
  });
}

// 포착된 비디오 URL 스트림 다운로드 (자동 파일명)
async function downloadCaughtVideo(url) {
  if (!url) return null;

  const outDir = getOutRoot();
  const timestamp = Date.now();
  const fileName = `canva_video_${timestamp}.mp4`;
  const filePath = path.join(outDir, fileName);

  console.log(`[canva-browse] ⚡ 즉시 스트림 다운로드 시작: ${fileName}`);

  // downloadFromCDN 함수를 재사용
  try {
    return await downloadFromCDN(url, filePath);
  } catch (error) {
    console.error(`[canva-browse] ❌ 즉시 다운로드 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 네트워크 요청에서 비디오 URL 추출
function extractVideoUrlFromResponse(url, responseBody) {
  try {
    console.log(`[canva-browse] 🔍 URL 추출 시도 - 응답 유형: ${typeof responseBody}`);

    // JSON 응답에서 비디오 URL 패턴 찾기
    if (typeof responseBody === "string") {
      console.log(`[canva-browse] 📄 문자열 응답에서 URL 패턴 검색 중... (길이: ${responseBody.length})`);

      // Export API 응답에서 다운로드 URL 추출
      const downloadUrlMatch = responseBody.match(/"download_url":\s*"([^"]+)"/);
      if (downloadUrlMatch) {
        const cleanUrl = downloadUrlMatch[1].replace(/\\u002F/g, "/").replace(/\\/g, "");
        console.log(`[canva-browse] ✅ download_url 패턴 발견: ${cleanUrl}`);
        return cleanUrl;
      }

      // CDN URL 패턴 추출 (캔바 비디오 URL 형식)
      const cdnPatterns = [
        /https:\/\/[^"]*\.cloudfront\.net[^"]*\.mp4[^"]*/g,
        /https:\/\/[^"]*amazonaws\.com[^"]*\.mp4[^"]*/g,
        /https:\/\/[^"]*canva-[^"]*\.mp4[^"]*/g,
        /https:\/\/[^"]*export[^"]*\.mp4[^"]*/g,
      ];

      for (const pattern of cdnPatterns) {
        const matches = responseBody.match(pattern);
        if (matches && matches.length > 0) {
          const cleanUrl = matches[0].replace(/\\/g, "");
          console.log(`[canva-browse] ✅ CDN URL 패턴 발견: ${cleanUrl}`);
          return cleanUrl;
        }
      }

      // 일반적인 MP4 URL 패턴
      const mp4UrlMatch = responseBody.match(/https:\/\/[^"]*\.mp4[^"]*/);
      if (mp4UrlMatch) {
        const cleanUrl = mp4UrlMatch[0].replace(/\\/g, "");
        console.log(`[canva-browse] ✅ 일반 MP4 URL 패턴 발견: ${cleanUrl}`);
        return cleanUrl;
      }

      // JSON 파싱 시도
      try {
        const parsed = JSON.parse(responseBody);
        return extractVideoUrlFromResponse(url, parsed);
      } catch (parseError) {
        console.log(`[canva-browse] ⚠️ JSON 파싱 실패, 문자열로 처리 계속`);
      }
    }

    // JSON 객체인 경우
    if (typeof responseBody === "object" && responseBody !== null) {
      console.log(`[canva-browse] 📦 객체 응답에서 URL 검색 중...`);
      const obj = responseBody;

      // 다양한 키에서 다운로드 URL 찾기
      const urlKeys = [
        "download_url",
        "downloadUrl",
        "export_url",
        "exportUrl",
        "url",
        "videoUrl",
        "video_url",
        "fileUrl",
        "file_url",
        "cdnUrl",
        "cdn_url",
        "directUrl",
        "direct_url",
      ];

      for (const key of urlKeys) {
        if (obj[key] && typeof obj[key] === "string" && obj[key].includes("http")) {
          if (key === "url" && !obj[key].includes(".mp4") && !obj[key].includes("video")) {
            continue; // url 키는 MP4나 video가 포함된 경우만 사용
          }
          console.log(`[canva-browse] ✅ 키 '${key}'에서 URL 발견: ${obj[key]}`);
          return obj[key];
        }
      }

      // 중첩된 객체에서 재귀 검색
      const nestedPaths = [
        ["export", "url"],
        ["result", "url"],
        ["data", "url"],
        ["video", "url"],
        ["file", "url"],
        ["download", "url"],
        ["export", "download_url"],
        ["result", "download_url"],
      ];

      for (const path of nestedPaths) {
        let current = obj;
        let valid = true;

        for (const key of path) {
          if (current && typeof current === "object" && current[key]) {
            current = current[key];
          } else {
            valid = false;
            break;
          }
        }

        if (valid && typeof current === "string" && current.includes("http")) {
          console.log(`[canva-browse] ✅ 중첩 경로 '${path.join(".")}'에서 URL 발견: ${current}`);
          return current;
        }
      }

      // 배열 내 검색
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const nestedUrl = extractVideoUrlFromResponse(url, item);
          if (nestedUrl) {
            return nestedUrl;
          }
        }
      }

      // 모든 값에 대해 재귀 검색 (깊이 제한)
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "object" && value !== null) {
          const nestedUrl = extractVideoUrlFromResponse(url, value);
          if (nestedUrl) {
            console.log(`[canva-browse] ✅ 재귀 검색에서 URL 발견 (키: ${key}): ${nestedUrl}`);
            return nestedUrl;
          }
        }
      }
    }

    console.log(`[canva-browse] ❌ 응답에서 비디오 URL을 찾을 수 없음`);
  } catch (e) {
    console.log(`[canva-browse] ⚠️ URL 추출 중 오류: ${e.message}`);
  }

  return null;
}

// ============================== 내부 이벤트 전송 ==============================
// 특정 렌더러(webContents)로만 쏘고 싶으면 sender 전송.
// 전체 창 브로드캐스트가 필요하면 BrowserWindow.getAllWindows() 순회.
function sendProgressTo(sender, payload) {
  try {
    // UI 호환 진행상황 형식으로 변환
    const uiPayload = {
      stage: payload.stage || "progress",
      keyword: payload.keyword || "",
      method: payload.method || "CDN",
      progress: payload.progress || 0,
      downloaded: payload.downloaded || 0,
      filename: payload.filename || payload.keyword,
      error: payload.error || "",
      message: payload.message || "",
    };

    console.log(`[canva-browse] 📊 UI 진행상황 전송:`, uiPayload);
    sender.send("canva:progress", uiPayload);
  } catch (e) {
    console.log(`[canva-browse] ⚠️ 진행상황 전송 실패: ${e.message}`);
  }
}

function sendDownloadedTo(sender, payload) {
  try {
    // UI 호환 완료 형식으로 변환
    const uiPayload = {
      success: true,
      keyword: payload.keyword || "",
      path: payload.path || "",
      size: payload.size || 0,
      downloaded: payload.downloaded || 1,
      methods: payload.methods || { CDN: 1 },
      message: payload.message || `다운로드 완료: ${payload.path || payload.keyword}`,
    };

    console.log(`[canva-browse] ✅ UI 완료 알림 전송:`, uiPayload);
    sender.send("canva:downloaded", uiPayload);
  } catch (e) {
    console.log(`[canva-browse] ⚠️ 완료 알림 전송 실패: ${e.message}`);
  }
}

// ============================== 80개 키워드 무인 처리 파이프라인 ==============================

// 단일 키워드 처리 (템플릿 검색 → 클릭 → CDP로 다운로드 포착)
async function processKeyword(page, keyword, index, options = {}, progressCallback) {
  const { perKeywordLimit = 1 } = options;
  console.log(`[canva-browse] 🔍 키워드 처리 시작: "${keyword}" (${index + 1})`);

  let downloadCount = 0;
  const downloadResults = [];

  try {
    // 1. 캔바 비디오 템플릿 검색 페이지로 이동
    const searchUrl = `https://www.canva.com/templates/search/videos/?query=${encodeURIComponent(keyword)}`;
    console.log(`[canva-browse] 📍 검색 페이지 이동: ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULTS.pageTimeout,
    });

    // 페이지 로딩 대기
    await page.waitForTimeout(2000);

    progressCallback?.({
      stage: "search",
      keyword,
      method: "CDP자동화",
      message: `검색 완료: ${keyword}`,
    });

    // 2. 템플릿 카드들 찾기 (다양한 선택기 시도)
    const templateSelectors = ['a[href*="/design/"]', '[data-testid*="template"] a', ".template-card a", 'article a[href*="/design/"]'];

    let templates = null;
    for (const selector of templateSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        templates = await page.$$(selector);
        if (templates && templates.length > 0) {
          console.log(`[canva-browse] ✅ ${templates.length}개 템플릿 발견 (선택기: ${selector})`);
          break;
        }
      } catch (e) {
        console.log(`[canva-browse] ⏭️ 선택기 시도: ${selector} - 실패`);
      }
    }

    if (!templates || templates.length === 0) {
      console.log(`[canva-browse] ❌ 템플릿을 찾을 수 없음: ${keyword}`);
      return { keyword, success: false, downloads: 0, message: "템플릿 없음" };
    }

    // 3. 필요한 만큼 템플릿 처리 (perKeywordLimit)
    const templatesToProcess = Math.min(templates.length, perKeywordLimit);

    for (let i = 0; i < templatesToProcess; i++) {
      try {
        console.log(`[canva-browse] 🖱️ 템플릿 ${i + 1}/${templatesToProcess} 클릭`);

        // 템플릿 클릭 전 네트워크 모니터링 활성화
        await startNetworkMonitoring(page);

        // 현재 다운로드 개수 기록
        const beforeDownloads = caughtVideoUrls.size;

        // 템플릿 클릭 (새 탭에서 열릴 수 있음)
        const [newPage] = await Promise.all([page.waitForEvent("popup", { timeout: 10000 }).catch(() => null), templates[i].click()]);

        // 새 탭이 열렸으면 해당 탭에서 작업, 아니면 현재 페이지에서 작업
        const workingPage = newPage || page;

        if (newPage) {
          console.log("[canva-browse] 📄 새 탭에서 에디터 열림");
          await startNetworkMonitoring(newPage);
        }

        // 에디터 로딩 대기
        await workingPage.waitForTimeout(3000);

        progressCallback?.({
          stage: "downloading",
          keyword,
          method: "CDP자동화",
          message: `다운로드 대기 중: ${keyword} (${i + 1}/${templatesToProcess})`,
        });

        // 다운로드 버튼 찾기 및 클릭
        const downloadButtons = [
          'button[data-testid*="download"]',
          'button:has-text("Download")',
          'button:has-text("다운로드")',
          '[aria-label*="Download"]',
          'button[aria-label*="다운로드"]',
        ];

        let downloadClicked = false;
        for (const btnSelector of downloadButtons) {
          try {
            const downloadBtn = await workingPage.$(btnSelector);
            if (downloadBtn) {
              console.log(`[canva-browse] 🖱️ 다운로드 버튼 클릭: ${btnSelector}`);
              await downloadBtn.click();
              downloadClicked = true;
              break;
            }
          } catch (e) {
            // 버튼 클릭 실패는 무시하고 다음 시도
          }
        }

        if (!downloadClicked) {
          console.log(`[canva-browse] ⚠️ 다운로드 버튼을 찾지 못함, Share 버튼 시도`);

          // Share → Download 시도
          try {
            const shareBtn = await workingPage.$('button:has-text("Share")');
            if (shareBtn) {
              await shareBtn.click();
              await workingPage.waitForTimeout(1000);

              const dlMenuItem = await workingPage.$('li:has-text("Download"), [role="menuitem"]:has-text("Download")');
              if (dlMenuItem) {
                await dlMenuItem.click();
                downloadClicked = true;
              }
            }
          } catch (e) {
            console.log(`[canva-browse] ⚠️ Share → Download 시도 실패: ${e.message}`);
          }
        }

        if (downloadClicked) {
          // 다운로드가 트리거된 후 네트워크 모니터링으로 URL 포착 대기
          console.log("[canva-browse] ⏳ CDP로 비디오 URL 포착 대기 중...");

          // 최대 15초 동안 새로운 다운로드 대기
          const maxWait = 15000;
          const startWait = Date.now();

          while (Date.now() - startWait < maxWait) {
            if (caughtVideoUrls.size > beforeDownloads) {
              const newDownloads = caughtVideoUrls.size - beforeDownloads;
              console.log(`[canva-browse] ✅ CDP로 ${newDownloads}개 비디오 URL 포착됨`);
              downloadCount += newDownloads;
              downloadResults.push({
                template: i + 1,
                downloads: newDownloads,
                method: "CDP자동화",
              });
              break;
            }
            await page.waitForTimeout(500);
          }

          if (caughtVideoUrls.size === beforeDownloads) {
            console.log(`[canva-browse] ⚠️ ${maxWait}ms 내에 비디오 URL 포착되지 않음`);
          }
        }

        // 새 탭이 열렸으면 닫기
        if (newPage && !newPage.isClosed()) {
          await newPage.close();
        }

        // 다음 템플릿 처리 전 대기
        await page.waitForTimeout(DEFAULTS.waitAfterEach);
      } catch (templateError) {
        console.error(`[canva-browse] ❌ 템플릿 ${i + 1} 처리 실패: ${templateError.message}`);
        // 계속 진행
      }
    }

    // 검색 페이지로 돌아가기 (다음 키워드를 위해)
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1000);

    progressCallback?.({
      stage: "success",
      keyword,
      method: "CDP자동화",
      downloaded: downloadCount,
      message: `완료: ${keyword} (${downloadCount}개 다운로드)`,
    });

    return {
      keyword,
      success: downloadCount > 0,
      downloads: downloadCount,
      results: downloadResults,
      message: `${downloadCount}개 다운로드 완료`,
    };
  } catch (error) {
    console.error(`[canva-browse] ❌ 키워드 "${keyword}" 처리 중 오류: ${error.message}`);

    progressCallback?.({
      stage: "error",
      keyword,
      error: error.message,
      message: `오류: ${keyword} - ${error.message}`,
    });

    return {
      keyword,
      success: false,
      downloads: 0,
      error: error.message,
      message: `처리 실패: ${error.message}`,
    };
  }
}

// 해상도/포맷 등 모달 조작 (MP4 우선 선택)
async function selectDownloadOptions(editorPage, { downloadFormat = "MP4", resolutionLabel }) {
  console.log(`[canva-browse] 🎛️ 다운로드 옵션 설정: ${downloadFormat}, ${resolutionLabel}`);

  // 대기 시간 추가 - 모달 로딩 완료 대기
  await editorPage.waitForTimeout(2000);

  // 1. MP4 포맷 선택 (다양한 방법 시도)
  try {
    // 방법 1: role=combobox 기반
    const formatSelectors = [
      'select[name*="format"]', // 포맷 선택 드롭다운
      'select[aria-label*="format"]',
      '[data-testid*="format"] select',
      'div[role="combobox"]', // 일반 콤보박스
      'button[aria-haspopup="listbox"]', // 리스트박스 버튼
    ];

    for (const selector of formatSelectors) {
      try {
        const formatControl = await editorPage.$(selector);
        if (formatControl) {
          await formatControl.click();
          await editorPage.waitForTimeout(500);

          // MP4 옵션 찾기 및 클릭
          const mp4Options = [
            `option:has-text("MP4")`,
            `option:has-text("mp4")`,
            `[role="option"]:has-text("MP4")`,
            `[role="option"]:has-text("mp4")`,
            `li:has-text("MP4")`,
          ];

          for (const optSelector of mp4Options) {
            try {
              const mp4Option = await editorPage.$(optSelector);
              if (mp4Option) {
                await mp4Option.click();
                console.log(`[canva-browse] ✅ MP4 포맷 선택됨 (${selector} -> ${optSelector})`);
                await editorPage.waitForTimeout(1000);
                break;
              }
            } catch (e) {
              continue;
            }
          }
          break;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log(`[canva-browse] ⚠️ 포맷 선택 실패: ${e.message}`);
  }

  // 2. 해상도 선택
  try {
    const resolutionSelectors = [
      `input[type="radio"][value*="1920"]`,
      `input[type="radio"][aria-label*="${resolutionLabel}"]`,
      `[role="radio"]:has-text("${resolutionLabel}")`,
      `label:has-text("${resolutionLabel}") input`,
      `label:has-text("1920") input`,
    ];

    for (const selector of resolutionSelectors) {
      try {
        const radio = await editorPage.$(selector);
        if (radio) {
          await radio.click();
          console.log(`[canva-browse] ✅ 해상도 선택됨: ${resolutionLabel} (${selector})`);
          await editorPage.waitForTimeout(500);
          break;
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log(`[canva-browse] ⚠️ 해상도 선택 실패: ${e.message}`);
  }

  // 3. 최종 확인 - MP4가 선택되었는지 검증
  try {
    const selectedFormat = await editorPage.evaluate(() => {
      // 선택된 포맷 확인
      const selectedOption = document.querySelector('option[selected], [aria-selected="true"]');
      return selectedOption?.textContent || "";
    });

    if (selectedFormat.toLowerCase().includes("mp4")) {
      console.log(`[canva-browse] ✅ MP4 포맷 선택 확인됨: ${selectedFormat}`);
    } else {
      console.log(`[canva-browse] ⚠️ MP4 포맷이 선택되지 않았을 수 있음: ${selectedFormat}`);
    }
  } catch (e) {
    console.log(`[canva-browse] ⚠️ 포맷 선택 확인 실패: ${e.message}`);
  }
}

async function openFirstResultAndDownload(context, rootPage, keyword, indexInKeyword, opts, outDir, sender) {
  const safeKw = sanitizeFilename(keyword);
  const base = `${safeKw}_${String(indexInKeyword).padStart(2, "0")}_${opts.resolutionLabel.replace(/\s/g, "")}`;

  console.log(`[canva-browse] 🎬 Starting download process for: ${keyword} (${indexInKeyword})`);

  // 디버깅을 위한 스크린샷 디렉토리 생성
  const debugDir = path.join(outDir, "debug", `${safeKw}_${indexInKeyword}`);
  fs.mkdirSync(debugDir, { recursive: true });

  // CDN URL을 저장할 변수
  let detectedVideoUrl = null;
  let downloadAttempted = false;

  try {
    // 1) 네트워크 인터셉션 설정 - CDN URL 감지
    console.log(`[canva-browse] 🕸️ 네트워크 모니터링 시작`);

    // 컨텍스트 레벨에서 모든 페이지의 네트워크 요청 모니터링
    context.route("**/*", async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();

      // Export API 및 비디오 관련 요청 감지
      if (
        url.includes("/api/v1/exports") ||
        url.includes("/export") ||
        url.includes(".mp4") ||
        url.includes("video") ||
        url.includes("cloudfront") ||
        url.includes("amazonaws")
      ) {
        console.log(`[canva-browse] 🔍 관련 네트워크 요청 감지: ${method} ${url}`);
      }

      route.continue();
    });

    // 응답 모니터링 - 더 포괄적인 감지
    context.on("response", async (response) => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()["content-type"] || "";

      // 다운로드 시도 전에만 URL 추출
      if (!downloadAttempted) {
        // 1. Export/Download API 응답
        if (
          (url.includes("/api/v1/exports") || url.includes("/export") || url.includes("/download") || url.includes("/render")) &&
          (status === 200 || status === 201 || status === 302)
        ) {
          console.log(`[canva-browse] 📡 Export API 응답 감지: ${status} ${url}`);

          try {
            let body;
            if (contentType.includes("application/json")) {
              body = await response.json();
            } else {
              body = await response.text();
            }

            const extractedUrl = extractVideoUrlFromResponse(url, body);
            if (extractedUrl && !detectedVideoUrl) {
              detectedVideoUrl = extractedUrl;
              console.log(`[canva-browse] 🎯 Export API에서 비디오 URL 추출: ${extractedUrl}`);
            }
          } catch (e) {
            console.log(`[canva-browse] ⚠️ Export API 응답 분석 실패: ${e.message}`);
          }
        }

        // 2. 직접 비디오 파일 응답 (CDN)
        else if (url.includes(".mp4") && status === 200) {
          console.log(`[canva-browse] 🎬 직접 MP4 파일 감지: ${url}`);
          if (!detectedVideoUrl && url.includes("http")) {
            detectedVideoUrl = url;
            console.log(`[canva-browse] 🎯 직접 비디오 URL 감지: ${url}`);
          }
        }

        // 3. CDN 응답 (CloudFront, AWS 등)
        else if ((url.includes("cloudfront") || url.includes("amazonaws") || url.includes("canva-")) && status === 200) {
          console.log(`[canva-browse] 🌐 CDN 응답 감지: ${status} ${url}`);

          try {
            const body = await response.text();
            const extractedUrl = extractVideoUrlFromResponse(url, body);
            if (extractedUrl && !detectedVideoUrl) {
              detectedVideoUrl = extractedUrl;
              console.log(`[canva-browse] 🎯 CDN에서 비디오 URL 추출: ${extractedUrl}`);
            } else if (url.includes(".mp4") && !detectedVideoUrl) {
              detectedVideoUrl = url;
              console.log(`[canva-browse] 🎯 CDN에서 직접 비디오 URL: ${url}`);
            }
          } catch (e) {
            // CDN 응답 분석 실패는 무시 (바이너리 파일일 수 있음)
            if (url.includes(".mp4") && !detectedVideoUrl) {
              detectedVideoUrl = url;
              console.log(`[canva-browse] 🎯 CDN MP4 URL (바이너리): ${url}`);
            }
          }
        }

        // 4. 리다이렉트 응답
        else if ((status === 301 || status === 302) && response.headers()["location"]) {
          const redirectUrl = response.headers()["location"];
          console.log(`[canva-browse] 🔄 리다이렉트 감지: ${url} → ${redirectUrl}`);

          if (redirectUrl.includes(".mp4") && !detectedVideoUrl) {
            detectedVideoUrl = redirectUrl;
            console.log(`[canva-browse] 🎯 리다이렉트에서 비디오 URL: ${redirectUrl}`);
          }
        }
      }
    });

    // 2) 비디오 템플릿 전용 검색 - 항상 비디오 템플릿만 검색
    const searchUrl = `https://www.canva.com/templates/search/videos/?query=${encodeURIComponent(keyword)}`;
    console.log(`[canva-browse] 🔍 비디오 전용 검색 URL: ${searchUrl}`);

    await rootPage.goto(searchUrl, { waitUntil: "domcontentloaded" });
    console.log(`[canva-browse] ⏳ 페이지 로딩 대기 중...`);
    await rootPage.waitForLoadState("networkidle");

    // 검색 페이지 스크린샷 저장
    await rootPage.screenshot({ path: path.join(debugDir, "01_search_page.png"), fullPage: true });
    console.log(`[canva-browse] 📸 검색 페이지 스크린샷 저장됨`);

    // 추가 안정화 대기 (JavaScript 완전 로딩)
    await rootPage.waitForTimeout(3000);
    console.log(`[canva-browse] ✅ 페이지 안정화 완료`);

    // 3) 결과 카드(템플릿 링크) 대기 - 다중 선택기 시도
    const linkSelectors = [
      // 캔바 비디오 템플릿 전용 선택기
      "a[href*='/design/'][href*='DAF']", // 비디오 템플릿 (DAF 포함)
      "a[href*='/design/'][data-testid*='video']", // 비디오 테스트 ID
      "[data-testid*='video-template'] a", // 비디오 템플릿 전용

      // 일반 템플릿 선택기 (우선순위 순)
      "a[href*='/design/']", // 기본 디자인 링크
      "[data-testid*='template'] a", // 템플릿 테스트 ID 기반
      "[data-testid*='design'] a", // 디자인 테스트 ID 기반
      "a[data-testid*='template-card']", // 템플릿 카드 링크
      ".template-card a", // 클래스 기반 템플릿 카드

      // 추가 포괄적 선택기
      "div[role='button'] a[href*='/design/']", // 버튼 역할의 디자인 링크만
      "article a[href*='/design/']", // 아티클 내 디자인 링크만
      "[aria-label*='template'] a", // ARIA 라벨 기반
      "[aria-label*='Template'] a", // 대문자 Template
      "[data-qa*='template'] a", // QA 테스트용 속성
      ".grid a[href*='/design/']", // 그리드 내 디자인 링크
      ".search-result a[href*='/design/']", // 검색 결과 내 디자인 링크
    ];

    let candidates = [];
    let usedSelector = "";

    console.log(`[canva-browse] 🎯 템플릿 링크 검색 중...`);

    for (const selector of linkSelectors) {
      try {
        console.log(`[canva-browse] 🔍 선택기 시도: ${selector}`);
        await rootPage.waitForSelector(selector, { timeout: 5000 });
        const tempCandidates = await rootPage.$$(selector);

        if (tempCandidates && tempCandidates.length > 0) {
          // 비디오 관련 선택기는 우선적으로 사용
          if (selector.includes("video") || selector.includes("DAF")) {
            candidates = tempCandidates;
            usedSelector = selector;
            console.log(`[canva-browse] 🎥 비디오 템플릿 우선 선택: ${tempCandidates.length}개 (선택기: ${selector})`);
            break;
          }

          // 일반 선택기는 첫 번째로 성공한 것을 사용
          if (!candidates || candidates.length === 0) {
            candidates = tempCandidates;
            usedSelector = selector;
            console.log(`[canva-browse] ✅ ${tempCandidates.length}개 템플릿 발견 (선택기: ${selector})`);

            // 비디오 관련이 아닌 경우 계속 검색해서 더 좋은 선택기가 있는지 확인
            if (!selector.includes("video") && !selector.includes("DAF")) {
              continue; // 더 좋은 선택기가 있을 수 있으므로 계속 진행
            } else {
              break; // 비디오 관련 선택기면 즉시 사용
            }
          }
        }
      } catch (e) {
        console.log(`[canva-browse] ❌ 선택기 실패: ${selector} - ${e.message}`);
        continue;
      }
    }

    // 추가 필터링: 실제 디자인 링크인지 검증
    if (candidates && candidates.length > 0) {
      console.log(`[canva-browse] 🔍 템플릿 링크 검증 시작...`);
      const validCandidates = [];

      for (let i = 0; i < Math.min(candidates.length, 5); i++) {
        try {
          const href = await candidates[i].getAttribute("href");
          if (href && (href.includes("/design/") || href.includes("canva.com"))) {
            console.log(`[canva-browse] ✅ 유효한 템플릿 링크 ${i + 1}: ${href}`);
            validCandidates.push(candidates[i]);
          } else {
            console.log(`[canva-browse] ❌ 무효한 링크 ${i + 1}: ${href}`);
          }
        } catch (e) {
          console.log(`[canva-browse] ⚠️ 링크 검증 실패 ${i + 1}: ${e.message}`);
        }
      }

      if (validCandidates.length > 0) {
        candidates = validCandidates;
        console.log(`[canva-browse] ✅ 최종 검증된 템플릿: ${validCandidates.length}개`);
      }
    }

    if (!candidates || candidates.length === 0) {
      console.log(`[canva-browse] ⚠️ 주요 선택기로 템플릿을 찾지 못함, 대안적 방법 시도 중...`);

      // 대안적 방법 1: 페이지의 모든 링크 검색
      try {
        console.log(`[canva-browse] 🔍 대안 1: 모든 링크 검색`);
        const allLinks = await rootPage.$$("a");
        const designLinks = [];

        for (const link of allLinks.slice(0, 20)) {
          // 처음 20개만 검사
          try {
            const href = await link.getAttribute("href");
            if (href && href.includes("/design/")) {
              designLinks.push(link);
              console.log(`[canva-browse] 🔗 디자인 링크 발견: ${href.substring(0, 60)}...`);
            }
          } catch (e) {
            // 링크 검사 실패는 무시
          }
        }

        if (designLinks.length > 0) {
          candidates = designLinks;
          usedSelector = "대안검색_모든링크";
          console.log(`[canva-browse] ✅ 대안적 방법으로 ${designLinks.length}개 템플릿 발견`);
        }
      } catch (e) {
        console.log(`[canva-browse] ❌ 대안 검색 실패: ${e.message}`);
      }

      // 대안적 방법 2: JavaScript로 템플릿 검색
      if (!candidates || candidates.length === 0) {
        try {
          console.log(`[canva-browse] 🔍 대안 2: JavaScript로 템플릿 검색`);
          const jsResults = await rootPage.evaluate(() => {
            // 다양한 방법으로 템플릿 링크 찾기
            const links = [];

            // href에 'design'이 포함된 모든 링크
            document.querySelectorAll('a[href*="design"]').forEach((link, idx) => {
              if (idx < 10) links.push(link.href); // 처음 10개만
            });

            // data 속성에 'template' 또는 'design'이 포함된 요소 내의 링크
            document.querySelectorAll('[data-testid*="template"] a, [data-testid*="design"] a').forEach((link, idx) => {
              if (idx < 10) links.push(link.href); // 처음 10개만
            });

            return links;
          });

          if (jsResults && jsResults.length > 0) {
            console.log(`[canva-browse] ✅ JavaScript로 ${jsResults.length}개 링크 발견`);
            // 첫 번째 유효한 링크로 가상 클릭 대상 생성
            candidates = [await rootPage.$(`a[href="${jsResults[0]}"]`)].filter(Boolean);
            usedSelector = "대안검색_JavaScript";
          }
        } catch (e) {
          console.log(`[canva-browse] ❌ JavaScript 검색 실패: ${e.message}`);
        }
      }

      // 여전히 템플릿을 찾지 못한 경우
      if (!candidates || candidates.length === 0) {
        await rootPage.screenshot({ path: path.join(debugDir, "02_no_templates_final.png"), fullPage: true });
        console.log(`[canva-browse] 📸 최종 템플릿 없음 스크린샷 저장됨`);

        // 페이지 내용 로깅
        const pageContent = await rootPage.content();
        const contentSnippet = pageContent.substring(0, 1000);
        console.log(`[canva-browse] 📄 페이지 내용 (처음 1000자): ${contentSnippet}`);

        sendProgressTo(sender, { stage: "no_results", keyword });
        return { ok: false };
      }
    }

    console.log(`[canva-browse] 🎯 첫 번째 템플릿 선택 준비 (총 ${candidates.length}개 중)`);

    // 템플릿 목록 스크린샷
    await rootPage.screenshot({ path: path.join(debugDir, "02_templates_found.png"), fullPage: true });
    console.log(`[canva-browse] 📸 템플릿 발견 스크린샷 저장됨`);

    // 4) 첫 결과 클릭 → 새 팝업(에디터) 기대
    console.log(`[canva-browse] 🖱️ 첫 번째 템플릿 클릭 시도`);

    // 클릭하기 전 템플릿 상세 로깅
    try {
      const templateHref = await candidates[0].getAttribute("href");
      console.log(`[canva-browse] 🔗 템플릿 링크: ${templateHref}`);
    } catch (e) {
      console.log(`[canva-browse] ⚠️ 템플릿 링크 정보 가져오기 실패: ${e.message}`);
    }

    const [editorPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 15000 }),
      candidates[0].click({ button: "left" }),
    ]).catch((e) => {
      console.log(`[canva-browse] ❌ 템플릿 클릭 실패: ${e.message}`);
      return [null];
    });

    if (!editorPage) {
      await rootPage.screenshot({ path: path.join(debugDir, "03_template_click_failed.png"), fullPage: true });
      console.log(`[canva-browse] 📸 템플릿 클릭 실패 스크린샷 저장됨`);
      console.log(`[canva-browse] ❌ 에디터 페이지가 열리지 않음`);
      sendProgressTo(sender, { stage: "editor_open_fail", keyword });
      return { ok: false };
    }

    console.log(`[canva-browse] ✅ 에디터 페이지 성공적으로 열림: ${editorPage.url()}`);

    // 에디터 로딩 대기
    console.log(`[canva-browse] ⏳ 에디터 페이지 로딩 대기...`);
    await editorPage.waitForLoadState("domcontentloaded");
    await editorPage.waitForLoadState("networkidle");

    // 에디터 로딩 완료 스크린샷
    await editorPage.screenshot({ path: path.join(debugDir, "03_editor_loaded.png"), fullPage: true });
    console.log(`[canva-browse] 📸 에디터 로딩 완료 스크린샷 저장됨`);

    // 3) 다운로드 버튼 진입 (직접 Download or Share → Download)
    console.log(`[canva-browse] 🔍 다운로드 버튼 탐지 시작`);
    let opened = false;

    // 방법 1: 직접 다운로드 버튼 찾기
    try {
      console.log(`[canva-browse] 🎯 방법 1: 직접 다운로드 버튼 검색`);
      const dlBtn = editorPage.getByRole("button", {
        name: (n) => n && (n.includes("Download") || n.includes("다운로드")),
      });

      const isVisible = await dlBtn.isVisible();
      console.log(`[canva-browse] 👀 직접 다운로드 버튼 가시성: ${isVisible}`);

      if (isVisible) {
        console.log(`[canva-browse] 🖱️ 직접 다운로드 버튼 클릭 시도`);
        await dlBtn.click();
        opened = true;
        console.log(`[canva-browse] ✅ 직접 다운로드 버튼 클릭 성공`);
      }
    } catch (e) {
      console.log(`[canva-browse] ❌ 직접 다운로드 버튼 클릭 실패: ${e.message}`);
    }

    // 방법 2: Share 버튼을 통한 다운로드
    if (!opened) {
      try {
        console.log(`[canva-browse] 🎯 방법 2: Share 버튼을 통한 다운로드`);
        const share = editorPage.getByRole("button", {
          name: (n) => n && (n.includes("Share") || n.includes("공유")),
        });

        const shareVisible = await share.isVisible();
        console.log(`[canva-browse] 👀 Share 버튼 가시성: ${shareVisible}`);

        if (shareVisible) {
          console.log(`[canva-browse] 🖱️ Share 버튼 클릭 시도`);
          await share.click();
          await editorPage.waitForTimeout(300);

          // Share 클릭 후 스크린샷
          await editorPage.screenshot({ path: path.join(debugDir, "04_after_share_click.png"), fullPage: true });
          console.log(`[canva-browse] 📸 Share 클릭 후 스크린샷 저장됨`);

          const dlMenu = editorPage.getByRole("menuitem", {
            name: (n) => n && (n.includes("Download") || n.includes("다운로드")),
          });

          const menuVisible = await dlMenu.isVisible();
          console.log(`[canva-browse] 👀 다운로드 메뉴 가시성: ${menuVisible}`);

          if (menuVisible) {
            console.log(`[canva-browse] 🖱️ 다운로드 메뉴 클릭 시도`);
            await dlMenu.click();
            opened = true;
            console.log(`[canva-browse] ✅ Share를 통한 다운로드 메뉴 클릭 성공`);
          }
        }
      } catch (e) {
        console.log(`[canva-browse] ❌ Share를 통한 다운로드 실패: ${e.message}`);
      }
    }

    if (!opened) {
      // 다운로드 버튼 찾기 실패 시 페이지의 모든 버튼 로깅
      try {
        console.log(`[canva-browse] 🔍 페이지의 모든 버튼 탐색 중...`);
        const allButtons = await editorPage.locator("button").all();
        console.log(`[canva-browse] 📊 총 ${allButtons.length}개의 버튼 발견`);

        for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
          try {
            const buttonText = await allButtons[i].textContent();
            const buttonRole = await allButtons[i].getAttribute("role");
            console.log(`[canva-browse] 🔘 버튼 ${i + 1}: "${buttonText}" (role: ${buttonRole})`);
          } catch (e) {
            console.log(`[canva-browse] 🔘 버튼 ${i + 1}: 정보 가져오기 실패`);
          }
        }
      } catch (e) {
        console.log(`[canva-browse] ❌ 버튼 탐색 실패: ${e.message}`);
      }

      await editorPage.screenshot({ path: path.join(debugDir, "04_download_button_not_found.png"), fullPage: true });
      console.log(`[canva-browse] 📸 다운로드 버튼 찾기 실패 스크린샷 저장됨`);

      await editorPage.close().catch(() => {});
      console.log(`[canva-browse] ❌ 다운로드 패널 열기 실패 - 에디터 페이지 닫음`);
      sendProgressTo(sender, { stage: "download_panel_fail", keyword });
      return { ok: false };
    }

    // 4) 옵션 선택
    console.log(`[canva-browse] ⚙️ 다운로드 옵션 선택 시작`);
    await selectDownloadOptions(editorPage, opts);
    console.log(`[canva-browse] ✅ 다운로드 옵션 선택 완료`);

    // 옵션 선택 후 스크린샷
    await editorPage.screenshot({ path: path.join(debugDir, "05_options_selected.png"), fullPage: true });
    console.log(`[canva-browse] 📸 옵션 선택 후 스크린샷 저장됨`);

    // 5) 다운로드 시도 - CDN 방식 우선, UI 방식 폴백
    console.log(`[canva-browse] 📥 다운로드 시작 준비`);
    downloadAttempted = true;

    const finalPath = await new Promise(async (resolve) => {
      let saved = null;

      // 방법 1: CDN 직접 다운로드 시도 (네트워크에서 감지된 URL 사용)
      if (detectedVideoUrl) {
        console.log(`[canva-browse] 🌐 CDN 직접 다운로드 시도: ${detectedVideoUrl}`);

        try {
          const ext = path.extname(detectedVideoUrl) || ".mp4";
          const dest = path.join(outDir, `${base}${ext}`);

          const cdnResult = await downloadFromCDN(detectedVideoUrl, dest, (progress) => {
            sendProgressTo(sender, {
              stage: "cdn_download",
              keyword,
              progress: progress.progress,
              downloadedSize: progress.downloadedSize,
              totalSize: progress.totalSize,
            });
          });

          if (cdnResult.success) {
            console.log(`[canva-browse] ✅ CDN 다운로드 성공: ${dest}`);
            saved = cdnResult.filePath;

            try {
              await editorPage.close();
            } catch (closeError) {
              console.log(`[canva-browse] ⚠️ 에디터 페이지 닫기 실패: ${closeError.message}`);
            }

            resolve(saved);
            return;
          }
        } catch (cdnError) {
          console.log(`[canva-browse] ❌ CDN 다운로드 실패, UI 방식으로 폴백: ${cdnError.message}`);
        }
      } else {
        console.log(`[canva-browse] ⚠️ 네트워크 모니터링에서 비디오 URL이 감지되지 않음`);
        console.log(`[canva-browse] 🔍 다운로드 버튼 클릭 전 추가 네트워크 모니터링 활성화`);

        // 추가 네트워크 모니터링 설정 - 다운로드 시도 중
        const additionalUrlPromise = new Promise((urlResolve) => {
          const timeout = setTimeout(() => urlResolve(null), 10000); // 10초 타임아웃

          const responseListener = async (response) => {
            const url = response.url();
            const status = response.status();

            if ((url.includes(".mp4") || url.includes("/export") || url.includes("/download")) && status === 200) {
              console.log(`[canva-browse] 🎯 다운로드 중 추가 URL 감지: ${url}`);
              clearTimeout(timeout);
              context.off("response", responseListener);

              if (url.includes(".mp4")) {
                urlResolve(url);
              } else {
                try {
                  const body = await response.text();
                  const extractedUrl = extractVideoUrlFromResponse(url, body);
                  urlResolve(extractedUrl);
                } catch (e) {
                  urlResolve(null);
                }
              }
            }
          };

          context.on("response", responseListener);
        });

        // 병렬로 추가 URL 탐지 실행
        additionalUrlPromise.then(async (additionalUrl) => {
          if (additionalUrl && !saved) {
            console.log(`[canva-browse] 🌐 추가 감지된 URL로 CDN 다운로드 재시도: ${additionalUrl}`);
            try {
              const ext = path.extname(additionalUrl) || ".mp4";
              const dest = path.join(outDir, `${base}${ext}`);

              const cdnResult = await downloadFromCDN(additionalUrl, dest, (progress) => {
                sendProgressTo(sender, {
                  stage: "cdn_download_retry",
                  keyword,
                  progress: progress.progress,
                  downloadedSize: progress.downloadedSize,
                  totalSize: progress.totalSize,
                });
              });

              if (cdnResult.success && !saved) {
                console.log(`[canva-browse] ✅ 추가 CDN 다운로드 성공: ${dest}`);
                saved = cdnResult.filePath;
                resolve(saved);
              }
            } catch (e) {
              console.log(`[canva-browse] ❌ 추가 CDN 다운로드 실패: ${e.message}`);
            }
          }
        });
      }

      // 방법 2: 기존 UI 기반 다운로드 (CDN 방식 실패 시 폴백)
      console.log(`[canva-browse] 🔄 UI 기반 다운로드로 폴백`);

      try {
        console.log(`[canva-browse] ⏳ 다운로드 이벤트 리스너 등록 (120초 타임아웃)`);
        const downloadPromise = context.waitForEvent("download", { timeout: 120000 });

        const finalBtn = editorPage.getByRole("button", {
          name: (n) => n && (n.includes("Download") || n.includes("다운로드")),
        });

        const finalBtnVisible = await finalBtn.isVisible();
        console.log(`[canva-browse] 👀 최종 다운로드 버튼 가시성: ${finalBtnVisible}`);

        if (!finalBtnVisible) {
          console.log(`[canva-browse] ❌ 최종 다운로드 버튼을 찾을 수 없음`);
          await editorPage.screenshot({ path: path.join(debugDir, "06_final_button_not_found.png"), fullPage: true });
          console.log(`[canva-browse] 📸 최종 버튼 찾기 실패 스크린샷 저장됨`);
          resolve(null);
          return;
        }

        console.log(`[canva-browse] 🖱️ 최종 다운로드 버튼 클릭`);
        await finalBtn.click();

        // 다운로드 시작 후 스크린샷
        await editorPage.screenshot({ path: path.join(debugDir, "06_download_started.png"), fullPage: true });
        console.log(`[canva-browse] 📸 다운로드 시작 스크린샷 저장됨`);

        console.log(`[canva-browse] ⏳ 다운로드 이벤트 대기 중...`);
        const download = await downloadPromise;
        console.log(`[canva-browse] ✅ 다운로드 이벤트 수신됨`);

        const suggested = (download.suggestedFilename() || "").trim();
        console.log(`[canva-browse] 📁 제안된 파일명: "${suggested}"`);

        const ext = path.extname(suggested) || (opts.downloadFormat.toLowerCase() === "mp4" ? ".mp4" : ".bin");
        console.log(`[canva-browse] 🏷️ 파일 확장자: "${ext}"`);

        const dest = path.join(outDir, `${base}${ext}`);
        const temp = path.join(outDir, `${base}.tmp`);

        console.log(`[canva-browse] 💾 임시 파일 저장: ${temp}`);
        await download.saveAs(temp);

        console.log(`[canva-browse] 🔄 파일명 변경: ${temp} → ${dest}`);
        fs.renameSync(temp, dest);

        // 다운로드된 파일 정보 검증
        try {
          const stat = fs.statSync(dest);
          console.log(`[canva-browse] ✅ UI 기반 파일 저장 성공: ${dest} (크기: ${stat.size} bytes)`);
          saved = dest;
        } catch (statError) {
          console.log(`[canva-browse] ❌ 파일 저장 검증 실패: ${statError.message}`);
          saved = null;
        }
      } catch (e) {
        console.log(`[canva-browse] ❌ UI 기반 다운로드 프로세스 오류: ${e.message}`);

        // 오류 시 스크린샷
        try {
          await editorPage.screenshot({ path: path.join(debugDir, "06_download_error.png"), fullPage: true });
          console.log(`[canva-browse] 📸 다운로드 오류 스크린샷 저장됨`);
        } catch (screenshotError) {
          console.log(`[canva-browse] ⚠️ 오류 스크린샷 저장 실패: ${screenshotError.message}`);
        }

        saved = null;
      } finally {
        try {
          console.log(`[canva-browse] 🔒 에디터 페이지 닫기`);
          await editorPage.close();
        } catch (closeError) {
          console.log(`[canva-browse] ⚠️ 에디터 페이지 닫기 실패: ${closeError.message}`);
        }
        resolve(saved);
      }
    });

    if (!finalPath) {
      console.log(`[canva-browse] ❌ 다운로드 실패 - 최종 경로 없음`);
      sendProgressTo(sender, { stage: "download_timeout", keyword });
      return { ok: false };
    }

    console.log(`[canva-browse] ✅ 다운로드 성공: ${finalPath}`);

    // 완료 이벤트
    try {
      const stat = fs.statSync(finalPath);
      sendDownloadedTo(sender, {
        keyword,
        path: finalPath,
        size: stat.size,
      });
    } catch {
      sendDownloadedTo(sender, {
        keyword,
        path: finalPath,
        size: 0,
      });
    }

    // 살짝 대기(서버 보호/안정화)
    await rootPage.waitForTimeout(DEFAULTS.waitAfterEach);
    return { ok: true, path: finalPath };
  } catch (error) {
    console.error(`[canva-browse] ❌ 전체 프로세스 오류: ${error.message}`);
    sendProgressTo(sender, { stage: "process_error", keyword, error: error.message });
    return { ok: false };
  }
}

// ============================== 새로운 공개 API (IPC) - Remote Chrome 기반 ==============================

// Chrome 세션 시작 및 로그인 창 열기
async function handleOpenBrowser(event, options = {}) {
  console.log("[canva-browse] 🚀 Remote Chrome 세션 시작 요청");

  try {
    // Remote Chrome 시작
    await startRemoteChrome();

    // Puppeteer로 연결
    await connectToRemoteChrome();

    // 재사용 가능한 페이지 생성
    const page = await getReusablePage();

    // 캔바 메인 페이지로 이동 (로그인 유도)
    await page.goto("https://www.canva.com/", {
      waitUntil: "domcontentloaded",
      timeout: DEFAULTS.pageTimeout,
    });

    console.log("[canva-browse] ✅ Remote Chrome 세션 준비 완료 - 수동 로그인 가능");

    return {
      ok: true,
      message: "Remote Chrome이 시작되었습니다. 브라우저에서 로그인하세요.",
      port: DEFAULTS.remotePort,
    };
  } catch (error) {
    console.error("[canva-browse] ❌ Remote Chrome 시작 실패:", error);
    return {
      ok: false,
      message: `Chrome 시작 실패: ${error.message}`,
    };
  }
}

// 향상된 다운로드 (UI 호환) - CDN 방식 우선
async function handleEnhancedDownload(event, payload) {
  const startTime = performance.now();
  console.log("[canva-browse] 🚀 Enhanced Download 시작");
  console.log("[canva-browse] 📋 입력 파라미터:", JSON.stringify(payload, null, 2));

  const sender = event?.sender;
  const { keywords = [], options = {} } = payload || {};

  console.log(`[canva-browse] 🔍 키워드 개수: ${keywords.length}`);
  console.log(`[canva-browse] ⚙️ 옵션:`, options);

  if (!Array.isArray(keywords) || keywords.length === 0) {
    console.log("[canva-browse] ❌ 키워드 배열이 없음");
    return { success: false, message: "키워드가 제공되지 않았습니다." };
  }

  try {
    // UI 진행 상황 알림
    console.log(`[canva-browse] 📡 UI에 시작 알림 전송`);
    sendProgressTo(sender, {
      stage: "start",
      message: `${keywords.length}개 키워드로 CDN 기반 다운로드 시작`,
      keywords: keywords.length,
      method: "CDN우선",
    });

    // 기존 bulkDownload 로직 재사용하되 응답 형식을 UI에 맞게 조정
    console.log(`[canva-browse] 🔄 bulkDownload 로직 호출 중...`);
    const bulkResult = await handleBulkDownload(event, payload);
    const elapsedTime = Math.round(performance.now() - startTime);

    console.log(`[canva-browse] 📊 bulkDownload 결과 (${elapsedTime}ms):`, bulkResult);

    if (bulkResult && bulkResult.ok && bulkResult.downloaded > 0) {
      console.log(`[canva-browse] ✅ Enhanced Download 성공: ${bulkResult.downloaded}개 파일 (${elapsedTime}ms)`);

      // 최종 완료 알림
      sendDownloadedTo(sender, {
        keyword: keywords.join(", "),
        downloaded: bulkResult.downloaded,
        methods: { CDN직접다운로드: bulkResult.downloaded },
        message: `CDN 방식으로 ${bulkResult.downloaded}개 파일 다운로드 완료`,
      });

      // UI 호환 응답 형식
      return {
        success: true,
        downloaded: bulkResult.downloaded,
        total: bulkResult.total,
        outDir: bulkResult.outDir,
        methods: {
          CDN직접다운로드: bulkResult.downloaded,
          UI폴백: 0,
        },
        message: `CDN 방식으로 ${bulkResult.downloaded}개 파일 다운로드 완료 (${elapsedTime}ms)`,
        elapsed: elapsedTime,
      };
    } else {
      console.log("[canva-browse] ❌ Enhanced Download 실패 - bulkResult:", bulkResult);
      console.log(`[canva-browse] 📊 실패 원인 분석: ok=${bulkResult?.ok}, downloaded=${bulkResult?.downloaded}`);

      return {
        success: false,
        downloaded: 0,
        total: keywords.length,
        message: "다운로드에 실패했습니다. 로그인 상태나 네트워크를 확인해주세요.",
        elapsed: elapsedTime,
        debug: {
          bulkResult: bulkResult,
          keywords: keywords,
          options: options,
        },
      };
    }
  } catch (error) {
    const elapsedTime = Math.round(performance.now() - startTime);
    console.error("[canva-browse] ❌ Enhanced Download 오류:", error);
    console.error("[canva-browse] 🔍 오류 스택:", error.stack);

    sendProgressTo(sender, {
      stage: "error",
      message: `Enhanced Download 오류: ${error.message}`,
      error: error.message,
    });

    return {
      success: false,
      downloaded: 0,
      total: keywords.length,
      message: `오류: ${error.message}`,
      error: error.message,
      elapsed: elapsedTime,
      debug: {
        keywords: keywords,
        options: options,
        stack: error.stack,
      },
    };
  }
}

// 테스트용 단일 키워드 다운로드
async function handleTestDownload(event, payload) {
  console.log("[canva-browse] 🧪 테스트 다운로드 시작:", payload);

  const testKeyword = payload?.keyword || "cat";
  const testPayload = {
    keywords: [testKeyword],
    options: {
      perKeywordLimit: 1,
      downloadFormat: "MP4",
      resolutionLabel: "1920 × 1080",
      headless: false, // 테스트 시 브라우저 표시
    },
  };

  console.log(`[canva-browse] 🧪 "${testKeyword}" 키워드로 테스트 다운로드 실행`);

  try {
    const result = await handleEnhancedDownload(event, testPayload);
    console.log("[canva-browse] 🧪 테스트 다운로드 결과:", result);
    return result;
  } catch (error) {
    console.error("[canva-browse] 🧪 테스트 다운로드 오류:", error);
    return {
      success: false,
      message: `테스트 실패: ${error.message}`,
      error: error.message,
    };
  }
}

async function handleBulkDownload(event, payload) {
  if (!playwright) playwright = require("playwright");
  const sender = event?.sender;

  const { keywords = [], options = {} } = payload || {};

  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("keywords is empty");
  }

  const opts = {
    headless: options.headless ?? DEFAULTS.headless,
    slowMo: options.slowMo ?? DEFAULTS.slowMo,
    downloadFormat: options.downloadFormat ?? DEFAULTS.downloadFormat,
    resolutionLabel: options.resolutionLabel ?? DEFAULTS.resolutionLabel,
    perKeywordLimit: options.perKeywordLimit ?? DEFAULTS.perKeywordLimit,
    waitAfterEach: options.waitAfterEach ?? DEFAULTS.waitAfterEach,
  };

  const profile = getChromeProfileDir();
  const outDir = getOutRoot();

  let context, page;

  // 🔒 협력업체 방식: 최강 보안 우회 옵션 사용
  const launchOptions = [
    {
      name: "협력업체 최강 보안 우회",
      options: {
        headless: opts.headless,
        slowMo: opts.slowMo,
        acceptDownloads: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          `--user-data-dir=${profile}`,
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-web-security',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          '--accept-lang=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        ],
        ignoreDefaultArgs: [
          '--enable-automation',
          '--enable-blink-features=AutomationControlled'
        ]
      },
    },
    {
      name: "기본 Chrome 백업",
      options: {
        headless: false,
        acceptDownloads: true,
        args: [
          "--no-sandbox", 
          "--disable-dev-shm-usage", 
          "--disable-web-security",
          `--user-data-dir=${profile}`
        ],
      },
    },
  ];

  // persistent context 실패 시 임시 브라우저 시도
  const tempLaunchOptions = [
    {
      name: "임시 브라우저",
      usePersistent: false,
      options: {
        headless: false,
        args: ["--no-sandbox", "--disable-web-security"],
      },
    },
  ];

  let lastError;
  let browser;

  // 먼저 persistent context 시도
  for (const { name, options } of launchOptions) {
    try {
      console.log(`[canva-browse] ${name}으로 persistent context 실행 시도...`);

      context = await playwright.chromium.launchPersistentContext(profile, options);

      // 컨텍스트가 닫혔는지 확인
      if (context.pages().length === 0) {
        throw new Error("컨텍스트가 즉시 닫혔습니다");
      }

      page = await context.newPage();
      
      // 🔒 협력업체의 최강 탐지 방지 스크립트 적용
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // 자동화 감지 변수들 완전 제거
        const automationProps = [
          '$cdc_asdjflasutopfhvcZLmcfl_',
          '$chrome_asyncScriptInfo',
          '__$webdriverAsyncExecutor',
          '__driver_evaluate',
          '__webdriver_evaluate',
          '__selenium_evaluate'
        ];
        
        automationProps.forEach(prop => {
          delete window[prop];
          Object.defineProperty(window, prop, {
            get: () => undefined,
            set: () => {},
            configurable: true
          });
        });
      });
      
      await ensureLogin(page);

      console.log(`[canva-browse] ${name}으로 브라우저 실행 성공!`);
      break;
    } catch (error) {
      console.warn(`[canva-browse] ${name} 실행 실패:`, error.message);
      lastError = error;

      if (context) {
        try {
          await context.close();
        } catch (closeError) {
          console.warn("[canva-browse] Error closing failed context:", closeError);
        }
        context = null;
      }
    }
  }

  // persistent context 모두 실패 시 임시 브라우저 시도
  if (!context || !page) {
    console.warn("[canva-browse] 모든 persistent context 실패, 임시 브라우저 시도...");

    for (const { name, usePersistent, options } of tempLaunchOptions) {
      try {
        console.log(`[canva-browse] ${name} 실행 시도...`);

        browser = await playwright.chromium.launch(options);
        context = await browser.newContext({ acceptDownloads: true });
        page = await context.newPage();
        
        // 🔒 협력업체의 최강 탐지 방지 스크립트 적용 (임시 브라우저)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          
          // 자동화 감지 변수들 완전 제거
          const automationProps = [
            '$cdc_asdjflasutopfhvcZLmcfl_',
            '$chrome_asyncScriptInfo',
            '__$webdriverAsyncExecutor',
            '__driver_evaluate',
            '__webdriver_evaluate',
            '__selenium_evaluate'
          ];
          
          automationProps.forEach(prop => {
            delete window[prop];
            Object.defineProperty(window, prop, {
              get: () => undefined,
              set: () => {},
              configurable: true
            });
          });
        });

        console.log(`[canva-browse] ${name} 실행 성공! (로그인 필요)`);

        // 임시 브라우저는 로그인이 필요할 수 있음
        await page.goto("https://www.canva.com", { waitUntil: "domcontentloaded" });

        break;
      } catch (error) {
        console.warn(`[canva-browse] ${name} 실행 실패:`, error.message);
        lastError = error;

        if (context) {
          try {
            await context.close();
          } catch (closeError) {
            console.warn("[canva-browse] Error closing temp context:", closeError);
          }
          context = null;
        }
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.warn("[canva-browse] Error closing temp browser:", closeError);
          }
          browser = null;
        }
      }
    }
  }

  // 모든 옵션이 실패한 경우
  if (!context || !page) {
    throw new Error(`모든 브라우저 실행 옵션 실패. 마지막 오류: ${lastError?.message || "알 수 없는 오류"}`);
  }

  let done = 0;
  const total = keywords.length * opts.perKeywordLimit;

  try {
    // 메인 다운로드 루프
    for (const kw of keywords) {
      let got = 0;
      let attempts = 0;
      while (got < opts.perKeywordLimit && attempts < Math.max(opts.perKeywordLimit * 3, 3)) {
        attempts += 1;

        sendProgressTo(sender, {
          stage: "start",
          keyword: kw,
          done,
          total,
          attempt: attempts,
        });

        try {
          const r = await openFirstResultAndDownload(context, page, kw, got + 1, opts, outDir, sender);
          if (r.ok) {
            got += 1;
            done += 1;
            sendProgressTo(sender, {
              stage: "success",
              keyword: kw,
              done,
              total,
            });
          } else {
            sendProgressTo(sender, {
              stage: "retry",
              keyword: kw,
              done,
              total,
            });
            await page.waitForTimeout(1200);
          }
        } catch (e) {
          sendProgressTo(sender, {
            stage: "error",
            keyword: kw,
            error: e?.message || String(e),
            done,
            total,
          });
          await page.waitForTimeout(1500);
        }
      }
    }
  } catch (mainError) {
    console.error("[canva-browse] Error during main download loop:", mainError);

    // 에러가 발생해도 진행 상황 알림
    sendProgressTo(sender, {
      stage: "error",
      error: `다운로드 중 오류: ${mainError.message}`,
      done,
      total,
    });

    throw mainError;
  } finally {
    // 브라우저 정리 (항상 실행)
    console.log("[canva-browse] Cleaning up browser resources...");

    if (page) {
      try {
        await page.close();
        console.log("[canva-browse] Page closed successfully");
      } catch (pageError) {
        console.warn("[canva-browse] Error closing page:", pageError);
      }
    }

    if (context) {
      try {
        await context.close();
        console.log("[canva-browse] Context closed successfully");
      } catch (contextError) {
        console.warn("[canva-browse] Error closing context:", contextError);
      }
    }

    if (browser) {
      try {
        await browser.close();
        console.log("[canva-browse] Browser closed successfully");
      } catch (browserError) {
        console.warn("[canva-browse] Error closing browser:", browserError);
      }
    }
  }

  return { ok: true, outDir, downloaded: done, total };
}

// ============================== 등록 함수 (main.js의 tryRegister와 호환) ==============================
function register() {
  console.log("[canva-browse] 📝 Canva Browse IPC 핸들러 등록 중...");

  // 🔄 기존 핸들러들 모두 제거 후 재등록 (충돌 방지)
  try {
    ipcMain.removeHandler("canva:enhancedDownload");
    ipcMain.removeHandler("canva:bulkDownload");
    ipcMain.removeHandler("canva:openBrowser");
    ipcMain.removeHandler("canva:testDownload");
    console.log("[canva-browse] 🗑️ 기존 핸들러들 제거 완료");
  } catch (e) {
    // 핸들러가 없어도 무시
  }

  // 핸들러 강제 등록 (중복 체크 없이)
  ipcMain.handle("canva:enhancedDownload", handleEnhancedDownload);
  console.log("[canva-browse] ✅ canva:enhancedDownload 핸들러 강제 등록 완료");

  ipcMain.handle("canva:bulkDownload", handleBulkDownload);
  console.log("[canva-browse] ✅ canva:bulkDownload 핸들러 강제 등록 완료");

  ipcMain.handle("canva:openBrowser", handleOpenBrowser);
  console.log("[canva-browse] ✅ canva:openBrowser 핸들러 강제 등록 완료");

  ipcMain.handle("canva:testDownload", handleTestDownload);
  console.log("[canva-browse] ✅ canva:testDownload 핸들러 강제 등록 완료");

  // 기존 캔바 API들과의 호환성을 위한 별칭들
  ipcMain.handle("canva:getSession", async () => {
    console.log("[canva-browse] 📋 세션 확인 요청 (CDN 방식은 별도 세션 불필요)");
    return { ok: true, method: "playwright" };
  });
  console.log("[canva-browse] ✅ canva:getSession 핸들러 등록됨 (호환성)");

  ipcMain.handle("canva:login", handleOpenBrowser);
  console.log("[canva-browse] ✅ canva:login 핸들러 등록됨 (openBrowser 별칭)");

  // 🔒 협력업체 방식: 1회 로그인 세션 관리
  ipcMain.handle("canva:initSession", handleInitSession);
  console.log("[canva-browse] ✅ canva:initSession 핸들러 등록 완료 (협력업체 방식)");
  
  console.log("[canva-browse] 🎉 모든 IPC 핸들러 등록 완료!");

  return true;
}

// 🔒 협력업체 방식: 1회 로그인 + 세션 유지 시스템
async function handleInitSession(event) {
  console.log("[canva-browse] 🚀 협력업체 방식 세션 초기화 시작...");
  
  try {
    // 🔍 먼저 기존 세션 상태 확인
    if (!playwright) playwright = require("playwright");
    
    const profileDir = getChromeProfileDir();
    
    console.log("[canva-browse] 🔍 기존 로그인 세션 확인 중...");
    
    // 🔒 협력업체의 최강 Chrome 옵션
    const options = {
      headless: true, // 먼저 숨김 모드로 확인
      args: [
        '--disable-blink-features=AutomationControlled',
        `--user-data-dir=${profileDir}`,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-web-security',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-client-side-phishing-detection',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        '--accept-lang=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      ],
      ignoreDefaultArgs: [
        '--enable-automation',
        '--enable-blink-features=AutomationControlled'
      ]
    };
    
    const context = await playwright.chromium.launchPersistentContext(profileDir, options);
    const page = await context.newPage();
    
    // 🔒 협력업체의 최강 탐지 방지 스크립트
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // 자동화 감지 변수들 완전 제거
      const automationProps = [
        '$cdc_asdjflasutopfhvcZLmcfl_',
        '$chrome_asyncScriptInfo',
        '__$webdriverAsyncExecutor',
        '__driver_evaluate',
        '__webdriver_evaluate',
        '__selenium_evaluate'
      ];
      
      automationProps.forEach(prop => {
        delete window[prop];
        Object.defineProperty(window, prop, {
          get: () => undefined,
          set: () => {},
          configurable: true
        });
      });
    });
    
    try {
      // Canva 메인 페이지로 이동해서 로그인 상태 확인
      await page.goto('https://www.canva.com/ko_kr/', { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      const isLoggedIn = !currentUrl.includes('/login') && 
                        (currentUrl.includes('canva.com') || 
                         await page.locator('button[data-testid="user-avatar"], [data-testid="profile-menu"]').count() > 0);
      
      if (isLoggedIn) {
        await context.close();
        console.log("[canva-browse] ✅ 이미 로그인되어 있습니다! 세션 초기화 불필요");
        return { 
          success: true, 
          alreadyLoggedIn: true,
          message: "이미 로그인되어 있습니다. 바로 다운로드를 시작할 수 있습니다!" 
        };
      }
      
      await context.close();
      
    } catch (error) {
      await context.close();
      console.log("[canva-browse] ⚠️ 세션 확인 실패, 새 로그인 필요:", error.message);
    }
    
    // 🔓 로그인이 필요한 경우 - 브라우저 창 표시
    console.log("[canva-browse] 🔓 로그인이 필요합니다. 브라우저 창을 엽니다...");
    
    const visibleOptions = {
      ...options,
      headless: false // 로그인을 위해 창 표시
    };
    
    const loginContext = await playwright.chromium.launchPersistentContext(profileDir, visibleOptions);
    const loginPage = await loginContext.newPage();
    
    // 동일한 탐지 방지 스크립트 적용
    await loginPage.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      const automationProps = [
        '$cdc_asdjflasutopfhvcZLmcfl_',
        '$chrome_asyncScriptInfo',
        '__$webdriverAsyncExecutor',
        '__driver_evaluate',
        '__webdriver_evaluate',
        '__selenium_evaluate'
      ];
      
      automationProps.forEach(prop => {
        delete window[prop];
        Object.defineProperty(window, prop, {
          get: () => undefined,
          set: () => {},
          configurable: true
        });
      });
    });
    
    console.log("[canva-browse] 🔍 Canva 로그인 페이지로 이동...");
    
    // 자연스러운 탐색 패턴 (협력업체 방식)
    await loginPage.goto('https://www.canva.com/ko_kr/', { waitUntil: 'networkidle' });
    await loginPage.waitForTimeout(3000);
    
    await loginPage.goto('https://www.canva.com/ko_kr/login', { waitUntil: 'networkidle' });
    
    console.log("[canva-browse] ✅ 로그인 페이지 로드 완료!");
    console.log("[canva-browse] 💡 브라우저에서 로그인을 완료한 후 창을 닫으세요.");
    console.log("[canva-browse] 🔄 다음부터는 자동으로 로그인된 상태로 다운로드됩니다.");
    
    // 사용자가 로그인 완료 후 창을 닫을 때까지 대기
    return new Promise((resolve) => {
      loginContext.on('close', () => {
        console.log("[canva-browse] 🎉 세션 설정 완료! 이제 CAPTCHA 없이 다운로드 가능합니다.");
        resolve({ 
          success: true, 
          message: "세션 설정 완료! 다음부터는 CAPTCHA 없이 다운로드됩니다." 
        });
      });
    });
    
  } catch (error) {
    console.error("[canva-browse] ❌ 세션 초기화 오류:", error);
    return { success: false, error: error.message };
  }
}

// ============================== 강력한 중복 방지 시스템 ==============================

// 메타데이터 파일 로드
async function loadDownloadMetadata() {
  if (loadedMetadata) return loadedMetadata;

  try {
    const data = fs.readFileSync(downloadMetadataFile, "utf8");
    loadedMetadata = JSON.parse(data);

    // 메타데이터에서 중복 추적기 초기화
    if (loadedMetadata.videos) {
      for (const video of loadedMetadata.videos) {
        if (video.videoId) duplicateTracker.videoIds.add(video.videoId);
        if (video.urlHash) duplicateTracker.urlHashes.add(video.urlHash);
        if (video.fileHash) duplicateTracker.fileHashes.add(video.fileHash);
        if (video.titleHash) duplicateTracker.titleHashes.add(video.titleHash);
      }
    }

    console.log(`[canva-browse] 📊 메타데이터 로드 완료: ${loadedMetadata.videos?.length || 0}개 영상 정보 로드`);
    console.log(
      `[canva-browse] 🚫 중복 추적: ID=${duplicateTracker.videoIds.size}, URL=${duplicateTracker.urlHashes.size}, 파일=${duplicateTracker.fileHashes.size}, 제목=${duplicateTracker.titleHashes.size}`
    );
  } catch (error) {
    console.log("[canva-browse] 📄 메타데이터 파일 없음 - 새로 생성");
    loadedMetadata = { videos: [], lastUpdated: new Date().toISOString() };
  }

  return loadedMetadata;
}

// 메타데이터 파일 저장
async function saveDownloadMetadata() {
  if (!loadedMetadata || !downloadMetadataFile) return;

  try {
    const dir = path.dirname(downloadMetadataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    loadedMetadata.lastUpdated = new Date().toISOString();
    fs.writeFileSync(downloadMetadataFile, JSON.stringify(loadedMetadata, null, 2));
    console.log(`[canva-browse] 💾 메타데이터 저장 완료: ${loadedMetadata.videos.length}개 영상`);
  } catch (error) {
    console.error("[canva-browse] ❌ 메타데이터 저장 실패:", error.message);
  }
}

// 파일 해시 계산
function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
    return hash;
  } catch (error) {
    console.error(`[canva-browse] ❌ 파일 해시 계산 실패 (${filePath}):`, error.message);
    return null;
  }
}

// URL 해시 계산
function calculateUrlHash(url) {
  return crypto.createHash("md5").update(url).digest("hex");
}

// 제목 해시 계산 (유사 제목 체크용)
function calculateTitleHash(title) {
  // 공백, 특수문자 제거하고 소문자로 변환하여 유사 제목 검출
  const normalized = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  return crypto.createHash("md5").update(normalized).digest("hex");
}

// 중복 영상 체크 (다운로드 전)
async function isDuplicateVideo(videoId, title, videoUrl) {
  await loadDownloadMetadata(); // 메타데이터 로드 보장

  // 1. 비디오 ID 체크
  if (videoId && duplicateTracker.videoIds.has(videoId)) {
    console.log(`[canva-browse] 🚫 중복 영상 스킵 (ID): ${title} [${videoId}]`);
    return true;
  }

  // 2. URL 해시 체크
  const urlHash = calculateUrlHash(videoUrl);
  if (duplicateTracker.urlHashes.has(urlHash)) {
    console.log(`[canva-browse] 🚫 중복 영상 스킵 (URL): ${title} [${urlHash.substring(0, 8)}...]`);
    return true;
  }

  // 3. 제목 해시 체크 (유사 제목)
  const titleHash = calculateTitleHash(title);
  if (duplicateTracker.titleHashes.has(titleHash)) {
    console.log(`[canva-browse] 🚫 중복 영상 스킵 (제목): ${title} [${titleHash.substring(0, 8)}...]`);
    return true;
  }

  return false;
}

// 중복 파일 체크 (다운로드 후)
function isDuplicateFile(filePath) {
  const fileHash = calculateFileHash(filePath);
  if (!fileHash) return false;

  if (duplicateTracker.fileHashes.has(fileHash)) {
    console.log(`[canva-browse] 🚫 중복 파일 발견: ${path.basename(filePath)} [${fileHash.substring(0, 8)}...]`);
    return true;
  }

  return false;
}

// 영상 정보를 메타데이터에 추가
async function addVideoToMetadata(videoId, title, videoUrl, filePath) {
  await loadDownloadMetadata();

  const urlHash = calculateUrlHash(videoUrl);
  const titleHash = calculateTitleHash(title);
  const fileHash = calculateFileHash(filePath);

  const videoMetadata = {
    videoId: videoId,
    title: title,
    url: videoUrl,
    urlHash: urlHash,
    titleHash: titleHash,
    filePath: filePath,
    fileHash: fileHash,
    downloadedAt: new Date().toISOString(),
    fileSize: 0,
  };

  try {
    const stats = fs.statSync(filePath);
    videoMetadata.fileSize = stats.size;
  } catch (error) {
    console.warn("[canva-browse] 파일 크기 확인 실패:", error.message);
  }

  // 메타데이터에 추가
  loadedMetadata.videos.push(videoMetadata);

  // 중복 추적기에 추가
  if (videoId) duplicateTracker.videoIds.add(videoId);
  duplicateTracker.urlHashes.add(urlHash);
  duplicateTracker.titleHashes.add(titleHash);
  if (fileHash) duplicateTracker.fileHashes.add(fileHash);

  console.log(`[canva-browse] 📝 메타데이터 추가: ${title} [${videoId}]`);

  // 메타데이터 저장
  await saveDownloadMetadata();
}

// 중복 파일 삭제
function removeDuplicateFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    console.log(`[canva-browse] 🗑️ 중복 파일 삭제: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`[canva-browse] ❌ 파일 삭제 실패 (${filePath}):`, error.message);
    return false;
  }
}

// 전체 중복 체크 리셋 (새로운 다운로드 세션 시작 시)
async function resetDuplicateTracker() {
  console.log("[canva-browse] 🔄 중복 추적기 초기화...");
  await loadDownloadMetadata(); // 이전 데이터 로드
  console.log("[canva-browse] ✅ 중복 추적기 초기화 완료");
}

// ============================== 다양성 확보 시스템 ==============================

// 영상 다양성 확보를 위한 선별 함수
function selectDiverseVideos(videos, count) {
  if (videos.length <= count) {
    return videos;
  }

  const selected = [];
  const usedTitles = new Set();
  const usedVideoIds = new Set();

  console.log(`[canva-browse] 🎭 다양성 선별 시작: ${videos.length}개 중 ${count}개 선택`);

  // 1차: 제목 기반 다양성 확보
  for (const video of videos) {
    if (selected.length >= count) break;

    // 제목의 첫 3단어로 유사성 판단
    const titleWords = video.title.toLowerCase().split(/\s+/).slice(0, 3).join(" ");

    // ID로 완전 중복 방지
    if (!usedVideoIds.has(video.id) && !usedTitles.has(titleWords)) {
      selected.push(video);
      usedTitles.add(titleWords);
      usedVideoIds.add(video.id);

      console.log(`[canva-browse]   ✅ 1차 선택: "${video.title.substring(0, 30)}..." (ID: ${video.id})`);
    }
  }

  // 2차: 제목은 비슷하지만 내용이 다를 수 있는 영상들 추가 검토
  if (selected.length < count) {
    const remaining = videos.filter((v) => !selected.includes(v));

    for (const video of remaining) {
      if (selected.length >= count) break;

      // ID가 다른 경우 추가
      if (!usedVideoIds.has(video.id)) {
        selected.push(video);
        usedVideoIds.add(video.id);
        console.log(`[canva-browse]   ✅ 2차 선택: "${video.title.substring(0, 30)}..." (ID: ${video.id})`);
      }
    }
  }

  console.log(`[canva-browse] 🎭 다양성 확보 완료: ${videos.length}개 중 ${selected.length}개 선택`);
  return selected;
}

// ============================== 향상된 다운로드 함수 - 중복 방지 적용 ==============================

// 기존 openFirstResultAndDownload 함수에 중복 방지 적용
async function openFirstResultAndDownloadWithDuplicateCheck(context, rootPage, keyword, index, opts, outDir, sender) {
  try {
    // 기존 함수 호출 전에 중복 체크 준비
    const originalResult = await openFirstResultAndDownload(context, rootPage, keyword, index, opts, outDir, sender);

    if (originalResult.ok && originalResult.path) {
      // 다운로드 성공 시 중복 체크 수행
      const isDupe = isDuplicateFile(originalResult.path);
      if (isDupe) {
        console.log(`[canva-browse] 🚫 중복 파일 감지 - 삭제: ${path.basename(originalResult.path)}`);
        removeDuplicateFile(originalResult.path);
        return { ok: false, reason: "duplicate_file" };
      }

      // 메타데이터에 추가 (임시 ID 생성)
      const tempVideoId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const title = path.basename(originalResult.path, path.extname(originalResult.path));
      await addVideoToMetadata(tempVideoId, title, "local_download", originalResult.path);
    }

    return originalResult;
  } catch (error) {
    console.error("[canva-browse] ❌ 중복 체크 적용 다운로드 오류:", error);
    throw error;
  }
}

module.exports = {
  register,
  handleBulkDownload,
  handleEnhancedDownload,
  handleTestDownload,
  openFirstResultAndDownload,
  openFirstResultAndDownloadWithDuplicateCheck,
  searchTemplates: handleBulkDownload, // alias for canva-api integration
  downloadFromCDN,
  extractVideoUrlFromResponse,
  // 중복 방지 시스템
  loadDownloadMetadata,
  saveDownloadMetadata,
  isDuplicateVideo,
  isDuplicateFile,
  addVideoToMetadata,
  removeDuplicateFile,
  resetDuplicateTracker,
  // 다양성 확보
  selectDiverseVideos,
};
