/**
 * 자동 높이 계산을 위한 커스텀 훅
 * 
 * @description
 * 좌측 컨트롤 영역과 우측 콘텐츠 영역 사이의 레이아웃 기반으로
 * 우측 리스트의 최적 높이를 자동으로 계산하여 반응형 UI를 구현하는 훅
 * 
 * @features
 * - 📐 반응형 높이 자동 계산
 * - 🔄 ResizeObserver를 통한 실시간 감지
 * - 🪟 윈도우 리사이즈/스크롤 이벤트 대응
 * - ⚡ 성능 최적화된 이벤트 리스너
 * - 🎯 유연한 콜백 기반 업데이트
 * 
 * @example
 * ```jsx
 * import useAutoHeight from '../hooks/useAutoHeight';
 * 
 * function MyLayout() {
 *   const leftBottomRef = useRef();
 *   const rightBodyRef = useRef();
 *   const rightWrapRef = useRef();
 *   const [maxHeight, setMaxHeight] = useState(400);
 *   
 *   useAutoHeight({
 *     leftBottomRef,
 *     rightBodyRef,
 *     rightWrapRef,
 *     onChange: setMaxHeight
 *   });
 *   
 *   return (
 *     <div>
 *       <div ref={leftBottomRef}>좌측 컨트롤</div>
 *       <div ref={rightWrapRef}>
 *         <div ref={rightBodyRef} style={{maxHeight}}>
 *           우측 콘텐츠 리스트
 *         </div>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @usage
 * - 현재 사용 위치를 확인 필요 (구체적인 사용처 불명)
 * - 레이아웃 기반 반응형 높이 계산이 필요한 곳
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useEffect } from "react";

/**
 * 자동 높이 계산 훅
 * 
 * @param {Object} params - 훅 매개변수
 * @param {React.RefObject} params.leftBottomRef - 좌측 하단 영역 참조
 * @param {React.RefObject} params.rightBodyRef - 우측 콘텐츠 영역 참조  
 * @param {React.RefObject} params.rightWrapRef - 우측 래퍼 영역 참조
 * @param {Function} params.onChange - 높이 변경 콜백 함수 (height: number) => void
 */
export default function useAutoHeight({ leftBottomRef, rightBodyRef, rightWrapRef, onChange }) {
  useEffect(() => {
    const calc = () => {
      if (!leftBottomRef.current || !rightBodyRef.current) return;
      const fudge = 6;
      const leftBottom = leftBottomRef.current.getBoundingClientRect().bottom;
      const bodyTop = rightBodyRef.current.getBoundingClientRect().top;
      const byLeft = leftBottom - bodyTop - fudge;
      const byViewport = window.innerHeight - bodyTop - 16;
      const h = Math.max(200, Math.min(byLeft, byViewport));
      if (Number.isFinite(h)) onChange(h);
    };
    const roL = new ResizeObserver(calc);
    const roR = new ResizeObserver(calc);
    leftBottomRef.current && roL.observe(leftBottomRef.current);
    rightWrapRef.current && roR.observe(rightWrapRef.current);
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, { passive: true });
    return () => {
      roL.disconnect();
      roR.disconnect();
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc);
    };
  }, [leftBottomRef, rightBodyRef, rightWrapRef, onChange]);
}
