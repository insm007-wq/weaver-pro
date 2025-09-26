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

    // 이전 코드와 동일하게 먼저 assets 초기화
    setAssets([]);

    try {
      // 씬들을 텍스트로 합성
      const combinedText = scenes
        .map((scene, index) => `[씬 ${index + 1}] ${scene.text}`)
        .join("\\n\\n");

      console.log("[키워드 추출] 시작:", scenes.length, "개 씬");

      // IPC 호출로 키워드 추출 요청 (이전 코드와 동일하게)
      const result = await window.api.invoke("ai:extractKeywords", {
        subtitles: scenes.map((scene, index) => ({
          index: index,  // 명시적으로 인덱스 설정
          text: scene.text,
          start: scene.start,
          end: scene.end,
        })),
      });

      if (result.success && result.keywords && Object.keys(result.keywords).length > 0) {
        const extractedAssets = [];

        // 이전 코드와 동일한 방식으로 처리
        Object.entries(result.keywords).forEach(([index, keywords]) => {
          if (Array.isArray(keywords)) {
            keywords.forEach((keyword) => {
              if (keyword && keyword.trim()) {
                extractedAssets.push({ keyword: keyword.trim() });
              }
            });
          }
        });

        // 중복 제거 (이전 코드와 동일한 방식)
        const uniqueAssets = extractedAssets.filter((asset, index, self) =>
          index === self.findIndex((a) => a.keyword === asset.keyword)
        );

        // assets 추가 (이전에는 addAssets 사용했지만 현재는 setAssets)
        setAssets(uniqueAssets);

        // 🔥 키워드를 settings.json에 저장
        try {
          const keywordList = uniqueAssets.map(asset => asset.keyword);
          await window.api.setSetting({ key: "extractedKeywords", value: keywordList });
          console.log(`[키워드 저장] settings.json에 ${keywordList.length}개 키워드 저장됨`);
        } catch (saveError) {
          console.error("[키워드 저장] settings.json 저장 실패:", saveError);
          // 저장 실패해도 UI는 계속 진행 (키워드 추출 자체는 성공)
        }

        const duration = result.duration ? ` (${Math.round(result.duration / 1000)}초 소요)` : "";
        console.log(`[키워드 추출] 완료: ${uniqueAssets.length}개 키워드${duration}`);
        showSuccess(`${uniqueAssets.length}개 키워드가 추출되었습니다.${duration}`);
      } else {
        console.warn("[키워드 추출] 키워드가 추출되지 않았습니다.");
        showError("키워드가 추출되지 않았습니다. 자막 내용을 확인해주세요.");
      }
    } catch (error) {
      console.error("[키워드 추출] 실패:", error);
      const errorMessage = error.message || "알 수 없는 오류가 발생했습니다.";
      showError(`키워드 추출에 실패했습니다.\n${errorMessage}\n\n전역 설정 > 기본 설정에서 LLM 모델과 API 키를 확인해주세요.`);
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