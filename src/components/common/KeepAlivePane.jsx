// 탭 전환 시 언마운트 없이 상태/작업을 유지하는 래퍼
// - active=true인 순간 첫 마운트 → 이후엔 display:none으로만 숨김
// - children 안의 타이머/다운로드/작업은 계속 동작
import { useEffect, useRef, useState } from "react";

export default function KeepAlivePane({
  active,
  children,
  className = "",
  mountOnFirstShow = true, // true: 처음 보여줄 때만 마운트
}) {
  const everActivatedRef = useRef(active === true);
  const [, force] = useState(0);

  // 한 번이라도 active가 되면 "마운트 유지" 모드로 고정
  useEffect(() => {
    if (!everActivatedRef.current && active) {
      everActivatedRef.current = true;
      force((n) => n + 1); // 최초 활성화 시점에만 리렌더 한 번
    }
  }, [active]);

  const shouldMount = mountOnFirstShow
    ? everActivatedRef.current || active
    : true;

  if (!shouldMount) return null;

  return (
    <div
      className={className}
      aria-hidden={active ? "false" : "true"}
      style={{ display: active ? undefined : "none" }}
    >
      {children}
    </div>
  );
}
