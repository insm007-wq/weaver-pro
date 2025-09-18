// electron/ipc/replicate.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");
const {
  resolveLatestVersionId,
  createReplicate,
} = require("../services/replicateClient");

ipcMain.handle("replicate:generate", async (_e, payload = {}) => {
  const {
    prompt,
    referenceImage,
    count = 1,
    modelHint,
    aspectRatio = "16:9",
    cfg,
    steps,
    seed,
    strength,
    token,
  } = payload;

  try {
    // --- 입력 검증 ---
    const promptText = (prompt || "").trim();
    if (!promptText) return { ok: false, message: "prompt_required" };

    const numOutputs = Math.max(1, Math.min(4, Number(count) || 1)); // 1~4 클램프

    // --- 인증 토큰 확보 ---
    const saved = await getSecret("replicateKey");
    const auth = token || saved || process.env.REPLICATE_API_TOKEN;

    console.log(`🔑 토큰 상태 확인:`);
    console.log(`  - 요청 토큰: ${token ? '제공됨' : '없음'}`);
    console.log(`  - 저장된 토큰: ${saved ? '있음' : '없음'}`);
    console.log(`  - 환경변수 토큰: ${process.env.REPLICATE_API_TOKEN ? '있음' : '없음'}`);

    if (!auth) {
      console.error("❌ Replicate API 토큰이 없습니다!");
      return { ok: false, message: "no_replicate_token", details: "Replicate API 토큰을 설정해주세요" };
    }

    // --- 모델 선택 ---
    let slug;
    if (modelHint) {
      if (modelHint === "flux-dev") slug = "black-forest-labs/flux-dev";
      else if (modelHint === "sdxl") slug = "stability-ai/sdxl";
      else slug = "black-forest-labs/flux-schnell";
    } else {
      slug = referenceImage
        ? "stability-ai/sdxl"
        : "black-forest-labs/flux-schnell";
    }

    const versionId = await resolveLatestVersionId(slug, auth);
    if (!versionId)
      return { ok: false, message: `model_version_resolve_failed:${slug}` };

    // --- 모델별 입력 매핑 ---
    const input = {
      prompt: promptText,
      num_outputs: numOutputs,
      aspect_ratio: aspectRatio,
    };

    if (slug.startsWith("black-forest-labs/flux")) {
      if (cfg != null) input.guidance = cfg;
      if (steps != null) input.num_inference_steps = steps;
      if (seed != null) input.seed = seed;
      // flux 계열은 referenceImage를 직접 안 쓰는 경우가 많음(필요시 모델별 파라미터로 매핑)
    } else {
      if (cfg != null) input.cfg_scale = cfg;
      if (steps != null) input.num_inference_steps = steps;
      if (seed != null) input.seed = seed;
      if (referenceImage) {
        input.image = referenceImage; // URL 또는 base64 data URL
        if (strength != null) input.strength = strength;
      }
    }

    // --- 요청 실행 + 폴링 ---
    console.log(`🎨 Replicate 요청 시작: ${slug}`);
    console.log(`📝 프롬프트: ${promptText}`);
    console.log(`⚙️ 입력 파라미터:`, JSON.stringify(input, null, 2));
    
    const replicate = createReplicate(auth);
    let prediction = await replicate.predictions.create({
      version: versionId,
      input,
    });
    
    console.log(`🔄 Replicate prediction 생성: ${prediction.id}`);

    // 최대 2분(120 * 1초) 폴링
    const maxTries = 120;
    let tries = 0;

    while (
      ["starting", "processing", "queued"].includes(prediction.status) &&
      tries < maxTries
    ) {
      if (tries % 10 === 0) {
        console.log(`⏳ Replicate 대기 중: ${prediction.status} (${tries}/${maxTries})`);
      }
      await new Promise((r) => setTimeout(r, 1000));
      prediction = await replicate.predictions.get(prediction.id);
      tries++;
    }

    if (tries >= maxTries) {
      console.error("❌ Replicate 타임아웃: 2분 초과");
      return { ok: false, message: "timeout" };
    }

    console.log(`🎯 Replicate 최종 상태: ${prediction.status}`);
    
    if (prediction.status !== "succeeded") {
      console.error("❌ Replicate 실패 상세 분석:");
      console.error(`  - 상태: ${prediction.status}`);
      console.error(`  - 오류: ${prediction.error || '알 수 없음'}`);
      console.error(`  - 로그:`, prediction.logs || '없음');
      console.error(`  - 전체 응답:`, JSON.stringify(prediction, null, 2));

      // 상세한 오류 메시지 생성
      let detailedMessage = `상태: ${prediction.status}`;
      if (prediction.error) {
        detailedMessage += `, 오류: ${prediction.error}`;
      }

      // 특정 오류에 대한 사용자 친화적 메시지
      let userMessage = "알 수 없는 오류";
      if (prediction.error && typeof prediction.error === 'string') {
        if (prediction.error.includes('quota') || prediction.error.includes('credit')) {
          userMessage = "크레딧이 부족합니다. Replicate 계정을 확인해주세요";
        } else if (prediction.error.includes('unauthorized') || prediction.error.includes('auth')) {
          userMessage = "API 토큰이 유효하지 않습니다";
        } else if (prediction.error.includes('rate limit')) {
          userMessage = "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요";
        }
      }

      return {
        ok: false,
        message: userMessage,
        details: detailedMessage,
        status: prediction.status,
        error: prediction.error
      };
    }

    // --- 결과 정규화 ---
    const out = prediction.output;
    console.log(`📤 Replicate 출력:`, out);
    
    const images = Array.isArray(out)
      ? out.filter((x) => typeof x === "string")
      : typeof out === "string"
      ? [out]
      : [];

    console.log(`🖼️ 추출된 이미지 URL:`, images);

    // ✅ 순수 JSON만 반환 (prompt 제거해서 루프 차단)
    return { ok: true, images };
  } catch (err) {
    // 에러는 문자열로만 반환
    const msg =
      err?.response?.data?.error ||
      err?.response?.data ||
      err?.message ||
      String(err);
    return { ok: false, message: msg };
  }
});
