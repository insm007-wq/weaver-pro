/**
 * 대본 생성 관리를 위한 커스텀 훅
 * 
 * @description
 * AI 엔진을 사용한 대본 생성 기능을 관리하는 훅
 * 다양한 AI 엔진 지원, 프롬프트 관리, 대본 생성 상태 관리 등을 제공합니다.
 * 
 * @features
 * - 🤖 다양한 AI 엔진 지원 (GPT-5, Claude)
 * - 📝 프롬프트 기반 대본 생성
 * - 🎯 토픽, 스타일, 길이 등 세부 설정
 * - 📊 생성 상태 및 진행률 관리
 * - 🛡️ 오류 처리 및 토스트 알림
 * - 🔄 생성된 대본 상태 관리
 * 
 * @example
 * ```jsx
 * import { useScriptGeneration } from './hooks/useScriptGeneration';
 * 
 * function ScriptGenerator() {
 *   const { doc, isLoading, error, runGenerate, AI_ENGINE_OPTIONS } = useScriptGeneration();
 *   
 *   const handleGenerate = () => {
 *     runGenerate({
 *       topic: '인공지능의 미래',
 *       style: 'informative',
 *       aiEngine: 'openai-gpt5mini',
 *       durationMin: 3,
 *       maxScenes: 10
 *     });
 *   };
 *   
 *   if (isLoading) return <GeneratingSpinner />;
 *   if (error) return <ErrorMessage message={error} />;
 *   if (doc) return <ScriptDocument scenes={doc.scenes} />;
 *   
 *   return <GenerateButton onClick={handleGenerate} />;
 * }
 * ```
 * 
 * @usage
 * - ScriptVoiceGenerator.jsx: 대본 생성 및 상태 관리
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useEffect, useCallback } from "react";
import { useApi } from "./useApi";
import { useToast } from "./useToast";

const AI_ENGINE_OPTIONS = [
  {
    key: "openai-gpt5mini",
    text: "🤖 OpenAI GPT-5 Mini",
    desc: "최신 GPT-5 모델, 롱폼 대본 최적화",
    processingTime: "2-5분",
  },
  {
    key: "anthropic", 
    text: "🧠 Anthropic Claude",
    desc: "Claude Sonnet/Haiku, 정확하고 자연스러운 문체",
    processingTime: "1-3분",
  },
];

/**
 * 대본 생성 관리 훅
 * 
 * @returns {Object} 대본 생성 관련 상태와 함수들
 * @returns {Object|null} returns.doc - 생성된 대본 문서 객체 (scenes 배열 포함)
 * @returns {boolean} returns.isLoading - 대본 생성 중 여부
 * @returns {string} returns.error - 생성 오류 메시지 (없으면 빈 문자열)
 * @returns {Function} returns.runGenerate - 대본 생성 실행 함수
 * @returns {Array} returns.AI_ENGINE_OPTIONS - 사용 가능한 AI 엔진 옵션 목록
 */
export function useScriptGeneration() {
  const api = useApi();
  const toast = useToast();

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const getSelectedPromptContent = useCallback(async (promptName) => {
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
  }, [api]);

  const runGenerate = useCallback(async (form) => {
    setError("");
    setIsLoading(true);

    try {
      let promptContent = { script: "", reference: "" };
      if (form.promptName) {
        promptContent = await getSelectedPromptContent(form.promptName);
      }

      const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);

      const payload = {
        llm: form.aiEngine,
        type: "auto",
        topic: form.topic,
        style: form.style,
        duration: form.durationMin,
        maxScenes: form.maxScenes,
        temperature: form.temperature,
        prompt: promptContent.script || form.customPrompt,
        referenceText: form.referenceScript,
        cpmMin: 300,
        cpmMax: 400,
      };

      // 협력업체 수준의 상세 로깅 (디버깅 강화)
      console.log("🔧 Enhanced Template substitution payload:", payload);
      console.log("🎯 MaxScenes validation:", {
        formValue: form.maxScenes,
        payloadValue: payload.maxScenes,
        isValid: payload.maxScenes >= 4 && payload.maxScenes <= 20,
        recommendation: payload.maxScenes < 4 ? "Too few scenes" : payload.maxScenes > 20 ? "Too many scenes" : "Optimal range"
      });

      if (promptContent.script) {
        console.log("📝 Original prompt:", promptContent.script);
        console.log("📝 Variables to substitute (협력업체 방식):");
        console.log("  - {topic}:", form.topic);
        console.log("  - {style}:", form.style);
        console.log("  - {duration}:", form.durationMin);
        console.log("  - {maxScenes}:", form.maxScenes, "(설정값 적용됨)");

        // 계산된 값들도 로그로 표시 (협력업체 방식)
        const minChars = form.durationMin * 300;
        const maxChars = form.durationMin * 400;
        const avgCharsPerScene = Math.floor((minChars + maxChars) / 2 / form.maxScenes);
        console.log("📊 Calculated values (협력업체 방식):");
        console.log("  - minCharacters:", minChars);
        console.log("  - maxCharacters:", maxChars);
        console.log("  - avgCharsPerScene:", avgCharsPerScene);
      }

      const res = await api.invoke("llm/generateScript", payload, { timeout: 120000 }); // 2분 타임아웃

      if (res && res.data && res.data.scenes) {
        // 협력업체 방식: 실제 생성된 장면 수 검증
        const actualScenes = res.data.scenes.length;
        const requestedScenes = form.maxScenes;

        console.log("✅ Script generation validation (협력업체 방식):");
        console.log(`  - 요청 장면 수: ${requestedScenes}개`);
        console.log(`  - 실제 생성 장면 수: ${actualScenes}개`);
        console.log(`  - 일치도: ${actualScenes === requestedScenes ? '완전일치' : `차이 ${Math.abs(actualScenes - requestedScenes)}개`}`);

        // 실제 대본 분량 분석
        const totalChars = res.data.scenes.reduce((sum, scene) => sum + (scene.text || '').length, 0);
        const avgCharsPerScene = Math.round(totalChars / actualScenes);
        console.log(`  - 총 글자 수: ${totalChars}자`);
        console.log(`  - 장면당 평균: ${avgCharsPerScene}자`);

        setDoc(res.data);
        const engineName = selectedEngine?.text || form.aiEngine;
        const promptName = form.promptName || "기본";

        // 향상된 성공 메시지 (협력업체보다 상세함)
        toast.success(`${engineName}로 "${promptName}" 프롬프트를 사용해 ${actualScenes}개 장면의 대본을 생성했습니다. (${totalChars}자)`);
      } else {
        throw new Error("API 응답이 올바르지 않습니다.");
      }
    } catch (e) {
      const errorMessage = e?.message || "대본 생성 중 오류가 발생했습니다.";
      setError(errorMessage);
      toast.error(`대본 생성 실패: ${errorMessage}`);
      console.error("대본 생성 오류:", e);
    } finally {
      setIsLoading(false);
    }
  }, [api, toast, getSelectedPromptContent]);

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
  };
}