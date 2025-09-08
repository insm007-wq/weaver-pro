// electron/ipc/canva.js
// ============================================================================
// Canva 자동화 IPC (Phase 1: 로그인/검색창 순차 오픈 + 다운로드 가로채기)
// - login(): Canva 브라우저 창 오픈 (사용자 로그인)
// - getSession(): 간단한 세션 체크(창/쿠키 유무 기반 베이직 헬스체크)
// - logout(): 파티션 쿠키 정리
// - autoRun(payload): 키워드별 검색 페이지를 순차로 열기 (다운로드는 사용자가 클릭)
// - stop(): autoRun 루프 중지
// - will-download 훅: 저장 경로/파일명 통일, 완료 이벤트 브로드캐스트
// - 이벤트: "canva:progress", "canva:downloaded"
// ============================================================================

const { app, BrowserWindow, ipcMain, session, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const store = require("../services/store"); // electron-store 래퍼 (프로젝트에 이미 존재)
let win = null;
let running = false;
let stopRequested = false;
let downloadHookAttached = false;
let canvaHeaders = {}; // 캔바 전용 헤더 저장
let videoDocTypeId = null; // 비디오 docType ID 저장

const PARTITION = "persist:canva";
const START_URL = "https://www.canva.com/"; // 로그인 진입
const SEARCH_BASE = "https://www.canva.com/templates/search/"; // 키워드 검색 진입

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
  return p;
}

// 기본 저장 루트(설정 → 저장 루트 우선, 없으면 C:\ContentWeaver\YYYY-MM-DD 또는 ~/ContentWeaver/…)
function getDefaultRoot() {
  const configured = store.get("paths.saveRoot") || store.get("paths.projectRoot") || store.get("paths.root") || null;

  if (configured) return ensureDir(configured);

  const base =
    process.platform === "win32" ? path.join("C:\\", "ContentWeaver", todayStr()) : path.join(os.homedir(), "ContentWeaver", todayStr());
  return ensureDir(base);
}

// 브로드캐스트 유틸
function emitAll(event, payload) {
  try {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(event, payload));
  } catch (e) {
    console.warn("[canva] emitAll fail:", e?.message || e);
  }
}

// 고도화된 캔바 자동 다운로드 (강화된 DOM 셀렉터 + API 호출 방식)
async function advancedCanvaDownload(browserWindow, keyword, targetCount) {
  try {
    // 먼저 API 방식 시도
    const apiResult = await tryApiDownload(browserWindow, keyword, targetCount);
    if (apiResult && apiResult > 0) {
      return apiResult;
    }
    
    // API 실패시 DOM 자동화 폴백
    console.log('[canva] API download failed, falling back to DOM automation');
    const result = await browserWindow.webContents.executeJavaScript(`
      (async function() {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const waitForElement = async (selector, timeout = 10000) => {
          const startTime = Date.now();
          while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await wait(100);
          }
          return null;
        };
        
        const waitForNetworkIdle = async () => {
          return new Promise(resolve => {
            let timeout;
            const resetTimeout = () => {
              clearTimeout(timeout);
              timeout = setTimeout(resolve, 1000); // 1초간 네트워크 활동 없으면 완료
            };
            
            // 초기 타이머 설정
            resetTimeout();
            
            // 네트워크 요청 감지
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
              resetTimeout();
              return originalFetch.apply(this, args);
            };
            
            // 10초 후 강제 완료
            setTimeout(resolve, 10000);
          });
        };
        
        let downloadCount = 0;
        const maxDownloads = ${targetCount};
        
        console.log('[Canva] Starting advanced auto-download for:', '${keyword}');
        
        // 페이지 로딩 완료 대기 (네트워크 idle까지)
        await waitForNetworkIdle();
        console.log('[Canva] Network idle detected, starting template search');
        
        // 스크롤하여 더 많은 템플릿 로드
        for (let scroll = 0; scroll < 3; scroll++) {
          window.scrollTo(0, document.body.scrollHeight);
          await wait(1500);
          console.log('[Canva] Scroll', scroll + 1, '- Loading more templates');
        }
        
        // 고도화된 템플릿 셀렉터 (캔바 UI 패턴 기반)
        const templateSelectors = [
          // 2024 캔바 UI 패턴
          '[data-testid="design-card"]',
          '[data-testid="template-card"]', 
          '[data-qa-id*="template"]',
          '.design-card',
          '.template-card',
          // 비디오 특화 셀렉터
          '[data-testid*="video"] [role="button"]',
          'article[data-testid*="design"]',
          'div[role="button"]:has(video)',
          // 백업 셀렉터
          'a[href*="/design/"]',
          '.search-result-item'
        ];
        
        let templates = [];
        for (const selector of templateSelectors) {
          templates = Array.from(document.querySelectorAll(selector));
          console.log('[Canva] Selector', selector, 'found:', templates.length);
          if (templates.length >= maxDownloads) break;
        }
        
        console.log('[Canva] Total templates found:', templates.length);
        
        // 템플릿별 다운로드 시도
        for (let i = 0; i < Math.min(templates.length, maxDownloads); i++) {
          try {
            const template = templates[i];
            
            // 템플릿이 보이는 위치로 스크롤
            template.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await wait(500);
            
            // 템플릿 클릭 (더 안전한 클릭)
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            template.dispatchEvent(clickEvent);
            
            console.log('[Canva] Clicked template', i + 1);
            
            // 에디터 페이지 로딩 완료 대기
            await waitForNetworkIdle();
            
            // 고도화된 다운로드/공유 버튼 찾기
            const shareDownloadSelectors = [
              // Share 버튼 먼저 찾기
              'button[data-testid="share-button"]',
              'button[aria-label*="Share"]',
              'button[aria-label*="공유"]',
              '[data-testid*="share"]',
              // 직접 다운로드 버튼
              'button[data-testid="download-button"]',
              'button[aria-label*="Download"]', 
              'button[aria-label*="다운로드"]',
              '[data-testid*="download"]',
              // 메뉴에서 찾기
              'button:has-text("Download")',
              'button:has-text("다운로드")'
            ];
            
            let shareBtn = null;
            for (const selector of shareDownloadSelectors) {
              shareBtn = document.querySelector(selector);
              if (shareBtn) {
                console.log('[Canva] Found button with selector:', selector);
                break;
              }
            }
            
            if (shareBtn) {
              shareBtn.click();
              console.log('[Canva] Clicked share/download button');
              await wait(2000);
              
              // Share 패널이 열렸다면 Download 옵션 찾기
              const downloadOptions = [
                'button[aria-label*="Download"]',
                'button[aria-label*="다운로드"]', 
                'div[data-testid*="download"] button',
                'a:has-text("Download")',
                'a:has-text("다운로드")'
              ];
              
              for (const selector of downloadOptions) {
                const downloadBtn = document.querySelector(selector);
                if (downloadBtn) {
                  downloadBtn.click();
                  console.log('[Canva] Clicked download option');
                  await wait(1500);
                  
                  // MP4/비디오 형식 선택
                  const mp4Options = [
                    'button:has-text("MP4")',
                    '[data-testid*="mp4"]',
                    'button[aria-label*="MP4"]'
                  ];
                  
                  for (const selector of mp4Options) {
                    const mp4Btn = document.querySelector(selector);
                    if (mp4Btn) {
                      mp4Btn.click();
                      console.log('[Canva] Selected MP4 format');
                      await wait(1000);
                      break;
                    }
                  }
                  
                  // 최종 다운로드 버튼 클릭
                  const finalDownloadBtns = [
                    'button[data-testid*="download-confirm"]',
                    'button:has-text("Download")',
                    'button:has-text("다운로드")',
                    '.download-panel button[type="submit"]'
                  ];
                  
                  for (const selector of finalDownloadBtns) {
                    const finalBtn = document.querySelector(selector);
                    if (finalBtn) {
                      finalBtn.click();
                      console.log('[Canva] Started final download');
                      downloadCount++;
                      break;
                    }
                  }
                  break;
                }
              }
            } else {
              console.log('[Canva] Share/Download button not found');
            }
            
            // 뒤로 가기 (더 안전한 방법)
            await wait(2000);
            if (window.history.length > 1) {
              window.history.back();
            } else {
              // 브라우저 뒤로가기가 안되면 검색 페이지로 직접 이동
              window.location.href = 'https://www.canva.com/templates/search/${encodeURIComponent(keyword)}';
            }
            await wait(3000);
            
          } catch (e) {
            console.warn('[Canva] Template', i + 1, 'error:', e);
            // 에러 시 안전한 복구
            try {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = 'https://www.canva.com/templates/search/${encodeURIComponent(keyword)}';
              }
            } catch (recoverError) {
              console.warn('[Canva] Recovery failed:', recoverError);
            }
            await wait(2000);
          }
        }
        
        console.log('[Canva] Advanced download completed:', downloadCount, '/', maxDownloads);
        return downloadCount;
        
      })();
    `);

    return result || 0;
  } catch (error) {
    console.warn(`[canva] Advanced auto-download error for ${keyword}:`, error?.message || error);
    return 0;
  }
}

// API 기반 다운로드 시도 (smart-video-editor 방식)
async function tryApiDownload(browserWindow, keyword, targetCount) {
  try {
    console.log('[canva] Trying API-based download for:', keyword);
    
    // 캔바 API를 통한 비디오 검색 및 다운로드
    const apiScript = `
      (async function() {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        
        try {
          // 비디오 docType ID 가져오기
          const docTypeResponse = await fetch('https://www.canva.com/_ajax/home/home-subpage-init?page=LAUNCHPAD', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'accept': '*/*',
              'x-canva-app': 'home',
              'x-canva-locale': 'ko-KR',
              'x-canva-request': 'gethomesubpageinit'
            }
          });
          
          if (!docTypeResponse.ok) {
            console.log('[API] Failed to get docType');
            return 0;
          }
          
          let docTypeText = await docTypeResponse.text();
          // 보안 prefix 제거
          const prefixes = ["'\"])}while(1);</x>//", "'\"])}while(1);</x>/"];
          for (const prefix of prefixes) {
            if (docTypeText.startsWith(prefix)) {
              docTypeText = docTypeText.substring(prefix.length);
              break;
            }
          }
          
          const docTypeData = JSON.parse(docTypeText);
          let videoDocTypeId = null;
          
          // docType.id 찾기
          const findDocTypeId = (obj) => {
            if (typeof obj === 'object' && obj !== null) {
              for (const [key, value] of Object.entries(obj)) {
                if (key === 'docType.name' && value === '동영상') {
                  if (obj['docType.id']) return obj['docType.id'];
                }
                const result = findDocTypeId(value);
                if (result) return result;
              }
            }
            return null;
          };
          
          videoDocTypeId = findDocTypeId(docTypeData);
          if (!videoDocTypeId) {
            console.log('[API] Video docType ID not found');
            return 0;
          }
          
          console.log('[API] Found video docType ID:', videoDocTypeId);
          
          // 비디오 검색
          const searchUrl = \`https://www.canva.com/_ajax/search/content2?query=\${encodeURIComponent('${keyword}')}&contentTypes=H&doctype=\${videoDocTypeId}&limit=${targetCount * 2}\`;
          const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'accept': '*/*',
              'x-canva-app': 'editor',
              'x-canva-request': 'searchcontent2api',
              'x-canva-locale': 'ko-KR'
            }
          });
          
          if (!searchResponse.ok) {
            console.log('[API] Search failed');
            return 0;
          }
          
          let searchText = await searchResponse.text();
          // 보안 prefix 제거
          for (const prefix of prefixes) {
            if (searchText.startsWith(prefix)) {
              searchText = searchText.substring(prefix.length);
              break;
            }
          }
          
          const searchData = JSON.parse(searchText);
          const videos = searchData?.A || [];
          
          console.log('[API] Found', videos.length, 'videos');
          
          let downloadCount = 0;
          const maxDownloads = Math.min(videos.length, ${targetCount});
          
          // 각 비디오에 대해 고화질 URL 가져오기 및 다운로드 트리거
          for (let i = 0; i < maxDownloads; i++) {
            const video = videos[i];
            if (!video.K) continue;
            
            try {
              // 고화질 비디오 정보 가져오기
              const hqUrl = \`https://www.canva.com/_ajax/video/?type=IDS&includeFiles&includePosterframes&includeTimelines&containers=A&containers=B&containers=D&ids=\${video.K}&mintVideoUrls=false&mintVideoFiles=false\`;
              const hqResponse = await fetch(hqUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'accept': '*/*',
                  'x-canva-app': 'editor',
                  'x-canva-request': 'findvideosapi'
                }
              });
              
              if (hqResponse.ok) {
                let hqText = await hqResponse.text();
                for (const prefix of prefixes) {
                  if (hqText.startsWith(prefix)) {
                    hqText = hqText.substring(prefix.length);
                    break;
                  }
                }
                
                const hqData = JSON.parse(hqText);
                const videoFiles = hqData?.A?.[0]?.c || [];
                
                // 최고 화질 URL 찾기
                let bestUrl = null;
                let bestResolution = 0;
                
                for (const file of videoFiles) {
                  const resolution = (file.A || 0) * (file.B || 0);
                  if (resolution > bestResolution) {
                    bestResolution = resolution;
                    bestUrl = file.E;
                  }
                }
                
                if (bestUrl) {
                  // 다운로드 트리거 (실제 다운로드는 Electron will-download 이벤트가 처리)
                  const link = document.createElement('a');
                  link.href = bestUrl;
                  link.download = \`canva_${keyword}_\${i + 1}.mp4\`;
                  link.click();
                  downloadCount++;
                  await wait(1000);
                }
              }
            } catch (e) {
              console.warn('[API] Video', i, 'download error:', e);
            }
          }
          
          // 비디오가 부족한 경우 사진으로 대체
          if (downloadCount < ${targetCount}) {
            console.log('[API] Not enough videos, trying photos...');
            
            // 사진 검색 API
            const photoUrl = \`https://www.canva.com/_ajax/search/media2-untokenized?q=\${encodeURIComponent('${keyword}')}&domainName=photos&category=tACFanYhFT4&expandCategoryScope=false&types=B&perGroupLimit=10&docId=\${videoDocTypeId}&organic&trigger=search_bar&clientFeature=web_2_object_panel&mediaTypes=R&freeOnly=false&designSchemaVersion=web-2&fileQualities=TLSHU&includeTotalHits=false&explain=false&limit=${targetCount - downloadCount}&skipRewrites=false&skipAnalytics=false&preferredSize=90000&includeAnimatedPreviews&cutout=false&contentTypes=P\`;
            
            const photoResponse = await fetch(photoUrl, {
              method: 'GET',
              credentials: 'include',
              headers: {
                'accept': '*/*',
                'x-canva-app': 'editor',
                'x-canva-locale': 'ko-KR',
                'x-canva-request': 'searchmedia2api'
              }
            });
            
            if (photoResponse.ok) {
              let photoText = await photoResponse.text();
              for (const prefix of prefixes) {
                if (photoText.startsWith(prefix)) {
                  photoText = photoText.substring(prefix.length);
                  break;
                }
              }
              
              const photoData = JSON.parse(photoText);
              const photos = photoData?.A || [];
              
              console.log('[API] Found', photos.length, 'photos');
              
              // 사진 다운로드
              for (let i = 0; i < Math.min(photos.length, ${targetCount} - downloadCount); i++) {
                const photo = photos[i];
                const imageVersions = photo.V || [];
                
                // 최고 화질 이미지 URL 찾기
                let bestUrl = '';
                let maxSize = 0;
                
                for (const version of imageVersions) {
                  const size = (version.width || 0) * (version.height || 0);
                  if (!version.watermarked && size > maxSize) {
                    maxSize = size;
                    bestUrl = version.url;
                  }
                }
                
                if (bestUrl) {
                  const link = document.createElement('a');
                  link.href = bestUrl;
                  link.download = \`canva_${keyword}_photo_\${downloadCount + i + 1}.jpg\`;
                  link.click();
                  await wait(500);
                }
              }
              
              downloadCount += Math.min(photos.length, ${targetCount} - downloadCount);
            }
          }
          
          console.log('[API] Total downloaded:', downloadCount);
          return downloadCount;
          
        } catch (error) {
          console.error('[API] Error:', error);
          return 0;
        }
      })();
    `;
    
    const result = await browserWindow.webContents.executeJavaScript(apiScript);
    return result || 0;
    
  } catch (error) {
    console.warn('[canva] API download error:', error?.message || error);
    return 0;
  }
}

function createOrFocusWindow() {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Canva",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload.js"),
      partition: PARTITION,
    },
  });

  // 다운로드 가로채기 (세션 단위 1회만 설치)
  const ses = win.webContents.session;
  if (!downloadHookAttached) {
    ses.on("will-download", (e, item) => {
      try {
        const url = item.getURL();
        const mime = item.getMimeType();
        const origName = item.getFilename() || "download.mp4";

        // 런타임 옵션을 window 전역 대신 세션 temp에 담아둠
        const runtime = ses.__CW_RUNTIME__ || {};
        const keyword = runtime.__LAST_KEYWORD__ || "keyword";
        const seq = (runtime.__SEQ_MAP__ = runtime.__SEQ_MAP__ || {});
        const n = (seq[keyword] = (seq[keyword] || 0) + 1);

        const w = runtime.targetRes?.w || 1920;
        const h = runtime.targetRes?.h || 1080;
        const pattern = runtime.fileNamePattern || "{keyword}_{seq}_{w}x{h}";
        const ext = path.extname(origName) || (mime && mime.includes("video") ? ".mp4" : ".mp4");

        const safeKeyword = String(keyword)
          .replace(/[\\/:*?"<>|]/g, "_")
          .slice(0, 60);
        const fileName =
          pattern
            .replace("{keyword}", safeKeyword)
            .replace("{seq}", String(n).padStart(2, "0"))
            .replace("{w}", String(w))
            .replace("{h}", String(h)) + ext;

        const baseDir = ensureDir(path.join(getDefaultRoot(), "videos"));
        const savePath = path.join(baseDir, fileName);
        item.setSavePath(savePath);

        item.on("updated", (_e, state) => {
          emitAll("canva:progress", {
            keyword,
            phase: "download",
            message: state,
          });
        });

        item.once("done", (_e, state) => {
          if (state === "completed") {
            emitAll("canva:progress", {
              keyword,
              phase: "save",
              message: "completed",
              savedDelta: 1,
            });
            emitAll("canva:downloaded", {
              path: savePath,
              keyword,
              width: w,
              height: h,
              durationSec: 0,
              thumbUrl: "",
              provider: "canva",
              assetId: path.basename(savePath, ext),
            });
            emitAll("canva:progress", {
              keyword,
              phase: "done",
            });
          } else {
            emitAll("canva:progress", {
              keyword,
              phase: "save",
              message: state,
              skipDelta: 1,
              reason: "saveError",
            });
          }
        });
      } catch (err) {
        console.warn("[canva] will-download error:", err?.message || err);
      }
    });
    downloadHookAttached = true;
  }

  // 네트워크 요청 모니터링으로 캔바 헤더 수집
  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('canva.com')) {
      // 캔바 전용 헤더 수집
      const headers = details.requestHeaders;
      for (const key in headers) {
        if (key.toLowerCase().startsWith('x-canva')) {
          canvaHeaders[key] = headers[key];
        }
      }
      
      // API 요청에서 docType ID 추출 시도
      if (details.url.includes('home-subpage-init') && !videoDocTypeId) {
        win.webContents.executeJavaScript(`
          fetch('${details.url}', { credentials: 'include' })
            .then(r => r.text())
            .then(text => {
              const prefixes = ["'\"])}while(1);</x>//"];
              for (const prefix of prefixes) {
                if (text.startsWith(prefix)) {
                  text = text.substring(prefix.length);
                  break;
                }
              }
              const data = JSON.parse(text);
              // docType.id 찾기 로직
              const findId = (obj) => {
                if (typeof obj === 'object' && obj !== null) {
                  for (const [k, v] of Object.entries(obj)) {
                    if (k === 'docType.name' && v === '동영상') {
                      return obj['docType.id'];
                    }
                    const result = findId(v);
                    if (result) return result;
                  }
                }
                return null;
              };
              return findId(data);
            });
        `).then(id => {
          if (id) {
            videoDocTypeId = id;
            console.log('[canva] Found video docType ID:', videoDocTypeId);
          }
        }).catch(() => {});
      }
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  win.on("closed", () => {
    win = null;
    canvaHeaders = {};
    videoDocTypeId = null;
  });

  win.loadURL(START_URL);
  return win;
}

// 고도화된 Google OAuth 자동 로그인
async function enhancedGoogleLogin(browserWindow) {
  try {
    console.log('[canva] Starting enhanced Google OAuth automation');
    
    const result = await browserWindow.webContents.executeJavaScript(`
      (async function() {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const waitForElement = async (selector, timeout = 15000) => {
          const startTime = Date.now();
          while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) return element;
            await wait(200);
          }
          return null;
        };
        
        console.log('[OAuth] Starting Google login automation');
        
        // 1. Google 로그인 버튼 찾기 (여러 패턴)
        const googleLoginSelectors = [
          'button[data-qa-id*="google"]',
          'button[aria-label*="Google"]',
          'button:has-text("Google")',
          '[data-testid*="google"] button',
          '.google-login-button',
          'button[class*="google"]',
          'a[href*="google"][href*="oauth"]'
        ];
        
        let googleBtn = null;
        for (const selector of googleLoginSelectors) {
          googleBtn = document.querySelector(selector);
          if (googleBtn) {
            console.log('[OAuth] Found Google button with:', selector);
            break;
          }
        }
        
        if (!googleBtn) {
          console.log('[OAuth] Google login button not found');
          return { success: false, reason: 'google_button_not_found' };
        }
        
        // Google 버튼 클릭
        googleBtn.click();
        console.log('[OAuth] Clicked Google login button');
        await wait(3000);
        
        // 2. Google 계정 선택 (이미 로그인된 경우)
        await wait(2000);
        const accountSelectors = [
          '[data-email]',
          '[data-identifier]', 
          'div[role="button"]:has([data-email])',
          '.account-card',
          '[jsname="bPKPid"]' // Google 계정 카드
        ];
        
        for (const selector of accountSelectors) {
          const accounts = document.querySelectorAll(selector);
          if (accounts.length > 0) {
            console.log('[OAuth] Found', accounts.length, 'Google accounts');
            // 첫 번째 계정 선택
            accounts[0].click();
            console.log('[OAuth] Selected first Google account');
            await wait(3000);
            break;
          }
        }
        
        // 3. 이메일/비밀번호 입력이 필요한 경우 자동 감지
        const emailInput = await waitForElement('input[type="email"], input[id*="email"], input[name*="email"]');
        const hasEmailField = !!emailInput;
        
        if (hasEmailField) {
          console.log('[OAuth] Manual login required - email field detected');
          return { success: false, reason: 'manual_login_required', hasEmailField: true };
        }
        
        // 4. 권한 승인 자동화
        await wait(2000);
        const approveSelectors = [
          'button[id="submit_approve_access"]',
          'button:has-text("Allow")',
          'button:has-text("허용")',
          'button[data-qa-id*="approve"]',
          '#submit_approve_access'
        ];
        
        for (const selector of approveSelectors) {
          const approveBtn = document.querySelector(selector);
          if (approveBtn) {
            approveBtn.click();
            console.log('[OAuth] Clicked approve button');
            await wait(3000);
            break;
          }
        }
        
        // 5. 로그인 성공 확인 (Canva 메인 페이지로 돌아왔는지)
        await wait(5000);
        const isCanvaMain = window.location.href.includes('canva.com') && 
                           !window.location.href.includes('login');
        
        if (isCanvaMain) {
          console.log('[OAuth] Login success - returned to Canva main');
          return { success: true, redirected: true };
        }
        
        return { success: false, reason: 'login_incomplete' };
        
      })();
    `);
    
    return result;
  } catch (error) {
    console.warn('[canva] Enhanced Google login error:', error?.message || error);
    return { success: false, reason: 'automation_error', error: error?.message };
  }
}

// 간단 세션 헬스체크: Canva 도메인 쿠키 유무 확인(대체용)
async function hasCanvaCookie() {
  try {
    const ses = session.fromPartition(PARTITION);
    const cookies = await ses.cookies.get({ domain: ".canva.com" });
    // 쿠키가 1개라도 있으면 로그인된 것으로 간주(보수적 단순판단)
    return Array.isArray(cookies) && cookies.length > 0;
  } catch {
    return false;
  }
}

/* =============================== IPC 등록 =============================== */
function register() {
  // 로그인: 창 오픈 후 URL 로드. (실제 로그인은 사용자가 수행)
  ipcMain.handle("canva:login", async () => {
    const w = createOrFocusWindow();
    try {
      await w.loadURL(START_URL);
    } catch (_) {}
    // 2초 뒤 쿠키 한번 체크(너무 빡세게 확인하지 않음)
    setTimeout(async () => {
      const ok = await hasCanvaCookie();
      emitAll("canva:progress", {
        keyword: null,
        phase: "login",
        message: ok ? "logged-in" : "not-logged-in",
      });
    }, 2000);

    // 사용자 정보까지는 불가 → 기본 응답
    return { ok: true, user: null };
  });

  // 세션 조회 - canva-browse.js에서 처리하므로 주석 처리
  // ipcMain.handle("canva:getSession", async () => {
  //   const ok = await hasCanvaCookie();
  //   return { ok, session: ok ? { user: null } : null };
  // });

  // 로그아웃: 파티션 쿠키 모두 제거
  ipcMain.handle("canva:logout", async () => {
    try {
      const ses = session.fromPartition(PARTITION);
      const cookies = await ses.cookies.get({});
      await Promise.all(
        cookies.map((c) => ses.cookies.remove((c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + (c.path || "/"), c.name))
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || String(e) };
    }
  });

  // 자동화 시작(스마트 80개 타겟 달성 로직)
  ipcMain.handle("canva:autoRun", async (_evt, payload = {}) => {
    if (running) return { ok: false, message: "이미 실행 중입니다." };
    const keywords = Array.isArray(payload.keywords) ? payload.keywords : [];
    if (!keywords.length) return { ok: false, message: "키워드가 없습니다." };

    // 스마트 80개 타겟 달성 로직
    const targetTotal = payload.targetTotal || 80;
    const keywordCount = keywords.length;
    const basePerKeyword = Math.floor(targetTotal / keywordCount);
    const remainder = targetTotal % keywordCount;
    
    // 키워드별 할당량 계산 (나머지는 앞 키워드들에 1개씩 추가)
    const keywordQuotas = keywords.map((_, index) => 
      basePerKeyword + (index < remainder ? 1 : 0)
    );
    
    console.log(`[canva] Smart target distribution: ${targetTotal} total across ${keywordCount} keywords`);
    console.log(`[canva] Quotas:`, keywordQuotas.map((q, i) => `${keywords[i]}:${q}`).join(', '));

    const w = createOrFocusWindow();
    const ses = w.webContents.session;
    // 런타임 파라미터 공유(다운로드 파일명 생성에 사용)
    ses.__CW_RUNTIME__ = {
      targetRes: payload.targetRes || { w: 1920, h: 1080 },
      fileNamePattern: payload.fileNamePattern || "{keyword}_{seq}_{w}x{h}",
      __SEQ_MAP__: {},
    };

    running = true;
    stopRequested = false;
    
    // 전체 진행률 추적
    let totalCompleted = 0;
    let totalFailed = 0;

    try {
      for (let keywordIndex = 0; keywordIndex < keywords.length; keywordIndex++) {
        if (stopRequested) break;
        
        const k = keywords[keywordIndex];
        const quota = keywordQuotas[keywordIndex];
        
        // 진행 메시지: 스마트 80개 타겟 추적
        emitAll("canva:progress", { 
          keyword: k, 
          phase: "search", 
          message: `${totalCompleted}/${targetTotal} - ${k} 검색중 (목표: ${quota}개)`,
          total: targetTotal,
          saved: totalCompleted,
          failed: totalFailed
        });

        // 마지막 키워드 기록(다운로드 네이밍 용)
        ses.__CW_RUNTIME__.__LAST_KEYWORD__ = k;

        // 검색 페이지 열기
        const url = SEARCH_BASE + encodeURIComponent(k);
        await w.loadURL(url);

        // 페이지 로딩 대기
        await new Promise((r) => setTimeout(r, 3000));

        // 고급 자동 다운로드 실행 (할당된 quota만큼)
        emitAll("canva:progress", { 
          keyword: k, 
          phase: "pick", 
          message: `${totalCompleted}/${targetTotal} - ${k} 다운로드중 (목표: ${quota}개)`,
          total: targetTotal,
          saved: totalCompleted,
          failed: totalFailed
        });
        
        try {
          // 먼저 검색 페이지가 제대로 로드되었는지 확인
          await new Promise(r => setTimeout(r, 2000));
          
          const downloadCount = await advancedCanvaDownload(w, k, quota);
          totalCompleted += downloadCount;
          
          emitAll("canva:progress", { 
            keyword: k, 
            phase: "pick", 
            message: `${totalCompleted}/${targetTotal} - ${k} ${downloadCount}개 완료`,
            pickedDelta: downloadCount,
            total: targetTotal,
            saved: totalCompleted,
            failed: totalFailed
          });
          
          // 80개 달성 시 조기 완료
          if (totalCompleted >= targetTotal) {
            console.log(`[canva] Target ${targetTotal} achieved! Stopping early.`);
            emitAll("canva:progress", { 
              keyword: null, 
              phase: "done", 
              message: `🎉 목표 달성! ${totalCompleted}/${targetTotal} 완료`,
              total: targetTotal,
              saved: totalCompleted,
              failed: totalFailed
            });
            break;
          }
          
        } catch (downloadError) {
          console.warn(`[canva] Download failed for ${k}:`, downloadError?.message || downloadError);
          totalFailed += quota;
          
          emitAll("canva:progress", { 
            keyword: k, 
            phase: "pick", 
            message: `${totalCompleted}/${targetTotal} - ${k} 실패`,
            skipDelta: quota,
            reason: "downloadError",
            total: targetTotal,
            saved: totalCompleted,
            failed: totalFailed
          });
        }

        // 키워드 간 간격 (서버 부하 방지)
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
      }

      // 최종 완료 메시지
      if (totalCompleted < targetTotal) {
        emitAll("canva:progress", { 
          keyword: null, 
          phase: "done", 
          message: `다운로드 완료: ${totalCompleted}/${targetTotal}`,
          total: targetTotal,
          saved: totalCompleted,
          failed: totalFailed
        });
      }
      
      return { 
        ok: true, 
        completed: totalCompleted,
        failed: totalFailed,
        target: targetTotal
      };
    } catch (e) {
      console.warn("[canva:autoRun] error:", e?.message || e);
      return { ok: false, message: e?.message || String(e) };
    } finally {
      running = false;
    }
  });

  // 중지
  ipcMain.handle("canva:stop", async () => {
    stopRequested = true;
    return { ok: true };
  });

  console.log("[ipc] canva: registered");
}

module.exports = { register };
