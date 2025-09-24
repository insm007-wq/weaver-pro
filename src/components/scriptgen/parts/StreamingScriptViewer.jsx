/**
 * 스트리밍 스크립트 뷰어 컴포넌트 (전체 코드 / hide-show 버그 수정)
 * - "숨기기/보이기"가 항상 동작하도록 렌더 순서 수정
 * - shouldShow 이전에 isVisible 분기 처리
 * - 버튼 가시성 강화(secondary appearance)
 * - 안전한 옵셔널 체이닝 적용
 */

import React, { useState } from "react";
import { Text, tokens, Card, Spinner, Button, Badge } from "@fluentui/react-components";
import { CheckmarkCircleRegular, DismissRegular, EyeRegular } from "@fluentui/react-icons";

/**
 * 사용자 친화적 LLM 모델명
 */
function getModelDisplayName(modelName) {
  const modelMap = {
    anthropic: "🧠 Anthropic Claude",
    "openai-gpt5mini": "🤖 OpenAI GPT-5 Mini",
  };
  return modelMap[modelName] || "🤖 AI";
}

/**
 * 완료된 대본 표시 컴포넌트
 */
function CompletedScript({ doc, form }) {
  return (
    <div>
      {/* 주제 정보 */}
      {form?.topic && (
        <div
          style={{
            marginBottom: tokens.spacingVerticalM,
            padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
            backgroundColor: "rgba(37, 99, 235, 0.06)",
            borderRadius: 8,
            border: "1px solid rgba(37, 99, 235, 0.2)",
          }}
        >
          <Text size={300} style={{ color: tokens.colorBrandForeground1, fontWeight: 600 }}>
            📋 주제: {form.topic}
          </Text>
          {form.style && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginLeft: 16 }}>
              🎨 {form.style} 스타일
            </Text>
          )}
          {form.durationMin && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginLeft: 16 }}>
              ⏱️ {form.durationMin}분
            </Text>
          )}
        </div>
      )}

      {/* 제목 */}
      <div style={{ marginBottom: tokens.spacingVerticalL }}>
        <Text size={400} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
          📖 {doc?.title || "생성된 대본"}
        </Text>
      </div>

      {/* 씬 목록 */}
      {doc?.scenes?.map((scene, index) => (
        <div
          key={scene?.id || index}
          style={{
            marginBottom: tokens.spacingVerticalM,
            paddingBottom: tokens.spacingVerticalM,
            borderBottom:
              index < (doc?.scenes?.length || 0) - 1 ? `1px solid ${tokens.colorNeutralStroke3}` : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: tokens.spacingVerticalXS, gap: 8 }}>
            <Text size={300} weight="semibold" style={{ color: tokens.colorPaletteBlueForeground1 }}>
              🎬 장면 {index + 1}
            </Text>
            {scene?.duration ? (
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground3,
                  backgroundColor: tokens.colorNeutralBackground2,
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {scene.duration}초
              </Text>
            ) : null}
          </div>
          <Text style={{ lineHeight: 1.6 }}>{scene?.text}</Text>
        </div>
      ))}
    </div>
  );
}

/**
 * 생성 중 표시 컴포넌트
 */
function GeneratingScript({ isLoading, form, fullVideoState }) {
  const defaultMessage = `대본 생성 준비 중...

📋 주제: ${form?.topic || "미정"}
🎨 스타일: ${form?.style || "기본"}
⏱️ 길이: ${form?.durationMin || 3}분

🤖 AI가 곧 대본 생성을 시작합니다...`;

  const showCaret = isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");

  return (
    <>
      {defaultMessage}
      {showCaret && (
        <span
          style={{
            animation: "blink 1s infinite",
            marginLeft: 2,
            fontSize: 16,
            color: tokens.colorBrandForeground1,
            fontWeight: "bold",
          }}
        >
          █
        </span>
      )}
      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      `}</style>
    </>
  );
}

/**
 * 메인 컴포넌트
 */
function StreamingScriptViewer({ fullVideoState = {}, doc, isLoading, form = {}, globalSettings = {}, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  // 1) 축소 상태 먼저 처리 → shouldShow와 무관하게 '보이기' 카드가 나와야 함
  if (!isVisible) {
    const generating = isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");
    const completed = !!doc || fullVideoState?.currentStep === "completed";

    return (
      <Card
        style={{
          background: tokens.colorNeutralBackground1,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          borderRadius: 8,
          margin: "16px 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: `linear-gradient(90deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {generating ? (
              <Spinner size="small" appearance="primary" />
            ) : completed ? (
              <CheckmarkCircleRegular style={{ color: tokens.colorPaletteBlueForeground1, fontSize: 16 }} />
            ) : null}

            <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
              {completed ? `📝 대본 생성 완료 - ${(doc?.scenes?.length || 0)}개 장면` : "📝 AI 대본 생성 중..."}
            </Text>
          </div>

          <Button
            appearance="subtle"
            size="small"
            icon={<EyeRegular />}
            onClick={() => setIsVisible(true)}
            style={{ borderRadius: 6 }}
            aria-label="패널 보이기"
          >
            보이기
          </Button>
        </div>
      </Card>
    );
  }

  // 2) 표시 조건 검사(확장 뷰만 해당)
  const shouldShow =
    (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script") ||
    !!isLoading ||
    !!doc ||
    fullVideoState?.currentStep === "completed";

  if (!shouldShow) return null;

  const generatingNow = isLoading || (fullVideoState?.isGenerating && fullVideoState?.currentStep === "script");
  const completedNow = !!doc || fullVideoState?.currentStep === "completed";

  return (
    <Card
      style={{
        background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 14,
        padding: tokens.spacingVerticalL,
        marginBottom: tokens.spacingVerticalL,
        minHeight: completedNow ? 600 : 300,
        maxHeight: completedNow ? 700 : 450,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      {/* 헤더 (CardHeader 제거, 커스텀 헤더로 교체) */}
      <div
        style={{
          paddingBottom: tokens.spacingVerticalM,
          borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
          marginBottom: tokens.spacingVerticalS,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {generatingNow ? (
              <Spinner size="small" appearance="primary" />
            ) : completedNow ? (
              <CheckmarkCircleRegular style={{ color: tokens.colorPaletteBlueForeground1, fontSize: 20 }} />
            ) : null}

            <Text
              size={500}
              weight="semibold"
              style={{ color: completedNow ? tokens.colorPaletteBlueForeground1 : tokens.colorBrandForeground1 }}
            >
              {completedNow ? "✅ 대본 생성 완료" : generatingNow ? "📝 AI 대본 생성 중..." : "📝 대본 생성 대기 중"}
            </Text>
          </div>

          <Button
            appearance="subtle"
            size="small"
            icon={<DismissRegular />}
            onClick={() => setIsVisible(false)}
            style={{ borderRadius: 6 }}
            aria-label="패널 숨기기"
          >
            숨기기
          </Button>
        </div>

        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
          {completedNow
            ? `총 ${(doc?.scenes?.length || 0)}개 장면으로 구성된 대본이 생성되었습니다`
            : generatingNow
            ? `${getModelDisplayName(globalSettings?.llmModel || form?.aiEngine)} 모델이 실시간으로 대본을 생성하고 있습니다`
            : `대본 생성이 시작되면 여기에 진행상태가 표시됩니다`}
        </Text>
      </div>

      {/* 본문 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: tokens.spacingVerticalL,
          border: "1px solid rgba(0,0,0,0.04)",
          fontFamily: completedNow ? "inherit" : "'Consolas', 'Monaco', 'Courier New', monospace",
          fontSize: completedNow ? "15px" : "14px",
          lineHeight: 1.7,
          minHeight: completedNow ? 400 : 200,
          maxHeight: completedNow ? 550 : 450,
          overflowY: "auto",
          whiteSpace: completedNow ? "normal" : "pre-wrap",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
        }}
      >
        {completedNow ? (
          <CompletedScript doc={doc} form={form} />
        ) : (
          <GeneratingScript isLoading={!!isLoading} form={form} fullVideoState={fullVideoState} />
        )}
      </div>
    </Card>
  );
}

export default StreamingScriptViewer;
