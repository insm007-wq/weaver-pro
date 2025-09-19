/**
 * 스트리밍 스크립트 뷰어 컴포넌트
 *
 * @description
 * AI 대본 생성 과정을 실시간으로 시각화하는 컴포넌트
 * 생성 중에는 타이핑 시뮬레이션을, 완성 후에는 최종 대본을 표시합니다.
 *
 * @features
 * - ⚡ 실시간 타이핑 시뮬레이션 (ChatGPT 스타일)
 * - 📖 완성된 대본의 구조화된 표시
 * - 🎨 생성 단계별 UI 변화
 * - 🔄 진행 상태 시각적 피드백
 * - 📊 씬별 정보 표시 (지속시간, 순서)
 * - 🤖 사용된 AI 모델 정보 표시
 *
 * @requires
 * - Hook: useTypingSimulation (타이핑 시뮬레이션 로직)
 * - State: fullVideoState (전체 상태), doc (완성된 대본), isLoading (로딩 상태)
 * - Components: Card, CardHeader, Text, Spinner, CheckmarkCircleRegular
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from "react";
import { Text, tokens, Card, CardHeader, Spinner, Button } from "@fluentui/react-components";
import { CheckmarkCircleRegular, DismissRegular } from "@fluentui/react-icons";

/**
 * AI 대본 생성 과정을 실시간으로 시각화하는 뷰어 컴포넌트
 *
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {Object} props.fullVideoState - 전체 영상 생성 상태
 * @param {boolean} props.fullVideoState.isGenerating - 현재 생성 진행 중 여부
 * @param {string} props.fullVideoState.currentStep - 현재 단계 ("script"|"audio"|"images"|"video"|"subtitle"|"completed")
 * @param {Object} props.doc - 완성된 대본 문서
 * @param {string} props.doc.title - 대본 제목
 * @param {Array} props.doc.scenes - 씬 배열
 * @param {string} props.doc.scenes[].id - 씬 ID
 * @param {string} props.doc.scenes[].text - 씬 텍스트
 * @param {number} props.doc.scenes[].duration - 씬 지속시간 (초)
 * @param {boolean} props.isLoading - 대본 생성 로딩 상태
 * @param {Object} props.form - 폼 설정
 * @param {string} props.form.topic - 영상 주제
 * @param {string} props.form.style - 영상 스타일
 * @param {number} props.form.durationMin - 영상 길이 (분)
 * @param {Object} props.globalSettings - 전역 설정
 * @param {string} props.globalSettings.llmModel - 사용된 LLM 모델 ("anthropic"|"openai-gpt5mini")
 *
 * @example
 * ```jsx
 * // 기본 사용법
 * import StreamingScriptViewer from './parts/StreamingScriptViewer';
 *
 * function ScriptGenerator() {
 *   const [fullVideoState, setFullVideoState] = useState({
 *     isGenerating: true,
 *     currentStep: "script"
 *   });
 *   const [doc, setDoc] = useState(null);
 *   const [isLoading, setIsLoading] = useState(true);
 *   const [form] = useState({
 *     topic: "요리 레시피",
 *     style: "친근한",
 *     durationMin: 5
 *   });
 *   const [globalSettings] = useState({
 *     llmModel: "anthropic"
 *   });
 *
 *   return (
 *     <StreamingScriptViewer
 *       fullVideoState={fullVideoState}
 *       doc={doc}
 *       isLoading={isLoading}
 *       form={form}
 *       globalSettings={globalSettings}
 *       onClose={() => console.log('닫기')}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // 완성된 대본 표시 상태
 * const completedDoc = {
 *   title: "맛있는 파스타 만들기",
 *   scenes: [
 *     {
 *       id: "1",
 *       text: "안녕하세요! 오늘은 간단하면서도 맛있는 파스타를 만드는 방법을 알려드리겠습니다.",
 *       duration: 5
 *     },
 *     {
 *       id: "2",
 *       text: "먼저 필요한 재료를 준비해보겠습니다. 파스타면, 올리브오일, 마늘, 그리고 파마산 치즈가 필요합니다.",
 *       duration: 7
 *     }
 *   ]
 * };
 *
 * <StreamingScriptViewer
 *   fullVideoState={{ isGenerating: false, currentStep: "completed" }}
 *   doc={completedDoc}
 *   isLoading={false}
 *   form={{ topic: "파스타 요리", style: "친근한", durationMin: 3 }}
 *   globalSettings={{ llmModel: "anthropic" }}
 *   onClose={() => console.log('닫기')}
 * />
 * ```
 */
function StreamingScriptViewer({
  fullVideoState,
  doc,
  isLoading,
  form,
  globalSettings,
  onClose
}) {
  // 표시 조건 확인
  // 1. 대본 생성 중이거나 (스크립트 단계)
  // 2. 로딩 중이거나
  // 3. 완성된 대본이 있을 때
  // 4. 완료된 상태일 때
  const shouldShow = (
    (fullVideoState.isGenerating && fullVideoState.currentStep === "script") ||
    isLoading ||
    doc ||
    fullVideoState.currentStep === "completed"
  );

  if (!shouldShow) return null;

  return (
    <Card
      style={{
        background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 14,
        padding: tokens.spacingVerticalL,
        marginBottom: tokens.spacingVerticalL,
        // 대본 완성 시 더 큰 높이, 생성 중에는 기본 높이
        minHeight: doc ? 600 : 300,
        maxHeight: doc ? 700 : 450,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      {/* 헤더: 상태별 아이콘과 제목 */}
      <CardHeader style={{ paddingBottom: tokens.spacingVerticalM }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 상태별 아이콘 표시 */}
            {(isLoading || (fullVideoState.isGenerating && fullVideoState.currentStep === "script")) ? (
              // 생성 중: 회전하는 스피너
              <Spinner size="small" appearance="primary" />
            ) : (doc || fullVideoState.currentStep === "completed") ? (
              // 완료: 녹색 체크마크
              <CheckmarkCircleRegular
                style={{
                  color: tokens.colorPaletteLightGreenForeground1,
                  fontSize: 20
                }}
              />
            ) : null}

            {/* 상태별 제목 */}
            <Text
              size={500}
              weight="semibold"
              style={{
                color: (doc || fullVideoState.currentStep === "completed")
                  ? tokens.colorPaletteLightGreenForeground1  // 완료: 녹색
                  : tokens.colorBrandForeground1              // 진행중: 브랜드 색상
              }}
            >
              {(doc || fullVideoState.currentStep === "completed") ? "✅ 대본 생성 완료" : "📝 AI 대본 생성 중..."}
            </Text>
          </div>

          {/* 닫기 버튼 (완료 시에만 표시) */}
          {(doc || fullVideoState.currentStep === "completed") && onClose && (
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              onClick={onClose}
              size="small"
              style={{
                color: tokens.colorNeutralForeground3
              }}
            />
          )}
        </div>

        {/* 부제목: 상태별 상세 정보 */}
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
          {(doc || fullVideoState.currentStep === "completed")
            ? `총 ${doc?.scenes?.length || 0}개 장면으로 구성된 대본이 생성되었습니다`
            : `${getModelDisplayName(globalSettings.llmModel)} 모델이 실시간으로 대본을 생성하고 있습니다`
          }
        </Text>
      </CardHeader>

      {/* 메인 콘텐츠 영역 */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: tokens.spacingVerticalL,
          border: "1px solid rgba(0,0,0,0.04)",
          // 완성된 대본은 일반 폰트, 생성 중에는 모노스페이스 폰트
          fontFamily: doc ? "inherit" : "'Consolas', 'Monaco', 'Courier New', monospace",
          fontSize: doc ? "15px" : "14px",
          lineHeight: 1.7,
          minHeight: doc ? 400 : 200,
          maxHeight: doc ? 550 : 450,
          overflowY: "auto",
          whiteSpace: doc ? "normal" : "pre-wrap",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
        }}
      >
        {doc ? (
          // 완성된 대본 표시
          <CompletedScript doc={doc} form={form} />
        ) : (
          // 생성 중 표시 (기본 메시지)
          <GeneratingScript
            isLoading={isLoading}
            form={form}
            fullVideoState={fullVideoState}
          />
        )}
      </div>
    </Card>
  );
}

/**
 * 완성된 대본을 구조화하여 표시하는 서브 컴포넌트
 * @param {Object} props.doc - 완성된 대본 데이터
 * @param {Object} props.form - 폼 설정 (주제 정보 포함)
 */
function CompletedScript({ doc, form }) {
  return (
    <div>
      {/* 주제 정보 표시 */}
      {form?.topic && (
        <div style={{
          marginBottom: tokens.spacingVerticalM,
          padding: tokens.spacingVerticalS + " " + tokens.spacingHorizontalM,
          backgroundColor: "rgba(102, 126, 234, 0.08)",
          borderRadius: 8,
          border: "1px solid rgba(102, 126, 234, 0.2)"
        }}>
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

      {/* 대본 제목 */}
      <div style={{ marginBottom: tokens.spacingVerticalL }}>
        <Text size={400} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
          📖 {doc.title || "생성된 대본"}
        </Text>
      </div>

      {/* 씬별 대본 내용 */}
      {doc.scenes?.map((scene, index) => (
        <div
          key={index}
          style={{
            marginBottom: tokens.spacingVerticalM,
            paddingBottom: tokens.spacingVerticalM,
            // 마지막 씬이 아니면 하단 구분선 표시
            borderBottom: index < doc.scenes.length - 1
              ? `1px solid ${tokens.colorNeutralStroke3}`
              : 'none'
          }}
        >
          {/* 씬 헤더: 순서 + 지속시간 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: tokens.spacingVerticalXS,
              gap: 8
            }}
          >
            {/* 씬 번호 */}
            <Text size={300} weight="semibold" style={{ color: tokens.colorPaletteBlueForeground1 }}>
              🎬 장면 {index + 1}
            </Text>

            {/* 지속시간 (있을 경우에만) */}
            {scene.duration && (
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground3,
                  backgroundColor: tokens.colorNeutralBackground2,
                  padding: "2px 8px",
                  borderRadius: 4
                }}
              >
                {scene.duration}초
              </Text>
            )}
          </div>

          {/* 씬 텍스트 */}
          <Text style={{ lineHeight: 1.6 }}>
            {scene.text}
          </Text>
        </div>
      ))}
    </div>
  );
}

/**
 * 대본 생성 중 상태를 표시하는 서브 컴포넌트
 * @param {boolean} props.isLoading - 로딩 상태
 * @param {Object} props.form - 폼 데이터
 * @param {Object} props.fullVideoState - 전체 비디오 상태
 */
function GeneratingScript({ isLoading, form, fullVideoState }) {
  // 기본 메시지
  const defaultMessage = `대본 생성 준비 중...

📋 주제: ${form.topic || "미정"}
🎨 스타일: ${form.style || "기본"}
⏱️ 길이: ${form.durationMin || 3}분

🤖 AI가 곧 대본 생성을 시작합니다...`;

  return (
    <>
      {/* 생성 상태 메시지 */}
      {defaultMessage}

      {/* 커서 애니메이션 (생성 중일 때만) */}
      {(isLoading || (fullVideoState.isGenerating && fullVideoState.currentStep === "script")) && (
        <span
          style={{
            animation: "blink 1s infinite",
            marginLeft: 2,
            fontSize: "16px",
            color: tokens.colorBrandForeground1,
            fontWeight: "bold",
          }}
        >
          █
        </span>
      )}

      {/* CSS 애니메이션 정의 */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}

/**
 * LLM 모델명을 사용자 친화적으로 변환하는 헬퍼 함수
 * @param {string} modelName - 내부 모델명
 * @returns {string} 표시용 모델명
 */
function getModelDisplayName(modelName) {
  const modelMap = {
    "anthropic": "🧠 Anthropic Claude",
    "openai-gpt5mini": "🤖 OpenAI GPT-5 Mini"
  };

  return modelMap[modelName] || "🤖 AI";
}

export default StreamingScriptViewer;

/**
 * @typedef {Object} ScriptDocument
 * @property {string} title - 대본 제목
 * @property {Array<ScriptScene>} scenes - 씬 배열
 */

/**
 * @typedef {Object} ScriptScene
 * @property {string} id - 씬 고유 ID
 * @property {string} text - 씬 텍스트 내용
 * @property {number} [duration] - 씬 지속시간 (초, 선택사항)
 * @property {number} [start] - 시작 시간 (초, 선택사항)
 * @property {number} [end] - 종료 시간 (초, 선택사항)
 */

/**
 * @typedef {Object} TypingState
 * @property {string} currentText - 현재 화면에 표시되는 텍스트
 * @property {boolean} isTyping - 타이핑 애니메이션 진행 여부
 * @property {string} fullText - 최종 완성될 전체 텍스트
 */

/**
 * 컴포넌트 상태별 표시 로직:
 *
 * 1. 표시 안함 (return null)
 *    - isGenerating: false && currentStep !== "script" && !isLoading && !typingState.isTyping && !doc
 *
 * 2. 생성 중 표시 (GeneratingScript)
 *    - isGenerating: true && currentStep === "script"
 *    - isLoading: true
 *    - typingState.isTyping: true
 *
 * 3. 완성된 대본 표시 (CompletedScript)
 *    - doc: 존재하는 객체
 *    - isGenerating: false || currentStep !== "script"
 *    - isLoading: false
 *    - typingState.isTyping: false
 */