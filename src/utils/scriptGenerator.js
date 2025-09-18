/**
 * 스크립트 생성 유틸리티
 *
 * @description
 * AI를 통해 대본을 생성하는 유틸리티
 * 다양한 LLM 모델과 프롬프트를 지원합니다.
 *
 * @features
 * - 🤖 다중 LLM 모델 지원 (Anthropic, OpenAI)
 * - 📝 프롬프트 기반 대본 생성
 * - ⚙️ 세부 설정 옵션 지원
 * - 🎯 응답 검증 및 오류 처리
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 */

/**
 * AI를 사용하여 대본을 생성하는 함수
 *
 * @param {Object} form - 폼 설정 데이터
 * @param {Object} globalSettings - 전역 설정
 * @param {Function} getSelectedPromptContent - 프롬프트 내용 가져오기 함수
 * @param {Function} api - API 호출 함수
 * @param {Function} setDoc - 문서 설정 함수
 * @param {Function} setFullVideoState - 상태 업데이트 함수
 * @param {Object} toast - 토스트 알림 객체
 * @param {Function} addLog - 로그 추가 함수
 * @returns {Promise<Object>} 생성된 스크립트 데이터
 */
export async function generateScriptStep(form, globalSettings, getSelectedPromptContent, api, setDoc, setFullVideoState, toast, addLog) {
  try {
    let promptContent = { script: "", reference: "" };
    if (form.promptName) {
      promptContent = await getSelectedPromptContent(form.promptName);
    }

    // 유효한 LLM 모델인지 확인 후 설정
    const validLlmModels = ["anthropic", "openai-gpt5mini"];
    const selectedLlm = globalSettings.llmModel && validLlmModels.includes(globalSettings.llmModel)
      ? globalSettings.llmModel
      : "anthropic"; // 기본값

    const payload = {
      llm: selectedLlm,
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

    console.log("🔍 globalSettings:", globalSettings);
    console.log("🔍 LLM Model:", globalSettings.llmModel);
    console.log("전송할 payload:", payload);

    // 로그 추가
    if (addLog) {
      addLog("📝 대본 생성을 시작합니다...");
      addLog(`📋 주제: ${form.topic}`);
      addLog(`🎨 스타일: ${form.style}`);
      addLog(`⏱️ 길이: ${form.durationMin}분`);
      addLog(`🤖 AI 모델: ${selectedLlm === "anthropic" ? "Anthropic Claude" : "OpenAI GPT-5 Mini"}`);

      // 예상 시간 계산 (장면 수에 따라)
      const estimatedSeconds = Math.max(30, form.maxScenes * 5);
      addLog(`⏳ 예상 소요 시간: 약 ${estimatedSeconds}초`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    let res;
    try {
      res = await api.invoke("llm/generateScript", payload, { timeout: 120000 });
    } catch (error) {
      // LLM 모델 오류 시 자동 전환 처리
      if (selectedLlm === "openai-gpt5mini" && (
        error.message.includes("invalid_request") ||
        error.message.includes("model_not_found") ||
        error.message.includes("not available")
      )) {
        if (addLog) {
          addLog(`⚠️ OpenAI GPT-5 Mini 응답이 유효하지 않아 Anthropic Claude로 자동 전환`, "warning");
          addLog(`🔄 더 안정적인 Claude 모델로 다시 시도합니다.`, "info");
        }

        toast.warning("OpenAI GPT-5 Mini → Anthropic Claude 자동 전환: 모델 오류");

        // Anthropic Claude로 재시도
        const fallbackPayload = { ...payload, llm: "anthropic" };
        res = await api.invoke("llm/generateScript", fallbackPayload, { timeout: 120000 });

        if (addLog && res && res.data && res.data.scenes) {
          addLog(`✅ Claude 모델로 자동 전환 완료!`, "success");
        }
      } else {
        throw error; // 다른 에러는 그대로 던지기
      }
    }

    console.log("🔍 API 응답 확인:", res);

    if (res && res.data && res.data.scenes && Array.isArray(res.data.scenes) && res.data.scenes.length > 0) {
      // 성공 로그
      if (addLog) {
        addLog(`✅ 대본 생성 완료! ${res.data.scenes.length}개의 장면이 생성되었습니다.`);
        addLog(`📖 제목: "${res.data.title || '생성된 대본'}"`);

        // 총 예상 재생 시간 계산
        const totalDuration = res.data.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0);
        if (totalDuration > 0) {
          addLog(`⏱️ 총 예상 재생 시간: ${Math.round(totalDuration)}초`);
        }
      }

      setDoc(res.data);
      setFullVideoState(prev => ({
        ...prev,
        results: { ...prev.results, script: res.data },
        progress: { ...prev.progress, script: 100 },
        streamingScript: "",
      }));
      return res.data;
    } else {
      console.error("❌ 대본 생성 실패 상세:");
      console.error("- res가 존재하는가?", !!res);
      console.error("- res.scenes가 존재하는가?", !!res?.scenes);
      console.error("- scenes가 배열인가?", Array.isArray(res?.scenes));
      console.error("- scenes 길이:", res?.scenes?.length);
      console.error("- 전체 응답 구조:", JSON.stringify(res, null, 2));

      const errorMsg = `대본 생성 API 응답이 올바르지 않습니다.`;
      if (addLog) {
        addLog(`❌ ${errorMsg}`, "error");
      }
      throw new Error(errorMsg);
    }
  } catch (error) {
    // 에러 로그
    if (addLog) {
      addLog(`❌ 대본 생성 실패: ${error.message}`, "error");
    }
    throw error;
  }
}

/**
 * 대본 생성을 위한 페이로드를 준비하는 함수
 *
 * @param {Object} form - 폼 데이터
 * @param {Object} globalSettings - 전역 설정
 * @param {Object} promptContent - 프롬프트 내용
 * @returns {Object} API 호출을 위한 페이로드
 */
export function prepareScriptPayload(form, globalSettings, promptContent) {
  const validLlmModels = ["anthropic", "openai-gpt5mini"];
  const selectedLlm = globalSettings.llmModel && validLlmModels.includes(globalSettings.llmModel)
    ? globalSettings.llmModel
    : "anthropic";

  return {
    llm: selectedLlm,
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
}

/**
 * 스크립트 생성 응답을 검증하는 함수
 *
 * @param {Object} response - API 응답
 * @returns {boolean} 유효성 여부
 */
export function validateScriptResponse(response) {
  return response &&
         response.data &&
         response.data.scenes &&
         Array.isArray(response.data.scenes) &&
         response.data.scenes.length > 0;
}

/**
 * LLM 모델 유효성을 확인하고 기본값을 반환하는 함수
 *
 * @param {string} requestedModel - 요청된 모델
 * @returns {string} 유효한 모델명
 */
export function validateLlmModel(requestedModel) {
  const validLlmModels = ["anthropic", "openai-gpt5mini"];
  return validLlmModels.includes(requestedModel) ? requestedModel : "anthropic";
}

