import { memo, useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Text,
  Button,
  tokens,
  Divider,
} from "@fluentui/react-components";

const ResultsSidebar = memo(
  ({
    fullVideoState,
    doc,
    isLoading,
    form,
    globalSettings,
    resetFullVideoState,
    api,
    onClose,
    horizontal,
  }) => {
    // default parameter 처리
    const isHorizontal = horizontal === true;
  

  // 표시할 내용이 있는지 확인
  const isComplete = ["complete", "completed"].includes(fullVideoState?.currentStep);
  const hasProgress = (fullVideoState?.isGenerating || fullVideoState?.currentStep !== "idle") && !isComplete;
  const hasScript = doc || isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");

  // 전혀 표시할 내용이 없으면 숨김
  if (!hasProgress && !hasScript) {
    return null;
  }

  // 가로형 레이아웃 (하단 배치용)
  if (isHorizontal) {
    return (
      <Card
        style={{
          width: "100%",
          background: tokens.colorNeutralBackground1,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
            background: tokens.colorNeutralBackground1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
              📊 실시간 결과
            </Text>
          </div>
          <Button
            appearance="subtle"
            size="small"
            onClick={onClose}
            style={{ borderRadius: 6 }}
            aria-label="숨기기"
          >
            숨기기
          </Button>
        </div>

        {/* 1열 콘텐츠 - 대본만 표시 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacingVerticalL,
            padding: "20px",
          }}
        >
          {/* 대본 결과 섹션만 표시 */}
          {hasScript && (
            <div>
              <CompactScriptViewer
                fullVideoState={fullVideoState}
                doc={doc}
                isLoading={isLoading}
                form={form}
                globalSettings={globalSettings}
              />
            </div>
          )}
        </div>
      </Card>
    );
  }

  // 세로형 레이아웃 (사이드바용)
  return (
    <Card
      style={{
        width: "100%",
        height: "calc(100vh - 120px)", // 헤더 공간 제외
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "sticky",
        top: 20,
      }}
    >
      {/* 사이드바 헤더 */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
          background: tokens.colorNeutralBackground1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
            📊 실시간 결과
          </Text>
        </div>
        <Button
          appearance="subtle"
          size="small"
          onClick={onClose}
          style={{ borderRadius: 6 }}
          aria-label="숨기기"
        >
          숨기기
        </Button>
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 - 대본만 표시 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0",
        }}
      >
        {/* 대본 결과 섹션만 표시 */}
        {hasScript && (
          <div style={{ padding: "0 20px 16px", height: "100%" }}>
            <CompactScriptViewer
              fullVideoState={fullVideoState}
              doc={doc}
              isLoading={isLoading}
              form={form}
              globalSettings={globalSettings}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
);

// 카운트다운 타이머 컴포넌트 (개선된 로직)
function CountdownTimer({ targetTimeMs, size, color }) {
  const [timeLeft, setTimeLeft] = useState(targetTimeMs);

  useEffect(() => {
    if (targetTimeMs <= 0) {
      setTimeLeft(0);
      return;
    }

    // 새로운 targetTime이 현재 timeLeft와 크게 다르면 즉시 업데이트
    const diff = Math.abs(targetTimeMs - timeLeft);
    if (diff > 5000) { // 5초 이상 차이나면 즉시 업데이트
      setTimeLeft(targetTimeMs);
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1000;
        return newTime <= 0 ? 0 : newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTimeMs]);

  const formatTime = (ms) => {
    if (ms <= 0) return "완료";

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${seconds}초`;
    }
  };

  return (
    <Text size={size} style={{ color, fontFamily: 'monospace', fontWeight: 600 }}>
      {formatTime(timeLeft)}
    </Text>
  );
}

// 카운트다운 시간 계산 함수 (수정된 로직)
function getCountdownTime(currentStep, mode, fullVideoState) {
  if (!fullVideoState?.startTime || !fullVideoState?.progress) {
    return 0;
  }

  const now = new Date();
  const elapsedMs = now - new Date(fullVideoState.startTime);
  const currentProgress = fullVideoState.progress[currentStep] || 0;

  // 진행률이 75% 이상이면 "곧 완료" 상태
  if (currentProgress >= 75) {
    return Math.max(0, 30000 - (currentProgress - 75) * 1200); // 30초에서 시작해서 0으로
  }

  if (currentProgress <= 0) {
    // 진행률이 0%이면 기본 예상치 사용
    const defaultTimes = {
      automation_mode: {
        script: 180000, // 3분
        audio: 240000,  // 4봄
        images: 360000, // 6봄
        video: 180000   // 3봄
      },
      script_mode: {
        script: 180000, // 3봄
        audio: 240000,  // 4봄
        subtitle: 90000 // 1.5봄
      }
    };

    return defaultTimes[mode]?.[currentStep] || 180000;
  }

  if (currentProgress >= 100) {
    return 0;
  }

  // 진행률 1-74% 구간에서만 실시간 계산 사용
  // 계산된 시간이 너무 길면 제한
  const estimatedTotalMs = (elapsedMs / currentProgress) * 100;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);

  // 최대 10분으로 제한
  return Math.min(remainingMs, 600000);
}

// 동적 예상 시간 계산 함수
function getEstimatedTime(currentStep, mode, fullVideoState) {
  if (!fullVideoState?.startTime || !fullVideoState?.progress) {
    return "계산 중...";
  }

  const now = new Date();
  const elapsedMs = now - new Date(fullVideoState.startTime);
  const elapsedMin = Math.floor(elapsedMs / 1000 / 60);
  const elapsedSec = Math.floor((elapsedMs / 1000) % 60);

  // 현재 단계의 진행률
  const currentProgress = fullVideoState.progress[currentStep] || 0;

  if (currentProgress <= 0) {
    // 진행률이 0%이면 과거 데이터 기반 추정
    const estimates = getHistoricalEstimates(currentStep, mode);
    return estimates;
  }

  if (currentProgress >= 100) {
    return "완료";
  }

  // 실시간 계산: (경과시간 / 진행률) * (100 - 진행률)
  const estimatedTotalMs = (elapsedMs / currentProgress) * 100;
  const remainingMs = estimatedTotalMs - elapsedMs;
  const remainingMin = Math.max(0, Math.floor(remainingMs / 1000 / 60));
  const remainingSec = Math.max(0, Math.floor((remainingMs / 1000) % 60));

  if (remainingMin > 0) {
    return `약 ${remainingMin}분 ${remainingSec}초`;
  } else if (remainingSec > 10) {
    return `약 ${remainingSec}초`;
  } else {
    return "곧 완료";
  }
}

// 과거 데이터 기반 추정치 (fallback)
function getHistoricalEstimates(currentStep, mode) {
  const estimates = {
    automation_mode: {
      script: "2-4분",
      audio: "3-5분",
      images: "5-8분",
      video: "2-4분"
    },
    script_mode: {
      script: "2-4분",
      audio: "3-5분",
      subtitle: "1-2분"
    }
  };

  return estimates[mode]?.[currentStep] || "예상 중...";
}

// 전체 작업 예상 시간 계산
function getTotalEstimatedTime(mode, fullVideoState) {
  if (!fullVideoState?.startTime) return "계산 중...";

  const steps = mode === "automation_mode"
    ? ["script", "audio", "images", "video"]
    : ["script", "audio", "subtitle"];

  const now = new Date();
  const elapsedMs = now - new Date(fullVideoState.startTime);

  // 전체 평균 진행률
  const totalProgress = steps.reduce((acc, step) =>
    acc + (fullVideoState.progress?.[step] || 0), 0) / steps.length;

  if (totalProgress <= 0) {
    const totalEstimates = {
      automation_mode: "10-15분",
      script_mode: "5-8분"
    };
    return totalEstimates[mode] || "계산 중...";
  }

  if (totalProgress >= 100) return "완료";

  // 전체 작업 예상 시간
  const estimatedTotalMs = (elapsedMs / totalProgress) * 100;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  const remainingMin = Math.floor(remainingMs / 1000 / 60);

  return remainingMin > 0 ? `약 ${remainingMin}분 남음` : "곧 완료";
}

// 미니 진행률 패널 컴포넌트
function MiniProgressPanel({ fullVideoState, resetFullVideoState, api }) {
  if (!fullVideoState?.isGenerating && fullVideoState?.currentStep === "idle") {
    return (
      <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontStyle: "italic" }}>
        대기 중...
      </Text>
    );
  }

  const isComplete = ["complete", "completed"].includes(fullVideoState.currentStep);
  const isError = fullVideoState.currentStep === "error";
  const isAutomation = fullVideoState.mode === "automation_mode";
  const steps = isAutomation ? ["script", "audio", "images", "video"] : ["script", "audio", "subtitle"];

  // 전체 진행률 계산
  const avgProgress = Math.round(
    steps.reduce((acc, k) => acc + (fullVideoState.progress?.[k] || 0), 0) / steps.length
  );

  return (
    <div>
      {/* 상태 표시 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isError
              ? tokens.colorPaletteRedBackground3
              : isComplete
              ? tokens.colorPaletteGreenBackground3
              : "#667eea",
            animation: !isComplete && !isError ? "pulse 2s infinite" : "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text
            size={200}
            weight="semibold"
            style={{
              animation: !isComplete && !isError && fullVideoState.isGenerating ? "blinking 1.5s ease-in-out infinite" : "none",
            }}
          >
            {isError ? "오류 발생" : isComplete ? "완료" : "진행 중"}
          </Text>
          {!isComplete && !isError && fullVideoState.isGenerating && (
            <CountdownTimer
              targetTimeMs={getCountdownTime(fullVideoState.currentStep, fullVideoState.mode, fullVideoState)}
              size={100}
              color="#667eea"
            />
          )}
        </div>
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
          {avgProgress}%
        </Text>
      </div>

      {/* 현재 단계 및 총괄 시간 - 완료 시 숨김 */}
      {!isComplete && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
              현재: {getStepDisplayName(fullVideoState.currentStep)}
            </Text>
            {!isError && fullVideoState.isGenerating && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontFamily: 'monospace' }}>
                전체: {getTotalEstimatedTime(fullVideoState.mode, fullVideoState)}
              </Text>
            )}
          </div>

          {/* 미니 진행바 - 더 크고 파란색으로 */}
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 4,
              background: tokens.colorNeutralBackground3,
              overflow: "hidden",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: `${avgProgress}%`,
                height: "100%",
                background: isError
                  ? tokens.colorPaletteRedForeground1
                  : "#667eea", // 보라색 진행바
                transition: "width 300ms ease-out",
              }}
            />
          </div>
        </>
      )}



      {/* 완료 시 액션 버튼 - 높이 증가 */}
      {isComplete && (
        <Button
          appearance="outline"
          size="medium"
          onClick={async () => {
            try {
              const result = await api?.invoke?.("project:openOutputFolder");
              // 토스트는 부모에서 처리하도록 이벤트 전달 가능
            } catch (e) {
              console.error(e);
            }
          }}
          style={{
            width: "100%",
            marginTop: 0, // 상단 여백 제거
            borderRadius: 8,
            fontSize: "13px",
            minHeight: "36px", // 버튼 높이 증가
            fontWeight: 600,
          }}
        >
          📂 결과 폴더 열기
        </Button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes blinking {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// 컴팩트 스크립트 뷰어 컴포넌트
const CompactScriptViewer = memo(({ fullVideoState, doc, isLoading, form, globalSettings }) => {
  const [showAllScenes, setShowAllScenes] = useState(false);
  const generatingNow = isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");
  const completedNow = !!doc;

  const handleNavigateToAssemble = useCallback(() => {
    window.dispatchEvent(new CustomEvent('navigate-to-assemble'));
  }, []);

  if (!generatingNow && !completedNow) {
    return (
      <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontStyle: "italic" }}>
        대본이 생성되면 여기에 표시됩니다.
      </Text>
    );
  }

  return (
    <div
      style={{
        background: tokens.colorNeutralBackground2,
        borderRadius: 8,
        padding: 12,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        maxHeight: "400px",
        overflowY: "auto",
      }}
    >
      {completedNow ? (
        // 완료된 대본 표시
        <div>
          {doc?.title && (
            <Text size={200} weight="semibold" style={{ marginBottom: 8, display: "block" }}>
              📖 {doc.title}
            </Text>
          )}

          <div
            style={{
              maxHeight: showAllScenes ? "none" : "300px",
              overflowY: showAllScenes ? "visible" : "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            {(showAllScenes ? doc?.scenes : doc?.scenes?.slice(0, 3))?.map((scene, index) => (
              <div
                key={`scene-${index}-${scene?.id || 'no-id'}`}
                style={{
                  padding: 10,
                  background: tokens.colorNeutralBackground1,
                  borderRadius: 6,
                  border: `1px solid ${tokens.colorNeutralStroke1}`,
                }}
              >
                <Text size={250} weight="semibold" style={{ color: "#667eea", marginBottom: 6, display: "block" }}>
                  장면 {index + 1}
                  {scene?.duration && (
                    <span style={{ color: tokens.colorNeutralForeground3, fontWeight: "normal", marginLeft: 4 }}>
                      ({scene.duration}초)
                    </span>
                  )}
                </Text>
                <Text
                  size={250}
                  style={{
                    color: tokens.colorNeutralForeground2,
                    lineHeight: 1.5,
                    display: showAllScenes ? "block" : "-webkit-box",
                    WebkitLineClamp: showAllScenes ? "none" : 2,
                    WebkitBoxOrient: showAllScenes ? "initial" : "vertical",
                    overflow: showAllScenes ? "visible" : "hidden",
                  }}
                >
                  {scene?.text}
                </Text>
              </div>
            ))}

            {doc?.scenes?.length > 3 && (
              <Button
                appearance="subtle"
                size="small"
                onClick={() => setShowAllScenes(!showAllScenes)}
                style={{
                  marginTop: 4,
                  alignSelf: "center",
                  fontSize: "12px",
                  minHeight: "28px"
                }}
              >
                {showAllScenes
                  ? "접기"
                  : `+ ${doc.scenes.length - 3}개 장면 더 보기`
                }
              </Button>
            )}
          </div>

          {/* 다음 단계 버튼 */}
          <Divider style={{ margin: "12px 0" }} />
          <Button
            appearance="primary"
            size="large"
            onClick={handleNavigateToAssemble}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 8,
              fontSize: "14px",
              fontWeight: 600,
              minHeight: "44px",
              border: "none",
            }}
          >
            ➡️ 다음 단계: 미디어 준비
          </Button>
        </div>
      ) : (
        // 생성 중 표시
        <div style={{ textAlign: "center" }}>
          <Text size={200} weight="semibold" style={{ marginBottom: 8, display: "block" }}>
            🤖 AI가 대본을 생성하고 있습니다...
          </Text>
          <Text size={100} style={{ color: tokens.colorNeutralForeground3, lineHeight: 1.4 }}>
            주제: {form?.topic || "미정"}<br />
            스타일: {form?.style || "기본"}<br />
            예상 길이: {form?.durationMin || 3}분
          </Text>

          <div
            style={{
              marginTop: 12,
              padding: 8,
              background: tokens.colorNeutralBackground1,
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: "10px",
              color: tokens.colorNeutralForeground3,
            }}
          >
            대본 생성 준비 중
            <span
              style={{
                animation: "blink 1s infinite",
                marginLeft: 2,
              }}
            >
              █
            </span>
          </div>

          <style>{`
            @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
          `}</style>
        </div>
      )}
    </div>
  );
  }
);

// 단계 표시명 매핑
const getStepDisplayName = (step) => {
  const stepNames = {
    script: "대본 생성 중",
    audio: "음성 합성 중",
    images: "이미지 생성 중",
    video: "영상 합성 중",
    subtitle: "자막 생성 중",
    complete: "완료",
    completed: "완료",
    error: "오류",
    idle: "대기",
  };
  return stepNames[step] || step;
};

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
ResultsSidebar.displayName = "ResultsSidebar";
CompactScriptViewer.displayName = "CompactScriptViewer";

export default ResultsSidebar;