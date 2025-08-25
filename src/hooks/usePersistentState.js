import { useEffect, useRef, useState } from "react";

/**
 * localStorage에 JSON으로 자동 저장/복원하는 경량 훅
 * - key: 저장 키 (프로젝트별로 다르게 주면 분리됨)
 * - initial: 초기값
 */
export default function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  // 첫 렌더 직후 저장 쓰기 방지
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}
