// src/components/common/KeepAlivePane.jsx
// -----------------------------------------------------------------------------
// 탭 전환 시 언마운트 없이 상태/작업을 유지하는 래퍼
// - active=true가 된 "최초 순간"에만 마운트 (mountOnFirstShow=true)
// - 이후 비활성화 시에는 display:none으로만 숨겨서, 내부 타이머/작업은 계속 동작
// - 불필요한 강제 리렌더/효과 제거 (useEffect/force setState 삭제)
// -----------------------------------------------------------------------------

import React, { useRef } from "react";

/**
 * @param {object} props
 * @param {boolean} props.active   - 현재 표시 여부
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @param {boolean} [props.mountOnFirstShow=true] - true면 '처음 보일 때' 마운트, 그 전엔 안 만듦
 */
export default function KeepAlivePane({ active, children, className = "", mountOnFirstShow = true }) {
  const everActivatedRef = useRef(active === true);

  // 🎯 렌더 시점에서 바로 ref 갱신 → 별도 effect/리렌더 불필요
  if (active && !everActivatedRef.current) {
    everActivatedRef.current = true;
  }

  // mountOnFirstShow=true면, 처음 활성화되기 전엔 렌더 자체를 생략
  const shouldMount = mountOnFirstShow ? everActivatedRef.current || active : true;
  if (!shouldMount) return null;

  // 숨길 때는 display:none만 적용 → 내부 상태/작업 유지
  const hidden = !active;

  return (
    <div className={className} role="tabpanel" aria-hidden={hidden} style={{ display: hidden ? "none" : undefined }}>
      {children}
    </div>
  );
}
