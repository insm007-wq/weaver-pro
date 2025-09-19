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
    console.log("🔍 프롬프트 로딩 디버깅:");
    console.log("- form.promptName:", form.promptName);

    if (form.promptName) {
      promptContent = await getSelectedPromptContent(form.promptName);
      console.log("- promptContent 로드 결과:", {
        hasScript: !!(promptContent.script && promptContent.script.trim()),
        hasReference: !!(promptContent.reference && promptContent.reference.trim()),
        scriptLength: promptContent.script ? promptContent.script.length : 0,
        referenceLength: promptContent.reference ? promptContent.reference.length : 0,
        scriptPreview: promptContent.script ? promptContent.script.substring(0, 100) + "..." : "없음",
        referencePreview: promptContent.reference ? promptContent.reference.substring(0, 100) + "..." : "없음"
      });
    } else {
      console.log("❌ form.promptName이 없어서 프롬프트를 로드하지 않음");
    }

    // 유효한 LLM 모델인지 확인 후 설정
    const validLlmModels = ["anthropic", "openai-gpt5mini"];
    const selectedLlm = globalSettings.llmModel && validLlmModels.includes(globalSettings.llmModel)
      ? globalSettings.llmModel
      : "anthropic"; // 기본값

    // ✅ 하이브리드 모드 분석 (페이로드 구성 전에 먼저 선언)
    const hasReference = !!(form.referenceScript && form.referenceScript.trim());
    const hasTopic = !!(form.topic && form.topic.trim());

    // ✅ 하이브리드 모드에 따른 페이로드 구성
    const isReferenceImproveMode = hasReference && !hasTopic;

    // 사용자 입력값으로 치환할 변수들 계산
    const duration = form.durationMin;
    const maxScenes = form.maxScenes;

    // ★ 추가: TTS 기준 CPM 동적 계산
    const BASE_CPM = 1100;                   // 1.0x에서 900~1300 사이 권장, 보수적으로 1100
    const ttsSpeed = parseFloat(form.speed || "1.0");
    const targetCpm = Math.round(BASE_CPM * (isFinite(ttsSpeed) ? ttsSpeed : 1));
    const cpmMin = Math.round(targetCpm * 0.9);
    const cpmMax = Math.round(targetCpm * 1.1);

    const minCharacters = Math.floor(duration * (cpmMin / 60) * 60);
    const maxCharacters = Math.floor(duration * (cpmMax / 60) * 60);
    const avgCharactersPerScene = Math.floor(minCharacters / maxScenes);
    const totalSeconds = duration * 60;

    const payload = {
      llm: selectedLlm,
      type: "auto",  // anthropic.js에서 reference_improve 타입을 아직 지원하지 않아서 auto 사용
      topic: hasTopic ? form.topic : (hasReference ? "레퍼런스 대본 개선" : form.topic),
      style: form.style,
      duration: form.durationMin,
      maxScenes: form.maxScenes,
      temperature: form.temperature,
      prompt: isReferenceImproveMode
        ? (promptContent.reference || promptContent.script || form.customPrompt)  // 협력업체처럼 원본 프롬프트만 전달
        : (promptContent.script || form.customPrompt),  // Backend에서 치환 담당
      referenceText: form.referenceScript,
      cpmMin,    // ✅ 동적 반영
      cpmMax,    // ✅ 동적 반영
    };

    console.log("🔍 globalSettings:", globalSettings);
    console.log("🔍 LLM Model:", globalSettings.llmModel);

    // ✅ 하이브리드 모드 프롬프트 디버깅
    console.log("🎯 하이브리드 모드 상태:");
    console.log("- hasReference:", hasReference);
    console.log("- hasTopic:", hasTopic);
    console.log("- isReferenceImproveMode:", isReferenceImproveMode);
    console.log("- 사용자 설정 duration:", form.durationMin);
    console.log("- 사용자 설정 maxScenes:", form.maxScenes);
    console.log("- 계산된 duration:", duration);
    console.log("- 계산된 maxScenes:", maxScenes);

    // 협력업체 방식: 원본 프롬프트만 로깅 (Backend에서 치환됨)
    const rawPrompt = isReferenceImproveMode
      ? (promptContent.reference || promptContent.script || form.customPrompt)
      : (promptContent.script || form.customPrompt);

    console.log("📝 프롬프트 선택 로직:");
    console.log("- isReferenceImproveMode:", isReferenceImproveMode);
    console.log("- promptContent.script 존재:", !!(promptContent.script && promptContent.script.trim()));
    console.log("- promptContent.reference 존재:", !!(promptContent.reference && promptContent.reference.trim()));
    console.log("- form.customPrompt 존재:", !!(form.customPrompt && form.customPrompt.trim()));
    console.log("- 최종 선택된 프롬프트 유형:",
      rawPrompt === promptContent.reference ? "reference" :
      rawPrompt === promptContent.script ? "script" :
      rawPrompt === form.customPrompt ? "customPrompt" : "없음"
    );
    console.log("📝 원본 프롬프트 (Backend에서 치환됨):", rawPrompt?.substring(0, 500));
    console.log("📝 치환될 변수들:", {
      maxScenes,
      duration,
      topic: form.topic,
      referenceText: form.referenceScript?.substring(0, 100) + "..."
    });

    const referenceAnalysis = {
      hasReference,
      hasTopic,
      referenceLength: form.referenceScript ? form.referenceScript.trim().length : 0,
      previewText: form.referenceScript ? form.referenceScript.substring(0, 100) + "..." : "없음",
      wordCount: form.referenceScript ? form.referenceScript.trim().split(/\s+/).length : 0,
      isOptimal: form.referenceScript ? form.referenceScript.trim().length >= 500 : false,
      processingMode: hasReference ? (hasTopic ? "reference_guided" : "reference_improve") : "topic_only"
    };

    console.log("📜 레퍼런스 대본 분석:", referenceAnalysis);
    console.log("🎯 생성 모드:",
      referenceAnalysis.processingMode === "reference_guided" ? "레퍼런스 가이드 모드 (톤&매너 분석)" :
      referenceAnalysis.processingMode === "reference_improve" ? "레퍼런스 개선 모드 (더 나은 버전 생성)" :
      "일반 토픽 모드 (기본 설정만)"
    );
    console.log("전송할 payload:", payload);

    // ✅ 하이브리드 모드 로깅
    if (addLog) {
      addLog("📝 대본 생성을 시작합니다...");

      // 모드별 안내
      if (referenceAnalysis.processingMode === "reference_improve") {
        addLog(`🔄 레퍼런스 개선 모드: 기존 대본을 분석해 더 나은 버전을 생성합니다`);
        addLog(`📋 원본 대본: 레퍼런스로 제공됨`);
      } else if (referenceAnalysis.processingMode === "reference_guided") {
        addLog(`🎭 레퍼런스 가이드 모드: 레퍼런스 스타일로 새 주제의 대본을 생성합니다`);
        addLog(`📋 주제: ${form.topic}`);
      } else {
        addLog(`📋 주제: ${form.topic}`);
      }

      addLog(`🎨 스타일: ${form.style}`);
      addLog(`⏱️ 길이: ${form.durationMin}분`);
      addLog(`🤖 AI 모델: ${selectedLlm === "anthropic" ? "Anthropic Claude" : "OpenAI GPT-5 Mini"}`);

      // ✅ 향상된 레퍼런스 대본 추적 로깅
      if (hasReference) {
        const refLength = form.referenceScript.trim().length;
        const wordCount = form.referenceScript.trim().split(/\s+/).length;
        const isOptimal = refLength >= 500;

        addLog(`📜 레퍼런스 대본: 적용됨 (${refLength.toLocaleString()}자, ${wordCount.toLocaleString()}단어)`);

        if (referenceAnalysis.processingMode === "reference_improve") {
          addLog(`📈 이 레퍼런스를 분석해 구조와 스타일을 개선한 새로운 버전을 생성합니다`);
        } else {
          addLog(`🎭 레퍼런스의 톤앤매너를 분석하여 새로운 주제에 적용합니다`);
        }

        addLog(`📊 레퍼런스 품질: ${isOptimal ? "✅ 최적" : "⚠️ 부족"} (권장: 500자 이상)`);

        // 협력업체 수준 상세 분석 로깅
        if (wordCount > 0) {
          const avgWordLength = refLength / wordCount;
          addLog(`🔍 분석 결과: 평균 단어 길이 ${avgWordLength.toFixed(1)}자`);
        }

        // 레퍼런스 미리보기 로깅 (처음 50자)
        const preview = form.referenceScript.trim().substring(0, 50);
        addLog(`👁️ 레퍼런스 미리보기: "${preview}${refLength > 50 ? "..." : ""}"`);
      } else {
        addLog(`📜 레퍼런스 대본: 사용 안함 (기본 설정만 사용)`);
        addLog(`💡 협력업체처럼 레퍼런스를 활용하려면 500자 이상 입력하세요`);
      }

      // 롱폼 컨텐츠 예상 시간 계산 (더 정확한 추정)
      const estimatedSeconds = Math.max(60, Math.min(form.maxScenes * 8, 600)); // 1분~10분
      addLog(`⏳ 예상 소요 시간: 약 ${estimatedSeconds}초 (롱폼 최적화)`);

      // 초장편 컨텐츠 안내
      if (duration >= 90) {
        addLog(`🎬 초장편 컨텐츠 모드: ${duration}분 (${Math.floor(duration/60)}시간 ${duration%60}분) 영상 생성`);
        addLog(`⚡ 최대 30분 소요 예상 - 안정적인 대본 생성을 위해 기다려주세요`);
      } else if (duration >= 60) {
        addLog(`🎞️ 장편 컨텐츠 모드: ${duration}분 (${Math.floor(duration/60)}시간 ${duration%60}분) 영상 생성`);
        addLog(`🔄 최대 20분 소요 예상 - 고품질 대본 생성 중`);
      } else if (duration >= 30) {
        addLog(`📊 롱폼 컨텐츠 모드: ${duration}분 영상 생성 중...`);
        addLog(`🔄 안정적인 생성을 위해 시간이 더 소요될 수 있습니다`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    let res;
    // 2시간까지 지원하는 초장편 대응
    const getTimeoutForDuration = (minutes) => {
      if (minutes >= 90) return 1800000;  // 90분+: 30분 타임아웃
      if (minutes >= 60) return 1200000;  // 60분+: 20분 타임아웃
      if (minutes >= 30) return 900000;   // 30분+: 15분 타임아웃
      if (minutes >= 20) return 600000;   // 20분+: 10분 타임아웃
      return 300000; // 기본: 5분 타임아웃
    };

    const isLongForm = duration >= 20;
    const isUltraLong = duration >= 60; // 1시간 이상은 초장편
    const timeoutMs = getTimeoutForDuration(duration);

    try {
      if (addLog) {
        if (isUltraLong) {
          addLog(`🚀 초장편 대본 생성 시작! (최대 ${timeoutMs/60000}분 대기)`);
          addLog(`📚 ${form.maxScenes}개 장면으로 구성된 ${duration}분 대본을 생성합니다`);
        } else if (isLongForm) {
          addLog(`🚀 롱폼 컨텐츠 생성 시작 (최대 ${timeoutMs/60000}분 대기)`);
        }
      }

      res = await api.invoke("llm/generateScript", payload, { timeout: timeoutMs });
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
        res = await api.invoke("llm/generateScript", fallbackPayload, { timeout: timeoutMs }); // 롱폼 대응 타임아웃

        if (addLog && res && res.data && res.data.scenes) {
          addLog(`✅ Claude 모델로 자동 전환 완료!`, "success");
        }
      } else {
        throw error; // 다른 에러는 그대로 던지기
      }
    }

    console.log("🔍 API 응답 확인:", res);

    if (res && res.data && res.data.scenes && Array.isArray(res.data.scenes) && res.data.scenes.length > 0) {
      // ✅ 향상된 성공 로그 (협력업체 수준)
      if (addLog) {
        addLog(`✅ 대본 생성 완료! ${res.data.scenes.length}개의 장면이 생성되었습니다.`);
        addLog(`📖 제목: "${res.data.title || '생성된 대본'}"`);

        // 총 예상 재생 시간 계산
        const totalDuration = res.data.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0);
        if (totalDuration > 0) {
          addLog(`⏱️ 총 예상 재생 시간: ${Math.round(totalDuration)}초`);
        }

        // ✅ 하이브리드 모드별 성공 추적
        if (hasReference) {
          const generatedLength = res.data.scenes.reduce((sum, scene) => sum + (scene.narration || "").length, 0);
          const referenceLength = form.referenceScript.trim().length;
          const lengthRatio = generatedLength / referenceLength;

          if (referenceAnalysis.processingMode === "reference_improve") {
            addLog(`📈 레퍼런스 개선 완료: 원본을 분석해 더 나은 버전을 생성했습니다`);
            addLog(`📏 길이 변화: 원본 ${referenceLength}자 → 개선됨 ${generatedLength}자 (${lengthRatio.toFixed(1)}배)`);
            addLog(`✨ 구조와 스타일이 개선된 새로운 대본이 완성되었습니다`);
          } else {
            addLog(`🎯 레퍼런스 가이드 완료: 원본 톤앤매너가 새로운 주제에 성공적으로 적용됨`);
            addLog(`📏 길이 비교: 레퍼런스 ${referenceLength}자 → 생성됨 ${generatedLength}자 (${lengthRatio.toFixed(1)}배)`);
            addLog(`🔄 스타일 전이: "${form.topic}"에 레퍼런스 스타일 적용완료`);
          }
        } else {
          addLog(`🎨 일반 생성: 설정된 스타일(${form.style})과 기본 설정으로 생성됨`);
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
  const selectedLlm = validLlmModels.includes(globalSettings.llmModel)
    ? globalSettings.llmModel
    : "anthropic";

  // ★ 추가: TTS 기준 CPM 동적 계산
  const BASE_CPM = 1100;
  const ttsSpeed = parseFloat(form.speed || "1.0");
  const targetCpm = Math.round(BASE_CPM * (isFinite(ttsSpeed) ? ttsSpeed : 1));
  const cpmMin = Math.round(targetCpm * 0.9);
  const cpmMax = Math.round(targetCpm * 1.1);

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
    cpmMin,   // ✅
    cpmMax,   // ✅
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

