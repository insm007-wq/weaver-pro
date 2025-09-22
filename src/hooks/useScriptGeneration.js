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

  // 훅 초기화 시 강제로 상태 클리어
  useEffect(() => {
    setDoc(null);
    setIsLoading(false);
    setError("");
    console.log("✅ useScriptGeneration 훅 초기화 완료 - doc 상태 클리어됨");
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
          cpmMin: form.cpmMin || 300,
          cpmMax: form.cpmMax || 400,
        };

        // 상세 로깅 (디버깅 강화)
        console.log("🔧 Enhanced Template substitution payload:", payload);
        console.log("🎯 MaxScenes validation:", {
          formValue: form.maxScenes,
          payloadValue: payload.maxScenes,
          isValid: payload.maxScenes >= 4 && payload.maxScenes <= 20,
          recommendation: payload.maxScenes < 4 ? "Too few scenes" : payload.maxScenes > 20 ? "Too many scenes" : "Optimal range",
        });

        if (promptContent.script) {
          console.log("📝 Original prompt:", promptContent.script);
          console.log("📝 Variables to substitute:");
          console.log("  - {topic}:", form.topic);
          console.log("  - {style}:", form.style);
          console.log("  - {duration}:", form.durationMin);
          console.log("  - {maxScenes}:", form.maxScenes, "(설정값 적용됨)");

          // 계산된 값들도 로그로 표시
          const minChars = form.durationMin * 300;
          const maxChars = form.durationMin * 400;
          const avgCharsPerScene = Math.floor((minChars + maxChars) / 2 / form.maxScenes);
          console.log("📊 Calculated values:");
          console.log("  - minCharacters:", minChars);
          console.log("  - maxCharacters:", maxChars);
          console.log("  - avgCharsPerScene:", avgCharsPerScene);
        }

        // 롱폼 컨텐츠 대응 타임아웃 (scriptGenerator.js와 동일한 로직)
        const getTimeoutForDuration = (minutes) => {
          if (minutes >= 90) return 600000; // 90분+: 10분 타임아웃 (속도 우선)
          if (minutes >= 60) return 480000; // 60분+: 8분 타임아웃
          if (minutes >= 30) return 300000; // 30분+: 5분 타임아웃
          if (minutes >= 20) return 180000; // 20분+: 3분 타임아웃
          return 120000; // 기본: 2분 타임아웃 (속도 우선)
        };

        const timeoutMs = getTimeoutForDuration(form.durationMin);
        console.log(`⏱️ 타임아웃 설정: ${form.durationMin}분 → ${timeoutMs / 60000}분 대기`);

        const res = await api.invoke("llm/generateScript", payload, { timeout: timeoutMs });

        if (res && res.data && res.data.scenes) {
          // 협력업체 방식: 실제 생성된 장면 수 검증
          const actualScenes = res.data.scenes.length;
          const requestedScenes = form.maxScenes;

          console.log("✅ Script generation validation");
          console.log(`  - 요청 장면 수: ${requestedScenes}개`);
          console.log(`  - 실제 생성 장면 수: ${actualScenes}개`);
          console.log(
            `  - 일치도: ${actualScenes === requestedScenes ? "완전일치" : `차이 ${Math.abs(actualScenes - requestedScenes)}개`}`
          );

          // 실제 대본 분량 분석
          const totalChars = res.data.scenes.reduce((sum, scene) => sum + (scene.text || "").length, 0);
          const avgCharsPerScene = Math.round(totalChars / actualScenes);
          console.log(`  - 총 글자 수: ${totalChars}자`);
          console.log(`  - 장면당 평균: ${avgCharsPerScene}자`);

          setDoc(res.data);
          const engineName = selectedEngine?.text || form.aiEngine;
          const promptName = form.promptName || "기본";

          // 성공 메시지는 컴포넌트에서 처리
          console.log(
            `✅ ${engineName}로 "${promptName}" 프롬프트를 사용해 ${actualScenes}개 장면의 대본을 생성했습니다. (${totalChars}자)`
          );

          return res.data; // 완전 자동 모드를 위해 반환
        } else {
          throw new Error("API 응답이 올바르지 않습니다.");
        }
      } catch (e) {
        const errorMessage = e?.message || "대본 생성 중 오류가 발생했습니다.";
        setError(errorMessage);
        // 오류 메시지는 error 상태로 전달
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
  };
}
