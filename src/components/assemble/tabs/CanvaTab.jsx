/**
 * Canva 자동 다운로드 전용 탭 컴포넌트
 * 
 * @description
 * Canva API를 통한 영상 자동 다운로드 기능을 제공하는 React 컴포넌트
 * - SRT 파일에서 키워드를 자동 추출하여 Canva에서 관련 영상을 다운로드
 * - 세션 기반 인증으로 로봇 탐지 우회
 * - 실시간 진행 상황 모니터링 및 키워드별 상태 표시
 * - 다중 다운로드 방법 자동 시도로 안정성 보장
 * 
 * @features
 * - 🔐 Canva 세션 기반 로그인 관리
 * - 📊 실시간 다운로드 진행 상황 표시
 * - 🎯 키워드별 상태 추적 (대기/검색중/완료/오류)
 * - ⚙️ 해상도, 용량, 개수 등 다운로드 옵션 설정
 * - 🔄 여러 다운로드 방법 자동 시도 (세션/패널 방식)
 * - 📤 다운로드된 에셋 자동 전달로 조립 단계 연동
 * 
 * @events
 * - canva:progress: 키워드별 다운로드 진행 상황 업데이트
 * - canva:downloaded: 개별 파일 다운로드 완료 알림
 * 
 * @author Weaver Pro Team
 * @version 2.0.0
 * @since 1.0.0
 */
// React Hooks
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

// Components
import { StandardCard } from "../../common";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { LoadingSpinner } from "../../common/LoadingSpinner";

// Utilities
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";
import { getSetting, readTextAny, aiExtractKeywords, getSecret } from "../../../utils/ipcSafe";
import { formatMs, debounce } from "../../../utils/common";
import { useToast } from "../../../hooks/useToast";
import { useApi } from "../../../hooks/useApi";
import { useProgress } from "../../../hooks/useProgress";

// =========================== 상수 정의 ===========================

/**
 * 파일 용량 계산을 위한 메가바이트 단위
 * @constant {number}
 */
const MB = 1024 * 1024;

/**
 * 지원되는 해상도 프리셋 목록
 * 
 * @constant {Array<{id: string, label: string, w: number, h: number}>}
 * @description Canva에서 다운로드 가능한 영상 해상도 옵션들
 * - HD: 720p 표준 해상도
 * - FHD: 1080p 풀HD 해상도 (기본값)
 * - QHD: 1440p 고화질 해상도
 * - UHD: 2160p 4K 초고화질 해상도
 */
const RES_PRESETS = [
  { id: "hd", label: "HD (1280×720)", w: 1280, h: 720 },
  { id: "fhd", label: "FHD (1920×1080)", w: 1920, h: 1080 },
  { id: "qhd", label: "QHD (2560×1440)", w: 2560, h: 1440 },
  { id: "uhd", label: "4K (3840×2160)", w: 3840, h: 2160 },
];

// =========================== 진행 상황 관리 ===========================

/**
 * 다운로드 진행 상황 초기 상태
 * 
 * @typedef {Object} ProgressState
 * @property {number} total - 전체 다운로드 대상 개수
 * @property {number} saved - 성공적으로 저장된 파일 개수
 * @property {number} skipped - 건너뛴 파일 개수 (오류/결과없음 등)
 * @property {Object<string, {picked: number, saved: number, status: string}>} rows - 키워드별 상세 진행 상황
 * @property {Object<string, number>} skipsBy - 건너뛴 이유별 통계
 */
const progInit = {
  total: 0,
  saved: 0,
  skipped: 0,
  rows: {}, // { [keyword]: { picked, saved, status } }
  skipsBy: { noResult: 0, searchError: 0, saveError: 0, other: 0 },
};
/**
 * 진행 상황 관리를 위한 리듀서 함수
 * 
 * @param {ProgressState} state - 현재 진행 상황 상태
 * @param {Object} action - 상태 변경 액션
 * @param {string} action.type - 액션 타입 (init|status|picked|saved|skip|done)
 * @param {string} [action.k] - 대상 키워드
 * @param {number} [action.n] - 변경할 개수
 * @param {string} [action.status] - 새로운 상태
 * @param {string} [action.reason] - 건너뛴 이유
 * @param {Array<string>} [action.keywords] - 초기화할 키워드 목록
 * @param {number} [action.perKeyword] - 키워드당 다운로드 개수
 * @returns {ProgressState} 새로운 진행 상황 상태
 */
function progReducer(state, action) {
  switch (action.type) {
    case "init": {
      const rows = {};
      for (const k of action.keywords) rows[k] = { picked: 0, saved: 0, status: "대기" };
      return {
        total: action.keywords.length * action.perKeyword,
        saved: 0,
        skipped: 0,
        rows,
        skipsBy: { noResult: 0, searchError: 0, saveError: 0, other: 0 },
      };
    }
    case "status": {
      const { k, status } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      return { ...state, rows: { ...state.rows, [k]: { ...row, status } } };
    }
    case "picked": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextPicked = (row.picked || 0) + n;
      return { ...state, rows: { ...state.rows, [k]: { ...row, picked: nextPicked } } };
    }
    case "saved": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextSaved = (row.saved || 0) + n;
      return {
        ...state,
        saved: state.saved + n,
        rows: { ...state.rows, [k]: { ...row, saved: nextSaved, status: "저장" } },
      };
    }
    case "skip": {
      const { k, n = 1, reason = "other" } = action;
      const by = { ...state.skipsBy };
      by[reason] = (by[reason] || 0) + n;
      return { ...state, skipped: state.skipped + n, skipsBy: by };
    }
    case "done": {
      const { k } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      return { ...state, rows: { ...state.rows, [k]: { ...row, status: "완료" } } };
    }
    default:
      return state;
  }
}

// =========================== 유틸리티 함수 ===========================

// formatMs function moved to common utils

/**
 * Canva UI에서 사용하는 해상도 라벨 생성
 * 
 * @param {number} w - 너비 픽셀
 * @param {number} h - 높이 픽셀
 * @returns {string} Canva 형식의 해상도 라벨 (예: "1920 × 1080")
 * 
 * @description
 * Canva 웹사이트에서 사용하는 해상도 표기 형식에 맞춰
 * 공백과 × 기호를 포함한 라벨을 생성합니다.
 */
function buildResolutionLabel(w, h) {
  // Canva-browse에서 기본 사용: "1920 × 1080"
  return `${w} × ${h}`;
}

// =========================== 메인 컴포넌트 ===========================

/**
 * Canva 자동 다운로드 탭 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {Function} props.addAssets - 다운로드된 에셋을 상위 컴포넌트로 전달하는 콜백 함수
 * @param {Array<{id: string, type: string, path: string, thumbUrl: string, durationSec: number, tags: Array<string>}>} props.addAssets.assets - 추가할 에셋 배열
 * 
 * @returns {JSX.Element} Canva 다운로드 탭 UI
 */
function CanvaTab({ addAssets }) {
  const toast = useToast();
  const api = useApi();
  const progress = useProgress();
  
  // =========================== 기본 상태 관리 ===========================
  
  /** @type {[boolean, Function]} 작업 진행 중 여부 */
  const [busy, setBusy] = useState(false);
  
  /** @type {[string, Function]} 현재 상태 메시지 */
  const [msg, setMsg] = useState("");
  
  /** @type {[Array<string>, Function]} 추출된 키워드 목록 */
  const [keywords, setKeywords] = useState([]);
  
  /** @type {[string, Function]} 사용자가 직접 입력한 테스트 키워드 */
  const [manualKeywords, setManualKeywords] = useState("");

  // =========================== 다운로드 옵션 설정 ===========================
  
  /** @type {[number, Function]} 최소 파일 용량 (MB) */
  const [minMB, setMinMB] = useState(1);
  
  /** @type {[number, Function]} 최대 파일 용량 (MB) */
  const [maxMB, setMaxMB] = useState(14);
  
  /** @type {[string, Function]} 선택된 해상도 프리셋 ID */
  const [resPreset, setResPreset] = useState("fhd");
  
  /** @type {[number, Function]} 키워드당 다운로드할 파일 개수 */
  const [perKeyword, setPerKeyword] = useState(1);
  
  /** @type {[number, Function]} 동시 다운로드 개수 (현재 미구현) */
  const [concurrency, setConcurrency] = useState(3);
  
  /** @type {[number, Function]} 사용할 최대 키워드 개수 */
  const [maxKeywordsToUse, setMaxKeywordsToUse] = useState(30);

  // =========================== 진행 상황 및 성능 추적 ===========================
  
  /** @type {[ProgressState, Function]} 다운로드 진행 상황 상태 */
  const [progress, dispatchProg] = useReducer(progReducer, progInit);
  
  /** @type {[number, Function]} 키워드 추출에 소요된 시간 (ms) */
  const [extractMs, setExtractMs] = useState(0);
  
  /** @type {React.MutableRefObject<number>} 작업 시작 시점 타임스탬프 */
  const runStartRef = useRef(0);
  
  /** @type {[number, Function]} 전체 작업에 소요된 시간 (ms) */
  const [runMs, setRunMs] = useState(0);
  
  /** @type {[boolean, Function]} 완료 시 깜빡임 효과 표시 여부 */
  const [doneFlash, setDoneFlash] = useState(false);
  
  /** 
   * 선택된 해상도 프리셋 정보
   * @type {{id: string, label: string, w: number, h: number}}
   */
  const chosenRes = useMemo(() => RES_PRESETS.find((r) => r.id === resPreset) || RES_PRESETS[1], [resPreset]);

  // =========================== Canva 세션 관리 ===========================
  
  /** @type {[boolean, Function]} Canva 로그인 작업 진행 중 여부 */
  const [canvaBusy, setCanvaBusy] = useState(false);
  
  /** @type {[boolean, Function]} Canva 로그인 인증 상태 */
  const [canvaAuthed, setCanvaAuthed] = useState(false);
  
  /** @type {[Object|null, Function]} 로그인된 Canva 사용자 정보 */
  const [canvaUser, setCanvaUser] = useState(null);
  
  /** @type {[string, Function]} Canva 로그인 관련 상태 메시지 */
  const [canvaMsg, setCanvaMsg] = useState("");

  // =========================== 이벤트 리스너 설정 ===========================
  
  /**
   * Canva 다운로드 관련 이벤트 구독
   * 
   * @description
   * - canva:progress: 키워드별 다운로드 진행 상황 업데이트
   * - canva:downloaded: 개별 파일 다운로드 완료 알림
   * 
   * 컴포넌트 마운트 시 이벤트 리스너를 등록하고,
   * 언마운트 시 정리하여 메모리 누수를 방지합니다.
   */
  useEffect(() => {
    const api = window?.api;
    if (!api || typeof api.on !== "function" || typeof api.off !== "function") return;

    /**
     * 다운로드 진행 상황 이벤트 핸들러
     * 
     * @param {Object} payload - 진행 상황 데이터
     * @param {string} payload.keyword - 현재 처리 중인 키워드
     * @param {string} [payload.phase] - 기존 자동화 단계 (search|pick|download|save|done)
     * @param {string} [payload.stage] - 새로운 방식 단계 (start|success|retry|error|no_results)
     * @param {number} [payload.pickedDelta] - 선택된 파일 개수 증가량
     * @param {number} [payload.savedDelta] - 저장된 파일 개수 증가량
     * @param {number} [payload.skipDelta] - 건너뛴 파일 개수 증가량
     * @param {string} [payload.reason] - 건너뛴 이유
     */
    const onProg = (payload) => {
      // 다양한 다운로드 방식 호환성 지원
      // - canva-browse 방식: { stage, keyword, done, total, ... }
      // - 기존 자동화 방식: { phase, keyword, ... }
      const k = payload?.keyword;
      if (!k) return;

      const phase = payload?.phase; // 기존
      const stage = payload?.stage; // B안

      /**
       * 다운로드 단계를 한국어 상태로 변환
       * 
       * @param {string} val - 영문 단계명
       * @returns {string|null} 한국어 상태명
       */
      const toStatus = (val) => {
        if (!val) return null;
        const v = String(val);
        
        // 진행 단계별 한국어 매핑
        if (["search"].includes(v)) return "검색 중";
        if (["pick"].includes(v)) return "선택";
        if (["download"].includes(v)) return "다운로드 중";
        if (["save"].includes(v)) return "저장 중";
        if (["done", "success"].includes(v)) return "완료";
        if (["retry"].includes(v)) return "재시도";
        if (["no_results"].includes(v)) return "결과 없음";
        if (["error", "download_timeout", "editor_open_fail", "download_panel_fail"].includes(v)) return "오류";
        
        return v; // 알 수 없는 상태는 그대로 반환
      };

      const status = toStatus(phase || stage);
      if (status) {
        dispatchProg({ type: "status", k, status });
        if (status === "완료") dispatchProg({ type: "done", k });
      }

      // 구버전 델타 호환
      if (payload?.pickedDelta) dispatchProg({ type: "picked", k, n: payload.pickedDelta });
      if (payload?.savedDelta) dispatchProg({ type: "saved", k, n: payload.savedDelta });
      if (payload?.skipDelta) dispatchProg({ type: "skip", k, n: payload.skipDelta, reason: payload.reason || "other" });
    };

    /**
     * 파일 다운로드 완료 이벤트 핸들러
     * 
     * @param {Object} x - 다운로드된 파일 정보
     * @param {string} x.keyword - 연관된 키워드
     * @param {string} x.path - 다운로드된 파일 경로
     * @param {number} [x.size] - 파일 크기
     * @param {number} [x.width] - 영상 너비
     * @param {number} [x.height] - 영상 높이
     * @param {number} [x.durationSec] - 영상 길이 (초)
     * @param {string} [x.thumbUrl] - 썸네일 URL
     * @param {string} [x.provider] - 제공자 정보
     * @param {string} [x.assetId] - 에셋 고유 ID
     */
    const onDownloaded = (x) => {
      try {
        const k = x?.keyword || "";
        
        // 진행 상황 업데이트
        if (k) {
          dispatchProg({ type: "saved", k, n: 1 });
          dispatchProg({ type: "status", k, status: "저장" });
        }
        
        // 상위 컴포넌트로 에셋 전달 (자동 배치를 위해)
        if (typeof addAssets === "function" && x?.path) {
          const asset = {
            id: x.assetId || x.path,
            type: "video",
            path: x.path,
            thumbUrl: x.thumbUrl || "",
            durationSec: x.durationSec ?? 0,
            tags: [x.keyword].filter(Boolean),
          };
          addAssets([asset]);
        }
      } catch (error) {
        console.warn('다운로드 완료 이벤트 처리 실패:', error);
      }
    };

    api.on("canva:progress", onProg);
    api.on("canva:downloaded", onDownloaded);
    return () => {
      api.off("canva:progress", onProg);
      api.off("canva:downloaded", onDownloaded);
    };
  }, [addAssets]);

  // =========================== Canva 세션 관리 함수들 ===========================
  
  /**
   * Canva 세션 상태를 확인하고 초기화
   * 
   * @description
   * 기존 Canva 로그인 세션이 유효한지 확인하고,
   * 세션이 있으면 인증 상태를 활성화합니다.
   * 다운로드 패널 방식을 사용하여 안정성을 보장합니다.
   * 
   * @async
   * @function
   */
  const refreshCanvaSession = useCallback(async () => {
    try {
      if (window?.api?.invoke) {
        const sessionResult = await window.api.invoke('canva:getSession');
        
        if (sessionResult?.ok) {
          setCanvaAuthed(true);
          setCanvaUser({ name: '기존 로그인' });
          setCanvaMsg("기존 Canva 로그인 세션을 사용합니다");
        } else {
          setCanvaAuthed(false);
          setCanvaUser(null);
          setCanvaMsg("로그인이 필요합니다. 다운로드 패널 방식을 사용합니다.");
        }
      } else {
        setCanvaAuthed(false);
        setCanvaUser(null);
        setCanvaMsg("API 초기화 대기 중...");
      }
    } catch (e) {
      setCanvaAuthed(false);
      setCanvaUser(null);
      setCanvaMsg("세션 초기화 실패");
    }
  }, []);
  useEffect(() => {
    refreshCanvaSession();
  }, [refreshCanvaSession]);

  /**
   * Canva 로그인 창을 열고 세션 설정
   * 
   * @description
   * 새 브라우저 창에서 Canva 로그인 페이지를 열어
   * 사용자가 수동으로 로그인할 수 있도록 합니다.
   * 로그인 완료 후 세션 정보를 저장하여 자동 다운로드에 사용합니다.
   * 
   * @async
   * @function
   */
  const handleCanvaLogin = useCallback(async () => {
    try {
      setCanvaBusy(true);
      setCanvaMsg("Canva 로그인 창을 여는 중...");
      
      if (window?.api?.invoke) {
        const result = await window.api.invoke('canva:login');
        
        if (result?.ok) {
          setCanvaAuthed(true);
          setCanvaUser({ name: '로그인 대기' });
          setCanvaMsg("로그인 창이 열렸습니다. 수동으로 로그인하세요. 다운로드는 백엔드에서 자동 처리됩니다.");
        } else {
          setCanvaMsg("로그인 창 열기 실패");
        }
      } else {
        setCanvaMsg("API가 없습니다. Electron preload 설정을 확인하세요.");
      }
    } catch (e) {
      setCanvaAuthed(false);
      setCanvaUser(null);
      setCanvaMsg("로그인 창 열기 중 오류: " + (e?.message || e));
    } finally {
      setCanvaBusy(false);
    }
  }, []);

  /**
   * 현재 Canva 로그인 상태를 확인
   * 
   * @description
   * 저장된 세션 정보가 여전히 유효한지 확인하고
   * UI 상태를 업데이트합니다.
   * 
   * @async
   * @function
   */
  const handleCheckLogin = useCallback(async () => {
    setCanvaBusy(true);
    setCanvaMsg("Canva 세션 확인 중...");
    
    try {
      if (window?.api?.invoke) {
        const sessionResult = await window.api.invoke('canva:getSession');
        
        if (sessionResult?.ok) {
          setCanvaAuthed(true);
          setCanvaUser({ name: '로그인됨' });
          setCanvaMsg("Canva 로그인 상태가 확인되었습니다. 다운로드 패널 방식을 사용할 수 있습니다.");
        } else {
          setCanvaAuthed(false);
          setCanvaUser(null);
          setCanvaMsg("로그인이 필요합니다. 로그인 버튼을 클릭하세요.");
        }
      }
    } catch (error) {
      setCanvaMsg("세션 확인 실패: " + (error?.message || error));
    } finally {
      setCanvaBusy(false);
    }
  }, []);

  /**
   * Canva 로그아웃 처리
   * 
   * @description
   * 저장된 Canva 세션 쿠키와 인증 정보를 모두 삭제하여
   * 완전한 로그아웃을 수행합니다.
   * 
   * @async
   * @function
   */
  const handleCanvaLogout = useCallback(async () => {
    try {
      setCanvaBusy(true);
      
      if (window?.api?.invoke) {
        const result = await window.api.invoke('canva:logout');
        
        if (result?.ok) {
          setCanvaAuthed(false);
          setCanvaUser(null);
          setCanvaMsg("로그아웃이 완료되었습니다.");
        } else {
          setCanvaMsg("로그아웃 실패: " + (result?.message || "알 수 없는 오류"));
        }
      }
    } finally {
      setCanvaBusy(false);
    }
  }, []);

  // =========================== 키워드 추출 관련 함수들 ===========================
  
  /**
   * SRT 파일을 읽고 정제된 텍스트 반환
   * 
   * @description
   * 설정된 SRT 파일 경로에서 파일을 읽어와
   * 타임스탬프와 번호를 제거하여 순수 텍스트만 추출합니다.
   * 
   * @async
   * @returns {Promise<string|null>} 정제된 SRT 텍스트 또는 null
   */
  const readCleanSrt = useCallback(async () => {
    const srtPath = await getSetting("paths.srt");
    if (!srtPath) {
      alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
      return null;
    }
    const raw = await readTextAny(srtPath);
    return String(raw || "")
      .replace(/\r/g, "\n")
      .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
      .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g, "");
  }, []);

  /**
   * SRT 텍스트에서 자동으로 키워드 추출
   * 
   * @description
   * 두 단계 키워드 추출 프로세스:
   * 1. OpenAI API를 사용한 AI 기반 지능형 키워드 추출 (우선)
   * 2. 로컬 TF-IDF/RAKE 알고리즘을 사용한 백업 추출
   * 
   * @param {number} topK - 추출할 최대 키워드 개수 (기본값: 60)
   * @returns {Promise<Array<string>>} 추출된 키워드 배열
   * 
   * @async
   * @function
   */
  const extractKeywordsAuto = useCallback(
    async (topK = 60) => {
      const text = await readCleanSrt();
      if (!text) return [];
      
      const t0 = performance.now();
      
      try {
        // 🎯 1단계: OpenAI API를 사용한 AI 기반 키워드 추출
        const apiKey = await getSecret("openaiKey");
        if (apiKey) {
          setMsg("AI가 키워드를 추출 중…");
          const result = await aiExtractKeywords({ 
            apiKey, 
            text, 
            topK, 
            language: "ko" 
          });
          
          const t1 = performance.now();
          setExtractMs(t1 - t0);
          
          if (result?.ok && Array.isArray(result.keywords) && result.keywords.length) {
            return result.keywords;
          }
        }
      } catch (error) {
        console.warn('AI 키워드 추출 실패, 로컬 방식으로 대체:', error);
      }
      
      // 🔄 2단계: 로컬 TF-IDF/RAKE 알고리즘 백업 추출
      const localKeywords = fallbackExtract(text, { topK, minLen: 2 });
      const t1 = performance.now();
      setExtractMs(t1 - t0);
      
      return Array.isArray(localKeywords) ? localKeywords : [];
    },
    [readCleanSrt]
  );

  // =========================== 메인 실행 함수 ===========================
  
  /**
   * Canva 자동 다운로드 프로세스 실행
   * 
   * @description
   * 전체 자동 다운로드 워크플로우:
   * 1. Canva 로그인 상태 확인 및 세션 설정
   * 2. SRT에서 키워드 자동 추출 (필요시)
   * 3. 다운로드 옵션 구성 및 진행 상황 초기화
   * 4. 향상된 세션 기반 다운로드 실행
   * 5. 실시간 진행 상황 모니터링
   * 6. 완료된 파일을 상위 컴포넌트로 전달
   * 
   * @async
   * @function
   */
  const handleRun = useCallback(async () => {
    if (!window?.api?.invoke) {
      alert("API가 없습니다. Electron preload 설정을 확인하세요.");
      return;
    }

    let baseKeywords = keywords;

    try {
      setBusy(true);
      setMsg("준비 중…");
      runStartRef.current = performance.now();

      // ===== 1단계: Canva 로그인 상태 확인 및 세션 설정 =====
      if (!canvaAuthed) {
        setMsg("Canva 로그인 상태 확인 중…");
        
        try {
          // 기존 세션 확인
          const sessionResult = await window.api.invoke('canva:getSession');
          
          if (sessionResult?.ok) {
            setCanvaAuthed(true);
            setCanvaUser({ name: '기존 세션' });
            setCanvaMsg("기존 로그인 세션을 사용합니다.");
          } else {
            setCanvaMsg("Canva 로그인 창을 여는 중…");
            
            // 로그인 창 열기
            const loginResult = await window.api.invoke('canva:login');
            
            if (loginResult?.ok) {
              setCanvaAuthed(true);
              setCanvaUser({ name: '로그인 필요' });
              setCanvaMsg("로그인 창이 열렸습니다. 수동으로 로그인 후 다운로드를 시작하세요.");
            } else {
              throw new Error("로그인 창 열기 실패");
            }
          }
        } catch (e) {
          console.warn("Login check failed:", e);
          setCanvaMsg("로그인 확인 실패, 하지만 다운로드를 시도합니다");
          setCanvaAuthed(true); // 시도는 해보기
        }
      }

      // ===== 2단계: 키워드 자동 추출 (필요시) =====
      if (!Array.isArray(baseKeywords) || baseKeywords.length === 0) {
        setMsg("SRT에서 키워드 추출 중…");
        const extracted = await extractKeywordsAuto(Math.max(60, maxKeywordsToUse));
        if (!extracted.length) {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
          return;
        }
        baseKeywords = extracted;
        setKeywords(extracted);
        setMsg(`키워드 ${extracted.length}개 추출됨 · API 기반 다운로드 시작`);
      }

      // ===== 3단계: 실행 키워드 집합 준비 및 진행 상황 초기화 =====
      const runKeywords = baseKeywords.slice(0, Math.max(1, Math.min(maxKeywordsToUse, baseKeywords.length)));
      dispatchProg({ type: "init", keywords: runKeywords, perKeyword });

      // ===== 4단계: 다운로드 옵션 구성 =====
      const options = {
        perKeywordLimit: Math.max(1, Math.min(10, perKeyword)), // 키워드당 최대 10개 제한
        downloadFormat: "MP4", // 지원되는 비디오 포맷
        resolutionLabel: `${chosenRes.w} × ${chosenRes.h}`, // Canva 형식 해상도
        minMB: minMB, // 최소 파일 크기 필터
        maxMB: maxMB, // 최대 파일 크기 필터
      };

      setMsg(`키워드 ${runKeywords.length}개에서 총 ${runKeywords.length * perKeyword}개 영상 API 다운로드 시작`);

      // ===== 5단계: 실시간 진행 상황 추적 설정 =====
      /**
       * 다운로드 진행 상황 실시간 모니터링
       * @param {Object} payload - 진행 상황 데이터
       */
      const progressHandler = (payload) => {
        const { stage, keyword, method, downloaded, filename, error, progress } = payload || {};
        
        if (stage === "search") {
          setMsg(`검색 중: ${keyword}`);
        } else if (stage === "downloading") {
          const progressText = progress ? ` (${Math.round(progress)}%)` : '';
          setMsg(`다운로드 중 [${method}]: ${filename || keyword}${progressText}`);
        } else if (stage === "success") {
          setMsg(`완료 [${method}]: ${filename || keyword} (총 ${downloaded}개)`);
        } else if (stage === "error") {
          console.warn(`다운로드 실패 [${method}]: ${keyword} - ${error}`);
        }
      };

      /**
       * 전체 다운로드 완료 이벤트 핸들러
       * @param {Object} result - 다운로드 결과 요약
       */
      const downloadedHandler = (result) => {
        if (result?.success && result?.downloaded !== undefined) {
          const methods = result.methods || {};
          const methodsSummary = Object.entries(methods)
            .map(([method, count]) => `${method}(${count})`)
            .join(', ');
          setMsg(`다운로드 완료: 총 ${result.downloaded}개 파일 [방법: ${methodsSummary}]`);
        }
      };

      // 이벤트 리스너 등록
      if (window.api?.on) {
        window.api.on("canva:progress", progressHandler);
        window.api.on("canva:downloaded", downloadedHandler);
      }

      try {
        // ===== 6단계: 향상된 세션 기반 다운로드 실행 =====
        // 여러 다운로드 방법을 자동으로 시도하여 안정성 보장
        const downloadResult = await window.api.invoke('canva:enhancedDownload', {
          keywords: runKeywords,
          options: {
            perKeywordLimit: perKeyword,
            downloadFormat: "MP4",
            resolutionLabel: `${chosenRes.w} × ${chosenRes.h}`,
            minMB: minMB,
            maxMB: maxMB,
            timeout: 60000 // 60초 타임아웃
          }
        });

        if (downloadResult?.success) {
          const methods = downloadResult.methods || {};
          const methodsSummary = Object.entries(methods)
            .map(([method, count]) => `${method}: ${count}개`)
            .join(', ');
          
          setMsg(`세션 기반 다운로드 완료: ${downloadResult.downloaded}개 파일 다운로드됨 (${methodsSummary})`);
        } else {
          throw new Error(downloadResult?.message || "세션 기반 다운로드 실패");
        }
      } finally {
        // 이벤트 리스너 정리
        if (window.api?.off) {
          window.api.off("canva:progress", progressHandler);
          window.api.off("canva:downloaded", downloadedHandler);
        }
      }

    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
      alert("Canva API 다운로드 중 오류: " + (e?.message || e));
    } finally {
      setRunMs(performance.now() - runStartRef.current);
      setBusy(false);
      setDoneFlash(true);
      setTimeout(() => setDoneFlash(false), 1800);
    }
  }, [canvaAuthed, keywords, extractKeywordsAuto, maxKeywordsToUse, perKeyword, chosenRes]);

  /**
   * 진행 중인 다운로드 작업 중지
   * 
   * @description
   * 현재 실행 중인 Canva 다운로드 프로세스에 중지 신호를 보내
   * 작업을 안전하게 종료합니다.
   * 
   * @async
   * @function
   */
  const handleStop = useCallback(async () => {
    try {
      if (window?.api?.invoke) {
        const result = await window.api.invoke('canva:stop');
        if (result?.ok) {
          setMsg("세션 기반 다운로드 중지 요청됨");
        } else {
          setMsg("중지 실패");
        }
      }
    } catch (e) {
      setMsg("중지 실패: " + (e?.message || e));
    }
  }, []);

  // =========================== UI 표시용 계산된 데이터 ===========================
  
  /**
   * 전체 진행률 계산 (퍼센트)
   * @type {number} 0-100 사이의 진행률
   */
  const pct = useMemo(() => {
    if (!progress.total) return 0;
    const done = Math.min(progress.saved + progress.skipped, progress.total);
    return Math.round((done / progress.total) * 100);
  }, [progress.saved, progress.skipped, progress.total]);

  /** @type {Array<string>} UI에 표시할 키워드 목록 */
  const keywordDisplay = useMemo(() => Object.keys(progress.rows || {}), [progress.rows]);
  
  /** @type {boolean} 모든 작업이 완료되었는지 여부 */
  const isDone = progress.total > 0 && progress.saved + progress.skipped >= progress.total;

  /** @type {number} 예상 다운로드 파일 개수 */
  const estimatedDownloads = Math.min(keywords.length || maxKeywordsToUse, maxKeywordsToUse) * perKeyword;

  // =========================== UI 렌더링 ===========================
  
  return (
    <ErrorBoundary>
      <div className="w-full max-w-screen-xl mx-auto px-4 force-text-dark">
      {/* 키워드 입력 섹션 */}
      <div className="mb-4">
        <StandardCard
          title="🧪 테스트 키워드 입력"
          right={
            <div className="text-xs text-neutral-500">
              {keywords.length > 0 ? `${keywords.length}개 키워드 설정됨` : "키워드를 입력하세요"}
            </div>
          }
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-neutral-700 flex flex-col gap-1">
                테스트 키워드 (쉼표로 구분)
                <input
                  type="text"
                  placeholder="예: 비디오, 테스트, 동영상"
                  value={manualKeywords}
                  onChange={(e) => setManualKeywords(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="flex gap-2 items-end">
              <button
                onClick={() => {
                  const kws = manualKeywords.split(',').map(k => k.trim()).filter(k => k);
                  if (kws.length > 0) {
                    setKeywords(kws);
                    setMsg(`${kws.length}개 키워드 설정됨: ${kws.join(', ')}`);
                  } else {
                    alert('키워드를 입력해주세요');
                  }
                }}
                className="h-9 px-4 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors whitespace-nowrap"
                disabled={busy}
              >
                키워드 설정
              </button>
              <button
                onClick={() => {
                  setKeywords([]);
                  setManualKeywords("");
                  setMsg("키워드 초기화됨");
                }}
                className="h-9 px-3 rounded-lg bg-gray-500 text-white text-sm hover:bg-gray-600 transition-colors whitespace-nowrap"
                disabled={busy}
              >
                초기화
              </button>
            </div>
          </div>
          {keywords.length > 0 && (
            <div className="mt-3 text-xs text-neutral-600 bg-gray-50 p-2 rounded">
              현재 키워드: <span className="font-medium">{keywords.join(', ')}</span>
            </div>
          )}
        </StandardCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch [&>*]:min-w-0">
        {/* 옵션 */}
        <StandardCard
          className="h-full"
          title="Canva 세션 기반 다운로드"
          right={
            <span className="text-xs text-neutral-600">
              다중 방법 자동 시도 · <span className="text-neutral-500">추출 {formatMs(extractMs)}</span>
            </span>
          }
        >
          {/* 로그인 상태 */}
          <div className="mb-3 flex items-center gap-2">
            {canvaAuthed ? (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg text-[12px] bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                ✅ Canva 로그인됨{canvaUser?.email ? ` · ${canvaUser.email}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg text-[12px] bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                ⚠️ Canva 미로그인
              </span>
            )}
            {canvaMsg && (
              <span className="text-[12px] text-neutral-600" aria-live="polite">
                {canvaMsg}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={handleCanvaLogin} className="btn-primary h-9" disabled={canvaBusy} title="Canva 로그인 후 세션 정보를 저장합니다. 여러 다운로드 방법을 자동으로 시도합니다.">
              {canvaBusy ? "로그인 창 여는 중…" : canvaAuthed ? "로그인 창 다시 열기" : "Canva 세션 로그인"}
            </button>
            <button
              onClick={handleCheckLogin}
              className="btn-secondary h-9"
              disabled={canvaBusy}
              title="현재 Canva 로그인 상태를 확인합니다."
            >
              로그인 확인
            </button>
            <button
              onClick={handleCanvaLogout}
              className="btn-secondary h-9"
              disabled={canvaBusy}
              title="Canva 세션 쿠키를 모두 제거합니다."
            >
              로그아웃
            </button>
          </div>

          {/* 옵션들 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              해상도
              <select
                value={resPreset}
                onChange={(e) => setResPreset(e.target.value)}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white text-neutral-900 w-full"
                disabled={busy}
              >
                {RES_PRESETS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              키워드당 개수
              <input
                type="number"
                min={1}
                max={10}
                value={perKeyword}
                onChange={(e) => setPerKeyword(Math.max(1, Math.min(10, +e.target.value || 1)))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              최소 용량 (MB)
              <input
                type="number"
                min={0}
                max={500}
                value={minMB}
                onChange={(e) => setMinMB(Math.max(0, +e.target.value || 0))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              최대 용량 (MB)
              <input
                type="number"
                min={0}
                max={2000}
                value={maxMB}
                onChange={(e) => setMaxMB(Math.max(0, +e.target.value || 0))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              동시 다운로드
              <input
                type="number"
                min={1}
                max={6}
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, Math.min(6, +e.target.value || 1)))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
              <span className="text-[11px] text-neutral-500 break-words">
                현재 구현은 순차 다운로드입니다. 여러 방법을 자동으로 시도하여 안정성을 보장합니다.
              </span>
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              상위 키워드만 사용
              <input
                type="number"
                min={1}
                max={300}
                value={maxKeywordsToUse}
                onChange={(e) => setMaxKeywordsToUse(Math.max(1, Math.min(300, +e.target.value || 30)))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
              <span className="text-[11px] text-neutral-500 break-words">긴 대본일 때 과도한 호출을 방지합니다.</span>
            </label>
          </div>

          {/* 액션 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleRun}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
              disabled={busy}
              title="키워드가 없으면 SRT에서 자동 추출 후 캔바에서 영상 다운로드"
            >
              {busy ? "Canva 세션 기반 다운로드 실행 중…" : "Canva 세션 기반 다운로드 시작"}
            </button>
            <button
              onClick={handleStop}
              className="h-9 px-3 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-500 disabled:opacity-60"
              disabled={busy}
              title="진행 중인 자동화를 중지 요청합니다."
            >
              중지
            </button>
            {msg && <div className="text-[12px] text-neutral-700">{msg}</div>}
          </div>

          <div className="mt-2 text-[12px] text-neutral-600">
            예상 다운로드: <b>{Math.min(keywords.length || maxKeywordsToUse, maxKeywordsToUse) * perKeyword}</b>개
          </div>
        </StandardCard>

        {/* 진행/키워드 표시 */}
        <StandardCard
          className="h-full"
          title="진행 상황"
          right={
            <span className="text-xs text-neutral-500">
              {isDone ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 ${
                    doneFlash ? "animate-pulse" : ""
                  }`}
                >
                  ✅ 완료 100% · 총 {formatMs(runMs)}
                </span>
              ) : (
                "실시간"
              )}
            </span>
          }
        >
          <div className="h-full flex flex-col">
            {/* 요약 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-700 mb-2 shrink-0">
              <span className="text-lg font-semibold text-emerald-600">
                {progress.saved}/{progress.total || 0}
              </span>
              <span>
                다운로드 완료 <b>{progress.saved}</b>개
              </span>
              {progress.skipped > 0 && (
                <span>
                  패스 <b>{progress.skipped}</b>개
                </span>
              )}
              <span className="text-neutral-500">
                {Math.round(((progress.saved + progress.skipped) / (progress.total || 1)) * 100)}% 완료
              </span>
              {extractMs > 0 && <span className="text-neutral-500">추출 {formatMs(extractMs)}</span>}
              {runMs > 0 && <span className="text-neutral-500">소요 {formatMs(runMs)}</span>}
            </div>

            {/* 진행바 */}
            <div
              className={`relative h-1.5 w-full rounded ${
                isDone ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-neutral-100"
              } overflow-hidden mb-3 shrink-0 transition-colors`}
            >
              <div className="h-1.5 bg-emerald-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>

            {/* 키워드 칩 */}
            <div className="mb-2 text-xs text-neutral-700 shrink-0">키워드 {keywordDisplay.length}개</div>

            {/* 키워드 영역 */}
            <div className="flex-1 min-h-[240px]">
              <div className="h-full w-full rounded-lg border bg-white p-2 overflow-auto">
                {keywordDisplay.length ? (
                  <div className="flex flex-wrap gap-2">
                    {keywordDisplay.map((k) => {
                      const st = progress.rows?.[k]?.status;
                      let klass = "bg-neutral-100 text-neutral-700";
                      if (st) {
                        if (st.includes("완료") || st.includes("저장")) klass = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                        else if (st.includes("결과 없음")) klass = "bg-neutral-100 text-neutral-500 border border-neutral-200";
                        else if (st.includes("검색") || st.includes("다운로드") || st.includes("저장 중") || st.includes("재시도"))
                          klass = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                        else if (st.includes("오류")) klass = "bg-rose-50 text-rose-700 border border-rose-100";
                      }
                      return (
                        <span key={k} title={st || ""} className={`px-2 py-1 rounded-lg text-[12px] ${klass} max-w-[12rem] truncate`}>
                          #{k}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-[12px] text-neutral-600">아직 실행된 작업이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </StandardCard>
      </div>
      </div>
    </ErrorBoundary>
  );
}

export default function CanvaTabWithBoundary({ addAssets }) {
  return <CanvaTab addAssets={addAssets} />;
}
