// FullVideoProgressPanel.jsx — polished ver.
// - 세련된 헤더/바/로그 스타일
// - 체브론(>>) 스텝 바 + 진행상태 색상 정리
// - "이미지도 >> 가게" 요청: script 모드에서도 images 스텝을 포함하도록 옵션화
// - ETA/경과시간 표시 로직 유지 + 로그 자동 스크롤

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Text,
  Button,
  Badge,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import {
  DocumentEditRegular,
  VideoRegular,
  MicRegular,
  ImageRegular,
} from "@fluentui/react-icons";

/* =======================================================================
    STEP 메타: 라벨 + 아이콘
   ======================================================================= */
const STEP_META = {
  script: { label: "대본 생성", icon: DocumentEditRegular },
  audio: { label: "음성 생성", icon: MicRegular },
  images: { label: "이미지 생성", icon: ImageRegular },
  video: { label: "영상 합성", icon: VideoRegular },
  subtitle: { label: "자막 생성", icon: DocumentEditRegular },
};

/* =======================================================================
    ProgressBar (얇고 매끈한 진행바)
   ======================================================================= */
function ProgressBar({ value = 0, tone = "brand" }) {
  const bg = tokens.colorNeutralBackground3;
  const fg =
    tone === "success"
      ? tokens.colorPaletteGreenForeground1
      : tone === "danger"
      ? tokens.colorPaletteRedForeground1
      : tokens.colorBrandForeground1;

  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        borderRadius: 999,
        background: bg,
        overflow: "hidden",
      }}
      aria-label="progress"
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: fg,
          transition: "width 180ms ease-out",
        }}
      />
    </div>
  );
}

/* =======================================================================
    ETA 계산 (개선된 시간 예측 알고리즘)
   ======================================================================= */
function useETA(fullVideoState, visibleSteps, enabled) {
  const histRef = useRef([]);
  const stepTimesRef = useRef({});

  useEffect(() => {
    if (!enabled) return;
    const step = fullVideoState.currentStep;
    const p = step && fullVideoState.progress ? fullVideoState.progress[step] || 0 : 0;

    if (step && !["idle", "complete", "completed", "error"].includes(step)) {
      const now = Date.now() / 1000;
      histRef.current.push({ step, t: now, p });

      // 스텝별 시작 시간 기록
      if (!stepTimesRef.current[step] && p > 0) {
        stepTimesRef.current[step] = now;
      }

      if (histRef.current.length > 120) histRef.current = histRef.current.slice(-80);
    }
  }, [enabled, fullVideoState.currentStep, fullVideoState.progress]);

  return useMemo(() => {
    if (!enabled) return "";
    const current = fullVideoState.currentStep;
    const isComplete = ["complete", "completed"].includes(current);
    if (isComplete || !current || current === "idle" || current === "error") return "";

    const progress = fullVideoState.progress || {};
    const currentProgress = progress[current] || 0;

    // 각 스텝별 예상 소요 시간 (초)
    const stepDurations = {
      script: 45, // 대본 생성: 약 45초
      audio: 90, // 음성 생성: 약 1분 30초
      images: 180, // 이미지 생성: 약 3분
      video: 120, // 영상 합성: 약 2분
      subtitle: 30, // 자막 생성: 약 30초
    };

    // 1) 현재 스텝 진행률 기반 남은 시간 계산
    let remainingTime = 0;

    if (currentProgress < 100) {
      const expectedDuration = stepDurations[current] || 60;
      const stepStartTime = stepTimesRef.current[current];

      if (stepStartTime && currentProgress > 0) {
        // 실제 진행 속도 기반 계산
        const elapsed = Date.now() / 1000 - stepStartTime;
        const rate = currentProgress / elapsed; // %/sec
        if (rate > 0) {
          remainingTime += (100 - currentProgress) / rate;
        } else {
          remainingTime += (expectedDuration * (100 - currentProgress)) / 100;
        }
      } else {
        // 예상 시간 기반 계산
        remainingTime += (expectedDuration * (100 - currentProgress)) / 100;
      }
    }

    // 2) 남은 스텝들의 예상 시간
    const currentIndex = visibleSteps.indexOf(current);
    for (let i = currentIndex + 1; i < visibleSteps.length; i++) {
      const step = visibleSteps[i];
      remainingTime += stepDurations[step] || 60;
    }

    // 3) 시간 포맷팅
    const totalSeconds = Math.max(0, Math.round(remainingTime));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `약 ${minutes}분 ${seconds}초 남음`;
    } else if (seconds > 5) {
      return `약 ${seconds}초 남음`;
    } else {
      return "곧 완료됩니다";
    }
  }, [enabled, fullVideoState, visibleSteps]);
}

/* =======================================================================
    로그 타임 표시 보조(Invalid Date 방지)
   ======================================================================= */
function formatLogTime(ts) {
  if (!ts) return "-";
  if (ts instanceof Date) return ts.toLocaleTimeString();
  if (typeof ts === "number") return new Date(ts).toLocaleTimeString();
  const parsed = Date.parse(ts);
  if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleTimeString();
  return String(ts);
}

/* =======================================================================
    체브론(>>) 스텝 헤더
   ======================================================================= */
function ChevronSteps({ steps, currentStep, progress }) {
  const chevronBgActive = tokens.colorBrandBackground;
  const chevronBgDone = tokens.colorNeutralBackground3;
  const chevronBgIdle = tokens.colorNeutralBackground2;
  const fgActive = tokens.colorNeutralForegroundInverted;
  const fgIdle = tokens.colorNeutralForeground2;

  return (
    <div style={{ display: "flex", alignItems: "stretch", width: "100%", gap: 0 }}>
      {steps.map((id, i) => {
        const meta = STEP_META[id];
        const Icon = meta.icon;
        const pct = progress?.[id] ?? 0;
        const isActive = currentStep === id;
        const isDone = pct >= 100 || (!isActive && steps.indexOf(currentStep) > i);

        const bg = isActive ? chevronBgActive : isDone ? chevronBgDone : chevronBgIdle;
        const color = isActive ? fgActive : fgIdle;

        return (
          <div
            key={id}
            style={{
              flex: 1,
              minWidth: 140,
              position: "relative",
              background: bg,
              color,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: isActive ? 700 : 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              clipPath:
                i === 0
                  ? "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)"
                  : i === steps.length - 1
                  ? "polygon(18px 0, 100% 0, 100% 100%, 18px 100%, 0 50%)"
                  : "polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%)",
              borderTopLeftRadius: i === 0 ? 10 : 0,
              borderBottomLeftRadius: i === 0 ? 10 : 0,
              borderTopRightRadius: i === steps.length - 1 ? 10 : 0,
              borderBottomRightRadius: i === steps.length - 1 ? 10 : 0,
            }}
            aria-current={isActive ? "step" : undefined}
            role="listitem"
          >
            <Icon style={{ marginRight: 8, fontSize: 16 }} /> {meta.label}
          </div>
        );
      })}
    </div>
  );
}

/* =======================================================================
    메인 컴포넌트
   ======================================================================= */
export default function FullVideoProgressPanel({
  fullVideoState,
  resetFullVideoState,
  api,
  toast,
  showEta = true,
}) {
  if (!fullVideoState?.isGenerating && fullVideoState?.currentStep === "idle") return null;

  const isComplete = ["complete", "completed"].includes(fullVideoState.currentStep);
  const isError = fullVideoState.currentStep === "error";

    // 모드 구분: 자동화 모드 = 이미지/비디오 포함, 대본 생성 모드 = 이미지/비디오 미포함
  const isAutomation = fullVideoState.mode === "automation_mode";
  const steps = isAutomation ? ["script", "audio", "images", "video"] : ["script", "audio", "subtitle"];
  const headingTitle = isAutomation ? "🎬 완전 자동화 모드" : "📝 대본 생성 모드";

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [finalElapsedTime, setFinalElapsedTime] = useState(null);

  // 로그 자동 스크롤용 ref
  const logWrapRef = useRef(null);
  useEffect(() => {
    if (logWrapRef.current) {
      logWrapRef.current.scrollTop = logWrapRef.current.scrollHeight;
    }
  }, [fullVideoState.logs, fullVideoState.currentStep]);

  useEffect(() => {
    // 완료되거나 오류 발생 시 최종 시간 저장하고 타이머 중지
    if (isComplete || isError) {
      if (!finalElapsedTime && fullVideoState.startTime) {
        const startTime =
          typeof fullVideoState.startTime === "string"
            ? new Date(fullVideoState.startTime).getTime()
            : fullVideoState.startTime;
        const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        setFinalElapsedTime(minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`);
      }
      return; // 타이머 중지
    }

    // 진행 중일 때만 타이머 작동
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isComplete, isError, fullVideoState.startTime, finalElapsedTime]);

  const elapsedText = useMemo(() => {
    // 완료되거나 오류 발생 시 최종 시간 사용
    if ((isComplete || isError) && finalElapsedTime) {
      return finalElapsedTime;
    }

    if (!fullVideoState.startTime) return "0초";
    const startTime =
      typeof fullVideoState.startTime === "string"
        ? new Date(fullVideoState.startTime).getTime()
        : fullVideoState.startTime;
    const elapsed = Math.max(0, Math.floor((currentTime - startTime) / 1000));
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
  }, [fullVideoState.startTime, currentTime, isComplete, isError, finalElapsedTime]);

  const etaText = useETA(fullVideoState, steps, showEta && !isComplete && !isError);

  const models = steps.map((k) => {
    const pct = fullVideoState.progress?.[k] ?? 0;
    const status = isError
      ? "error"
      : isComplete
      ? "done"
      : fullVideoState.currentStep === k
      ? "active"
      : pct >= 100
      ? "done"
      : "idle";
    return {
      id: k,
      label: STEP_META[k].label,
      icon: STEP_META[k].icon,
      percent: pct,
      status,
      error: isError && fullVideoState.failedStep === k,
    };
  });

  const avgProgress = Math.round(
    steps.reduce((acc, k) => acc + (fullVideoState.progress?.[k] || 0), 0) / steps.length
  );

  return (
    <Card
      style={{
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        borderRadius: 16,
        margin: "16px 0",
        overflow: "hidden",
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
          background: `linear-gradient(180deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
        }}
      >
        <Text weight="semibold" size={500} style={{ color: tokens.colorNeutralForeground1 }}>
          {headingTitle}
        </Text>
        <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <Badge appearance="outline" color={isError ? "red" : isComplete ? "green" : "brand"}>
            {isError ? "오류" : isComplete ? "완료" : "진행중"}
          </Badge>
          <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
            {isComplete
              ? `완료 (${elapsedText})`
              : isError
              ? `오류 발생 (${elapsedText})`
              : `진행 중… (${elapsedText} 경과)`}
          </Text>
          {etaText && !isComplete && !isError && (
            <Text size={300} style={{ color: tokens.colorBrandForegroundLink, fontWeight: 600 }}>
              ⏰ {etaText}
            </Text>
          )}
        </div>
      </div>

      {/* 체브론 스텝 + 전체 진행률 */}
      <div style={{ padding: "14px 20px 8px" }}>
        <ChevronSteps steps={steps} currentStep={fullVideoState.currentStep} progress={fullVideoState.progress} />
        <div style={{ marginTop: 10 }}>
          <ProgressBar value={avgProgress} tone={isError ? "danger" : isComplete ? "success" : "brand"} />
        </div>
      </div>

      {/* 단계 타일(상세) */}
      <div
        style={{
          padding: "10px 20px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {models.map((m) => {
          const Icon = m.icon;
          const tone = m.error ? "danger" : m.status === "done" ? "success" : "brand";
          const cardBg = m.error
            ? tokens.colorPaletteRedBackground1
            : m.status === "done"
            ? tokens.colorPaletteGreenBackground1
            : tokens.colorNeutralBackground1;
          const badge = m.error
            ? { text: "오류", color: "red" }
            : m.status === "done"
            ? { text: "완료", color: "green" }
            : { text: "진행중", color: "brand" };

          return (
            <div
              key={m.id}
              style={{
                background: cardBg,
                border: `1px solid ${tokens.colorNeutralStroke2}`,
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 104,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon fontSize={18} />
                  <Text weight="semibold" size={300}>
                    {m.label}
                  </Text>
                </div>
                <Badge appearance="tint" color={badge.color}>
                  {badge.text}
                </Badge>
              </div>

              <ProgressBar value={m.percent} tone={tone} />

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {m.error ? "문제 발생" : m.status === "done" ? "완료됨" : "작업 중…"}
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                  {Math.round(m.percent || 0)}%
                </Text>
              </div>
            </div>
          );
        })}
      </div>

      {/* 진행 로그 */}
      <div
        style={{
          padding: "12px 20px 16px",
          borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
          background: tokens.colorNeutralBackground2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
            ☰ 진행 로그
          </Text>
        </div>

        <div
          ref={logWrapRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            fontFamily: "Consolas, 'SF Mono', Monaco, monospace",
            maxHeight: 180,
            overflowY: "auto",
            background: tokens.colorNeutralBackground1,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            borderRadius: 8,
            padding: 8,
          }}
        >
          {/* 프리셋 로그(현재 단계) */}
          {fullVideoState.currentStep === "script" && (
            <>
              <div style={{ fontSize: 12, color: tokens.colorBrandForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] START: 대본 생성 프로세스 시작
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: AI 모델 연결 중... ({fullVideoState.aiModel || "Claude"})
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: 프롬프트 처리 중... 주제: {fullVideoState.topic || "영상 주제"}
              </div>
            </>
          )}

          {fullVideoState.currentStep === "audio" && (
            <>
              <div style={{ fontSize: 12, color: tokens.colorPaletteGreenForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] SUCCESS: 대본 생성 완료 ({fullVideoState.sceneCount || 8}개 장면)
              </div>
              <div style={{ fontSize: 12, color: tokens.colorBrandForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] START: 음성 생성 프로세스 시작
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: Google TTS 연결 중...
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: 음성 합성 진행 중... 진행률: {Math.round(fullVideoState.progress?.audio || 0)}%
              </div>
            </>
          )}

          {fullVideoState.currentStep === "subtitle" && (
            <>
              <div style={{ fontSize: 12, color: tokens.colorPaletteGreenForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] SUCCESS: 음성 생성 완료
              </div>
              <div style={{ fontSize: 12, color: tokens.colorBrandForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] START: 자막 생성 프로세스 시작
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: SRT 파일 생성 중...
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: 자막 동기화 중... 진행률: {Math.round(fullVideoState.progress?.subtitle || 0)}%
              </div>
            </>
          )}

          {fullVideoState.currentStep === "images" && (
            <>
              <div style={{ fontSize: 12, color: tokens.colorPaletteGreenForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] SUCCESS: 음성 생성 완료
              </div>
              <div style={{ fontSize: 12, color: tokens.colorBrandForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] START: 이미지 생성 프로세스 시작
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: 키워드 추출 및 분석 중...
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: AI 이미지 생성 중... 진행률: {Math.round(fullVideoState.progress?.images || 0)}%
              </div>
            </>
          )}

          {fullVideoState.currentStep === "video" && (
            <>
              <div style={{ fontSize: 12, color: tokens.colorPaletteGreenForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] SUCCESS: 이미지 생성 완료
              </div>
              <div style={{ fontSize: 12, color: tokens.colorBrandForeground1 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] START: 영상 합성 프로세스 시작
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: FFmpeg 초기화 중...
              </div>
              <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
                [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] INFO: 영상 렌더링 중... 진행률: {Math.round(fullVideoState.progress?.video || 0)}%
              </div>
            </>
          )}

          {isComplete && (
            <div style={{ fontSize: 12, color: tokens.colorPaletteGreenForeground1 }}>
              [{new Date().toLocaleTimeString("ko-KR", { hour12: false })}] SUCCESS: 모든 작업 완료! 총 소요시간: {elapsedText}
            </div>
          )}

          {/* 추가 실시간 로그 */}
          {fullVideoState.logs?.slice(-50).map((log, idx) => (
            <div
              key={idx}
              style={{
                fontSize: 12,
                color:
                  log.type === "error"
                    ? tokens.colorPaletteRedForeground1
                    : log.type === "success"
                    ? tokens.colorPaletteGreenForeground1
                    : log.type === "warning"
                    ? tokens.colorPaletteYellowForeground1
                    : tokens.colorNeutralForeground3,
              }}
            >
              [{formatLogTime(log.timestamp)}] {log.type?.toUpperCase()}: {log.message}
            </div>
          ))}
        </div>
      </div>

      {/* 하단 버튼 */}
      {isComplete && (
        <div
          style={{
            padding: "12px 20px 16px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
            background: tokens.colorNeutralBackground2,
          }}
        >
          <Button
            appearance="outline"
            size="small"
            onClick={async () => {
              try {
                const result = await api?.invoke?.("project:openOutputFolder");
                if (result?.success) {
                  toast?.success?.("출력 폴더를 열었습니다.");
                } else {
                  toast?.error?.(`폴더 열기 실패: ${result?.message || "알 수 없는 오류"}`);
                }
              } catch (e) {
                toast?.error?.(`오류: ${e.message}`);
              }
            }}
            style={{ borderRadius: 8 }}
          >
            출력 폴더 열기
          </Button>
        </div>
      )}
    </Card>
  );
}
