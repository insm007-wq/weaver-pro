/**
 * 활동 로그 유틸리티 (성능 최적화 버전)
 * 사용자의 모든 작업(대본 생성, 이미지 생성 등)을 기록합니다.
 */

const MAX_LOGS = 500; // 최대 로그 개수
let __logsCache = null; // 메모리 캐시
let __savePending = false; // 저장 대기 중 플래그

/**
 * 캐시된 로그 조회 (localStorage에서 한 번만 로드)
 */
function _getLogsFromStorage() {
  if (__logsCache !== null) return __logsCache;

  try {
    const storedLogs = localStorage.getItem("activityLogs");
    __logsCache = storedLogs ? JSON.parse(storedLogs) : [];
  } catch (e) {
    console.warn("기존 로그 파싱 실패:", e);
    __logsCache = [];
  }
  return __logsCache;
}

/**
 * 저장 (디바운싱)
 */
function _saveToStorage(logs) {
  try {
    localStorage.setItem("activityLogs", JSON.stringify(logs));
  } catch (error) {
    console.error("로그 저장 실패:", error);
  }
}

/**
 * 작업 로그 추가 (비동기, 디바운싱 적용)
 * @param {Object} log - 로그 정보
 */
export function addActivityLog(log) {
  try {
    const normalizedLog = {
      type: log.type || "unknown",
      title: log.title || "작업 수행",
      detail: log.detail || "",
      status: log.status || "pending",
      timestamp: log.timestamp || Date.now(),
      metadata: log.metadata || {},
    };

    // 메모리 캐시에 추가
    const logs = _getLogsFromStorage();
    logs.push(normalizedLog);

    // 최대 개수 초과 시 제거
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }

    // 캐시 업데이트
    __logsCache = logs;

    // 디바운싱: 100ms 후에 저장 (여러 번 호출되면 마지막만 실행)
    if (!__savePending) {
      __savePending = true;
      setTimeout(() => {
        _saveToStorage(logs);
        __savePending = false;
      }, 100);
    }

    return true;
  } catch (error) {
    console.error("로그 저장 실패:", error);
    return false;
  }
}

/**
 * 로그 조회
 * @param {Object} options - 옵션
 * @param {string} options.type - 특정 타입의 로그만 조회
 * @param {string} options.status - 특정 상태의 로그만 조회
 * @param {number} options.limit - 최대 개수
 * @returns {Array} 로그 배열
 */
export function getActivityLogs(options = {}) {
  try {
    const storedLogs = localStorage.getItem("activityLogs");
    if (!storedLogs) return [];

    let logs = JSON.parse(storedLogs);

    // 필터링
    if (options.type) {
      logs = logs.filter((log) => log.type === options.type);
    }
    if (options.status) {
      logs = logs.filter((log) => log.status === options.status);
    }

    // 최신순 정렬 및 제한
    const limit = options.limit || 50;
    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  } catch (error) {
    console.error("로그 조회 실패:", error);
    return [];
  }
}

/**
 * 로그 초기화
 */
export function clearActivityLogs() {
  try {
    localStorage.setItem("activityLogs", JSON.stringify([]));
    console.log("✓ 로그 초기화 완료");
    return true;
  } catch (error) {
    console.error("로그 초기화 실패:", error);
    return false;
  }
}

/**
 * 특정 작업의 진행 중인 로그 업데이트
 * @param {number} timestamp - 작업의 타임스탐프
 * @param {Object} updates - 업데이트 정보
 */
export function updateActivityLog(timestamp, updates) {
  try {
    const storedLogs = localStorage.getItem("activityLogs");
    if (!storedLogs) return false;

    let logs = JSON.parse(storedLogs);
    const logIndex = logs.findIndex((log) => log.timestamp === timestamp);

    if (logIndex !== -1) {
      logs[logIndex] = { ...logs[logIndex], ...updates };
      localStorage.setItem("activityLogs", JSON.stringify(logs));
      console.log("✓ 로그 업데이트:", logs[logIndex]);
      return true;
    }

    return false;
  } catch (error) {
    console.error("로그 업데이트 실패:", error);
    return false;
  }
}
