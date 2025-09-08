// electron/ipc/canva-stealth.js
// ============================================================================
// Canva 스텔스 자동화 IPC (puppeteer-extra + stealth + CDP)
// - 크롬 자동 실행 + 스텔스 우회
// - 로그인 세션 관리
// - CDP 네트워크 세션으로 요청 수집
// - 템플릿 페이지 진입 → 쿠키/헤더 추출
// - 비디오 검색·식별을 위한 사전 값 확보
// - 네트워크/요청 재현으로 mp4 확보 → 파일 저장
// - 중복 다운로드 방지 (4중 트래커)
// ============================================================================

const { app, ipcMain } = require("electron");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const path = require("path");
const fs = require("fs").promises;
const axios = require("axios");
const crypto = require("crypto");
const { getProjectRoot } = require("./files");

// 🔒 최강 Stealth 플러그인 활성화 (canvaService 기법 적용)
puppeteer.use(StealthPlugin({
  enabledEvasions: new Set([
    'chrome.app',
    'chrome.csi', 
    'chrome.loadTimes',
    'chrome.runtime',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.vendor',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override',
    'webgl.vendor',
    'window.outerdimensions'
  ])
}));

class CanvaStealthService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.cdpSession = null;
    this.sessionActive = false;
    this.canvaHeaders = {};
    this.videoDocTypeId = null;
    this.cookieString = null;
    this.userAgent = null;
    this.duplicateTracker = {
      ids: new Set(),
      urls: new Set(),
      fileHashes: new Set(),
      titleHashes: new Set()
    };
    // 날짜 기반 프로젝트 루트의 videos 폴더 사용 (C:\ContentWeaver\YYYY-MM-DD\videos\)
    this.downloadDir = path.join(getProjectRoot(), 'videos');
  }

  // 시스템 Chrome 경로 탐지
  async findSystemChrome() {
    const possiblePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
      path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe")
    ].filter(Boolean); // null/undefined 경로 제거

    console.log(`🔍 Chrome 경로 탐지 시작 - ${possiblePaths.length}개 경로 확인`);
    
    for (const chromePath of possiblePaths) {
      try {
        console.log(`📍 확인 중: ${chromePath}`);
        await fs.access(chromePath);
        console.log(`✅ Chrome 발견: ${chromePath}`);
        return chromePath;
      } catch (e) {
        console.log(`❌ 없음: ${chromePath} - ${e.message}`);
        continue;
      }
    }
    
    console.log("⚠️ 시스템 Chrome을 찾을 수 없어 기본 Chromium을 사용합니다");
    return null;
  }

  // 크롬 자동 실행 + 스텔스 우회 초기화
  async initBrowser() {
    try {
      console.log("🚀 스텔스 브라우저 초기화 중...");

      const systemChrome = await this.findSystemChrome();
      const profileDir = path.join(app.getPath('userData'), 'chrome_profile_canva_stealth');
      
      console.log(`📁 프로필 디렉토리: ${profileDir}`);
      
      // 프로필 디렉토리 생성
      try {
        await fs.mkdir(profileDir, { recursive: true });
        console.log(`✅ 프로필 디렉토리 생성 완료`);
      } catch (e) {
        console.log(`⚠️ 프로필 디렉토리 생성 실패: ${e.message}`);
      }
      
      // 🔒 canvaService 검증된 최강 보안 우회 설정 적용
      const launchOptions = {
        headless: false,
        defaultViewport: null,
        userDataDir: profileDir, // 실제 Chrome 프로필 재사용
        ignoreHTTPSErrors: true,
        devtools: false,
        args: [
          // 🔒 캔바 탐지 완전 차단 설정 (canvaService 기법)
          '--disable-blink-features=AutomationControlled',
          `--user-data-dir=${profileDir}`,
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          
          // 🔒 핵심 탐지 방지
          '--disable-extensions-except=',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-client-side-phishing-detection',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-zygote',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-background-networking',
          '--disable-background-downloads',
          '--disable-add-to-shelf',
          '--disable-datasaver-prompt',
          '--disable-default-apps',
          '--disable-desktop-notifications',
          '--disable-domain-reliability',
          '--disable-component-extensions-with-background-pages',
          '--disable-permissions-api',
          '--disable-print-preview',
          '--disable-speech-api',
          '--disable-file-system-api',
          '--disable-presentation-api',
          '--disable-new-zip-unpacker',
          '--disable-media-session-api',
          
          // 🔒 최신 User Agent로 실제 사용자처럼 보이게
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          '--accept-lang=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          
          // 🔒 추가 보안 우회
          '--disable-features=TranslateUI',
          '--disable-infobars',
          '--disable-logging',
          '--disable-login-animations',
          '--disable-notifications',
          '--disable-password-generation',
          '--disable-save-password-bubble',
          '--disable-single-click-autofill',
          '--disable-autofill-keyboard-accessory-view',
          '--no-service-autorun',
          '--password-store=basic',
          '--use-mock-keychain'
        ],
        
        ignoreDefaultArgs: [
          '--enable-automation',
          '--enable-blink-features=AutomationControlled',
          '--disable-background-networking',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };

      if (systemChrome) {
        launchOptions.executablePath = systemChrome;
        console.log(`🎯 Chrome 실행 파일 설정: ${systemChrome}`);
      } else {
        console.log(`🔧 기본 Chromium 사용`);
      }

      console.log(`🚀 Puppeteer 실행 중... 옵션:`, {
        headless: launchOptions.headless,
        executablePath: launchOptions.executablePath || 'default',
        userDataDir: launchOptions.userDataDir,
        argsCount: launchOptions.args.length
      });

      this.browser = await puppeteer.launch(launchOptions);
      console.log(`✅ 브라우저 실행 성공`);
      this.page = await this.browser.newPage();
      
      // 화면 크기 설정 (검은 화면 방지)
      await this.page.setViewport({ 
        width: 1366, 
        height: 768,
        deviceScaleFactor: 1
      });
      console.log(`📱 화면 크기 설정 완료: 1366x768`);

      // 🔒 최강 탐지 방지 스크립트 주입 (canvaService 검증된 기법)
      await this.page.evaluateOnNewDocument(() => {
        // webdriver 완전 제거
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });
        
        // chrome 객체 완전 구현 (실제 Chrome처럼)
        window.chrome = {
          runtime: {
            onConnect: undefined,
            onMessage: undefined,
            connect: () => ({}),
            sendMessage: () => ({})
          },
          loadTimes: () => ({
            commitLoadTime: Math.random() * 1000 + 1000,
            finishDocumentLoadTime: Math.random() * 1000 + 2000,
            finishLoadTime: Math.random() * 1000 + 3000,
            firstPaintAfterLoadTime: Math.random() * 1000 + 2500,
            firstPaintTime: Math.random() * 1000 + 1500,
            navigationType: 'navigate',
            requestTime: Date.now() / 1000 - Math.random() * 10,
            startLoadTime: Math.random() * 1000 + 500
          }),
          csi: () => ({
            onloadT: Date.now(),
            startE: Date.now(),
            tran: 15
          }),
          app: {
            isInstalled: false,
            InstallState: {
              DISABLED: 'disabled',
              INSTALLED: 'installed',
              NOT_INSTALLED: 'not_installed'
            }
          }
        };
        
        // 🔒 강력한 자동화 속성 제거 (canvaService 기법)
        const automationProps = [
          '$cdc_asdjflasutopfhvcZLmcfl_',
          '$chrome_asyncScriptInfo',
          '__$webdriverAsyncExecutor',
          '__driver_evaluate',
          '__webdriver_evaluate',
          '__selenium_evaluate',
          '__fxdriver_evaluate',
          '__driver_unwrapped',
          '__webdriver_unwrapped',
          '__selenium_unwrapped',
          '__fxdriver_unwrapped',
          '__webdriver_script_fn',
          '__webdriver_script_func',
          '__webdriver_script_function'
        ];
        
        automationProps.forEach(prop => {
          delete window[prop];
          Object.defineProperty(window, prop, {
            get: () => undefined,
            set: () => {},
            configurable: true
          });
        });
        
        // 추가 핑거프린트 랜덤화
        Object.defineProperty(navigator, 'languages', {
          get: () => ['ko-KR', 'ko', 'en-US', 'en']
        });
        
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32'
        });
      });

      // 🔒 완벽한 헤더 설정 (canvaService 기법)
      await this.page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate', 
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"'
      });

      this.userAgent = await this.page.evaluate(() => navigator.userAgent);
      console.log(`🔧 User-Agent: ${this.userAgent}`);
      console.log(`🔒 canvaService 검증된 최강 보안 우회 설정 완료!`);

      return true;
    } catch (error) {
      console.error("❌ 브라우저 초기화 실패:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // 일반적인 오류들에 대한 해결책 제시
      if (error.message.includes('Could not find expected browser')) {
        console.error("💡 해결책: Chrome이 설치되지 않았거나 경로를 찾을 수 없습니다. Chrome을 설치하세요.");
      } else if (error.message.includes('Failed to launch')) {
        console.error("💡 해결책: 브라우저 실행 권한 문제이거나 이미 실행 중일 수 있습니다.");
      } else if (error.message.includes('EACCES')) {
        console.error("💡 해결책: 파일 권한 문제입니다. 관리자 권한으로 실행하세요.");
      }
      
      throw error;
    }
  }

  // 로그인 페이지로 이동 + CDP 세션 시작
  async startLoginSession() {
    try {
      if (!this.page) {
        await this.initBrowser();
      }

      console.log("🔐 로그인 세션 시작...");

      // CDP 세션 연결
      this.cdpSession = await this.page.target().createCDPSession();
      await this.cdpSession.send("Network.enable");
      await this.cdpSession.send("Runtime.enable");

      // 네트워크 요청 모니터링
      this.setupNetworkMonitoring();

      // 🔒 canvaService 자연스러운 탐색 패턴 적용
      console.log("🔍 캔바 접속 시작 - 자연스러운 탐색 패턴...");
      
      // 실제 사용자처럼 직접 Canva 접속 (중간 단계 생략)
      console.log("🌐 Canva 메인 페이지 직접 접속");
      await this.page.goto("https://www.canva.com", {
        waitUntil: "networkidle0",
        timeout: 60000
      });
      
      // 자연스러운 행동 시뮬레이션
      await this.simulateHumanBehavior();
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // 현재 URL 상태 확인
      const currentUrl = await this.page.url();
      console.log(`📍 현재 위치: ${currentUrl}`);
      
      // Cloudflare 검증 자동 처리
      await this.waitForCloudflareBypass();
      
      // 로그인 페이지로 자연스럽게 이동
      console.log("🔐 로그인 페이지로 이동");
      await this.page.goto("https://www.canva.com/ko_kr/login", {
        waitUntil: "networkidle0",
        timeout: 45000
      });

      console.log("✅ 로그인 페이지 로드 완료");
      console.log("💡 브라우저에서 로그인을 완료해주세요.");

      return { success: true, message: "로그인 창이 열렸습니다. 로그인을 완료해주세요." };
    } catch (error) {
      console.error("❌ 로그인 세션 시작 실패:", error);
      throw error;
    }
  }

  // CDP 네트워크 세션 요청 수집
  setupNetworkMonitoring() {
    this.cdpSession.on("Network.requestWillBeSent", (params) => {
      const { url, headers } = params.request;

      if (url.includes("canva.com")) {
        // x-canva-* 헤더 수집
        for (const [key, value] of Object.entries(headers)) {
          if (key.toLowerCase().startsWith("x-canva")) {
            this.canvaHeaders[key] = value;
          }
        }

        // User-Agent 업데이트
        if (headers["user-agent"]) {
          this.userAgent = headers["user-agent"];
        }
      }
    });

    this.cdpSession.on("Network.responseReceived", (params) => {
      // MP4 응답 감지
      const { url, headers } = params.response;
      if (url.includes(".mp4") || headers["content-type"]?.includes("video")) {
        console.log(`🎥 비디오 응답 감지: ${url.substring(0, 100)}...`);
      }
    });
  }

  // 로그인 확인 → 세션 고정
  async confirmLogin() {
    try {
      if (!this.page) {
        return { success: false, message: "브라우저가 열려있지 않습니다." };
      }

      const currentUrl = await this.page.url();
      console.log(`📍 현재 URL: ${currentUrl}`);

      // 로그인 완료 판정 (URL 기반)
      if (currentUrl.includes("login") || currentUrl.includes("signup")) {
        return { success: false, message: "아직 로그인되지 않았습니다." };
      }

      // 쿠키 추출
      const cookies = await this.page.cookies();
      this.cookieString = cookies.map(c => `${c.name}=${c.value}`).join("; ");
      console.log(`🍪 쿠키 추출 완료: ${cookies.length}개`);

      // 템플릿 페이지 진입 → 쿠키/헤더 추출
      await this.navigateToTemplatesAndExtractHeaders();

      // 비디오 문서 타입 ID 확보
      await this.getVideoDocumentTypeId();

      if (this.videoDocTypeId) {
        this.sessionActive = true;
        console.log("✅ 세션 활성화 완료!");
        console.log(`📊 수집된 헤더: ${Object.keys(this.canvaHeaders).join(", ")}`);
        console.log(`📺 Video DocType ID: ${this.videoDocTypeId}`);

        return {
          success: true,
          message: "로그인 성공! 세션이 활성화되었습니다.",
          sessionActive: true,
          headersCount: Object.keys(this.canvaHeaders).length,
          videoDocTypeId: this.videoDocTypeId
        };
      }

      return { success: false, message: "세션 설정 실패" };
    } catch (error) {
      console.error("❌ 로그인 확인 실패:", error);
      return { success: false, message: error.message };
    }
  }

  // 템플릿 페이지 진입 → 쿠키/헤더 추출 (강화된 버전)
  async navigateToTemplatesAndExtractHeaders() {
    try {
      console.log("📋 템플릿 페이지로 이동하여 헤더 수집...");

      // 1단계: 템플릿 페이지 방문
      await this.page.goto("https://www.canva.com/templates/", {
        waitUntil: "networkidle2",
        timeout: 30000
      });
      
      // 헤더 수집을 위한 충분한 대기
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`📊 1단계 헤더: ${Object.keys(this.canvaHeaders).join(", ")}`);

      // 2단계: 검색 요청 실행하여 헤더 수집
      console.log("🔍 검색 요청 실행하여 필수 헤더 수집...");
      
      await this.page.evaluate(async () => {
        try {
          // 실제 검색 요청을 보내서 헤더를 수집
          const searchResponse = await fetch("https://www.canva.com/_ajax/search/content2?query=test&limit=5", {
            method: "GET",
            credentials: "include",
            headers: {
              "accept": "*/*",
              "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
              "x-canva-app": "search",
              "x-canva-request": "searchcontent",
              "referer": "https://www.canva.com/templates/"
            }
          });
          console.log("검색 요청 상태:", searchResponse.status);
        } catch (e) {
          console.log("검색 요청 실패 (정상 - 헤더 수집용):", e.message);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3단계: 비디오 관련 페이지 방문
      const videoPages = [
        "https://www.canva.com/templates/videos/",
        "https://www.canva.com/create/videos/"
      ];

      for (const url of videoPages) {
        try {
          console.log(`🎬 비디오 페이지 방문: ${url}`);
          await this.page.goto(url, {
            waitUntil: "networkidle2", 
            timeout: 20000
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 페이지에서 검색 시도
          await this.page.evaluate(() => {
            try {
              const searchInput = document.querySelector('input[type="text"], input[placeholder*="search"], input[placeholder*="검색"]');
              if (searchInput) {
                searchInput.value = "test";
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } catch (e) {
              console.log("검색 입력 시도 실패:", e);
            }
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.log(`비디오 페이지 방문 실패: ${e.message}`);
        }
      }

      // 4단계: CSRF 토큰 및 필수 인증 헤더 추출
      console.log("🔐 CSRF 토큰 및 인증 헤더 추출...");
      
      const authData = await this.page.evaluate(() => {
        try {
          // 페이지에서 CSRF 토큰이나 인증 데이터 찾기
          const scripts = Array.from(document.querySelectorAll('script'));
          let csrfToken = null;
          let authTokens = {};
          
          for (const script of scripts) {
            const content = script.textContent || '';
            
            // CSRF 토큰 패턴들 찾기
            const csrfMatches = content.match(/(?:csrf[_-]?token|_token|authenticity_token)["']\s*:\s*["']([^"']+)["']/i);
            if (csrfMatches) {
              csrfToken = csrfMatches[1];
            }
            
            // x-canva 관련 토큰들 찾기
            const canvaMatches = content.matchAll(/["']x-canva-[^"']+["']\s*:\s*["']([^"']+)["']/gi);
            for (const match of canvaMatches) {
              const key = match[0].replace(/["']/g, '').split(':')[0];
              authTokens[key] = match[1];
            }
          }
          
          // 메타 태그에서도 토큰 찾기
          const metaCsrf = document.querySelector('meta[name="csrf-token"], meta[name="_token"]');
          if (metaCsrf && !csrfToken) {
            csrfToken = metaCsrf.getAttribute('content');
          }
          
          return { csrfToken, authTokens };
        } catch (e) {
          return { csrfToken: null, authTokens: {} };
        }
      });
      
      // 5단계: 필수 헤더 수동 설정 + 인증 토큰 추가
      console.log("🔧 필수 헤더 수동 설정...");
      this.canvaHeaders = {
        ...this.canvaHeaders,
        "x-canva-app": "search",
        "x-canva-request": "searchcontent",
        "x-canva-locale": "ko-KR",
        ...authData.authTokens
      };
      
      // CSRF 토큰이 있으면 추가
      if (authData.csrfToken) {
        this.canvaHeaders["x-csrf-token"] = authData.csrfToken;
        this.canvaHeaders["x-requested-with"] = "XMLHttpRequest";
        console.log(`🔐 CSRF 토큰 추가: ${authData.csrfToken.substring(0, 20)}...`);
      }

      console.log(`📊 최종 수집된 헤더: ${Object.keys(this.canvaHeaders).length}개`);
      console.log(`🔑 헤더 목록: ${Object.keys(this.canvaHeaders).join(", ")}`);
      
    } catch (error) {
      console.warn("템플릿 페이지 헤더 수집 실패:", error.message);
      
      // Fallback: 기본 필수 헤더 설정
      this.canvaHeaders = {
        "x-canva-app": "search",
        "x-canva-request": "searchcontent", 
        "x-canva-locale": "ko-KR"
      };
      console.log("🔧 기본 헤더 설정 완료");
    }
  }

  // 비디오 검색·식별을 위한 사전 값 확보
  async getVideoDocumentTypeId() {
    try {
      console.log("📺 비디오 문서 타입 ID 확보 중...");

      // 다중 API 엔드포인트 시도
      const endpoints = [
        "https://www.canva.com/_ajax/home/home-subpage-init?page=LAUNCHPAD",
        "https://www.canva.com/_ajax/home/app-init",
        "https://www.canva.com/_ajax/home/app-init?tab=home"
      ];

      for (const endpoint of endpoints) {
        console.log(`🔍 API 시도: ${endpoint}`);
        
        const result = await this.page.evaluate(async (url) => {
          try {
            const response = await fetch(url, {
              method: "GET",
              credentials: "include",
              headers: {
                "accept": "*/*",
                "x-canva-app": "home",
                "x-canva-locale": "ko-KR",
                "x-canva-request": "gethomesubpageinit"
              }
            });

            if (response.ok) {
              const text = await response.text();
              return { success: true, data: text };
            }
            return { success: false, error: `HTTP ${response.status}` };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }, endpoint);

        if (result.success) {
          console.log(`✅ API 응답 성공: ${endpoint}`);
          
          // 보안 prefix 제거
          let cleanText = result.data;
          const prefixes = ["'\"])}while(1);</x>//", ")]}',"];
          for (const prefix of prefixes) {
            if (cleanText.startsWith(prefix)) {
              cleanText = cleanText.substring(prefix.length);
              break;
            }
          }

          try {
            const data = JSON.parse(cleanText);
            this.videoDocTypeId = this.findDocTypeId(data);
            
            if (this.videoDocTypeId) {
              console.log(`✅ Video DocType ID 확보: ${this.videoDocTypeId}`);
              return;
            } else {
              console.log(`❌ DocType ID 찾기 실패 - 다음 API 시도`);
            }
          } catch (parseError) {
            console.log(`❌ JSON 파싱 실패 - 다음 API 시도: ${parseError.message}`);
          }
        } else {
          console.log(`❌ API 실패: ${result.error}`);
        }
      }

      // Fallback: 하드코딩된 일반적인 Video DocType ID 사용
      if (!this.videoDocTypeId) {
        console.log("⚠️ 자동 확보 실패 - 기본값 사용");
        this.videoDocTypeId = "DAFZ_Av3Zkg"; // 일반적인 Canva 비디오 DocType ID
        console.log(`🔧 기본 Video DocType ID 사용: ${this.videoDocTypeId}`);
      }
    } catch (error) {
      console.warn("DocType ID 확보 실패:", error.message);
      // 최종 Fallback
      this.videoDocTypeId = "DAFZ_Av3Zkg";
      console.log(`🔧 비상 기본값 사용: ${this.videoDocTypeId}`);
    }
  }

  // docType.id 찾기 헬퍼 (개선된 버전)
  findDocTypeId(obj, depth = 0) {
    if (depth > 10) return null; // 무한 재귀 방지
    
    if (typeof obj === "object" && obj !== null) {
      // 배열 처리
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const result = this.findDocTypeId(item, depth + 1);
          if (result) return result;
        }
      } else {
        // 객체 처리
        for (const [key, value] of Object.entries(obj)) {
          // 다양한 패턴으로 비디오 DocType 찾기
          if (key === "docType.name" || key === "name" || key === "displayName") {
            const nameValue = String(value).toLowerCase();
            if (nameValue.includes("video") || nameValue.includes("동영상") || nameValue.includes("영상")) {
              // 같은 객체 내에서 ID 찾기
              const possibleIdKeys = ["docType.id", "id", "docTypeId", "typeId"];
              for (const idKey of possibleIdKeys) {
                if (obj[idKey]) {
                  console.log(`🎯 DocType 발견: name="${value}", id="${obj[idKey]}"`);
                  return obj[idKey];
                }
              }
            }
          }
          
          // 재귀적으로 깊이 탐색
          const result = this.findDocTypeId(value, depth + 1);
          if (result) return result;
        }
      }
    }
    return null;
  }

  // 네트워크 요청 재현으로 mp4 확보
  async downloadVideosForKeyword(keyword, targetCount = 10) {
    try {
      if (!this.sessionActive) {
        throw new Error("세션이 활성화되지 않았습니다.");
      }

      console.log(`🔍 키워드 "${keyword}" 비디오 다운로드 시작 (목표: ${targetCount}개)`);

      // 다운로드 디렉토리 생성
      await fs.mkdir(this.downloadDir, { recursive: true });

      const videos = await this.searchVideos(keyword, targetCount * 2);
      console.log(`📋 검색 결과: ${videos.length}개 비디오`);

      let downloadCount = 0;
      const maxDownloads = Math.min(videos.length, targetCount);

      for (let i = 0; i < maxDownloads; i++) {
        const video = videos[i];
        
        // 중복 확인
        if (this.isDuplicate(video)) {
          console.log(`⚠️ 중복 스킵: ${video.title}`);
          continue;
        }

        try {
          // 고화질 URL 확보
          const downloadUrl = await this.getHighQualityVideoUrl(video.id) || video.videoUrl;
          
          if (!downloadUrl) {
            console.log(`❌ URL 없음: ${video.title}`);
            continue;
          }

          // 파일 저장
          const fileName = this.generateFileName(keyword, downloadCount + 1, video);
          const filePath = path.join(this.downloadDir, fileName);

          const success = await this.downloadVideoFile(downloadUrl, filePath, video);
          
          if (success) {
            downloadCount++;
            this.markAsDownloaded(video, filePath);
            console.log(`✅ 다운로드 완료: ${fileName} (${downloadCount}/${targetCount})`);
          }
        } catch (error) {
          console.warn(`⚠️ 다운로드 실패: ${video.title} - ${error.message}`);
        }
      }

      return {
        success: true,
        downloadedCount: downloadCount,
        totalFound: videos.length,
        targetCount: targetCount
      };
    } catch (error) {
      console.error(`❌ 키워드 다운로드 실패: ${error.message}`);
      throw error;
    }
  }

  // 비디오 검색 (브라우저 기반 접근 방식)
  async searchVideos(keyword, limit = 50) {
    try {
      console.log(`🔍 비디오 검색: "${keyword}" (DocType: ${this.videoDocTypeId || 'fallback'})`);
      
      // 브라우저 내에서 직접 검색 실행 (보안 컨텍스트 유지)
      const searchResult = await this.page.evaluate(async (searchKeyword, docTypeId, searchLimit) => {
        try {
          console.log(`🌐 브라우저 내 검색 실행: ${searchKeyword}`);
          
          // 다중 API URL 시도 (브라우저 컨텍스트에서)
          const searchUrls = [
            // DocType ID가 있는 경우
            ...(docTypeId ? [
              `https://www.canva.com/_ajax/search/content2?query=${encodeURIComponent(searchKeyword)}&contentTypes=H&doctype=${docTypeId}&limit=${searchLimit}`,
              `https://www.canva.com/_ajax/search/content2?query=${encodeURIComponent(searchKeyword)}&contentTypes=VIDEO&doctype=${docTypeId}&limit=${searchLimit}`
            ] : []),
            
            // DocType 없이 시도 (fallback)
            `https://www.canva.com/_ajax/search/content2?query=${encodeURIComponent(searchKeyword)}&contentTypes=H&limit=${searchLimit}`,
            `https://www.canva.com/_ajax/search/content2?query=${encodeURIComponent(searchKeyword)}&contentTypes=VIDEO&limit=${searchLimit}`,
            `https://www.canva.com/_ajax/search/content2?query=${encodeURIComponent(searchKeyword)}&limit=${searchLimit}`
          ];

          for (let i = 0; i < searchUrls.length; i++) {
            const url = searchUrls[i];
            console.log(`🔗 브라우저 API 시도 ${i + 1}/${searchUrls.length}: ${url.substring(0, 80)}...`);
            
            try {
              const response = await fetch(url, {
                method: "GET",
                credentials: "include", // 자동으로 쿠키 포함
                headers: {
                  "accept": "*/*",
                  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                  "accept-encoding": "gzip, deflate, br", 
                  "cache-control": "no-cache",
                  "pragma": "no-cache",
                  "referer": "https://www.canva.com/templates/",
                  "x-canva-app": "search",
                  "x-canva-request": "searchcontent",
                  "x-canva-locale": "ko-KR",
                  "x-requested-with": "XMLHttpRequest"
                }
              });

              console.log(`📡 API ${i + 1} 응답: ${response.status} ${response.statusText}`);
              
              if (response.ok) {
                const text = await response.text();
                console.log(`📄 응답 길이: ${text.length}자`);
                
                // 보안 prefix 제거
                let cleanText = text;
                const prefixes = ["'\"])}while(1);</x>//", ")]}',"];
                for (const prefix of prefixes) {
                  if (cleanText.startsWith(prefix)) {
                    cleanText = cleanText.substring(prefix.length);
                    break;
                  }
                }

                try {
                  const data = JSON.parse(cleanText);
                  console.log(`✅ API ${i + 1} JSON 파싱 성공`);
                  return { success: true, data, apiIndex: i + 1 };
                } catch (parseError) {
                  console.log(`❌ API ${i + 1} JSON 파싱 실패: ${parseError.message}`);
                  console.log(`원본 텍스트: ${cleanText.substring(0, 200)}...`);
                }
              } else {
                console.log(`❌ API ${i + 1} HTTP 오류: ${response.status} ${response.statusText}`);
              }
            } catch (fetchError) {
              console.log(`❌ API ${i + 1} 요청 실패: ${fetchError.message}`);
            }
          }

          return { success: false, error: "모든 API 시도 실패" };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, keyword, this.videoDocTypeId, limit);

      if (searchResult.success) {
        console.log(`✅ 브라우저 검색 성공 (API ${searchResult.apiIndex})`);
        const videos = this.extractVideoInfo(searchResult.data, keyword);
        console.log(`📊 추출된 비디오: ${videos.length}개`);
        return videos;
      } else {
        console.log(`❌ 브라우저 검색 실패: ${searchResult.error}`);
        return [];
      }
    } catch (error) {
      console.error(`비디오 검색 실패: ${error.message}`);
      return [];
    }
  }

  // 비디오 정보 추출 (다양한 응답 구조 지원)
  extractVideoInfo(searchData, keyword) {
    const videos = [];
    
    try {
      console.log(`📋 응답 데이터 구조 분석 중...`);
      
      // 다양한 데이터 구조 시도
      const possibleArrays = [
        searchData?.A,           // 기본 구조
        searchData?.data?.A,     // 중첩 구조
        searchData?.results,     // 대체 구조
        searchData?.items,       // 다른 구조
        searchData?.content,     // 또 다른 구조
        Array.isArray(searchData) ? searchData : null // 직접 배열
      ].filter(Boolean);

      for (const videoItems of possibleArrays) {
        if (Array.isArray(videoItems) && videoItems.length > 0) {
          console.log(`📹 비디오 배열 발견: ${videoItems.length}개 항목`);
          
          for (const item of videoItems) {
            // 다양한 ID 필드 시도
            const videoId = item.K || item.id || item.videoId || item.documentId;
            
            // 다양한 제목 필드 시도  
            const title = item.M || item.title || item.name || item.displayName || `${keyword}_video_${videoId}`;
            
            // 비디오 데이터 구조 탐색
            const videoData = item.N || item.video || item.videoData || item.media || {};
            const thumbnailUrl = videoData.A || videoData.thumbnail || videoData.preview || "";
            
            // 비디오 URL 찾기 (다양한 구조 시도)
            const videoInfo = videoData.J || videoData.source || videoData.file || {};
            let videoUrl = videoInfo.url || videoInfo.src || videoInfo.downloadUrl || "";
            
            // 직접 URL 필드도 확인
            if (!videoUrl) {
              videoUrl = item.videoUrl || item.url || item.downloadUrl || "";
            }
            
            if (videoId && (videoUrl || thumbnailUrl)) {
              const videoEntry = {
                id: String(videoId),
                title: String(title),
                videoUrl: videoUrl || "",
                thumbnailUrl: thumbnailUrl || "", 
                keyword: keyword,
                rawData: item // 디버깅용
              };
              
              videos.push(videoEntry);
              console.log(`✅ 비디오 추출: ${videoEntry.title} (ID: ${videoEntry.id})`);
            } else {
              console.log(`⚠️ 비디오 스킵 - ID나 URL 누락: ${JSON.stringify(item).substring(0, 100)}...`);
            }
          }
          
          // 첫 번째 성공적인 배열에서 추출했으면 중단
          if (videos.length > 0) break;
        }
      }
      
      console.log(`📊 최종 추출된 비디오: ${videos.length}개`);
      
    } catch (error) {
      console.error(`비디오 정보 추출 중 오류: ${error.message}`);
      console.log(`원본 데이터: ${JSON.stringify(searchData).substring(0, 500)}...`);
    }
    
    return videos;
  }

  // 고화질 비디오 URL 확보
  async getHighQualityVideoUrl(videoId) {
    try {
      const url = `https://www.canva.com/_ajax/video/?type=IDS&includeFiles&includePosterframes&includeTimelines&containers=A&containers=B&containers=D&ids=${videoId}&mintVideoUrls=false&mintVideoFiles=false`;
      
      const response = await axios.get(url, {
        headers: {
          "Cookie": this.cookieString,
          "User-Agent": this.userAgent,
          "accept": "*/*",
          "x-canva-app": "editor",
          "x-canva-request": "findvideosapi",
          "referer": "https://www.canva.com/design/",
          ...this.canvaHeaders
        }
      });

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

      return this.extractBestQualityUrl(responseData);
    } catch (error) {
      console.warn(`고화질 URL 확보 실패: ${error.message}`);
      return null;
    }
  }

  // 최고 화질 URL 추출
  extractBestQualityUrl(hqInfo) {
    try {
      const videoItems = hqInfo?.A || [];
      if (!videoItems.length) return null;
      
      const videoFiles = videoItems[0]?.c || [];
      let bestUrl = null;
      let bestResolution = 0;
      
      for (const file of videoFiles) {
        const resolution = (file.A || 0) * (file.B || 0);
        if (resolution > bestResolution) {
          bestResolution = resolution;
          bestUrl = file.E;
        }
      }
      
      return bestUrl;
    } catch (error) {
      console.warn(`고화질 URL 추출 실패: ${error.message}`);
      return null;
    }
  }

  // 비디오 파일 다운로드
  async downloadVideoFile(url, filePath, videoInfo) {
    try {
      console.log(`📥 다운로드 중: ${path.basename(filePath)}`);

      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        headers: {
          "Cookie": this.cookieString,
          "User-Agent": this.userAgent,
          "Accept": "*/*",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": "https://www.canva.com/",
          "Range": "bytes=0-"
        },
        timeout: 60000,
        maxRedirects: 5
      });

      const writer = require("fs").createWriteStream(filePath);
      
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(`✅ 저장 완료: ${path.basename(filePath)}`);
          resolve(true);
        });
        writer.on("error", reject);
      });
    } catch (error) {
      console.error(`다운로드 실패: ${error.message}`);
      return false;
    }
  }

  // 중복 다운로드 방지 (4중 트래커)
  isDuplicate(video) {
    const idHash = video.id;
    const urlHash = crypto.createHash('md5').update(video.videoUrl).digest('hex').substring(0, 8);
    const titleHash = crypto.createHash('md5').update(video.title).digest('hex').substring(0, 8);

    return this.duplicateTracker.ids.has(idHash) ||
           this.duplicateTracker.urls.has(urlHash) ||
           this.duplicateTracker.titleHashes.has(titleHash);
  }

  markAsDownloaded(video, filePath) {
    this.duplicateTracker.ids.add(video.id);
    this.duplicateTracker.urls.add(crypto.createHash('md5').update(video.videoUrl).digest('hex').substring(0, 8));
    this.duplicateTracker.titleHashes.add(crypto.createHash('md5').update(video.title).digest('hex').substring(0, 8));
    
    // 파일 해시는 나중에 계산할 수 있음
    // this.duplicateTracker.fileHashes.add(fileHash);
  }

  // 파일명 생성
  generateFileName(keyword, sequence, video) {
    const safeKeyword = keyword.replace(/[^\w가-힣]/g, '_').substring(0, 20);
    const safeTitle = video.title.replace(/[^\w가-힣]/g, '_').substring(0, 30);
    const timestamp = Date.now().toString().substring(-6);
    return `canva_${safeKeyword}_${sequence.toString().padStart(2, '0')}_${safeTitle}_${timestamp}.mp4`;
  }

  // 인간처럼 마우스 움직임 시뮬레이션
  async simulateHumanBehavior() {
    try {
      const viewport = await this.page.viewport();
      const width = viewport?.width || 1366;
      const height = viewport?.height || 768;
      
      // 무작위 마우스 움직임 (3-5개 지점)
      const moveCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < moveCount; i++) {
        const x = Math.random() * width * 0.8 + width * 0.1; // 화면 가장자리 피하기
        const y = Math.random() * height * 0.8 + height * 0.1;
        
        // 부드러운 마우스 이동 (베지어 곡선 시뮬레이션)
        await this.page.mouse.move(x, y, { 
          steps: Math.floor(Math.random() * 10) + 5 // 5-15 스텝
        });
        
        // 무작위 지연 (100-800ms)
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 700));
        
        // 때때로 클릭 (30% 확률)
        if (Math.random() < 0.3) {
          await this.page.mouse.click(x, y);
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 500));
        }
      }
      
      // 스크롤 동작 (50% 확률)
      if (Math.random() < 0.5) {
        const scrollAmount = Math.random() * 500 + 100;
        await this.page.mouse.wheel({ deltaY: scrollAmount });
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        // 스크롤 되돌리기
        await this.page.mouse.wheel({ deltaY: -scrollAmount * 0.7 });
      }
      
      console.log("🖱️ 인간처럼 마우스 움직임 시뮬레이션 완료");
    } catch (error) {
      console.warn("마우스 움직임 시뮬레이션 실패:", error.message);
    }
  }

  // Cloudflare 우회 대기 (고급)
  async waitForCloudflareBypass() {
    try {
      const maxAttempts = 6; // 최대 6번 시도 (30초)
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 Cloudflare 확인 시도 ${attempt}/${maxAttempts}`);
        
        const currentUrl = await this.page.url();
        console.log(`📍 현재 URL: ${currentUrl}`);
        
        // Cloudflare 검증 페이지 감지 (다양한 패턴)
        const isCloudflare = currentUrl.includes('challenge') || 
                           currentUrl.includes('cdn-cgi') ||
                           currentUrl.includes('cf-browser-verification');
        
        if (!isCloudflare) {
          // 페이지 내용으로 추가 확인
          const pageContent = await this.page.evaluate(() => {
            const title = document.title?.toLowerCase() || '';
            const bodyText = document.body?.textContent?.toLowerCase() || '';
            
            return {
              title,
              hasCloudflareText: bodyText.includes('checking your browser') ||
                                bodyText.includes('verifying you are human') ||
                                bodyText.includes('just a moment') ||
                                bodyText.includes('please wait') ||
                                title.includes('just a moment'),
              hasCanvaContent: bodyText.includes('canva') || title.includes('canva')
            };
          });
          
          if (!pageContent.hasCloudflareText && pageContent.hasCanvaContent) {
            console.log("✅ Cloudflare 우회 성공!");
            return true;
          }
          
          if (pageContent.hasCloudflareText) {
            console.log("🔄 아직 Cloudflare 검증 중...");
          }
        }
        
        // 인간처럼 행동하며 대기
        if (attempt < maxAttempts) {
          await this.simulateHumanBehavior();
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        }
      }
      
      console.log("⚠️ Cloudflare 우회 타임아웃 - 수동 진행 필요");
      return false;
    } catch (error) {
      console.error("Cloudflare 우회 처리 중 오류:", error.message);
      return false;
    }
  }

  // 세션 정리
  async cleanup() {
    try {
      if (this.cdpSession) {
        await this.cdpSession.detach();
        this.cdpSession = null;
      }
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.sessionActive = false;
      console.log("🧹 세션 정리 완료");
    } catch (error) {
      console.warn("세션 정리 중 오류:", error.message);
    }
  }
}

// 전역 인스턴스
let canvaStealthService = null;

// IPC 핸들러 등록
function register() {
  // 스텔스 세션 초기화 (브라우저 시작 + 로그인 페이지)
  ipcMain.handle("canva:stealth:init", async () => {
    try {
      if (!canvaStealthService) {
        canvaStealthService = new CanvaStealthService();
      }
      return await canvaStealthService.startLoginSession();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 로그인 확인 및 세션 활성화
  ipcMain.handle("canva:stealth:confirm", async () => {
    try {
      if (!canvaStealthService) {
        return { success: false, message: "세션이 초기화되지 않았습니다." };
      }
      return await canvaStealthService.confirmLogin();
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 키워드별 비디오 다운로드
  ipcMain.handle("canva:stealth:download", async (event, { keyword, targetCount = 10 }) => {
    try {
      if (!canvaStealthService || !canvaStealthService.sessionActive) {
        return { success: false, message: "세션이 활성화되지 않았습니다. 먼저 로그인해주세요." };
      }
      
      return await canvaStealthService.downloadVideosForKeyword(keyword, targetCount);
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 다중 키워드 자동 다운로드
  ipcMain.handle("canva:stealth:autoRun", async (event, { keywords, targetTotal = 80 }) => {
    try {
      if (!canvaStealthService || !canvaStealthService.sessionActive) {
        return { success: false, message: "세션이 활성화되지 않았습니다." };
      }

      const keywordCount = keywords.length;
      const basePerKeyword = Math.floor(targetTotal / keywordCount);
      const remainder = targetTotal % keywordCount;
      
      let totalDownloaded = 0;
      const results = [];

      for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];
        const quota = basePerKeyword + (i < remainder ? 1 : 0);
        
        console.log(`🎯 처리 중: ${keyword} (목표: ${quota}개)`);
        
        try {
          const result = await canvaStealthService.downloadVideosForKeyword(keyword, quota);
          totalDownloaded += result.downloadedCount;
          results.push({ keyword, ...result });
          
          if (totalDownloaded >= targetTotal) {
            console.log(`🎉 목표 달성! ${totalDownloaded}/${targetTotal}`);
            break;
          }
        } catch (error) {
          console.warn(`⚠️ ${keyword} 처리 실패: ${error.message}`);
          results.push({ keyword, success: false, error: error.message });
        }
      }

      return {
        success: true,
        totalDownloaded,
        targetTotal,
        results,
        downloadDir: canvaStealthService.downloadDir
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 세션 상태 확인
  ipcMain.handle("canva:stealth:status", async () => {
    return {
      active: canvaStealthService?.sessionActive || false,
      hasDocTypeId: !!canvaStealthService?.videoDocTypeId,
      hasCookies: !!canvaStealthService?.cookieString,
      headersCount: Object.keys(canvaStealthService?.canvaHeaders || {}).length,
      duplicateTracker: {
        ids: canvaStealthService?.duplicateTracker.ids.size || 0,
        urls: canvaStealthService?.duplicateTracker.urls.size || 0,
        titles: canvaStealthService?.duplicateTracker.titleHashes.size || 0,
        files: canvaStealthService?.duplicateTracker.fileHashes.size || 0
      },
      downloadDir: canvaStealthService?.downloadDir
    };
  });

  // 세션 종료
  ipcMain.handle("canva:stealth:cleanup", async () => {
    try {
      if (canvaStealthService) {
        await canvaStealthService.cleanup();
        canvaStealthService = null;
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  console.log("[ipc] canva-stealth: registered");
}

module.exports = { register };