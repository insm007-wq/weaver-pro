import React, { useState } from "react";
import {
  Card,
  Text,
  Button,
  tokens,
  Divider,
} from "@fluentui/react-components";
import {
  ChevronUpRegular,
  ChevronDownRegular,
  DismissRegular,
} from "@fluentui/react-icons";

function ResultsSidebar({
  fullVideoState,
  doc,
  isLoading,
  form,
  globalSettings,
  resetFullVideoState,
  api,
  onClose,
  horizontal = false
}) {
  const [isProgressExpanded, setIsProgressExpanded] = useState(true);
  const [isScriptExpanded, setIsScriptExpanded] = useState(true);

  // 표시할 내용이 있는지 확인
  const hasProgress = fullVideoState?.isGenerating || fullVideoState?.currentStep !== "idle";
  const hasScript = doc || isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");

  // 전혀 표시할 내용이 없으면 숨김
  if (!hasProgress && !hasScript) {
    return null;
  }

  // 가로형 레이아웃 (하단 배치용)
  if (horizontal) {
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
            background: `linear-gradient(180deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
            📊 실시간 결과
          </Text>
          <Button
            appearance="subtle"
            size="small"
            icon={<DismissRegular />}
            onClick={onClose}
            style={{ borderRadius: 6 }}
            aria-label="결과 패널 닫기"
          />
        </div>

        {/* 2열 그리드 콘텐츠 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: tokens.spacingHorizontalL,
            padding: "20px",
          }}
        >
          {/* 좌측: 진행률 섹션 */}
          {hasProgress && (
            <div>
              <div
                style={{
                  padding: "12px 0",
                  marginBottom: tokens.spacingVerticalM,
                  borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
                }}
              >
                <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                  🔄 진행 상황
                </Text>
              </div>
              <MiniProgressPanel
                fullVideoState={fullVideoState}
                resetFullVideoState={resetFullVideoState}
                api={api}
              />
            </div>
          )}

          {/* 우측: 대본 결과 섹션 */}
          {hasScript && (
            <div>
              <div
                style={{
                  padding: "12px 0",
                  marginBottom: tokens.spacingVerticalM,
                  borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
                }}
              >
                <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                  📝 대본 결과
                </Text>
              </div>
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
          background: `linear-gradient(180deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
          📊 실시간 결과
        </Text>
        <Button
          appearance="subtle"
          size="small"
          icon={<DismissRegular />}
          onClick={onClose}
          style={{ borderRadius: 6 }}
          aria-label="결과 패널 닫기"
        />
      </div>

      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0",
        }}
      >
        {/* 진행률 섹션 */}
        {hasProgress && (
          <div style={{ borderBottom: hasScript ? `1px solid ${tokens.colorNeutralStroke3}` : "none" }}>
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                background: isProgressExpanded ? tokens.colorNeutralBackground2 : "transparent",
              }}
              onClick={() => setIsProgressExpanded(!isProgressExpanded)}
            >
              <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                🔄 진행 상황
              </Text>
              <Button
                appearance="subtle"
                size="small"
                icon={isProgressExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
                aria-label={isProgressExpanded ? "접기" : "펼치기"}
              />
            </div>

            {isProgressExpanded && (
              <div style={{ padding: "0 20px 16px" }}>
                <MiniProgressPanel
                  fullVideoState={fullVideoState}
                  resetFullVideoState={resetFullVideoState}
                  api={api}
                />
              </div>
            )}
          </div>
        )}

        {/* 대본 결과 섹션 */}
        {hasScript && (
          <div>
            <div
              style={{
                padding: "12px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                background: isScriptExpanded ? tokens.colorNeutralBackground2 : "transparent",
              }}
              onClick={() => setIsScriptExpanded(!isScriptExpanded)}
            >
              <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
                📝 대본 결과
              </Text>
              <Button
                appearance="subtle"
                size="small"
                icon={isScriptExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
                aria-label={isScriptExpanded ? "접기" : "펼치기"}
              />
            </div>

            {isScriptExpanded && (
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
        )}
      </div>
    </Card>
  );
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
              : tokens.colorBrandBackground,
            animation: !isComplete && !isError ? "pulse 2s infinite" : "none",
          }}
        />
        <Text size={200} weight="semibold">
          {isError ? "오류 발생" : isComplete ? "완료" : "진행 중..."}
        </Text>
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
          {avgProgress}%
        </Text>
      </div>

      {/* 현재 단계 */}
      <Text size={200} style={{ color: tokens.colorNeutralForeground2, marginBottom: 8 }}>
        현재: {getStepDisplayName(fullVideoState.currentStep)}
      </Text>

      {/* 미니 진행바 */}
      <div
        style={{
          width: "100%",
          height: 4,
          borderRadius: 2,
          background: tokens.colorNeutralBackground3,
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${avgProgress}%`,
            height: "100%",
            background: isError
              ? tokens.colorPaletteRedForeground1
              : isComplete
              ? tokens.colorPaletteGreenForeground1
              : tokens.colorBrandForeground1,
            transition: "width 300ms ease-out",
          }}
        />
      </div>

      {/* 단계별 미니 표시 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {steps.map((step, index) => {
          const progress = fullVideoState.progress?.[step] || 0;
          const isActive = fullVideoState.currentStep === step;
          const isDone = progress >= 100;

          return (
            <div
              key={step}
              style={{
                flex: 1,
                height: 2,
                borderRadius: 1,
                background: isDone
                  ? tokens.colorPaletteGreenBackground3
                  : isActive
                  ? tokens.colorBrandBackground
                  : tokens.colorNeutralBackground3,
              }}
            />
          );
        })}
      </div>

      {/* 최근 로그 */}
      {fullVideoState.logs && fullVideoState.logs.length > 0 && (
        <div
          style={{
            background: tokens.colorNeutralBackground2,
            borderRadius: 6,
            padding: 8,
            maxHeight: 100,
            overflowY: "auto",
          }}
        >
          <Text size={100} weight="semibold" style={{ marginBottom: 4, display: "block" }}>
            최근 활동:
          </Text>
          {fullVideoState.logs.slice(-3).map((log, idx) => (
            <Text
              key={idx}
              size={100}
              style={{
                display: "block",
                color: tokens.colorNeutralForeground3,
                fontFamily: "monospace",
                fontSize: "10px",
                lineHeight: 1.3,
              }}
            >
              {log.message}
            </Text>
          ))}
        </div>
      )}

      {/* 완료 시 액션 버튼 */}
      {isComplete && (
        <Button
          appearance="outline"
          size="small"
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
            marginTop: 8,
            borderRadius: 6,
            fontSize: "11px",
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
      `}</style>
    </div>
  );
}

// 컴팩트 스크립트 뷰어 컴포넌트
function CompactScriptViewer({ fullVideoState, doc, isLoading, form, globalSettings }) {
  const generatingNow = isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");
  const completedNow = !!doc;

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

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {doc?.scenes?.slice(0, 3).map((scene, index) => (
              <div
                key={`scene-${index}-${scene?.id || 'no-id'}`}
                style={{
                  padding: 8,
                  background: tokens.colorNeutralBackground1,
                  borderRadius: 6,
                  border: `1px solid ${tokens.colorNeutralStroke1}`,
                }}
              >
                <Text size={100} weight="semibold" style={{ color: tokens.colorBrandForeground1, marginBottom: 4, display: "block" }}>
                  장면 {index + 1}
                  {scene?.duration && (
                    <span style={{ color: tokens.colorNeutralForeground3, fontWeight: "normal", marginLeft: 4 }}>
                      ({scene.duration}초)
                    </span>
                  )}
                </Text>
                <Text
                  size={100}
                  style={{
                    color: tokens.colorNeutralForeground2,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {scene?.text}
                </Text>
              </div>
            ))}

            {doc?.scenes?.length > 3 && (
              <Text size={100} style={{ color: tokens.colorNeutralForeground3, textAlign: "center", fontStyle: "italic" }}>
                + {doc.scenes.length - 3}개 장면 더...
              </Text>
            )}
          </div>
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

// 단계 표시명 매핑
function getStepDisplayName(step) {
  const stepNames = {
    script: "대본 생성",
    audio: "음성 합성",
    images: "이미지 생성",
    video: "영상 합성",
    subtitle: "자막 생성",
    complete: "완료",
    completed: "완료",
    error: "오류",
    idle: "대기",
  };
  return stepNames[step] || step;
}

export default ResultsSidebar;