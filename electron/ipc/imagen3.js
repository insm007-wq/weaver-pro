// electron/ipc/imagen3.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const fs = require('fs').promises;

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

// 영상 생성용 이미지 생성 핸들러 (파일 저장 포함)
ipcMain.handle("imagen3:generate", async (_e, payload = {}) => {
  const {
    prompt,
    aspectRatio = "16:9",
    quality = "hd",
    style = "photo"
  } = payload;

  try {
    console.log(`🎨 Google Imagen3 이미지 생성 요청: "${prompt}"`);
    
    // --- 입력 검증 ---
    const promptText = (prompt || "").trim();
    if (!promptText) {
      return { success: false, message: "prompt_required" };
    }

    // --- 서비스 계정 인증 ---
    const serviceAccountJson = await getSecret("imagen3ServiceAccount");
    if (!serviceAccountJson) {
      return { success: false, message: "Google Imagen3 서비스 계정이 설정되지 않았습니다." };
    }
    
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
      return { success: false, message: "잘못된 서비스 계정 JSON 형식입니다." };
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    const accessToken = await auth.getAccessToken();
    const projectId = credentials.project_id;
    const location = "us-central1";
    
    // --- Google Vertex AI Imagen API 호출 ---
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
            sampleCount: 1,
            aspectRatio: aspectRatio,
            safetyFilterLevel: "block_few",
            personGeneration: "allow_adult"
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Imagen3 API 오류:", errorData);
      return { 
        success: false, 
        message: `Imagen3 API 실패: ${response.status} ${errorData.error?.message || ''}` 
      };
    }

    const data = await response.json();
    const predictions = data.predictions;
    
    if (!predictions || predictions.length === 0) {
      return { success: false, message: "이미지가 생성되지 않았습니다." };
    }

    // Base64 이미지 데이터 추출
    const imageData = predictions[0];
    const base64Image = imageData.bytesBase64Encoded;
    
    if (!base64Image) {
      return { success: false, message: "이미지 데이터를 찾을 수 없습니다." };
    }

    // 프로젝트 매니저에서 현재 프로젝트 가져오기
    const { getProjectManager } = require("../services/projectManager");
    const projectManager = getProjectManager();
    const currentProject = projectManager.getCurrentProject();
    
    if (!currentProject) {
      return { success: false, message: "현재 활성 프로젝트가 없습니다." };
    }

    // 이미지 파일 저장
    const timestamp = Date.now();
    const imageFileName = `imagen3_${timestamp}.jpg`;
    const imagePath = path.join(currentProject.paths.images, imageFileName);
    
    // Base64를 Buffer로 변환하여 파일 저장
    const imageBuffer = Buffer.from(base64Image, 'base64');
    await fs.writeFile(imagePath, imageBuffer);
    
    console.log(`✅ Google Imagen3 이미지 저장: ${imagePath}`);

    return {
      success: true,
      imageUrl: imagePath,
      fileName: imageFileName,
      provider: 'Google Imagen3'
    };

  } catch (error) {
    console.error("❌ Google Imagen3 이미지 생성 실패:", error);
    return { 
      success: false, 
      message: error.message 
    };
  }
});