import { useState, useCallback, useEffect } from "react";
import { getSetting } from "../utils/ipcSafe";
import { showSuccess, showError } from "../components/common/GlobalToast";

/**
 * AI 키워드 추출 관련 커스텀 훅
 * AssembleEditor에서 사용하는 키워드 추출 로직을 관리
 */
export const useKeywordExtraction = () => {
  // State
  const [assets, setAssets] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [currentLlmModel, setCurrentLlmModel] = useState("");

  // LLM 모델명을 사용자 친화적으로 표시하는 헬퍼 함수
  const getLlmDisplayName = useCallback((model) => {
    const modelMap = {
      anthropic: "🤖 Anthropic Claude",
      openai: "🤖 OpenAI GPT",
      "openai-gpt5mini": "🤖 OpenAI GPT-4o Mini",
      "google-gemini": "🤖 Google Gemini",
      minimax: "🤖 MiniMax",
      ollama: "🤖 Ollama Local",
    };
    return modelMap[model] || `🤖 ${model}`;
  }, []);

  // 현재 LLM 모델 로드
  const loadCurrentLlmModel = useCallback(async () => {
    try {
      const model = await getSetting("llmModel");
      setCurrentLlmModel(model || "");
    } catch (error) {
      console.error("LLM 모델 로드 오류:", error);
    }
  }, []);

  // 키워드 추출 실행
  const handleExtractKeywords = useCallback(async (scenes) => {
    if (!scenes || scenes.length === 0) {
      showError("SRT 파일을 먼저 업로드해주세요.");
      return;
    }

    setIsExtracting(true);

    try {
      // 씬들을 텍스트로 합성
      const combinedText = scenes
        .map((scene, index) => `[씬 ${index + 1}] ${scene.text}`)
        .join("\\n\\n");

      // IPC 호출로 키워드 추출 요청
      const result = await window.electron.ipcRenderer.invoke("extract-keywords", {
        text: combinedText,
        sceneCount: scenes.length,
      });

      if (result.success && result.keywords) {
        // 키워드를 asset 형태로 변환
        const newAssets = result.keywords.map((keyword, index) => ({
          id: `keyword-${Date.now()}-${index}`,
          keyword: keyword,
          type: "keyword",
          source: "ai-extraction",
        }));

        setAssets(newAssets);
        showSuccess(`🤖 키워드 추출 완료! ${newAssets.length}개의 키워드가 생성되었습니다.`);
      } else {
        throw new Error(result.error || "키워드 추출에 실패했습니다.");
      }
    } catch (error) {
      console.error("키워드 추출 오류:", error);
      showError("키워드 추출 중 오류가 발생했습니다. LLM 설정을 확인해주세요.");
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // 에셋 추가
  const addAssets = useCallback((items) => {
    setAssets((prev) => [...prev, ...items]);
  }, []);

  // 에셋 제거
  const removeAsset = useCallback((assetId) => {
    setAssets((prev) => prev.filter(asset => asset.id !== assetId));
  }, []);

  // 에셋 초기화
  const clearAssets = useCallback(() => {
    setAssets([]);
  }, []);

  // 컴포넌트 마운트 시 LLM 모델 로드
  useEffect(() => {
    loadCurrentLlmModel();
  }, [loadCurrentLlmModel]);

  return {
    // State
    assets,
    isExtracting,
    currentLlmModel,

    // Handlers
    handleExtractKeywords,
    addAssets,
    removeAsset,
    clearAssets,
    getLlmDisplayName,
    loadCurrentLlmModel,

    // Setters for external use
    setAssets,
    setIsExtracting,
    setCurrentLlmModel,
  };
};

export default useKeywordExtraction;