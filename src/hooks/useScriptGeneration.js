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
      console.log("📊 LLM 청크 진행률 수신:", data);
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
    async (promptName) => {
      try {
        const res = await api.invoke("prompts:getPairByName", promptName);
        if ((res?.ok || res?.success) && res.data) {
          return {
            script: res.data.script?.content || "",
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
    async (form, toast = null) => {
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
          promptContent = await getSelectedPromptContent(form.promptName);
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
        };

        const getTimeoutForDuration = (minutes) => {
          // 장편은 청크로 나눠 생성하므로 충분한 시간 필요
          if (minutes >= 90) return 900000;  // 90분+: 15분
          if (minutes >= 60) return 720000;  // 60분+: 12분
          if (minutes >= 30) return 600000;  // 30분+: 10분
          if (minutes >= 20) return 360000;  // 20분+: 6분
          if (minutes >= 10) return 240000;  // 10분+: 4분
          return 120000;                      // 10분 미만: 2분
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
