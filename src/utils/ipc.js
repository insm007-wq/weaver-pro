// src/utils/ipc.js  
// Optimized IPC 호출 유틸 (배치, 캐싱, 에러 핸들링)

// IPC 호출 캐시
const ipcCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 배치 처리를 위한 큐
const batchQueue = new Map();
let batchTimeout = null;

// 기본 IPC 호출
export const ipcCall = async (channel, payload) => {
  try {
    return await window.api.invoke(channel, payload);
  } catch (error) {
    console.error(`IPC call failed for channel: ${channel}`, error);
    throw error;
  }
};

// 캐싱된 IPC 호출 (설정 등의 정적 데이터용)
export const ipcCallCached = async (channel, payload, cacheDuration = CACHE_DURATION) => {
  const cacheKey = `${channel}:${JSON.stringify(payload)}`;
  const cached = ipcCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    return cached.data;
  }
  
  try {
    const result = await window.api.invoke(channel, payload);
    ipcCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    return result;
  } catch (error) {
    console.error(`Cached IPC call failed for channel: ${channel}`, error);
    throw error;
  }
};

// 배치 IPC 호출 (설정 업데이트 등)
export const ipcCallBatch = (channel, payload) => {
  return new Promise((resolve, reject) => {
    if (!batchQueue.has(channel)) {
      batchQueue.set(channel, []);
    }
    
    batchQueue.get(channel).push({ payload, resolve, reject });
    
    // 배치 타이머 설정
    if (batchTimeout) clearTimeout(batchTimeout);
    batchTimeout = setTimeout(async () => {
      for (const [batchChannel, requests] of batchQueue.entries()) {
        try {
          // 배치로 처리 가능한 채널들
          if (batchChannel.startsWith('settings/')) {
            const batchPayload = requests.map(r => r.payload);
            const results = await window.api.invoke(`${batchChannel}-batch`, batchPayload);
            requests.forEach((req, index) => {
              req.resolve(results[index]);
            });
          } else {
            // 개별 처리
            for (const req of requests) {
              try {
                const result = await window.api.invoke(batchChannel, req.payload);
                req.resolve(result);
              } catch (error) {
                req.reject(error);
              }
            }
          }
        } catch (error) {
          requests.forEach(req => req.reject(error));
        }
      }
      batchQueue.clear();
      batchTimeout = null;
    }, 50); // 50ms 대기 후 배치 실행
  });
};

// 진행 상황 업데이트를 위한 특별한 IPC
export const ipcCallWithProgress = async (channel, payload, onProgress) => {
  try {
    // 진행 상황 업데이트 리스너 등록
    const progressChannel = `${channel}-progress`;
    const cleanup = window.api.on?.(progressChannel, onProgress);
    
    const result = await window.api.invoke(channel, payload);
    
    // 정리
    if (cleanup) cleanup();
    
    return result;
  } catch (error) {
    console.error(`Progress IPC call failed for channel: ${channel}`, error);
    throw error;
  }
};

// 설정 가져오기 (캐싱되므로 더 빠름)
export const getSetting = (key) => 
  ipcCallCached('settings/get', { key });

// 설정 저장 (배치 처리)
export const setSetting = (key, value) => 
  ipcCallBatch('settings/set', { key, value });

// 캐시 지우기
export const clearCache = (pattern) => {
  if (pattern) {
    for (const key of ipcCache.keys()) {
      if (key.includes(pattern)) {
        ipcCache.delete(key);
      }
    }
  } else {
    ipcCache.clear();
  }
};

// 대본 생성 최적화 IPC
export const generateScriptOptimized = async (payload, onProgress) => {
  return ipcCallWithProgress('llm/generateScript', payload, onProgress);
};

// TTS 합성 최적화 IPC
export const synthesizeByScenes = async (payload, onProgress) => {
  return ipcCallWithProgress('tts/synthesizeByScenes', payload, onProgress);
};