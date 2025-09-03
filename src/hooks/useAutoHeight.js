// src/hooks/useAutoHeight.js
import { useEffect } from "react";

/**
 * 왼쪽 컨트롤 영역 하단과 오른쪽 카드 컨텐츠의 top을 기준으로
 * 오른쪽 리스트의 안전한 maxHeight를 계산.
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
