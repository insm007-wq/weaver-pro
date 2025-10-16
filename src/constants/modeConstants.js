import { DocumentEditRegular } from "@fluentui/react-icons";

// 공통 모드 상수
export const MODE_CONFIGS = {
  script_mode: {
    key: "script_mode",
    title: "📝 대본 생성",
    subtitle: "대본과 음성만 빠르게",
    fullTitle: "📝 대본 생성 (기본 모드)",
    description: "빠르게 대본과 음성을 생성하여 콘텐츠 제작을 시작합니다",
    fullDescription: "AI 대본 생성 → 음성 합성 → 자막 생성으로 빠르게 콘텐츠를 준비합니다",
    steps: ["대본 생성", "음성 합성", "자막 생성"],
    icon: DocumentEditRegular,
    color: "success",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    estimatedTime: "3-5분",
    buttonText: "📝 대본 생성 시작",
    loadingText: "대본 생성 중...",
    outputFormat: "대본 텍스트 + 음성 파일 + SRT 자막"
  }
};

// 공통 유효성 검사 함수
export const validateForm = (form, isGenerating) => {
  const hasValidTopic = form?.topic?.trim();
  const hasValidReference = form?.referenceScript?.trim() && form.referenceScript.trim().length >= 50;
  const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

  const errors = [];
  if (!hasValidTopic && !hasValidReference) {
    errors.push("• 영상 주제 입력 또는 레퍼런스 대본 입력 (50자 이상)");
  }
  if (!isReferenceOnlyMode && !form?.promptName) {
    errors.push("• 대본 생성 프롬프트 선택");
  }

  return {
    hasValidTopic,
    hasValidReference,
    isReferenceOnlyMode,
    errors,
    isValid: errors.length === 0,
    isDisabled: isGenerating || errors.length > 0
  };
};

// 모드별 배열 (ModeSelector용)
export const MODES_ARRAY = Object.values(MODE_CONFIGS);