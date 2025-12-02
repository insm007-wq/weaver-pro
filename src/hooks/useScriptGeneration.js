/**
 * 대본 생성 관리를 위한 커스텀 훅
 */

import { useState, useEffect, useCallback } from "react";
import { useApi } from "./useApi";
import { AI_ENGINE_OPTIONS } from "../constants/scriptSettings";

export function useScriptGeneration() {
  const api = useApi();

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [chunkProgress, setChunkProgress] = useState(null);

  useEffect(() => {
    setDoc(null);
    setIsLoading(false);
    setError("");
  }, []);

  // LLM 청크 진행률 리스너
  useEffect(() => {
    const handleChunkProgress = (data) => {
      setChunkProgress(data);
    };

    // 리스너 등록
    if (window.electronAPI?.on) {
      window.electronAPI.on('llm:chunk-progress', handleChunkProgress);
    }

    // 클린업
    return () => {
      if (window.electronAPI?.off) {
        window.electronAPI.off('llm:chunk-progress', handleChunkProgress);
      }
    };
  }, []);

  const getSelectedPromptContent = useCallback(
    async (promptName, selectedMode = "script_mode") => {
      try {
        const res = await api.invoke("prompts:getPairByName", promptName);
        if ((res?.ok || res?.success) && res.data) {
          // 모드에 따라 category 선택
          const scriptCategory = selectedMode === "shorts_mode" ? "shorts" : "script";
          const selectedPrompt = res.data[scriptCategory];

          // 쇼츠 프롬프트가 없으면 일반 프롬프트로 fallback
          if (!selectedPrompt?.content && selectedMode === "shorts_mode") {
            console.warn(`⚠️ 쇼츠 프롬프트가 없어 일반 프롬프트를 사용합니다: ${promptName}`);
          }

          return {
            script: selectedPrompt?.content || res.data.script?.content || "",
            reference: res.data.reference?.content || "",
          };
        }
      } catch (error) {
        console.error("프롬프트 내용 로딩 실패:", error);
      }
      return { script: "", reference: "" };
    },
    [api]
  );

  const runGenerate = useCallback(
    async (form, toast = null, selectedMode = "script_mode") => {
      setError("");
      setIsLoading(true);
      setChunkProgress(null); // 진행률 초기화

      try {
        // 전역 설정에서 LLM 모델 가져오기
        let globalLlmModel = null;
        try {
          const llmModelResult = await api.invoke("settings:get", "llmModel");
          globalLlmModel = llmModelResult?.data || llmModelResult;
        } catch (error) {
          console.warn("전역 설정 LLM 모델 로드 실패:", error);
        }

        // 전역 설정 우선, 없으면 form.aiEngine 사용
        const finalEngine = globalLlmModel || form.aiEngine || "anthropic";

        let promptContent = { script: "", reference: "" };
        if (form.promptName) {
          promptContent = await getSelectedPromptContent(form.promptName, selectedMode);
        }

        const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === finalEngine);

        const payload = {
          llm: finalEngine,
          type: "auto",
          topic: form.topic,
          style: form.style,
          duration: form.durationMin,
          temperature: form.temperature,
          prompt: promptContent.script || form.customPrompt,
          referenceText: form.referenceScript,
          cpmMin: form.cpmMin || 300,
          cpmMax: form.cpmMax || 400,
          isShorts: selectedMode === "shorts_mode", // 🎯 쇼츠 모드 플래그 추가
        };

        const getTimeoutForDuration = (minutes) => {
          // 장편은 청크로 나눠 생성하므로 충분한 시간 필요
          // 계산식: (청크 개수 × 청크당 최대 시간 5분) + 여유분
          // 단편: API 타임아웃 90초 × 재시도 3회 + 백오프 = 최대 5분
          if (minutes <= 1) return 180000;    // 1분 이하 (쇼츠): 3분 ✅
          if (minutes >= 90) return 2700000;  // 90분+: 45분 (18청크 × 2.5분)
          if (minutes >= 60) return 1800000;  // 60분+: 30분 (12청크 × 2.5분)
          if (minutes >= 30) return 1200000;  // 30분+: 20분 (6청크 × 3분)
          if (minutes >= 20) return 1200000;  // 20분+: 20분 (4청크 × 5분) ✅
          if (minutes >= 10) return 480000;   // 10분+: 8분 (단일 생성 + 재시도) ✅
          return 360000;                       // 10분 미만: 6분 (재시도 여유) ✅
        };

        const timeoutMs = getTimeoutForDuration(form.durationMin);
        const res = await api.invoke("llm/generateScript", payload, { timeout: timeoutMs });

        if (res && res.data && res.data.scenes) {
          setDoc(res.data);
          return res.data;
        } else {
          throw new Error("API 응답이 올바르지 않습니다.");
        }
      } catch (e) {
        const errorMessage = e?.message || "대본 생성 중 오류가 발생했습니다.";
        setError(errorMessage);
        console.error("대본 생성 오류:", e);
      } finally {
        setIsLoading(false);
      }
    },
    [api, getSelectedPromptContent]
  );

  return {
    doc,
    setDoc,
    isLoading,
    setIsLoading,
    error,
    setError,
    runGenerate,
    getSelectedPromptContent,
    AI_ENGINE_OPTIONS,
    chunkProgress,  // 청크 진행률 추가
  };
}
