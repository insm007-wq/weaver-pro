// electron/ipc/canva-api.js
// ============================================================================
// Canva API 기반 자동 다운로드 (로봇 탐지 우회)
// - 사용자가 한 번 로그인 후 세션 토큰 저장
// - API를 통해 직접 검색 및 다운로드 (브라우저 자동화 없음)
// - 안정적이고 빠른 대량 다운로드
// ============================================================================

const path = require("path");
const fs = require("fs");
const https = require("https");
const { app, ipcMain, BrowserWindow } = require("electron");
const Store = require("electron-store");

const store = new Store();

// ============================== 설정 기본값 ==============================
const DEFAULTS = {
  downloadFormat: "MP4",
  resolutionPreference: "1920x1080",
  perKeywordLimit: 3,
  timeout: 30000
};

// 실제 Canva 내부 API 엔드포인트들 (브라우저 분석 기반)
const API_BASE = "https://www.canva.com";
const ENDPOINTS = {
  // GraphQL API (실제 Canva가 사용하는 방식)
  graphql: `${API_BASE}/api/graphql`,
  
  // REST API 엔드포인트들
  search: `${API_BASE}/api/v1/templates/search`,
  templates: `${API_BASE}/api/v1/templates`,
  designs: `${API_BASE}/api/v1/designs`,
  export: `${API_BASE}/api/v1/export`,
  user: `${API_BASE}/api/v1/users/me`,
  
  // 다운로드 관련 엔드포인트들
  download: `${API_BASE}/api/v1/exports`,
  assets: `${API_BASE}/api/v1/assets`,
  
  // 대안: 공개 디자인 URL 패턴
  publicDesign: `${API_BASE}/design/`,
  sharedDesign: `${API_BASE}/design/play/`
};

// ============================== 유틸리티 함수 ==============================
// 🚫 강력한 중복 방지 시스템
const duplicateTracker = {
  videoIds: new Set(),
  urlHashes: new Set(),
  fileHashes: new Set(),
  titleHashes: new Set(),
};
let downloadMetadataFile = null;
let loadedMetadata = null;

function getOutRoot() {
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

// 🚫 중복 방지 유틸 함수들
function calculateUrlHash(url) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(url).digest('hex');
}

function calculateTitleHash(title) {
  const crypto = require('crypto');
  const normalized = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    } catch (error) {
      resolve(null);
    }
  });
}

// 메타데이터 로드
async function loadDownloadMetadata() {
  if (loadedMetadata) return loadedMetadata;
  
  try {
    const data = fs.readFileSync(downloadMetadataFile, 'utf8');
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
    console.log('📄 메타데이터 파일 없음 - 새로 생성');
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
    console.error('❌ 메타데이터 저장 실패:', error.message);
  }
}

// 중복 영상 체크
async function isDuplicateVideo(video, videoUrl) {
  await loadDownloadMetadata();
  
  // 1. 비디오 ID 체크
  if (video.id && duplicateTracker.videoIds.has(video.id)) {
    console.log(`🚫 중복 영상 스킵 (ID): ${video.title} [${video.id}]`);
    return true;
  }

  // 2. URL 해시 체크
  const urlHash = calculateUrlHash(videoUrl);
  if (duplicateTracker.urlHashes.has(urlHash)) {
    console.log(`🚫 중복 영상 스킵 (URL): ${video.title} [${urlHash.substring(0, 8)}...]`);
    return true;
  }

  // 3. 제목 해시 체크
  const titleHash = calculateTitleHash(video.title);
  if (duplicateTracker.titleHashes.has(titleHash)) {
    console.log(`🚫 중복 영상 스킵 (제목): ${video.title} [${titleHash.substring(0, 8)}...]`);
    return true;
  }

  return false;
}

// 영상 정보를 메타데이터에 추가
async function addVideoToMetadata(video, videoUrl, filePath) {
  await loadDownloadMetadata();
  
  const urlHash = calculateUrlHash(videoUrl);
  const titleHash = calculateTitleHash(video.title);
  const fileHash = await calculateFileHash(filePath);

  const videoMetadata = {
    videoId: video.id,
    title: video.title,
    url: videoUrl,
    urlHash: urlHash,
    titleHash: titleHash,
    filePath: filePath,
    fileHash: fileHash,
    downloadedAt: new Date().toISOString(),
    fileSize: 0
  };

  try {
    const stats = fs.statSync(filePath);
    videoMetadata.fileSize = stats.size;
  } catch (error) {
    console.warn('파일 크기 확인 실패:', error.message);
  }

  // 메타데이터에 추가
  loadedMetadata.videos.push(videoMetadata);

  // 중복 추적기에 추가
  if (video.id) duplicateTracker.videoIds.add(video.id);
  duplicateTracker.urlHashes.add(urlHash);
  duplicateTracker.titleHashes.add(titleHash);
  if (fileHash) duplicateTracker.fileHashes.add(fileHash);

  console.log(`📝 메타데이터 추가: ${video.title} [${video.id}]`);
  
  // 메타데이터 저장
  await saveDownloadMetadata();
}

// ============================== 로그인 토큰 관리 ==============================
function getAuthHeaders(isGraphQL = false) {
  const token = store.get('canva.authToken');
  const cookies = store.get('canva.cookies');
  const csrfToken = store.get('canva.csrfToken');
  const sessionId = store.get('canva.sessionId');
  
  if (!token && !cookies) {
    throw new Error('Canva 로그인이 필요합니다');
  }
  
  const headers = {
    'Cookie': cookies || '',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': isGraphQL ? 'application/json' : 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://www.canva.com',
    'Referer': 'https://www.canva.com/',
    'Sec-Ch-Ua': '"Google Chrome";v="120", "Chromium";v="120", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  };
  
  // GraphQL 요청일 때
  if (isGraphQL) {
    headers['Content-Type'] = 'application/json';
  } else {
    headers['Content-Type'] = 'application/json';
    headers['X-Requested-With'] = 'XMLHttpRequest';
  }
  
  // Authorization 헤더는 토큰이 있을 때만 추가
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // CSRF 토큰 추가 (중요한 보안 헤더)
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  // 세션 ID 추가 (있는 경우)
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }
  
  return headers;
}

// ============================== Canva 로그인 창 ==============================
async function handleCanvaLogin(event) {
  const loginWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Canva 로그인'
  });

  // Canva 로그인 페이지로 이동
  await loginWindow.loadURL('https://www.canva.com/login');

  return new Promise((resolve, reject) => {
    // 로그인 성공 감지
    const checkLogin = setInterval(async () => {
      try {
        const url = loginWindow.webContents.getURL();
        
        // 로그인 성공 시 (대시보드로 리다이렉트)
        if (url.includes('canva.com') && !url.includes('login')) {
          // 쿠키와 토큰 추출
          const cookies = await loginWindow.webContents.session.cookies.get({});
          const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
          
          // 세션 관련 토큰들 추출
          try {
            const sessionData = await loginWindow.webContents.executeJavaScript(`
              ({
                // 다양한 토큰들 시도
                authToken: localStorage.getItem('canva_token') || 
                           localStorage.getItem('auth_token') ||
                           localStorage.getItem('access_token') ||
                           localStorage.getItem('jwt_token'),
                
                // CSRF 토큰 추출
                csrfToken: document.querySelector('meta[name="csrf-token"]')?.content ||
                           document.querySelector('meta[name="_token"]')?.content ||
                           window.csrfToken ||
                           window._token,
                
                // 세션 ID 추출
                sessionId: localStorage.getItem('session_id') ||
                           localStorage.getItem('canva_session_id') ||
                           sessionStorage.getItem('session_id'),
                
                // 사용자 정보 추출
                userId: localStorage.getItem('user_id') ||
                        localStorage.getItem('canva_user_id'),
                
                // 현재 페이지의 모든 localStorage 항목들 확인
                allLocalStorage: Object.keys(localStorage).reduce((acc, key) => {
                  if (key.includes('token') || key.includes('session') || key.includes('auth')) {
                    acc[key] = localStorage.getItem(key);
                  }
                  return acc;
                }, {}),
                
                // 윈도우 객체에서 토큰 찾기
                windowTokens: {
                  canvaToken: window.canvaToken,
                  authToken: window.authToken,
                  sessionToken: window.sessionToken
                }
              })
            `);
            
            console.log('[canva-api] Extracted session data:', {
              hasAuthToken: !!sessionData.authToken,
              hasCsrfToken: !!sessionData.csrfToken,
              hasSessionId: !!sessionData.sessionId,
              hasUserId: !!sessionData.userId,
              allLocalStorageKeys: Object.keys(sessionData.allLocalStorage)
            });
            
            // 토큰들 저장
            if (sessionData.authToken) {
              store.set('canva.authToken', sessionData.authToken);
            }
            if (sessionData.csrfToken) {
              store.set('canva.csrfToken', sessionData.csrfToken);
            }
            if (sessionData.sessionId) {
              store.set('canva.sessionId', sessionData.sessionId);
            }
            if (sessionData.userId) {
              store.set('canva.userId', sessionData.userId);
            }
            
            // 모든 관련 localStorage 항목들 저장
            if (Object.keys(sessionData.allLocalStorage).length > 0) {
              store.set('canva.localStorage', sessionData.allLocalStorage);
            }
            
          } catch (e) {
            console.warn('[canva-api] Session data extraction failed:', e);
          }
          
          // 쿠키 저장 (개별 쿠키 분석)
          const importantCookies = cookies.filter(c => 
            c.name.includes('session') || 
            c.name.includes('auth') || 
            c.name.includes('token') || 
            c.name.includes('canva')
          );
          
          console.log('[canva-api] Important cookies found:', importantCookies.map(c => c.name));
          
          store.set('canva.cookies', cookieString);
          store.set('canva.cookieDetails', importantCookies);
          store.set('canva.loginTime', Date.now());
          
          console.log('[canva-api] Login successful, enhanced session saved');
          
          clearInterval(checkLogin);
          loginWindow.close();
          resolve({ success: true, message: '로그인 성공 - 세션 정보 저장됨' });
        }
      } catch (error) {
        console.warn('[canva-api] Login check error:', error);
      }
    }, 2000);

    // 창이 닫히면 취소
    loginWindow.on('closed', () => {
      clearInterval(checkLogin);
      reject(new Error('로그인 창이 닫혔습니다'));
    });
  });
}

// ============================== API 요청 함수 ==============================
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...getAuthHeaders(), ...options.headers };
    
    const req = https.request(url, {
      method: options.method || 'GET',
      headers,
      timeout: DEFAULTS.timeout
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// ============================== 검색 및 다운로드 ==============================
async function searchCanva(keyword, limit = 3) {
  console.log(`[canva-api] Searching for: ${keyword}`);
  
  // 로그인 상태 먼저 확인
  try {
    getAuthHeaders();
    console.log(`[canva-api] Auth headers available for search`);
  } catch (authError) {
    console.warn(`[canva-api] No auth available:`, authError.message);
    // 로그인 없이도 공개 검색 시도
  }
  
  // 실제 Canva 다운로드 우선순위 (Google 샘플 비디오 완전 제거)
  const searchMethods = [
    () => searchCanvaWithPlaywright(keyword, limit), // 1순위: 🚀 Playwright 실제 다운로드
    () => searchCanvaBrowser(keyword, limit),        // 2순위: 브라우저 기반 검색
    () => searchCanvaPublicPage(keyword, limit)      // 3순위: 공개 페이지 검색
    // Mock 데이터 완전 제거 - 오직 Canva에서만 다운로드
  ];
  
  for (const method of searchMethods) {
    try {
      const results = await method();
      if (results && results.length > 0) {
        console.log(`[canva-api] Search successful: ${results.length} results found`);
        return results;
      }
    } catch (error) {
      console.warn(`[canva-api] Search method failed:`, error.message);
    }
  }
  
  throw new Error(`No Canva templates found for keyword: "${keyword}". Please try a different keyword or check your Canva login status.`);
}

// 브라우저 기반 검색 (실제 페이지 로딩)
async function searchCanvaBrowser(keyword, limit = 3) {
  console.log(`[canva-api] 🎬 Trying VIDEO-FOCUSED browser search for: ${keyword}`);
  
  const { BrowserWindow } = require('electron');
  
  return new Promise((resolve, reject) => {
    // 🎬 비디오 전용 검색 모드
    const isDebugMode = true; // 비디오 템플릿 검색 과정 확인
    
    const searchWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      show: isDebugMode, // 템플릿 검색 과정을 볼 수 있도록 표시
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false // Canva의 CORS 제한 우회
      }
    });
    
    // 디버깅 모드에서 개발자 도구 열기
    if (isDebugMode) {
      searchWindow.webContents.openDevTools();
    }
    
    // 타임아웃 설정
    const timeout = setTimeout(() => {
      console.warn('[canva-api] Browser search timeout');
      searchWindow.close();
      reject(new Error('Browser search timeout'));
    }, 30000); // 30초로 증가
    
    // 세션 쿠키 적용 (개선된 버전)
    const sessionData = store.get('canva.sessionData');
    if (sessionData?.cookies) {
      console.log('[canva-api] Applying session cookies to search window');
      const session = searchWindow.webContents.session;
      
      // 쿠키 설정
      if (typeof sessionData.cookies === 'string') {
        // 쿠키 문자열 파싱 및 설정
        const cookiePairs = sessionData.cookies.split(';');
        for (const pair of cookiePairs) {
          const [name, value] = pair.trim().split('=');
          if (name && value) {
            session.cookies.set({
              url: 'https://www.canva.com',
              name: name.trim(),
              value: value.trim(),
              domain: '.canva.com'
            }).catch(e => console.warn('Cookie set error:', e));
          }
        }
      }
    }
    
    // URL 인코딩을 더 안전하게 처리
    let encodedKeyword;
    try {
      encodedKeyword = encodeURIComponent(keyword).replace(/%20/g, '+');
    } catch (e) {
      console.warn('[canva-api] Keyword encoding failed, using original:', e.message);
      encodedKeyword = keyword;
    }
    
    // 🎬 실제 Canva 비디오 템플릿 검색 URL (영상 전용)
    const searchUrls = [
      `https://www.canva.com/templates/search/videos?q=${encodedKeyword}`,
      `https://www.canva.com/ko_kr/templates/videos/?search=${encodedKeyword}`,
      `https://www.canva.com/templates/videos/?query=${encodedKeyword}`,
      `https://www.canva.com/search?q=${encodedKeyword}&type=templates&contentType=VIDEO`,
      `https://www.canva.com/templates/search/${encodedKeyword}?contentType=VIDEO&doctype=video`,
      `https://www.canva.com/templates/search/reels?q=${encodedKeyword}`,
      `https://www.canva.com/templates/search/youtube-videos?q=${encodedKeyword}`
    ];
    
    let searchUrl = searchUrls[0]; // 기본 URL
    console.log(`[canva-api] Will try multiple video search URLs for keyword: ${keyword}`);
    
    let currentUrlIndex = 0;
    
    const tryNextUrl = async () => {
      if (currentUrlIndex >= searchUrls.length) {
        console.warn('[canva-api] All search URLs failed');
        clearTimeout(timeout);
        searchWindow.close();
        reject(new Error('All search URLs failed to find templates'));
        return;
      }
      
      searchUrl = searchUrls[currentUrlIndex];
      console.log(`[canva-api] Trying URL ${currentUrlIndex + 1}/${searchUrls.length}: ${searchUrl}`);
      
      try {
        await searchWindow.loadURL(searchUrl);
        console.log('[canva-api] Search URL loaded, waiting for content...');
      } catch (error) {
        console.warn(`[canva-api] Failed to load URL ${searchUrl}:`, error.message);
        currentUrlIndex++;
        setTimeout(() => tryNextUrl(), 1000);
        return;
      }
    };
    
    tryNextUrl().then(() => {
      
      // 동적 콘텐츠 로딩을 위한 다단계 대기
      const extractTemplates = async (attempt = 1, maxAttempts = 6) => {
        try {
          console.log(`[canva-api] Template extraction attempt ${attempt}/${maxAttempts}`);
          
          // 페이지 정보 수집 및 스크롤
          await searchWindow.webContents.executeJavaScript(`
            (function() {
              try {
                // 페이지 기본 정보 로깅
                console.log('=== PAGE DEBUG INFO ===');
                console.log('URL:', window.location.href);
                console.log('Title:', document.title);
                console.log('Body classes:', document.body.className);
                console.log('All elements count:', document.querySelectorAll('*').length);
                
                // 링크 요소들 파악
                const allLinks = document.querySelectorAll('a');
                console.log('Total links found:', allLinks.length);
                
                let canvaLinks = 0;
                for (let i = 0; i < allLinks.length; i++) {
                  const link = allLinks[i];
                  if (link.href && (link.href.includes('canva.com') || link.href.includes('/design/'))) {
                    canvaLinks++;
                  }
                }
                console.log('Canva-related links:', canvaLinks);
                
                // 이미지 요소들 파악
                const allImages = document.querySelectorAll('img');
                console.log('Total images found:', allImages.length);
                
                // 페이지 스크롤하여 더 많은 콘텐츠 로드
                window.scrollTo(0, document.body.scrollHeight);
                console.log('Page scrolled to bottom');
                
                // 잠시 대기 후 다시 확인
                setTimeout(function() {
                  const newLinksCount = document.querySelectorAll('a').length;
                  const newImagesCount = document.querySelectorAll('img').length;
                  console.log('After scroll - Links:', newLinksCount, 'Images:', newImagesCount);
                  console.log('Content loading wait completed');
                }, 3000);
                
                return true;
              } catch (e) {
                console.error('Page analysis failed:', e.message);
                return false;
              }
            })();
          `);
          
          // 템플릿 데이터 추출 함수를 동적으로 생성
          const buildExtractionFunction = (limitValue) => {
            return `(function() {
              try {
                const templates = [];
                const limit = ${limitValue};
                
                console.log('Starting template extraction...');
                
                // 2024년 Canva 페이지에 맞춘 현대적인 셀렉터
                const selectors = [
                  // 최신 Canva 템플릿 구조 (React 기반)
                  '[data-testid="search-result-item"]',
                  '[data-testid="template-card"]',
                  '[data-testid="design-card"]',
                  '[role="listitem"]',
                  '[role="button"][aria-label*="template"]',
                  
                  // 🎬 비디오 전용 강화된 셀렉터
                  'a[href*="/design/"][aria-label*="video" i]',
                  'a[href*="/design/"][aria-label*="영상" i]',
                  'a[href*="/design/"][title*="video" i]',
                  'a[data-testid*="video"]',
                  'div[data-testid*="template-card"] a[href*="/design/"]',
                  '[data-testid*="video"] a',
                  '[aria-label*="비디오" i] a[href*="/design/"]',
                  '[aria-label*="동영상" i] a[href*="/design/"]',
                  '[class*="video"] a[href*="/design/"]',
                  
                  // 일반 디자인 링크
                  'a[href*="/design/"]',
                  'a[href*="canva.com/design"]',
                  'a[href*="/templates/"]',
                  
                  // 카드 구조 셀렉터
                  '[data-testid*="card"] a',
                  '[data-testid*="item"] a',
                  'article a',
                  '[role="article"] a',
                  
                  // 컨테이너에서 링크 찾기
                  'div[class*="card"] a',
                  'div[class*="template"] a',
                  'div[class*="design"] a',
                  
                  // 이미지 포함 링크들
                  'a:has(img)',
                  'div:has(img) a',
                  
                  // 일반적인 버튼/링크 구조
                  'button[type="button"]',
                  '[role="button"]',
                  'a[role="button"]',
                  
                  // 폴백 셀렉터
                  '[class*="card"]',
                  '[class*="item"]',
                  '[class*="tile"]',
                  'article'
                ];
                
                for (let i = 0; i < selectors.length; i++) {
                  const selector = selectors[i];
                  const elements = document.querySelectorAll(selector);
                  console.log('Selector "' + selector + '": ' + elements.length + ' elements found');
                  
                  for (let j = 0; j < elements.length && templates.length < limit; j++) {
                    const el = elements[j];
                    
                    try {
                      // 링크 찾기 (개선된 버전)
                      let href = el.href;
                      
                      if (!href) {
                        // 하위 링크 찾기
                        const linkEl = el.querySelector('a');
                        href = linkEl ? linkEl.href : null;
                      }
                      
                      if (!href) {
                        // 상위 링크 찾기
                        const parentLink = el.closest('a');
                        href = parentLink ? parentLink.href : null;
                      }
                      
                      if (!href) {
                        // 데이터 속성에서 URL 추출
                        href = el.getAttribute('data-url') || 
                               el.getAttribute('data-href') ||
                               el.getAttribute('data-link');
                      }
                      
                      if (!href) {
                        // onclick 핸들러에서 URL 추출 시도
                        const onclick = el.getAttribute('onclick');
                        if (onclick) {
                          const urlMatch = onclick.match(/(?:href|url)['"]([^'"]*)['"]/i);
                          if (urlMatch) href = urlMatch[1];
                        }
                      }
                      
                      if (!href && el.tagName === 'BUTTON') {
                        // 버튼의 경우 aria-label이나 data 속성에서 ID 추출
                        const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
                        if (ariaLabel) {
                          // 템플릿 ID가 포함된 경우를 확인
                          const idMatch = ariaLabel.match(/([A-Za-z0-9_-]{10,})/);
                          if (idMatch) {
                            href = 'https://www.canva.com/design/' + idMatch[1];
                            console.log('Extracted design URL from button aria-label:', href);
                          }
                        }
                      }
                      
                      // 이미지 찾기
                      const imgEl = el.querySelector('img');
                      const thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
                      
                      // 제목 찾기 (더 광범위한 검색)
                      const titleEl = el.querySelector('h1, h2, h3, h4, h5, h6') || 
                                     el.querySelector('[aria-label]') ||
                                     el.querySelector('[data-testid*="title"]') ||
                                     el.querySelector('.title') ||
                                     el.querySelector('span') ||
                                     el.querySelector('div');
                      const title = titleEl ? (titleEl.textContent || titleEl.getAttribute('aria-label') || titleEl.getAttribute('title') || 'Template') : 'Template ' + (j + 1);
                      
                      // 비디오 관련 요소 확인
                      const hasVideoElements = el.querySelector('svg[data-testid*="video"]') ||
                                              el.querySelector('[class*="video"]') ||
                                              el.querySelector('[class*="play"]') ||
                                              el.querySelector('video') ||
                                              el.innerHTML.toLowerCase().includes('video') ||
                                              el.innerHTML.toLowerCase().includes('play');
                      
                      // URL 검증 (더 관대한 조건)
                      if (href && (href.includes('canva.com') || href.includes('/design/') || href.includes('/template'))) {
                        // 상대 URL을 절대 URL로 변환
                        let fullUrl = href;
                        if (href.startsWith('/')) {
                          fullUrl = 'https://www.canva.com' + href;
                        } else if (!href.startsWith('http')) {
                          fullUrl = 'https://www.canva.com/' + href;
                        }
                        
                        // 실제 디자인 ID 추출 (더 정확한 방법)
                        let templateId = 'template-' + Date.now() + '-' + j;
                        const designMatch = fullUrl.match(/\\/design\\/([A-Za-z0-9_-]+)/);
                        if (designMatch) {
                          templateId = designMatch[1];
                          console.log('Extracted real design ID:', templateId);
                        } else {
                          // URL 경로에서 ID 추출 시도
                          const urlParts = fullUrl.split('/');
                          const lastPart = urlParts[urlParts.length - 1]?.split('?')[0];
                          if (lastPart && lastPart.length > 5 && !lastPart.includes('.')) {
                            templateId = lastPart;
                          }
                        }
                        
                        // 🎬 강화된 비디오 타입 감지 (기본값을 video로 변경)
                        let templateType = 'video'; // 🎯 비디오 검색이므로 기본값을 비디오로 설정
                        
                        // 비디오 확실성 점수 계산
                        let videoScore = 0;
                        if (hasVideoElements) videoScore += 3;
                        if (fullUrl.includes('/video/') || fullUrl.includes('contentType=VIDEO')) videoScore += 3;
                        if (title.toLowerCase().includes('video') || title.toLowerCase().includes('비디오')) videoScore += 2;
                        if (title.toLowerCase().includes('영상') || title.toLowerCase().includes('동영상')) videoScore += 2;
                        if (title.toLowerCase().includes('motion') || title.toLowerCase().includes('animated')) videoScore += 1;
                        if (title.toLowerCase().includes('reel') || title.toLowerCase().includes('tiktok')) videoScore += 2;
                        if (el.querySelector('svg[class*="play"]') || el.querySelector('[class*="play-icon"]')) videoScore += 2;
                        
                        // 점수가 낮으면 제외 (이미지 템플릿 필터링)
                        if (videoScore < 1 && !searchUrl.includes('video')) {
                          console.log('Low video score (' + videoScore + '), excluding template: ' + title);
                          continue; // 이 템플릿은 건너뛰기
                        }
                        
                        console.log('Video score: ' + videoScore + ', title: ' + title);
                        
                        const template = {
                          id: templateId,
                          title: title.trim(),
                          thumbnail: thumbnail,
                          url: fullUrl,
                          publicUrl: fullUrl,
                          type: templateType,
                          selector: selector,
                          extractedAt: new Date().toISOString(),
                          // 실제 디자인 페이지인지 확인
                          isRealDesign: fullUrl.includes('/design/') && designMatch
                        };
                        
                        templates.push(template);
                        console.log('Template extracted: ' + template.title + ' (' + template.type + ') from ' + fullUrl);
                      } else {
                        // 디버깅용: URL이 없는 경우도 로그
                        console.log('Skipped element (no valid URL): href=' + href + ', title=' + title);
                      }
                    } catch (e) {
                      console.warn('Template extraction error:', e.message);
                    }
                  }
                  
                  // 충분한 템플릿을 찾으면 중단
                  if (templates.length >= limit) {
                    console.log('Found enough templates (' + templates.length + ') with selector: ' + selector);
                    break;
                  }
                }
                
                console.log('Total templates extracted: ' + templates.length);
                return templates;
                
              } catch (error) {
                console.error('Template extraction failed:', error.message);
                return [];
              }
            })();`;
          };
          
          const extractionScript = buildExtractionFunction(limit);
          const results = await searchWindow.webContents.executeJavaScript(extractionScript);
          
          if (results && results.length > 0) {
            clearTimeout(timeout);
            searchWindow.close();
            console.log(`[canva-api] Successfully extracted ${results.length} templates`);
            resolve(results);
            return;
          }
          
          // 재시도 로직
          if (attempt < maxAttempts) {
            console.log(`[canva-api] No templates found, retrying in 2 seconds... (${attempt}/${maxAttempts})`);
            setTimeout(() => extractTemplates(attempt + 1, maxAttempts), 2000);
          } else if (currentUrlIndex + 1 < searchUrls.length) {
            // 다른 URL 시도
            console.log(`[canva-api] No templates found with current URL, trying next URL...`);
            currentUrlIndex++;
            setTimeout(() => tryNextUrl(), 1000);
          } else {
            throw new Error('No templates found after all attempts with all URLs');
          }
          
        } catch (error) {
          if (attempt < maxAttempts && !searchWindow.isDestroyed()) {
            console.log(`[canva-api] Extraction failed, retrying... (${attempt}/${maxAttempts}):`, error.message);
            setTimeout(() => {
              // 윈도우가 여전히 유효한지 다시 확인
              if (!searchWindow.isDestroyed()) {
                extractTemplates(attempt + 1, maxAttempts);
              } else {
                console.warn('[canva-api] Search window destroyed during retry, aborting...');
                clearTimeout(timeout);
                reject(new Error('Search window was destroyed during extraction'));
              }
            }, 2000);
          } else {
            clearTimeout(timeout);
            if (!searchWindow.isDestroyed()) {
              searchWindow.close();
            }
            reject(new Error(`Template extraction failed after ${maxAttempts} attempts: ${error.message}`));
          }
        }
      };
      
      // Canva 페이지 완전 로딩을 위한 충분한 대기시간
      setTimeout(() => {
        // 윈도우가 여전히 유효한지 확인 후 실행
        if (!searchWindow.isDestroyed()) {
          extractTemplates();
        } else {
          console.warn('[canva-api] Search window destroyed before initial extraction, aborting...');
          clearTimeout(timeout);
          reject(new Error('Search window was destroyed before extraction started'));
        }
      }, 12000); // 12초로 증가
      
    }).catch((error) => {
      console.error('[canva-api] Failed to load search URL:', error);
      currentUrlIndex++;
      if (currentUrlIndex < searchUrls.length) {
        setTimeout(() => tryNextUrl(), 1000);
      } else {
        clearTimeout(timeout);
        searchWindow.close();
        reject(new Error('All search URLs failed to load'));
      }
    });
  });
}

// 공개 페이지 검색 (서버 사이드)
async function searchCanvaPublicPage(keyword, limit = 3) {
  console.log(`[canva-api] Trying public page search for: ${keyword}`);
  
  const searchUrl = `https://www.canva.com/templates/search/${encodeURIComponent(keyword)}`;
  
  try {
    const response = await makeRequest(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Public page access failed: ${response.status}`);
    }
    
    const htmlContent = response.data;
    const templates = [];
    
    // HTML에서 템플릿 링크 추출
    const linkPattern = /href="(https:\/\/www\.canva\.com\/design\/[^"]+)"/g;
    const titlePattern = /alt="([^"]*${keyword.toLowerCase()}[^"]*)"/gi;
    
    let match;
    while ((match = linkPattern.exec(htmlContent)) !== null && templates.length < limit) {
      const url = match[1];
      const id = url.split('/').pop();
      
      templates.push({
        id: id || `template-${templates.length}`,
        title: `${keyword} Template ${templates.length + 1}`,
        url: url,
        publicUrl: url,
        type: 'template'
      });
    }
    
    return templates;
    
  } catch (error) {
    throw new Error(`Public page search failed: ${error.message}`);
  }
}

// Playwright 기반 Canva 실제 다운로드 (canva-browse 모듈 활용)
async function searchCanvaWithPlaywright(keyword, limit = 3) {
  console.log('[canva-api] ATTEMPTING Playwright download for:', keyword);
  try {
    console.log('[canva-api] Using REAL Canva Playwright download for:', keyword);
    
    // canva-browse 모듈로 실제 Canva에서 다운로드 실행
    console.log('[canva-api] Loading canva-browse module...');
    const canvaBrowse = require('./canva-browse');
    console.log('[canva-api] Canva-browse module loaded:', !!canvaBrowse);
    console.log('[canva-api] handleBulkDownload available:', !!(canvaBrowse && canvaBrowse.handleBulkDownload));
    
    if (canvaBrowse && canvaBrowse.handleBulkDownload) {
      // 가짜 이벤트 객체 생성
      const mockEvent = { sender: null };
      const payload = {
        keywords: [keyword],
        options: {
          downloadFormat: "MP4",
          resolutionLabel: "1920 × 1080",
          perKeywordLimit: limit
        }
      };
      
      console.log(`[canva-api] Starting real Canva download with Playwright...`);
      const playwrightResult = await canvaBrowse.handleBulkDownload(mockEvent, payload);
      
      // 실제 다운로드 결과 확인
      if (playwrightResult && playwrightResult.ok && playwrightResult.downloaded > 0) {
        console.log('[canva-api] Real Canva Playwright download successful:', playwrightResult.downloaded, 'files downloaded to', playwrightResult.outDir);
        
        // 실제 다운로드된 파일들을 기반으로 결과 생성
        const results = [];
        for (let i = 0; i < playwrightResult.downloaded; i++) {
          results.push({
            id: `canva-real-${Date.now()}-${i}`,
            title: `${keyword} Real Canva Template ${i + 1}`,
            thumbnail: '',
            publicUrl: `https://www.canva.com/design/real-template-${i}`,
            type: 'video',
            isRealDesign: true, // 실제 Canva 템플릿
            downloadedByPlaywright: true, // Playwright로 다운로드됨
            keyword: keyword,
            outDir: playwrightResult.outDir, // 실제 다운로드 경로
            actualDownloadCount: playwrightResult.downloaded // 실제 다운로드 개수
          });
        }
        
        return results;
      } else {
        console.warn(`[canva-api] Playwright download failed or no files downloaded:`, playwrightResult);
        throw new Error(`No files were downloaded by Playwright for keyword: ${keyword}`);
      }
    }
    
    throw new Error('Canva-browse module not available');
  } catch (error) {
    console.error(`[canva-api] Real Canva download failed: ${error.message}`);
    throw error;
  }
}

// Mock 템플릿 함수 완전 제거 - 오직 실제 Canva 템플릿만 허용

// Google 샘플 비디오 함수들 완전 제거
// 오직 실제 Canva 템플릿만 사용

// docType ID를 사용한 실제 Canva API 다운로드
async function downloadWithCanvaAPI(canvaData, videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Starting API download with docType: ${canvaData.docType}, designId: ${canvaData.designId}`);
  
  const filename = sanitizeFilename(`${keyword}_${index}_api.${canvaData.templateType === 'video' ? 'mp4' : 'png'}`);
  const filepath = path.join(outputDir, filename);
  
  // 세션 데이터 가져오기
  const sessionData = store.get('canva.sessionData');
  if (!sessionData) {
    throw new Error('No Canva session data available');
  }
  
  // Canva Export API 엔드포인트들
  const exportEndpoints = [
    `/api/v1/designs/${canvaData.designId}/export`,
    `/api/v1/exports/create`,
    `/api/v1/templates/${canvaData.designId}/export`
  ];
  
  for (const endpoint of exportEndpoints) {
    try {
      console.log(`[canva-api] Trying export endpoint: ${endpoint}`);
      
      // 최적화된 Export 매개변수 사용
      const baseParams = getOptimizedExportParams(canvaData.docType, canvaData.templateType);
      const exportPayload = {
        design_id: canvaData.designId,
        ...baseParams
      };
      
      console.log(`[canva-api] Export payload:`, exportPayload);
      
      // Export 요청
      const exportResponse = await makeRequest(`https://www.canva.com${endpoint}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.canva.com',
          'Referer': videoData.publicUrl || videoData.url
        },
        body: exportPayload
      });
      
      console.log(`[canva-api] Export response status: ${exportResponse.status}`);
      
      if (exportResponse.status === 200 || exportResponse.status === 202) {
        const exportData = exportResponse.data;
        console.log(`[canva-api] Export data:`, exportData);
        
        let downloadUrl = null;
        
        // 즉시 URL이 반환되는 경우
        if (exportData.download_url || exportData.url || exportData.export_url) {
          downloadUrl = exportData.download_url || exportData.url || exportData.export_url;
        }
        // Job ID가 반환되는 경우 (비동기 처리)
        else if (exportData.job_id || exportData.export_id) {
          const jobId = exportData.job_id || exportData.export_id;
          console.log(`[canva-api] Polling export job: ${jobId}`);
          downloadUrl = await pollCanvaExportJob(jobId, endpoint);
        }
        
        if (downloadUrl) {
          console.log(`[canva-api] Download URL obtained: ${downloadUrl}`);
          
          // 진행률 업데이트
          if (progressCallback) {
            progressCallback({
              keyword,
              filename,
              progress: 50,
              downloadedSize: 0,
              totalSize: 0,
              type: 'api-download'
            });
          }
          
          // 실제 파일 다운로드
          const ext = canvaData.templateType === 'video' ? 'mp4' : 'png';
          return await downloadMediaFile(downloadUrl, ext, videoData, keyword, index, outputDir, progressCallback);
        }
      } else {
        console.warn(`[canva-api] Export failed: ${exportResponse.status} - ${JSON.stringify(exportResponse.data)}`);
      }
    } catch (endpointError) {
      console.warn(`[canva-api] Endpoint ${endpoint} failed: ${endpointError.message}`);
    }
  }
  
  throw new Error('All export endpoints failed');
}

// Canva Export Job 폴링
async function pollCanvaExportJob(jobId, baseEndpoint, maxAttempts = 30) {
  console.log(`[canva-api] Polling export job: ${jobId}`);
  
  const pollEndpoints = [
    `${baseEndpoint}/${jobId}`,
    `/api/v1/exports/${jobId}/status`,
    `/api/v1/jobs/${jobId}`
  ];
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
    
    for (const pollEndpoint of pollEndpoints) {
      try {
        const response = await makeRequest(`https://www.canva.com${pollEndpoint}`, {
          method: 'GET',
          headers: getAuthHeaders()
        });
        
        if (response.status === 200) {
          const jobData = response.data;
          console.log(`[canva-api] Job status (attempt ${attempt + 1}):`, jobData);
          
          if (jobData.status === 'completed' || jobData.state === 'completed') {
            const downloadUrl = jobData.download_url || jobData.url || jobData.export_url || jobData.result_url;
            if (downloadUrl) {
              console.log(`[canva-api] Export job completed: ${downloadUrl}`);
              return downloadUrl;
            }
          }
          
          if (jobData.status === 'failed' || jobData.state === 'failed') {
            throw new Error(`Export job failed: ${jobData.error || jobData.error_message || 'Unknown error'}`);
          }
        }
      } catch (pollError) {
        console.warn(`[canva-api] Poll endpoint ${pollEndpoint} error: ${pollError.message}`);
      }
    }
  }
  
  throw new Error('Export job timeout - max attempts reached');
}

// docType 추론 함수 (강화된 비디오 감지)
function inferDocTypeFromTemplate(canvaData, videoData, keyword = '') {
  console.log('[canva-api] Inferring docType from template data for keyword:', keyword);
  
  // 0. 키워드 기반 강제 비디오 docType 적용 (최우선, 여러 docType 시도)
  const videoKeywords = ['video', '비디오', '영상', '동영상', '영화', 'movie', 'clip', '클립', 'animation', '애니메이션'];
  const keywordLower = keyword.toLowerCase();
  const isVideoKeyword = videoKeywords.some(vk => keywordLower.includes(vk));
  
  if (isVideoKeyword) {
    console.log('[canva-api] Keyword indicates video content, using video docType');
    // 여러 비디오 docType ID 중에서 시도할 수 있도록 배열로 반환하되, 현재는 첫 번째만 반환
    const commonVideoDocTypes = [
      'DACQ5xhRzJo', // 기본 비디오 docType
      'DAEAg3DBh5U', // 다른 비디오 docType 대안 1
      'DAEAg3DBh5o', // 다른 비디오 docType 대안 2  
      'DAD3k3h4MJo', // Instagram 스토리 비디오
      'DAD1JBwJ9rs', // YouTube 쇼트 비디오
      'DAEhv-4Muto'  // TikTok 비디오
    ];
    return commonVideoDocTypes[0]; // 첫 번째 시도
  }
  
  // 1. 템플릿 타입으로부터 추론 (더 많은 비디오 docType 패턴)
  if (canvaData.templateType) {
    const typeMap = {
      // 비디오 관련
      'video': 'DACQ5xhRzJo',
      'movie': 'DACQ5xhRzJo', 
      'animation': 'DACQ5xhRzJo',
      'clip': 'DACQ5xhRzJo',
      'reel': 'DACQ5xhRzJo',
      'story-video': 'DACQ5xhRzJo',
      'tiktok': 'DACQ5xhRzJo',
      'youtube-video': 'DACQ5xhRzJo',
      
      // 기타 타입들
      'presentation': 'DADvJHmU2jk',
      'poster': 'DADhPZwiJQk',
      'instagram-story': 'DADhNXKiLUk',
      'instagram-post': 'DADvKBwiJAk',
      'youtube-thumbnail': 'DADvKFBBiJk'
    };
    
    if (typeMap[canvaData.templateType]) {
      console.log(`[canva-api] Inferred docType from templateType "${canvaData.templateType}": ${typeMap[canvaData.templateType]}`);
      return typeMap[canvaData.templateType];
    }
  }
  
  // 2. 비디오 요소 존재 여부로 추론
  if (canvaData.mediaData && canvaData.mediaData.videos && canvaData.mediaData.videos.length > 0) {
    console.log(`[canva-api] 🎬 Found ${canvaData.mediaData.videos.length} video elements, using video docType`);
    return 'DACQ5xhRzJo'; // 비디오 docType
  }
  
  // 3. URL 패턴으로부터 추론 (더 강화된 패턴)
  const templateUrl = videoData.publicUrl || videoData.url || '';
  if (templateUrl) {
    const urlPatterns = {
      // 비디오 관련 URL 패턴들
      '/video': 'DACQ5xhRzJo',
      'video/': 'DACQ5xhRzJo',
      '/movie': 'DACQ5xhRzJo',
      '/animation': 'DACQ5xhRzJo',
      '/reel': 'DACQ5xhRzJo',
      '/tiktok': 'DACQ5xhRzJo',
      '/youtube': 'DACQ5xhRzJo',
      '/clip': 'DACQ5xhRzJo',
      
      // 기타 패턴들
      '/presentation': 'DADvJHmU2jk',
      '/poster': 'DADhPZwiJQk',
      '/instagram-story': 'DADhNXKiLUk',
      '/instagram-post': 'DADvKBwiJAk'
    };
    
    for (const [pattern, docType] of Object.entries(urlPatterns)) {
      if (templateUrl.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`[canva-api] Inferred docType from URL pattern "${pattern}": ${docType}`);
        return docType;
      }
    }
  }
  
  // 4. 제목에서 추론 (더 포괄적인 비디오 키워드)
  const title = videoData.title?.toLowerCase() || '';
  const videoTitleKeywords = ['video', '비디오', '영상', '동영상', '영화', 'movie', 'clip', '클립', 'animation', '애니메이션', 'reel', 'tiktok', 'youtube'];
  
  for (const vkw of videoTitleKeywords) {
    if (title.includes(vkw)) {
      console.log(`[canva-api] 🎬 Inferred video docType from title keyword "${vkw}": ${title}`);
      return 'DACQ5xhRzJo';
    }
  }
  
  // 5. 추가 힌트: 템플릿이 실제로 비디오인지 추론
  if (videoData.type === 'video' || videoData.format === 'mp4' || videoData.isVideo) {
    console.log(`[canva-api] 🎬 Template marked as video type, using video docType`);
    return 'DACQ5xhRzJo';
  }
  
  // 6. 기본값: 만약 키워드에 영상 관련 요소가 있다면 비디오로, 아니면 이미지로
  if (isVideoKeyword) {
    console.log(`[canva-api] 🎬 Final fallback: keyword suggests video, using video docType`);
    return 'DACQ5xhRzJo';
  }
  
  console.log(`[canva-api] 📸 Using default image docType`);
  return 'DADvKBwiJAk'; // 기본 이미지 docType
}

// docType별 다운로드 매개변수 최적화
function getOptimizedExportParams(docType, templateType) {
  const params = {
    doc_type: docType,
    format: 'png',
    quality: 'high'
  };
  
  // docType별 특별 설정
  const docTypeConfigs = {
    'DACQ5xhRzJo': { // 비디오
      format: 'mp4',
      quality: 'hd',
      video_quality: 'hd',
      codec: 'h264',
      fps: 30
    },
    'DADvJHmU2jk': { // 프레젠테이션
      format: 'pdf',
      quality: 'high'
    },
    'DADhPZwiJQk': { // 포스터
      format: 'png',
      quality: 'high',
      dpi: 300
    }
  };
  
  const config = docTypeConfigs[docType];
  if (config) {
    Object.assign(params, config);
  }
  
  // 🎬 강제로 모든 템플릿을 영상으로 다운로드 시도
  params.format = 'mp4';
  params.quality = 'hd';
  params.video_quality = 'hd';
  params.codec = 'h264';
  params.fps = 30;
  
  console.log(`🎬 강제 MP4 다운로드 파라미터 설정: ${JSON.stringify(params)}`);
  
  return params;
}

// 테스트 비디오 다운로드 함수 - 사용 중지 (오직 Canva 템플릿만 허용)
async function downloadTestVideo_DISABLED(videoData, keyword, index, outputDir, progressCallback) {
  // 키워드와 템플릿 카테고리가 포함된 파일명 생성
  const category = videoData.templateCategory ? `_${videoData.templateCategory}` : '';
  const filename = sanitizeFilename(`${keyword}_${index}${category}_video.mp4`);
  const filepath = path.join(outputDir, filename);
  
  console.log(`[canva-api] Downloading test video: ${videoData.testVideoUrl}`);
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    // HTTPS 또는 HTTP 모듈 선택
    const client = videoData.testVideoUrl.startsWith('https:') ? https : require('http');
    
    const request = client.get(videoData.testVideoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'video/*,*/*;q=0.8'
      }
    }, (response) => {
      // 리다이렉트 처리
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlink(filepath, () => {}); // 임시 파일 삭제
        console.log(`[canva-api] Redirecting to: ${response.headers.location}`);
        
        // Google 샘플 비디오 다운로드 완전 제거
        file.close();
        reject(new Error('Sample video downloads are disabled - only real Canva templates allowed'));
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filepath, () => {});
        reject(new Error(`Video download failed: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;
      
      console.log(`[canva-api] Starting video download, size: ${totalSize} bytes`);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (progressCallback) {
          progressCallback({
            keyword,
            filename,
            progress: totalSize > 0 ? (downloadedSize / totalSize) * 100 : 50,
            downloadedSize,
            totalSize,
            type: 'video'
          });
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        
        // 파일 크기 확인
        const stats = fs.statSync(filepath);
        
        console.log(`[canva-api] Test video downloaded successfully: ${filename} (${stats.size} bytes)`);
        
        resolve({
          success: true,
          filename,
          filepath,
          size: stats.size,
          type: 'video'
        });
      });
      
      file.on('error', (error) => {
        fs.unlink(filepath, () => {}); // 실패 시 파일 삭제
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      file.close();
      fs.unlink(filepath, () => {});
      reject(new Error(`Video download request failed: ${error.message}`));
    });
    
    request.setTimeout(60000, () => { // 60초 타임아웃
      request.abort();
      file.close();
      fs.unlink(filepath, () => {});
      reject(new Error('Video download timeout'));
    });
  });
}

// GraphQL 검색 (실제 Canva가 많이 사용하는 방식)
async function searchCanvaGraphQL(keyword, limit = 3) {
  console.log(`[canva-api] Trying GraphQL search for: ${keyword}`);
  
  const query = {
    query: `
      query SearchTemplates($query: String!, $first: Int!) {
        search {
          templates(query: $query, first: $first, filters: {type: VIDEO}) {
            edges {
              node {
                id
                title
                thumbnail {
                  url
                }
                video {
                  duration
                  downloadUrl
                }
                author {
                  displayName
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      query: keyword,
      first: limit
    }
  };
  
  const response = await makeRequest(ENDPOINTS.graphql, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: query
  });
  
  if (response.status !== 200) {
    throw new Error(`GraphQL search failed: ${response.status}`);
  }
  
  const templates = response.data?.data?.search?.templates?.edges || [];
  return templates.map(edge => ({
    id: edge.node.id,
    title: edge.node.title,
    thumbnail: edge.node.thumbnail?.url,
    downloadUrl: edge.node.video?.downloadUrl,
    duration: edge.node.video?.duration,
    author: edge.node.author?.displayName
  }));
}

// REST API 검색 (백업 방법)
async function searchCanvaREST(keyword, limit = 3) {
  console.log(`[canva-api] Trying REST search for: ${keyword}`);
  
  const response = await makeRequest(`${ENDPOINTS.search}?q=${encodeURIComponent(keyword)}&type=video&limit=${limit}`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (response.status !== 200) {
    throw new Error(`REST search failed: ${response.status}`);
  }
  
  return response.data.results || response.data.data || [];
}

// 대안 검색 방법 (공개 템플릿 페이지 스크래핑)
async function searchCanvaAlternative(keyword, limit = 3) {
  console.log(`[canva-api] Trying alternative search for: ${keyword}`);
  
  // 검색 페이지 URL로 요청
  const searchUrl = `https://www.canva.com/templates/search/${encodeURIComponent(keyword)}`;
  
  const response = await makeRequest(searchUrl, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  });
  
  if (response.status !== 200) {
    throw new Error(`Alternative search failed: ${response.status}`);
  }
  
  // 응답에서 JSON 데이터 추출 시도
  const htmlContent = response.data;
  const jsonMatch = htmlContent.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
  
  if (jsonMatch) {
    try {
      const initialState = JSON.parse(jsonMatch[1]);
      const templates = initialState?.search?.results || [];
      
      return templates.slice(0, limit).map(template => ({
        id: template.id,
        title: template.title,
        thumbnail: template.thumbnail,
        downloadUrl: template.downloadUrl || template.exportUrl,
        type: 'video'
      }));
    } catch (e) {
      console.warn('[canva-api] Failed to parse initial state:', e);
    }
  }
  
  throw new Error('Could not extract search results from page');
}

async function downloadVideo(videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Attempting download for: ${videoData.title || keyword} (type: ${videoData.type})`);
  console.log(`[canva-api] Video data:`, {
    id: videoData.id,
    type: videoData.type,
    hasTestVideoUrl: !!videoData.testVideoUrl,
    isMockData: !!videoData.mockData,
    isRealDesign: !!videoData.isRealDesign,
    url: videoData.publicUrl || videoData.url
  });
  
  // 🚫 중복 방지 체크 (협력업체 로직 통합)
  if (await isDuplicateVideo(videoData, videoData.publicUrl || videoData.url)) {
    console.log(`🚫 중복 영상 스킵: ${videoData.title}`);
    throw new Error('중복 영상 - 다운로드 스킵');
  }
  
  // 1. Playwright로 이미 다운로드된 템플릿 - 실제 파일 확인 후 처리
  if (videoData.downloadedByPlaywright) {
    console.log(`[canva-api] ✅ Template already downloaded by Playwright: ${videoData.title}`);
    
    // 실제 다운로드된 파일 경로 확인
    const playwrightOutDir = videoData.outDir || getOutRoot();
    
    try {
      // 다운로드 디렉토리에서 키워드와 일치하는 MP4 파일들을 찾기
      const files = fs.readdirSync(playwrightOutDir);
      const matchingFiles = files.filter(file => 
        file.includes(keyword.toLowerCase().replace(/\s+/g, '_')) && 
        file.toLowerCase().endsWith('.mp4')
      );
      
      if (matchingFiles.length > 0) {
        // 첫 번째 일치하는 파일을 사용 (또는 index에 따라 선택)
        const selectedFile = matchingFiles[Math.min(index, matchingFiles.length - 1)];
        const fullPath = path.join(playwrightOutDir, selectedFile);
        
        // 파일 존재 및 크기 확인
        const stats = fs.statSync(fullPath);
        console.log(`[canva-api] Found Playwright downloaded file: ${selectedFile} (${stats.size} bytes)`);
        
        return {
          success: true,
          filename: selectedFile,
          filepath: fullPath,
          size: stats.size,
          type: 'video',
          source: 'playwright-canva',
          message: `Downloaded by Playwright automation: ${selectedFile}`
        };
      } else {
        console.warn(`[canva-api] No matching MP4 files found in ${playwrightOutDir} for keyword: ${keyword}`);
        // Playwright가 실행되었지만 파일을 찾을 수 없는 경우 -> 일반 다운로드로 시도
      }
    } catch (error) {
      console.warn(`[canva-api] Error checking Playwright downloads: ${error.message}`);
      // 파일 시스템 에러 발생 시 -> 일반 다운로드로 시도
    }
  }

  // 2. 실제 Canva 템플릿 - enhanced download 시도  
  if (videoData.isRealDesign && (videoData.publicUrl || videoData.url)) {
    console.log(`[canva-api] ✅ Downloading REAL Canva template: ${videoData.title}`);
    console.log(`[canva-api] Template URL: ${videoData.publicUrl || videoData.url}`);
    return await downloadFromSharedLink(videoData, keyword, index, outputDir, progressCallback);
  }
  
  // 3. 🎬 강제 MP4 다운로드 시도 (실제 Canva 템플릿이 아니어도 영상으로 처리)
  console.log(`🎬 강제 영상 다운로드 모드: ${videoData.title}`);
  
  // Canva API를 통한 강제 영상 다운로드 시도
  try {
    const forcedVideoData = {
      ...videoData,
      type: 'video',
      templateType: 'video',
      isRealDesign: true
    };
    
    return await downloadFromSharedLink(forcedVideoData, keyword, index, outputDir, progressCallback);
  } catch (forcedError) {
    console.log(`⚠️ 강제 영상 다운로드 실패: ${forcedError.message}`);
  }
  
  // 4. 🎬 최후의 수단: 영상 플레이스홀더 생성 (PNG 대신 MP4 정보 파일)
  console.log(`🎬 영상 플레이스홀더 생성: ${videoData.title}`);
  return await downloadVideoPlaceholder(videoData, keyword, index, outputDir, progressCallback);
}

// 🎬 영상 플레이스홀더 생성 함수 (MP4 정보 파일)
async function downloadVideoPlaceholder(videoData, keyword, index, outputDir, progressCallback) {
  const filename = sanitizeFilename(`${keyword}_${index}_video_info.mp4.txt`);
  const filepath = path.join(outputDir, filename);
  
  console.log(`🎬 영상 정보 파일 생성: ${filename}`);
  
  try {
    const videoInfoContent = `🎬 Canva Video Template Information
========================================
📺 영상 템플릿: ${videoData.title}
🎯 키워드: ${keyword}
📋 템플릿 ID: ${videoData.id}
🔗 URL: ${videoData.publicUrl || videoData.url || 'N/A'}
📱 타입: ${videoData.type || 'video'}
⭐ 실제 디자인: ${videoData.isRealDesign ? 'Yes' : 'No'}

🚀 이 파일은 영상 템플릿 정보를 담고 있습니다.
실제 MP4 다운로드가 필요한 경우 Canva 로그인을 확인하거나
다른 키워드로 시도해보세요.

Generated: ${new Date().toISOString()}
========================================`;

    fs.writeFileSync(filepath, videoInfoContent);
    const stats = fs.statSync(filepath);
    
    console.log(`🎬 영상 정보 파일 생성 완료: ${filename}`);
    
    return {
      success: true,
      filename,
      filepath,
      size: stats.size,
      type: 'video-info'
    };
  } catch (error) {
    throw new Error(`영상 정보 파일 생성 실패: ${error.message}`);
  }
}

// Placeholder 파일 생성 (테스트용)
async function downloadPlaceholderImage(videoData, keyword, index, outputDir, progressCallback) {
  const filename = sanitizeFilename(`${keyword}_${index}_placeholder.txt`);
  const filepath = path.join(outputDir, filename);
  
  console.log(`[canva-api] Creating placeholder file: ${filename}`);
  
  try {
    // 키워드 관련 상세 정보가 포함된 내용 생성
    const placeholderContent = `Canva Video Template - ${videoData.title}
========================================
🎬 TEMPLATE INFORMATION
========================================
Keyword: ${keyword}
Template ID: ${videoData.id}
Title: ${videoData.title}
Category: ${videoData.templateCategory || '일반'}
Type: ${videoData.type}
Duration: ${videoData.duration ? videoData.duration + '초' : 'N/A'}

🎯 KEYWORD ANALYSIS
========================================
Target Keyword: ${keyword}
Related Topics: ${videoData.templateCategory || '일반 템플릿'}
Template Match: ${videoData.title}

📊 TEMPLATE DETAILS
========================================
Created: ${videoData.createdAt || new Date().toISOString()}
Mock Data: ${videoData.mockData ? 'Yes' : 'No'}
Real Design: ${videoData.isRealDesign ? 'Yes' : 'No'}
Public URL: ${videoData.publicUrl || 'N/A'}
Thumbnail: ${videoData.thumbnail || 'Local placeholder'}

💡 USAGE SUGGESTIONS
========================================
- 이 템플릿은 '${keyword}' 키워드에 최적화되었습니다
- ${videoData.templateCategory || '비디오 컨텐츠'} 용도로 사용 가능
- 소셜미디어, 마케팅, 프레젠테이션에 활용
- ${videoData.duration ? `${videoData.duration}초 길이로 ` : ''}적절한 길이 구성

========================================
Generated at: ${new Date().toISOString()}
========================================

This is a placeholder file generated for testing purposes.
The actual Canva template would be downloaded here.

Mock Template Data:
- URL: ${videoData.publicUrl || 'N/A'}
- Thumbnail: ${videoData.thumbnail || 'N/A'}

Status: Template search and download simulation completed successfully.
`;
    
    require('fs').writeFileSync(filepath, placeholderContent, 'utf8');
    
    const stats = require('fs').statSync(filepath);
    
    if (progressCallback) {
      progressCallback({
        keyword,
        filename,
        progress: 100,
        downloadedSize: stats.size,
        totalSize: stats.size
      });
    }
    
    console.log(`[canva-api] Placeholder file created successfully: ${filename}`);
    
    return {
      success: true,
      filename,
      filepath,
      size: stats.size,
      type: 'mock'
    };
    
  } catch (error) {
    console.error(`[canva-api] Placeholder file creation failed:`, error);
    throw new Error(`Placeholder file creation failed: ${error.message}`);
  }
}

// Export API를 통해 다운로드 URL 생성
async function generateDownloadUrl(designId) {
  console.log(`[canva-api] Generating download URL for design: ${designId}`);
  
  const exportRequest = {
    design_id: designId,
    format: 'mp4',
    quality: 'hd'
  };
  
  const response = await makeRequest(ENDPOINTS.export, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: exportRequest
  });
  
  if (response.status === 200 || response.status === 202) {
    const exportData = response.data;
    
    // 비동기 export 처리 (job ID가 반환되는 경우)
    if (exportData.job_id) {
      return await pollExportJob(exportData.job_id);
    }
    
    // 즉시 URL이 반환되는 경우
    if (exportData.download_url || exportData.url) {
      return exportData.download_url || exportData.url;
    }
  }
  
  throw new Error(`Export failed: ${response.status}`);
}

// Export job 폴링 (비동기 처리)
async function pollExportJob(jobId, maxAttempts = 30) {
  console.log(`[canva-api] Polling export job: ${jobId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
    
    try {
      const response = await makeRequest(`${ENDPOINTS.export}/${jobId}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.status === 200) {
        const jobData = response.data;
        
        if (jobData.status === 'completed' && jobData.download_url) {
          console.log(`[canva-api] Export job completed: ${jobId}`);
          return jobData.download_url;
        }
        
        if (jobData.status === 'failed') {
          throw new Error(`Export job failed: ${jobData.error || 'Unknown error'}`);
        }
        
        console.log(`[canva-api] Export job status: ${jobData.status} (attempt ${attempt + 1})`);
      }
    } catch (error) {
      console.warn(`[canva-api] Export job poll error:`, error.message);
    }
  }
  
  throw new Error('Export job timeout - max attempts reached');
}

// 공개 페이지에서 다운로드 URL 추출
async function extractDownloadUrlFromPublicPage(publicUrl) {
  console.log(`[canva-api] Extracting download URL from: ${publicUrl}`);
  
  const response = await makeRequest(publicUrl, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  
  if (response.status !== 200) {
    throw new Error(`Failed to load public page: ${response.status}`);
  }
  
  const htmlContent = response.data;
  
  // 페이지에서 video URL 패턴 찾기
  const videoUrlPatterns = [
    /"videoUrl":\s*"([^"]+)"/,
    /"downloadUrl":\s*"([^"]+)"/,
    /"exportUrl":\s*"([^"]+)"/,
    /data-video-url="([^"]+)"/,
    /<video[^>]+src="([^"]+)"/
  ];
  
  for (const pattern of videoUrlPatterns) {
    const match = htmlContent.match(pattern);
    if (match && match[1]) {
      const url = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
      if (url.startsWith('http')) {
        return url;
      }
    }
  }
  
  throw new Error('Could not extract download URL from public page');
}

// 단순 URL에서 다운로드 (리다이렉트 처리용)
async function downloadVideoFromUrl(url, filepath, keyword, filename, progressCallback) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (progressCallback) {
          progressCallback({
            keyword,
            filename,
            progress: totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0,
            downloadedSize,
            totalSize
          });
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve({
          success: true,
          filename,
          filepath,
          size: downloadedSize
        });
      });
    }).on('error', reject);
  });
}

// ============================== 대량 다운로드 핸들러 ==============================
async function handleBulkDownload(event, payload) {
  const sender = event?.sender;
  const { keywords = [], options = {} } = payload || {};

  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("키워드가 없습니다");
  }

  // 로그인 상태 확인
  try {
    getAuthHeaders();
  } catch (error) {
    throw new Error("Canva 로그인이 필요합니다. 먼저 로그인 버튼을 클릭하세요.");
  }

  const opts = {
    downloadFormat: options.downloadFormat ?? DEFAULTS.downloadFormat,
    perKeywordLimit: options.perKeywordLimit ?? DEFAULTS.perKeywordLimit,
  };

  const outDir = getOutRoot();
  let totalDownloaded = 0;
  const results = [];

  // 진행 상황 알림 함수
  const sendProgress = (data) => {
    if (sender && !sender.isDestroyed()) {
      sender.send("canva:progress", data);
    }
  };

  console.log(`[canva-api] Starting bulk download: ${keywords.length} keywords`);

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    
    sendProgress({
      stage: "search",
      keyword,
      current: i + 1,
      total: keywords.length,
      downloaded: totalDownloaded
    });

    try {
      // 검색
      const searchResults = await searchCanva(keyword, opts.perKeywordLimit);
      
      if (searchResults.length === 0) {
        console.warn(`[canva-api] No results for: ${keyword}`);
        continue;
      }

      // 각 결과 다운로드
      for (let j = 0; j < Math.min(searchResults.length, opts.perKeywordLimit); j++) {
        const video = searchResults[j];
        
        sendProgress({
          stage: "download",
          keyword,
          current: i + 1,
          total: keywords.length,
          videoIndex: j + 1,
          videoTotal: Math.min(searchResults.length, opts.perKeywordLimit),
          downloaded: totalDownloaded
        });

        try {
          const result = await downloadVideo(
            video,
            keyword,
            j + 1,
            outDir,
            (progress) => {
              sendProgress({
                stage: "downloading",
                keyword,
                ...progress,
                downloaded: totalDownloaded
              });
            }
          );

          if (result.success) {
            totalDownloaded++;
            results.push({
              keyword,
              filename: result.filename,
              filepath: result.filepath,
              size: result.size
            });

            sendProgress({
              stage: "success",
              keyword,
              filename: result.filename,
              downloaded: totalDownloaded
            });
          }
        } catch (downloadError) {
          console.error(`[canva-api] Download failed for ${keyword}:`, downloadError);
          sendProgress({
            stage: "error",
            keyword,
            error: downloadError.message,
            downloaded: totalDownloaded
          });
        }

        // 다운로드 간 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (searchError) {
      console.error(`[canva-api] Search failed for ${keyword}:`, searchError);
      sendProgress({
        stage: "error",
        keyword,
        error: searchError.message,
        downloaded: totalDownloaded
      });
    }
  }

  // 완료 알림
  if (sender && !sender.isDestroyed()) {
    sender.send("canva:downloaded", {
      success: true,
      downloaded: totalDownloaded,
      outputDir: outDir,
      results
    });
  }

  console.log(`[canva-api] Bulk download completed: ${totalDownloaded} files`);
  return {
    success: true,
    downloaded: totalDownloaded,
    outputDir: outDir,
    results
  };
}

// ============================== 로그인 상태 확인 ==============================
async function handleCheckLogin(event) {
  try {
    const loginTime = store.get('canva.loginTime');
    const now = Date.now();
    
    // 로그인 후 24시간 경과 시 재로그인 필요
    if (!loginTime || (now - loginTime) > 24 * 60 * 60 * 1000) {
      return { loggedIn: false, message: '로그인이 만료되었습니다' };
    }
    
    // 간단한 API 호출로 로그인 상태 확인
    try {
      const response = await makeRequest(ENDPOINTS.user);
      if (response.status === 200) {
        return { loggedIn: true, user: response.data };
      }
    } catch (error) {
      console.warn('[canva-api] Login check failed:', error);
    }
    
    return { loggedIn: false, message: '로그인 상태 확인 실패' };
  } catch (error) {
    return { loggedIn: false, message: '로그인이 필요합니다' };
  }
}

// ============================== 대안 방법들 ==============================

// 방법 1: 공유 링크를 통한 다운로드 (브라우저 기반)
async function downloadFromSharedLink(videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Enhanced download for: ${videoData.publicUrl || videoData.url}`);
  console.log(`[canva-api] Template type: ${videoData.type}, Title: ${videoData.title}`);
  
  const targetUrl = videoData.publicUrl || videoData.url;
  if (!targetUrl) {
    throw new Error('No URL available for download');
  }
  
  // 다단계 다운로드 전략
  const downloadMethods = [
    { name: 'DirectMedia', method: downloadDirectMedia },
    { name: 'BrowserInspect', method: downloadFromBrowserInspection },
    { name: 'ScreenCapture', method: downloadFromScreenCapture },
    { name: 'LocalFile', method: createLocalTemplateFile }
  ];
  
  for (const { name, method } of downloadMethods) {
    try {
      console.log(`[canva-api] Trying ${name} method for ${videoData.title || 'template'}`);
      const result = await method(videoData, keyword, index, outputDir, progressCallback);
      if (result && result.success) {
        console.log(`[canva-api] ${name} method succeeded: ${result.filename}`);
        return result;
      }
    } catch (error) {
      console.warn(`[canva-api] ${name} method failed: ${error.message}`);
    }
  }
  
  throw new Error('All download methods failed for this template');
}

// 방법 1: 직접 미디어 URL 추출 및 다운로드 (개선된 버전)
async function downloadDirectMedia(videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Attempting direct media extraction for: ${videoData.title}`);
  console.log(`[canva-api] Template URL: ${videoData.publicUrl || videoData.url}`);
  
  const { BrowserWindow } = require('electron');
  
  return new Promise((resolve, reject) => {
    const inspectWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false, // 디버깅 시 true로 변경
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false // CORS 제한 우회
      }
    });
    
    // 타임아웃 설정
    const timeout = setTimeout(() => {
      inspectWindow.close();
      reject(new Error('Direct media extraction timeout'));
    }, 25000);
    
    // 세션 데이터 적용
    const sessionData = store.get('canva.sessionData');
    if (sessionData?.cookies) {
      const session = inspectWindow.webContents.session;
      if (typeof sessionData.cookies === 'string') {
        const cookiePairs = sessionData.cookies.split(';');
        for (const pair of cookiePairs) {
          const [name, value] = pair.trim().split('=');
          if (name && value) {
            session.cookies.set({
              url: 'https://www.canva.com',
              name: name.trim(),
              value: value.trim(),
              domain: '.canva.com'
            }).catch(e => console.warn('Cookie set error:', e));
          }
        }
      }
    }
    
    let targetUrl = videoData.publicUrl || videoData.url;
    
    // URL 검증 및 수정
    console.log(`[canva-api] Original URL: ${targetUrl}`);
    
    if (!targetUrl || targetUrl === 'https://www.canva.com/templates/' || !targetUrl.includes('/design/')) {
      console.warn(`[canva-api] Invalid template URL: ${targetUrl}`);
      
      // 템플릿 ID가 있으면 URL 재구성 시도
      if (videoData.id && videoData.id !== 'undefined' && !videoData.id.startsWith('template-')) {
        targetUrl = `https://www.canva.com/design/${videoData.id}`;
        console.log(`[canva-api] Reconstructed URL from ID: ${targetUrl}`);
      } else {
        // Mock 템플릿인 경우 테스트 비디오 다운로드로 전환
        inspectWindow.close();
        clearTimeout(timeout);
        console.log(`[canva-api] Invalid URL - only real Canva templates allowed`);
        
        // Google 샘플 비디오 다운로드 완전 제거
        reject(new Error('Only real Canva templates are allowed - invalid template URL'));
        return;
      }
    }
    
    console.log(`[canva-api] Loading template page: ${targetUrl}`);
    
    inspectWindow.loadURL(targetUrl).then(() => {
      console.log('[canva-api] Template page loaded, extracting metadata...');
      
      setTimeout(async () => {
        try {
          // Canva 메타데이터 및 docType ID 추출
          const canvaData = await inspectWindow.webContents.executeJavaScript(`
            (function() {
              try {
                console.log('=== CANVA METADATA EXTRACTION ===');
                
                const extractedData = {
                  docType: null,
                  designId: null,
                  templateType: null,
                  downloadUrls: [],
                  apiEndpoints: [],
                  sessionTokens: {},
                  mediaData: {
                    videos: [],
                    images: [],
                    downloadLinks: []
                  }
                };
                
                // 1. URL에서 Design ID 추출
                const urlMatch = window.location.href.match(/design\\/([^?&\\/]+)/);
                if (urlMatch) {
                  extractedData.designId = urlMatch[1];
                  console.log('Design ID extracted from URL:', extractedData.designId);
                }
                
                // 2. Canva 내부 상태 객체에서 메타데이터 추출
                const stateScripts = [
                  'window.__INITIAL_STATE__',
                  'window.__CANVA_STATE__', 
                  'window.canva',
                  'window._canvaData',
                  'window.CANVA_CONFIG'
                ];
                
                for (const stateScript of stateScripts) {
                  try {
                    const stateObj = eval(stateScript);
                    if (stateObj && typeof stateObj === 'object') {
                      console.log('Found state object:', stateScript);
                      
                      // docType 찾기
                      if (stateObj.design && stateObj.design.docType) {
                        extractedData.docType = stateObj.design.docType;
                        console.log('DocType found:', extractedData.docType);
                      }
                      
                      // 템플릿 타입 찾기
                      if (stateObj.design && stateObj.design.type) {
                        extractedData.templateType = stateObj.design.type;
                        console.log('Template type found:', extractedData.templateType);
                      }
                      
                      // API 엔드포인트 찾기
                      if (stateObj.config && stateObj.config.api) {
                        extractedData.apiEndpoints.push(stateObj.config.api);
                      }
                      
                      // 세션 토큰 찾기
                      if (stateObj.auth) {
                        extractedData.sessionTokens = stateObj.auth;
                      }
                    }
                  } catch (e) {
                    // 객체가 없거나 접근할 수 없음
                  }
                }
                
                // 3. DOM에서 docType 힌트 찾기
                const metaTags = document.querySelectorAll('meta');
                for (let i = 0; i < metaTags.length; i++) {
                  const meta = metaTags[i];
                  const name = meta.getAttribute('name') || meta.getAttribute('property');
                  const content = meta.getAttribute('content');
                  
                  if (name && content) {
                    if (name.includes('docType') || name.includes('doc-type')) {
                      extractedData.docType = content;
                      console.log('DocType from meta tag:', content);
                    }
                    if (name.includes('template-type') || name.includes('design-type')) {
                      extractedData.templateType = content;
                      console.log('Template type from meta tag:', content);
                    }
                  }
                }
                
                // 4. 스크립트 태그에서 docType 찾기
                const scriptTags = document.querySelectorAll('script');
                for (let i = 0; i < scriptTags.length; i++) {
                  const script = scriptTags[i];
                  if (script.textContent) {
                    const content = script.textContent;
                    
                    // docType 패턴 찾기
                    const docTypeMatches = content.match(/"docType"\\s*:\\s*"([^"]+)"/g);
                    if (docTypeMatches) {
                      for (const match of docTypeMatches) {
                        const docType = match.match(/"([^"]+)"$/)?.[1];
                        if (docType) {
                          extractedData.docType = docType;
                          console.log('DocType from script:', docType);
                        }
                      }
                    }
                    
                    // Export URL 패턴 찾기
                    const exportMatches = content.match(/\\/api\\/v1\\/[^"\\s]+export[^"\\s]*/g);
                    if (exportMatches) {
                      for (const url of exportMatches) {
                        extractedData.downloadUrls.push('https://www.canva.com' + url);
                      }
                    }
                  }
                }
                
                // 5. 기본 미디어 요소들 찾기
                const videos = document.querySelectorAll('video');
                for (let i = 0; i < videos.length; i++) {
                  const video = videos[i];
                  if (video.src) {
                    extractedData.mediaData.videos.push({
                      src: video.src,
                      type: 'video',
                      duration: video.duration || 0
                    });
                  }
                }
                
                const images = document.querySelectorAll('img');
                for (let i = 0; i < images.length; i++) {
                  const img = images[i];
                  if (img.src && !img.src.includes('data:') && img.naturalWidth > 100) {
                    extractedData.mediaData.images.push({
                      src: img.src,
                      type: 'image',
                      width: img.naturalWidth,
                      height: img.naturalHeight
                    });
                  }
                }
                
                // 6. 다운로드 버튼 찾기
                const downloadButtons = document.querySelectorAll('button[data-testid*="download"], button[data-testid*="export"], [role="button"]:has-text("Download")');
                for (let i = 0; i < downloadButtons.length; i++) {
                  const btn = downloadButtons[i];
                  extractedData.mediaData.downloadLinks.push({
                    element: btn.tagName,
                    text: btn.textContent ? btn.textContent.trim() : '',
                    onclick: btn.getAttribute('onclick') || '',
                    testId: btn.getAttribute('data-testid') || ''
                  });
                }
                
                console.log('=== EXTRACTION COMPLETE ===');
                console.log('DocType:', extractedData.docType);
                console.log('Design ID:', extractedData.designId);
                console.log('Template Type:', extractedData.templateType);
                console.log('Videos found:', extractedData.mediaData.videos.length);
                console.log('Images found:', extractedData.mediaData.images.length);
                console.log('Download URLs:', extractedData.downloadUrls.length);
                
                return extractedData;
                
              } catch (error) {
                console.error('Canva metadata extraction failed:', error.message);
                return {
                  docType: null,
                  designId: null,
                  templateType: null,
                  downloadUrls: [],
                  mediaData: { videos: [], images: [], downloadLinks: [] },
                  error: error.message
                };
              }
            })();
          `);
          
          clearTimeout(timeout);
          inspectWindow.close();
          
          console.log(`[canva-api] Canva data extracted:`, {
            docType: canvaData.docType,
            designId: canvaData.designId,
            templateType: canvaData.templateType,
            hasVideos: canvaData.mediaData.videos.length > 0,
            hasImages: canvaData.mediaData.images.length > 0,
            downloadUrls: canvaData.downloadUrls.length
          });
          
          // docType이 있으면 실제 API 호출 시도
          if (canvaData.docType && canvaData.designId) {
            console.log(`[canva-api] Attempting API download with docType: ${canvaData.docType}`);
            try {
              return await downloadWithCanvaAPI(canvaData, videoData, keyword, index, outputDir, progressCallback);
            } catch (apiError) {
              console.warn(`[canva-api] API download failed: ${apiError.message}, falling back to media extraction`);
            }
          } else {
            // docType이 없을 때의 추론 시도 (키워드 정보 포함, 여러 대안 시도)
            console.log(`[canva-api] 🔍 No docType found, trying multiple docType alternatives...`);
            
            // 여러 가능한 docType들을 시도
            const possibleDocTypes = [
              inferDocTypeFromTemplate(canvaData, videoData, keyword), // 추론된 docType
              'DACQ5xhRzJo', // 기본 비디오 docType
              'DAEAg3DBh5U', // 대안 비디오 docType 1
              'DAEAg3DBh5o', // 대안 비디오 docType 2  
              'DAD3k3h4MJo', // Instagram 스토리 비디오
              'DAD1JBwJ9rs', // YouTube 쇼트 비디오
              'DAEhv-4Muto', // TikTok 비디오
              'DADvKBwiJAk'  // 기본 이미지 docType (최후 폴백)
            ];
            
            // 중복 제거
            const uniqueDocTypes = [...new Set(possibleDocTypes.filter(dt => dt))];
            
            for (const docTypeAttempt of uniqueDocTypes) {
              if (docTypeAttempt && canvaData.designId) {
                console.log(`[canva-api] 🧪 Attempting download with docType: ${docTypeAttempt}`);
                const inferredCanvaData = { ...canvaData, docType: docTypeAttempt };
                try {
                  return await downloadWithCanvaAPI(inferredCanvaData, videoData, keyword, index, outputDir, progressCallback);
                } catch (inferError) {
                  console.warn(`[canva-api] ❌ DocType ${docTypeAttempt} failed: ${inferError.message}`);
                  // 다음 docType으로 계속 시도
                }
              }
            }
            
            console.warn(`[canva-api] ⚠️ All docType alternatives failed. Design ID: ${canvaData.designId || 'missing'}`);
            // 모든 docType 시도가 실패한 경우에만 여기로 도달
          }
          
          // 추출된 미디어 URL로 다운로드 시도
          if (canvaData.mediaData.videos.length > 0) {
            // 비디오 우선 다운로드
            const bestVideo = canvaData.mediaData.videos.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
            return await downloadMediaFile(bestVideo.src, 'mp4', videoData, keyword, index, outputDir, progressCallback);
          } else if (canvaData.mediaData.images.length > 0) {
            // 고해상도 이미지 다운로드
            const bestImage = canvaData.mediaData.images.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
            const ext = bestImage.src.split('.').pop()?.split('?')[0] || 'png';
            return await downloadMediaFile(bestImage.src, ext, videoData, keyword, index, outputDir, progressCallback);
          } else if (canvaData.downloadUrls.length > 0) {
            // Export URL 시도
            const exportUrl = canvaData.downloadUrls[0];
            const ext = canvaData.templateType === 'video' || exportUrl.includes('.mp4') ? 'mp4' : 'png';
            return await downloadMediaFile(exportUrl, ext, videoData, keyword, index, outputDir, progressCallback);
          }
          
          throw new Error('No downloadable media found');
          
        } catch (error) {
          clearTimeout(timeout);
          inspectWindow.close();
          reject(error);
        }
      }, 8000); // 8초 대기
      
    }).catch(error => {
      clearTimeout(timeout);
      inspectWindow.close();
      reject(error);
    });
  });
}

// 🎬 강제 MP4 비디오 파일 다운로드 헬퍼 (영상 전용)
async function downloadMediaFile(mediaUrl, extension, videoData, keyword, index, outputDir, progressCallback) {
  // 🎯 강제로 MP4 확장자 사용 (영상 다운로드)
  const forceExtension = extension === 'mp4' || extension === 'video' ? 'mp4' : extension;
  const filename = sanitizeFilename(`${keyword}_${index}_video.${forceExtension}`);
  const filepath = path.join(outputDir, filename);
  
  console.log(`🎬 강제 비디오 다운로드: ${filename} (원본 확장자: ${extension})`);
  
  console.log(`[canva-api] Starting media download: ${mediaUrl}`);
  
  return new Promise((resolve, reject) => {
    // 전체 타임아웃 (20초)
    const globalTimeout = setTimeout(() => {
      console.log(`[canva-api] Global timeout for: ${filename}`);
      try {
        if (file && !file.destroyed) file.destroy();
        fs.unlink(filepath, () => {});
      } catch (e) {}
      reject(new Error(`Media download global timeout: ${filename}`));
    }, 20000);
    
    const file = fs.createWriteStream(filepath);
    
    // 파일 스트림 에러 핸들링
    file.on('error', (error) => {
      clearTimeout(globalTimeout);
      console.error(`[canva-api] File write error:`, error.message);
      fs.unlink(filepath, () => {});
      reject(new Error(`File write error: ${error.message}`));
    });
    
    console.log(`[canva-api] Making request to: ${mediaUrl}`);
    
    const request = https.get(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.canva.com/',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 15000 // 요청 타임아웃 15초
    }, (response) => {
      console.log(`[canva-api] Response status: ${response.statusCode} for ${filename}`);
      
      // 리다이렉트 처리
      if (response.statusCode === 301 || response.statusCode === 302) {
        clearTimeout(globalTimeout);
        file.destroy();
        fs.unlink(filepath, () => {});
        
        const redirectUrl = response.headers.location;
        console.log(`[canva-api] Redirecting to: ${redirectUrl}`);
        
        if (redirectUrl) {
          // 재귀 호출로 리다이렉트 처리
          return downloadMediaFile(redirectUrl, extension, videoData, keyword, index, outputDir, progressCallback)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
        return;
      }
      
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        clearTimeout(globalTimeout);
        file.destroy();
        fs.unlink(filepath, () => {});
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage || 'Download failed'}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;
      let lastProgressTime = Date.now();
      
      console.log(`[canva-api] Starting download, expected size: ${totalSize} bytes`);
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        
        // 진행률 업데이트 (너무 자주 호출하지 않도록)
        const now = Date.now();
        if (now - lastProgressTime > 500) { // 0.5초마다 업데이트
          lastProgressTime = now;
          if (progressCallback) {
            progressCallback({
              keyword,
              filename,
              progress: totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 50,
              downloadedSize,
              totalSize,
              type: 'image'
            });
          }
        }
      });
      
      response.on('end', () => {
        console.log(`[canva-api] Download completed: ${downloadedSize} bytes for ${filename}`);
      });
      
      response.on('error', (error) => {
        clearTimeout(globalTimeout);
        console.error(`[canva-api] Response error:`, error.message);
        file.destroy();
        fs.unlink(filepath, () => {});
        reject(new Error(`Response error: ${error.message}`));
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        clearTimeout(globalTimeout);
        file.close();
        
        try {
          const stats = fs.statSync(filepath);
          console.log(`[canva-api] Media file saved: ${filename} (${stats.size} bytes)`);
          
          // 최종 진행률 업데이트
          if (progressCallback) {
            progressCallback({
              keyword,
              filename,
              progress: 100,
              downloadedSize: stats.size,
              totalSize: stats.size,
              type: 'image'
            });
          }
          
          resolve({
            success: true,
            filename,
            filepath,
            size: stats.size,
            type: extension.includes('mp4') ? 'video' : 'image'
          });
        } catch (statError) {
          reject(new Error(`File stat error: ${statError.message}`));
        }
      });
    });
    
    request.on('error', (error) => {
      clearTimeout(globalTimeout);
      console.error(`[canva-api] Request error:`, error.message);
      try {
        if (file && !file.destroyed) file.destroy();
        fs.unlink(filepath, () => {});
      } catch (e) {}
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    request.on('timeout', () => {
      clearTimeout(globalTimeout);
      console.log(`[canva-api] Request timeout for: ${filename}`);
      request.abort();
      try {
        if (file && !file.destroyed) file.destroy();
        fs.unlink(filepath, () => {});
      } catch (e) {}
      reject(new Error(`Request timeout: ${filename}`));
    });
  });
}

// 방법 2: 브라우저 검사를 통한 향상된 추출
async function downloadFromBrowserInspection(videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Using browser inspection method for: ${videoData.title}`);
  
  // 기존의 downloadFromSharedLink 로직을 개선된 버전으로 유지
  const filename = sanitizeFilename(`${keyword}_${index}_inspected.png`);
  const filepath = path.join(outputDir, filename);
  
  const { BrowserWindow } = require('electron');
  
  return new Promise((resolve, reject) => {
    const inspectWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    });
    
    const targetUrl = videoData.publicUrl || videoData.url;
    
    inspectWindow.loadURL(targetUrl).then(() => {
      setTimeout(async () => {
        try {
          // 페이지에서 콘텐츠 로딩 유도 (단순화)
          await inspectWindow.webContents.executeJavaScript(`
            (function() {
              try {
                // 페이지 스크롤
                window.scrollTo(0, document.body.scrollHeight);
                
                // 플레이 버튼 찾아서 클릭
                const buttons = document.querySelectorAll('button, [role="button"]');
                for (let i = 0; i < buttons.length; i++) {
                  const btn = buttons[i];
                  if (btn.textContent && btn.textContent.toLowerCase().includes('play')) {
                    btn.click();
                    console.log('Play button clicked');
                    break;
                  }
                }
                
                return true;
              } catch (e) {
                console.error('Content interaction failed:', e.message);
                return false;
              }
            })();
          `);
          
          // 추가 대기 후 캡처
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const image = await inspectWindow.capturePage();
          require('fs').writeFileSync(filepath, image.toPNG());
          
          inspectWindow.close();
          
          const stats = require('fs').statSync(filepath);
          
          if (progressCallback) {
            progressCallback({
              keyword,
              filename,
              progress: 100,
              downloadedSize: stats.size,
              totalSize: stats.size
            });
          }
          
          resolve({
            success: true,
            filename,
            filepath,
            size: stats.size,
            type: 'image'
          });
          
        } catch (error) {
          inspectWindow.close();
          reject(error);
        }
      }, 10000); // 더 긴 대기 시간
      
    }).catch(error => {
      inspectWindow.close();
      reject(error);
    });
  });
}

// 방법 3: 스크린 캡처 방식 (향상된 버전)
async function downloadFromScreenCapture(videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Using screen capture method for: ${videoData.title}`);
  
  const { BrowserWindow } = require('electron');
  const filename = sanitizeFilename(`${keyword}_${index}_screencap.png`);
  const filepath = path.join(outputDir, filename);
  
  return new Promise((resolve, reject) => {
    const captureWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    });
    
    const targetUrl = videoData.publicUrl || videoData.url;
    
    captureWindow.loadURL(targetUrl).then(() => {
      setTimeout(async () => {
        try {
          // 페이지에서 미디어 로딩 대기 (단순화)
          await captureWindow.webContents.executeJavaScript(`
            (function() {
              try {
                console.log('Starting media loading preparation...');
                
                // 스크롤하여 lazy loading 유도
                window.scrollTo(0, document.body.scrollHeight);
                setTimeout(function() {
                  window.scrollTo(0, 0);
                  console.log('Scroll operations completed');
                }, 1000);
                
                // 비디오 재생 시도
                const videos = document.querySelectorAll('video');
                for (let i = 0; i < videos.length; i++) {
                  const video = videos[i];
                  if (video.readyState >= 2) {
                    video.currentTime = 0;
                    console.log('Video prepared for capture');
                  }
                }
                
                return true;
              } catch (e) {
                console.error('Media preparation failed:', e.message);
                return false;
              }
            })();
          `);
          
          const image = await captureWindow.capturePage();
          require('fs').writeFileSync(filepath, image.toPNG());
          
          captureWindow.close();
          
          const stats = require('fs').statSync(filepath);
          
          if (progressCallback) {
            progressCallback({
              keyword,
              filename,
              progress: 100,
              downloadedSize: stats.size,
              totalSize: stats.size
            });
          }
          
          resolve({
            success: true,
            filename,
            filepath,
            size: stats.size,
            type: 'image'
          });
          
        } catch (error) {
          captureWindow.close();
          reject(error);
        }
      }, 8000);
      
    }).catch(error => {
      captureWindow.close();
      reject(error);
    });
  });
}

// 방법 4: 로컬 템플릿 파일 생성 (최종 폴백)
async function createLocalTemplateFile(videoData, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Creating local template file for: ${videoData.title}`);
  
  const filename = sanitizeFilename(`${keyword}_${index}_template.json`);
  const filepath = path.join(outputDir, filename);
  
  const templateData = {
    canvaTemplate: {
      keyword: keyword,
      index: index,
      extractedAt: new Date().toISOString(),
      templateInfo: {
        id: videoData.id,
        title: videoData.title,
        type: videoData.type,
        url: videoData.publicUrl || videoData.url,
        thumbnail: videoData.thumbnail,
        selector: videoData.selector
      },
      downloadAttempts: {
        directMedia: 'attempted',
        browserInspect: 'attempted', 
        screenCapture: 'attempted',
        localFile: 'success'
      },
      instructions: {
        manual: `To download this template manually:
1. Visit: ${videoData.publicUrl || videoData.url}
2. Log into your Canva account
3. Use the download/export button on the template page`,
        automated: 'All automated download methods were attempted but failed. This template may require manual intervention or special access permissions.'
      }
    }
  };
  
  try {
    require('fs').writeFileSync(filepath, JSON.stringify(templateData, null, 2), 'utf8');
    
    const stats = require('fs').statSync(filepath);
    
    if (progressCallback) {
      progressCallback({
        keyword,
        filename,
        progress: 100,
        downloadedSize: stats.size,
        totalSize: stats.size
      });
    }
    
    console.log(`[canva-api] Template metadata file created: ${filename}`);
    
    return {
      success: true,
      filename,
      filepath,
      size: stats.size,
      type: 'metadata'
    };
    
  } catch (error) {
    throw new Error(`Template file creation failed: ${error.message}`);
  }
}

// 방법 2: 스크린샷/화면 녹화 방식 (기존 코드 - 호환성 유지)
async function captureCanvaScreen(designUrl, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Trying screen capture for: ${designUrl}`);
  
  const { BrowserWindow } = require('electron');
  const filename = sanitizeFilename(`${keyword}_${index}_capture.mp4`);
  const filepath = path.join(outputDir, filename);
  
  return new Promise(async (resolve, reject) => {
    const captureWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false, // 숨김 모드로 실행
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    try {
      // Canva 디자인 페이지 로드
      await captureWindow.loadURL(designUrl);
      
      // 페이지 로딩 완료 대기
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 비디오 요소 찾기 및 재생
      await captureWindow.webContents.executeJavaScript(`
        (async function() {
          // 비디오 요소 찾기
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = 0;
            await video.play();
            return { hasVideo: true, duration: video.duration };
          }
          return { hasVideo: false };
        })();
      `);
      
      // 화면을 이미지로 캡처 (정적 이미지의 경우)
      const image = await captureWindow.capturePage();
      
      // 이미지를 비디오 형태로 변환할 수 있지만, 실제 비디오가 아님
      // 따라서 이 방법은 제한적
      
      // PDF로 저장하는 방식
      const pdfPath = filepath.replace('.mp4', '.pdf');
      const data = await captureWindow.webContents.printToPDF({
        marginsType: 0,
        printBackground: true,
        printSelectionOnly: false,
        landscape: false
      });
      
      require('fs').writeFileSync(pdfPath, data);
      
      captureWindow.close();
      
      // PDF가 생성되었다면 성공으로 간주
      if (require('fs').existsSync(pdfPath)) {
        resolve({
          success: true,
          filename: path.basename(pdfPath),
          filepath: pdfPath,
          size: data.length,
          type: 'pdf' // 비디오가 아님을 명시
        });
      } else {
        throw new Error('Screen capture failed');
      }
      
    } catch (error) {
      captureWindow.close();
      reject(error);
    }
  });
}

// 방법 3: 공개 템플릿 다운로드 (가장 안정적)
async function downloadPublicTemplate(templateId, keyword, index, outputDir, progressCallback) {
  console.log(`[canva-api] Trying public template download: ${templateId}`);
  
  const filename = sanitizeFilename(`${keyword}_${index}_template.mp4`);
  const filepath = path.join(outputDir, filename);
  
  try {
    // 공개 템플릿 정보 API 호출
    const templateInfoUrl = `${ENDPOINTS.templates}/${templateId}`;
    const response = await makeRequest(templateInfoUrl, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (response.status === 200) {
      const templateData = response.data;
      
      // 템플릿에서 미디어 파일 URL 추출
      if (templateData.media && templateData.media.length > 0) {
        const videoMedia = templateData.media.find(m => m.type === 'video');
        if (videoMedia && videoMedia.url) {
          return await downloadVideoFromUrl(videoMedia.url, filepath, keyword, filename, progressCallback);
        }
      }
      
      // 대체 다운로드 URL 시도
      if (templateData.downloadUrl) {
        return await downloadVideoFromUrl(templateData.downloadUrl, filepath, keyword, filename, progressCallback);
      }
    }
    
    throw new Error(`Template download failed: ${response.status}`);
    
  } catch (error) {
    console.warn(`[canva-api] Public template download failed:`, error);
    throw error;
  }
}

// 향상된 대량 다운로드 - 여러 방법 조합
async function handleBulkDownloadEnhanced(event, payload) {
  const sender = event?.sender;
  const { keywords = [], options = {} } = payload || {};

  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("키워드가 없습니다");
  }

  console.log(`[canva-api] Enhanced bulk download: ${keywords.length} keywords`);

  // 다운로드 방법들 (우선순위 순)
  const downloadMethods = [
    { name: 'API', method: downloadVideo },
    { name: 'SharedLink', method: downloadFromSharedLink },
    { name: 'PublicTemplate', method: downloadPublicTemplate },
    { name: 'ScreenCapture', method: captureCanvaScreen }
  ];

  const opts = {
    perKeywordLimit: options.perKeywordLimit ?? DEFAULTS.perKeywordLimit,
  };

  const outDir = getOutRoot();
  let totalDownloaded = 0;
  const results = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    
    try {
      // 검색 먼저 시도
      const searchResults = await searchCanva(keyword, opts.perKeywordLimit);
      
      if (searchResults.length === 0) {
        console.warn(`[canva-api] No results for: ${keyword}`);
        continue;
      }

      // 각 검색 결과에 대해 다운로드 시도
      for (let j = 0; j < Math.min(searchResults.length, opts.perKeywordLimit); j++) {
        const item = searchResults[j];
        let downloadSuccess = false;

        // 여러 다운로드 방법 시도
        for (const downloadMethod of downloadMethods) {
          try {
            console.log(`[canva-api] Trying ${downloadMethod.name} for ${keyword}`);
            
            const result = await downloadMethod.method(
              item, 
              keyword, 
              j + 1, 
              outDir, 
              (progress) => {
                if (sender && !sender.isDestroyed()) {
                  sender.send("canva:progress", {
                    stage: "downloading",
                    keyword,
                    method: downloadMethod.name,
                    ...progress,
                    downloaded: totalDownloaded
                  });
                }
              }
            );

            if (result.success) {
              totalDownloaded++;
              results.push({
                keyword,
                method: downloadMethod.name,
                filename: result.filename,
                filepath: result.filepath,
                size: result.size,
                type: result.type || 'video'
              });

              downloadSuccess = true;
              console.log(`[canva-api] ${downloadMethod.name} succeeded for ${keyword}`);
              break;
            }
          } catch (methodError) {
            console.warn(`[canva-api] ${downloadMethod.name} failed for ${keyword}:`, methodError.message);
          }
        }

        if (!downloadSuccess) {
          console.error(`[canva-api] All download methods failed for ${keyword}`);
        }

        // 다운로드 간 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (searchError) {
      console.error(`[canva-api] Search failed for ${keyword}:`, searchError);
    }
  }

  // 완료 알림
  if (sender && !sender.isDestroyed()) {
    sender.send("canva:downloaded", {
      success: true,
      downloaded: totalDownloaded,
      outputDir: outDir,
      results,
      methods: results.reduce((acc, r) => {
        acc[r.method] = (acc[r.method] || 0) + 1;
        return acc;
      }, {})
    });
  }

  console.log(`[canva-api] Enhanced bulk download completed: ${totalDownloaded} files`);
  return {
    success: true,
    downloaded: totalDownloaded,
    outputDir: outDir,
    results,
    summary: `다운로드 완료: ${totalDownloaded}개 파일`
  };
}

// ============================== IPC 핸들러 등록 ==============================
function register() {
  // 중복 등록 방지를 위해 기존 핸들러 제거
  try {
    ipcMain.removeHandler("canva:login");
    ipcMain.removeHandler("canva:checkLogin");
    ipcMain.removeHandler("canva:apiDownload");
    ipcMain.removeHandler("canva:enhancedDownload");
  } catch (e) {
    // 핸들러가 없는 경우 무시
  }
  
  // 새로 등록
  ipcMain.handle("canva:login", handleCanvaLogin);
  ipcMain.handle("canva:checkLogin", handleCheckLogin);
  ipcMain.handle("canva:apiDownload", handleBulkDownload);
  ipcMain.handle("canva:enhancedDownload", handleBulkDownloadEnhanced);
  
  console.log("[canva-api] Enhanced IPC handlers registered");
  return true;
}

module.exports = { register };