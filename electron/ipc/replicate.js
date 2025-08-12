// electron/ipc/replicate.js
const { ipcMain } = require("electron");
const axios = require("axios");
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
    const saved = await getSecret("replicateKey");
    const auth = token || saved || process.env.REPLICATE_API_TOKEN;
    if (!auth) return { ok: false, message: "Replicate API Token이 없습니다." };

    // 모델 선택
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
      return { ok: false, message: `모델 버전 조회 실패: ${slug}` };

    // 모델별 입력 매핑
    let input = { prompt, num_outputs: count, aspect_ratio: aspectRatio };
    if (slug.startsWith("black-forest-labs/flux")) {
      if (cfg != null) input.guidance = cfg;
      if (steps != null) input.num_inference_steps = steps;
      if (seed != null) input.seed = seed;
    } else {
      if (cfg != null) input.cfg_scale = cfg;
      if (steps != null) input.num_inference_steps = steps;
      if (seed != null) input.seed = seed;
      if (referenceImage) {
        input.image = referenceImage;
        if (strength != null) input.strength = strength;
      }
    }

    const replicate = createReplicate(auth);
    let prediction = await replicate.predictions.create({
      version: versionId,
      input,
    });

    while (["starting", "processing", "queued"].includes(prediction.status)) {
      await new Promise((r) => setTimeout(r, 1200));
      prediction = await replicate.predictions.get(prediction.id);
    }

    if (prediction.status !== "succeeded") {
      return {
        ok: false,
        message: prediction?.error || `status: ${prediction.status}`,
      };
    }

    const images = Array.isArray(prediction.output)
      ? prediction.output
      : prediction.output
      ? [prediction.output]
      : [];

    return { ok: true, images, prompt: input.prompt };
  } catch (err) {
    return {
      ok: false,
      message: err?.response?.data || err?.message || "Replicate error",
    };
  }
});
