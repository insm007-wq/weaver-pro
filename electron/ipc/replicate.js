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
    if (!auth) return { ok: false, message: "no_replicate_token" };

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
      console.error("❌ Replicate 실패:", prediction);
      const errMsg =
        (prediction && (prediction.error || prediction.status)) ||
        "replicate_failed";
      return { ok: false, message: String(errMsg) };
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
