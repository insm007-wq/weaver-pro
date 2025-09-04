// Compact single-line progress bar with cancel support
import { useState, useEffect } from 'react';

const PHASE_CONFIG = {
  SCRIPT: { label: '대본 생성 중', color: 'from-emerald-400 to-emerald-600' },
  TTS: { label: '음성 합성 중', color: 'from-blue-400 to-blue-600' },
  SRT: { label: '자막 생성 중', color: 'from-purple-400 to-purple-600' },
  MERGE: { label: '파일 병합 중', color: 'from-orange-400 to-orange-600' },
  '완료': { label: '완료', color: 'from-green-400 to-green-600' }
};

export function CompactProgressBar({
  phase,
  detailedProgress,
  status,
  elapsedSec,
  etaSec,
  onCancel
}) {
  const [smoothProgress, setSmoothProgress] = useState(0);
  
  const currentPhaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG.SCRIPT;
  const overallProgress = detailedProgress?.overallPercent || 0;
  const currentStep = detailedProgress?.currentStep || '';

  useEffect(() => {
    const timer = setTimeout(() => {
      setSmoothProgress(overallProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [overallProgress]);

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  };

  return (
    <div className="w-full">
      {/* Compact header line */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-700">
            {currentPhaseConfig.label}
          </span>
          {currentStep && phase !== '완료' && (
            <>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">{currentStep}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {elapsedSec > 0 && phase !== '완료' && (
            <span className="text-slate-500">
              {formatTime(elapsedSec)} 경과
            </span>
          )}
          {etaSec > 0 && phase !== '완룬' && status === 'running' && (
            <span className="text-slate-600 font-medium">
              예상 {formatTime(etaSec)}
            </span>
          )}
          <span className="font-semibold text-slate-700 min-w-[3rem] text-right">
            {Math.round(smoothProgress)}%
          </span>
          {onCancel && status === 'running' && (
            <button
              onClick={onCancel}
              className="px-2 py-0.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-150"
              title="작업 취소"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* Single progress bar */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${
            status === 'done' 
              ? 'from-green-400 to-green-600' 
              : currentPhaseConfig.color
          } transition-all duration-700 ease-out rounded-full`}
          style={{ width: `${Math.max(1, smoothProgress)}%` }}
        />
        {/* Subtle shimmer effect */}
        {status === 'running' && smoothProgress < 100 && (
          <div 
            className="absolute top-0 left-0 h-full w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 animate-pulse"
            style={{
              transform: `translateX(${smoothProgress * 4}%)`
            }}
          />
        )}
      </div>
    </div>
  );
}

export function CompactIndeterminateBar({
  phase,
  detailedProgress,
  status,
  elapsedSec,
  onCancel
}) {
  const currentPhaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG.SCRIPT;
  const currentStep = detailedProgress?.currentStep || '처리 중...';
  const overallProgress = detailedProgress?.overallPercent;

  return (
    <div className="w-full">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-slate-700">
            {currentPhaseConfig.label}
          </span>
          {currentStep && (
            <>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">{currentStep}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {elapsedSec > 0 && (
            <span className="text-slate-500">
              {Math.floor(elapsedSec / 60) > 0 
                ? `${Math.floor(elapsedSec / 60)}분 ${elapsedSec % 60}초` 
                : `${elapsedSec}초`} 경과
            </span>
          )}
          {overallProgress !== undefined && (
            <span className="font-semibold text-slate-700 min-w-[3rem] text-right">
              {Math.round(overallProgress)}%
            </span>
          )}
          {onCancel && status === 'running' && (
            <button
              onClick={onCancel}
              className="px-2 py-0.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-150"
              title="작업 취소"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* Indeterminate progress bar */}
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        {overallProgress !== undefined ? (
          // If we have overall progress, show it
          <div
            className={`h-full bg-gradient-to-r ${currentPhaseConfig.color} transition-all duration-700 ease-out rounded-full`}
            style={{ width: `${Math.max(1, overallProgress)}%` }}
          />
        ) : (
          // Otherwise show indeterminate animation
          <div className="absolute inset-0">
            <div 
              className={`h-full w-1/3 bg-gradient-to-r ${currentPhaseConfig.color} rounded-full animate-bounce`}
            />
          </div>
        )}
      </div>
    </div>
  );
}