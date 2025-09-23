/**
 * 전체 영상 생성 진행률 패널 (모던 플랫 • 세로 구분선 • 상태배지 • 바형 진행률)
 * - 동그라미 제거, 타일형 스텝 카드
 * - 완료(연녹 배경) / 진행(중립 배경) / 오류(연적 배경)
 * - 상단 헤더는 최대한 컴팩트
 * - ETA 유지(보이면 상단 캡션으로), 불필요하면 showEta=false로 끄기
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, Text, Button, Badge, Spinner, tokens } from "@fluentui/react-components";
import {
  DocumentEditRegular,
  VideoRegular,
  MicRegular,
  ImageRegular,
  FolderOpenRegular,
  PlayRegular,
  DismissRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
} from "@fluentui/react-icons";

const STEP_META = {
  script: { label: "대본 생성", icon: DocumentEditRegular },
  audio: { label: "음성 생성", icon: MicRegular },
  images: { label: "이미지 생성", icon: ImageRegular },
  video: { label: "영상 합성", icon: VideoRegular },
  subtitle: { label: "자막 생성", icon: DocumentEditRegular },
};

function ProgressBar({ value, tone }) {
  const bg = "#e8e8ea";
  const fg =
    tone === "success"
      ? tokens.colorPaletteGreenForeground1
      : tone === "danger"
      ? tokens.colorPaletteRedForeground1
      : tokens.colorBrandForeground1;
  return (
    <div style={{ width: "100%", height: 10, borderRadius: 999, background: bg, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value || 0))}%`,
          height: "100%",
          background: fg,
          transition: "width 220ms ease",
        }}
      />
    </div>
  );
}

function StepTile({ id, label, icon: Icon, percent, status, error }) {
  const tone = error ? "danger" : status === "done" ? "success" : "brand";

  const cardBg = error
    ? tokens.colorPaletteRedBackground1
    : status === "done"
    ? tokens.colorPaletteGreenBackground1
    : tokens.colorNeutralBackground1;

  const badge = error
    ? { text: "오류", color: "red" }
    : status === "done"
    ? { text: "완료", color: "green" }
    : { text: "진행중", color: "brand" };

  const stateText = error ? "문제 발생" : status === "done" ? "완료됨" : "작업 중…";

  return (
    <div
      key={id}
      style={{
        flex: 1,
        minWidth: 240,
        background: cardBg,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon />
          <Text weight="semibold" size={300}>
            {label}
          </Text>
        </div>
        <Badge appearance="tint" color={badge.color}>
          {badge.text}
        </Badge>
      </div>

      <ProgressBar value={percent} tone={tone} />

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {stateText}
        </Text>
        <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
          {Math.round(percent || 0)}%
        </Text>
      </div>
    </div>
  );
}

/** ETA 계산(현재 스텝 이동평균 속도 → 백업 전체평균) */
function useETA(fullVideoState, visibleSteps, enabled) {
  const histRef = useRef([]);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const step = fullVideoState.currentStep;
    const p = step && fullVideoState.progress ? fullVideoState.progress[step] || 0 : 0;

    if (step && !["idle", "complete", "completed", "error"].includes(step)) {
      histRef.current.push({ step, t: now / 1000, p });
      if (histRef.current.length > 100) histRef.current = histRef.current.slice(-70);
    }
    lastRef.current = now;
  }, [enabled, fullVideoState.currentStep, fullVideoState.progress]);

  return useMemo(() => {
    if (!enabled) return "";
    const current = fullVideoState.currentStep;
    const isComplete = ["complete", "completed"].includes(fullVideoState.currentStep);
    if (isComplete || !current || current === "idle" || fullVideoState.currentStep === "error") return "";

    // 1) 현재 스텝 최근 속도
    const recent = histRef.current.filter((h) => h.step === current).slice(-10);
    if (recent.length >= 3) {
      const p0 = recent[0].p;
      const t0 = recent[0].t;
      const p1 = recent[recent.length - 1].p;
      const t1 = recent[recent.length - 1].t;
      const dp = Math.max(0, p1 - p0);
      const dt = Math.max(0.001, t1 - t0);
      const rate = dp / dt; // %/sec

      if (rate > 0 && p1 < 100) {
        const remainThis = (100 - p1) / rate;
        const currentIdx = visibleSteps.indexOf(current);
        const remainOthers = Math.max(0, visibleSteps.length - currentIdx - 1) * 60; // 경험칙 1스텝=60s
        const total = Math.max(0, remainThis + remainOthers);
        const m = Math.floor(total / 60),
          s = Math.round(total % 60);
        return m > 0 ? `약 ${m}분 ${s}초 남음` : `약 ${s}초 남음`;
      }
    }

    // 2) 백업: 전체 평균
    const progress = fullVideoState.progress || {};
    const sum = visibleSteps.reduce((acc, k) => acc + (progress[k] || 0), 0);
    const pct = sum / visibleSteps.length;
    if (pct > 0 && pct < 100) {
      const start = fullVideoState.startTime ? new Date(fullVideoState.startTime).getTime() : Date.now();
      const elapsed = (Date.now() - start) / 1000;
      const estTotal = (elapsed / pct) * 100;
      const remain = Math.max(0, estTotal - elapsed);
      const m = Math.floor(remain / 60),
        s = Math.round(remain % 60);
      return m > 0 ? `약 ${m}분 ${s}초 남음` : `약 ${s}초 남음`;
    }
    return "계산 중...";
  }, [enabled, fullVideoState, visibleSteps]);
}

/** 로그 타임 표시 보조(Invalid Date 방지) */
function formatLogTime(ts) {
  if (!ts) return "-";
  // Date 객체
  if (ts instanceof Date) return ts.toLocaleTimeString();
  // 숫자 타임스탬프
  if (typeof ts === "number") return new Date(ts).toLocaleTimeString();
  // 문자열: ISO 가능 여부
  const parsed = Date.parse(ts);
  if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleTimeString();
  // HH:MM:SS 등 포맷은 그대로 노출
  return String(ts);
}

export default function FullVideoProgressPanel({
  fullVideoState,
  resetFullVideoState,
  api,
  toast,
  showEta = true, // 필요 없으면 false
}) {
  if (!fullVideoState.isGenerating && fullVideoState.currentStep === "idle") return null;

  const isComplete = ["complete", "completed"].includes(fullVideoState.currentStep);
  const isError = fullVideoState.currentStep === "error";

  const steps = fullVideoState.mode === "automation_mode" ? ["script", "audio", "images", "video"] : ["script", "audio", "subtitle"];

  // 경과 시간 텍스트
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsedText = useMemo(() => {
    const start = fullVideoState.startTime ? new Date(fullVideoState.startTime).getTime() : Date.now();
    const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const m = Math.floor(sec / 60),
      s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  }, [tick, fullVideoState.startTime]);

  const etaText = useETA(fullVideoState, steps, showEta && !isComplete && !isError);

  const models = steps.map((k) => {
    const pct = fullVideoState.progress?.[k] || 0;
    const status = isError ? "error" : isComplete ? "done" : fullVideoState.currentStep === k ? "active" : pct >= 100 ? "done" : "idle";
    return {
      id: k,
      label: STEP_META[k].label,
      icon: STEP_META[k].icon,
      percent: pct,
      status,
      error: isError && fullVideoState.failedStep === k,
    };
  });

  return (
    <Card
      style={{
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* 상단 헤더: 최대한 컴팩트 (스샷 느낌) */}
      <CardHeader style={{ paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isComplete ? (
              <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
            ) : isError ? (
              <ErrorCircleRegular style={{ color: tokens.colorPaletteRedForeground1 }} />
            ) : (
              <Spinner size="tiny" />
            )}
            <Text weight="semibold" size={400}>
              {fullVideoState.mode === "automation_mode" ? "완전 자동화 영상 생성" : "대본 · 음성 · 자막 생성"}
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              {isComplete ? `완료 (${elapsedText})` : isError ? `오류 (${elapsedText})` : `진행중 (${elapsedText})`}
              {etaText ? ` · ⏳ ${etaText}` : ""}
            </Text>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {fullVideoState.isGenerating ? (
              <Button appearance="subtle" size="small" icon={<DismissRegular />} onClick={() => resetFullVideoState(false)}>
                취소
              </Button>
            ) : (
              <>
                {fullVideoState.currentStep !== "idle" && (
                  <Button appearance="subtle" size="small" onClick={() => resetFullVideoState(true)}>
                    초기화
                  </Button>
                )}
                <Button appearance="subtle" size="small" icon={<DismissRegular />} onClick={() => resetFullVideoState(false)}>
                  닫기
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {/* 스텝 타일 + 얇은 세로 구분선 (스샷 스타일) */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 12, marginBottom: 12 }}>
        {models.map((m, i) => (
          <React.Fragment key={m.id}>
            <StepTile {...m} />
            {i < models.length - 1 && (
              <div
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  background: tokens.colorNeutralStroke2,
                  opacity: 0.5,
                  borderRadius: 1,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* 로그 영역 */}
      {fullVideoState.logs?.length > 0 && (
        <div
          style={{
            background: tokens.colorNeutralBackground1,
            borderRadius: 12,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            padding: 12,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          <Text size={300} weight="semibold" style={{ marginBottom: 8, display: "block" }}>
            📋 진행 로그 ({fullVideoState.logs.length}개)
          </Text>
          {fullVideoState.logs.map((log, idx) => (
            <div key={idx} style={{ padding: "4px 0" }}>
              <Text
                size={200}
                style={{
                  color:
                    log.type === "error"
                      ? tokens.colorPaletteRedForeground1
                      : log.type === "success"
                      ? tokens.colorPaletteGreenForeground1
                      : log.type === "warning"
                      ? tokens.colorPaletteYellowForeground1
                      : tokens.colorNeutralForeground2,
                }}
              >
                [{formatLogTime(log.timestamp)}] {log.message}
              </Text>
            </div>
          ))}
        </div>
      )}

      {/* 완료 액션 (오른쪽 정렬) */}
      {isComplete && fullVideoState.results?.video && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <Button
            appearance="secondary"
            size="small"
            icon={<FolderOpenRegular />}
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
          >
            출력 폴더 열기
          </Button>

          <Button appearance="primary" size="small" icon={<PlayRegular />} onClick={() => toast?.success?.("영상 재생 기능 구현 예정")}>
            영상 재생
          </Button>
        </div>
      )}
    </Card>
  );
}
