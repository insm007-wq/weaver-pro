// electron/ipc/imagen3.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");
const { GoogleAuth } = require('google-auth-library');

ipcMain.handle("generateThumbnailsGoogleImagen3", async (_e, payload = {}) => {
  const {
    prompt,
    count = 1,
    aspectRatio = "16:9",
  } = payload;

  try {
    // --- 입력 검증 ---
    const promptText = (prompt || "").trim();
    if (!promptText) return { ok: false, message: "prompt_required" };

    const numOutputs = Math.max(1, Math.min(4, Number(count) || 1)); // 1~4 클램프

    // --- 서비스 계정 인증 ---
    const serviceAccountJson = await getSecret("imagen3ServiceAccount");
    if (!serviceAccountJson) return { ok: false, message: "no_imagen3_service_account" };
    
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
      return { ok: false, message: "invalid_service_account_json" };
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    const accessToken = await auth.getAccessToken();

    // --- Google Vertex AI Imagen API 호출 ---
    // Google Cloud Vertex AI를 통한 Imagen 3 API 사용
    const projectId = credentials.project_id;
    const location = "us-central1"; // Imagen 3가 지원되는 region
    
    const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: promptText,
            sampleCount: numOutputs,
            aspectRatio: aspectRatio,
            negativePrompt: "",
            safetyFilterLevel: "BLOCK_ONLY_HIGH",
            personGeneration: "ALLOW_ADULT",
          }
        ],
        parameters: {
          sampleCount: numOutputs,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        ok: false, 
        message: `Google Imagen API Error: ${response.status} - ${errorData.error?.message || response.statusText}` 
      };
    }

    const data = await response.json();
    
    // --- 결과 처리 ---
    if (!data.predictions || !Array.isArray(data.predictions)) {
      return { ok: false, message: "Invalid response format from Google Imagen API" };
    }

    // 이미지 URL 추출 (base64 데이터를 data URL로 변환)
    const images = data.predictions
      .filter(prediction => prediction.bytesBase64Encoded)
      .map(prediction => `data:image/png;base64,${prediction.bytesBase64Encoded}`)
      .slice(0, numOutputs);

    if (images.length === 0) {
      return { ok: false, message: "No images generated" };
    }

    return { ok: true, images };

  } catch (err) {
    console.error("Google ImageFX generation error:", err);
    const msg = err?.message || String(err);
    return { ok: false, message: msg };
  }
});

// Imagen3 테스트 핸들러
ipcMain.handle("testImagen3", async (_e, serviceAccountJson) => {
  try {
    if (!serviceAccountJson?.trim()) {
      return { ok: false, message: "Service account JSON required" };
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
      return { ok: false, message: "Invalid JSON format" };
    }

    if (!credentials.project_id || !credentials.private_key || !credentials.client_email) {
      return { ok: false, message: "Invalid service account format" };
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    const accessToken = await auth.getAccessToken();
    const projectId = credentials.project_id;
    const location = "us-central1";
    
    // 간단한 테스트 요청
    const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: "A simple test image of a blue circle",
            sampleCount: 1,
            aspectRatio: "1:1",
          }
        ],
      }),
    });

    if (response.ok) {
      return { ok: true, message: "Connection successful" };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { 
        ok: false, 
        message: `${response.status}: ${errorData.error?.message || response.statusText}` 
      };
    }

  } catch (err) {
    return { ok: false, message: err?.message || String(err) };
  }
});