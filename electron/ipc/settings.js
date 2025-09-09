// electron/ipc/settings.js
const { ipcMain, BrowserWindow } = require("electron");
const store = require("../services/store");
const { getSecret, setSecret } = require("../services/secrets");

/* ========================================================================== */
/* helpers                                                                    */
/* ========================================================================== */
function ensureKey(k, msg = "key is required") {
  if (typeof k !== "string" || !k.trim()) {
    throw new Error(msg);
  }
  return k.trim();
}

function isEqual(a, b) {
  // 값 비교(객체/배열 포함) – 브로드캐스트 노이즈 줄이기
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function broadcastChanged(payload) {
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const w of wins) {
      w.webContents.send("settings:changed", payload);
    }
  } catch (e) {
    console.warn("[settings] broadcast fail:", e);
  }
}

/* ========================================================================== */
/* 일반 설정 (electron-store)                                                 */
/* ========================================================================== */
ipcMain.handle("settings:get", async (_e, key) => {
  const k = ensureKey(key, "key is required");
  // undefined 그대로 넘기면 렌더러에서 다루기 불편 → null로 통일
  const v = store.get(k);
  return v === undefined ? null : v;
});

ipcMain.handle("settings:set", async (_e, payload) => {
  // payload는 { key, value } 형태
  const { key, value } = payload || {};
  const k = ensureKey(key, "key is required");

  const prev = store.get(k);
  store.set(k, value);

  // 값이 변경되었으면 모든 렌더러에 브로드캐스트
  if (!isEqual(prev, value)) {
    broadcastChanged({ key: k, value });
  }
  return { ok: true };
});

/* (옵션) 여러 키를 한 번에 저장하고 개별 변경 브로드캐스트 */
ipcMain.handle("settings:setMany", async (_e, items) => {
  // items: Array<{ key, value }>
  if (!Array.isArray(items))
    return { ok: false, message: "items must be array" };

  for (const it of items) {
    const k = ensureKey(it?.key, "key is required");
    const prev = store.get(k);
    store.set(k, it.value);
    if (!isEqual(prev, it.value)) {
      broadcastChanged({ key: k, value: it.value });
    }
  }
  return { ok: true };
});

/* ========================================================================== */
/* 프롬프트 관리 시스템 (협렵업체 스타일)                                      */
/* ========================================================================== */
function generatePromptId() {
  return `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultPrompts() {
  return [
    {
      id: "default-script",
      name: "기본 대본 생성",
      category: "script",
      content: `다음 조건에 맞춰 비디오 스크립트를 작성해 주세요:

주제: {{topic}}
길이: {{duration}}분
스타일: {{style}}

요구사항:
- 시청자의 관심을 끌 수 있는 매력적인 도입부
- 명확하고 이해하기 쉬운 내용 전개
- 적절한 감정적 호소와 논리적 구성
- 행동을 유도하는 강력한 마무리

스크립트를 장면별로 나누어 다음 형식으로 작성해 주세요:

[장면 1]
내레이션: (음성으로 읽을 내용)
화면 설명: (보여질 이미지나 영상에 대한 설명)

[장면 2]
내레이션: (음성으로 읽을 내용)
화면 설명: (보여질 이미지나 영상에 대한 설명)

(이하 반복)`,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: "default-reference",
      name: "기본 레퍼런스 분석",
      category: "reference",
      content: `다음 레퍼런스 대본을 분석하여 동일한 스타일과 구조로 새로운 대본을 생성해 주세요:

레퍼런스 대본:
{{referenceText}}

분석할 요소:
- 톤앤매너 (격식/친근함/전문성 등)
- 문장 구조와 리듬
- 정보 전달 방식
- 감정적 어조와 강조점
- 호출-응답(Call to Action) 스타일

위 레퍼런스의 스타일을 그대로 유지하면서 다음 내용으로 새로운 대본을 작성해 주세요:

주제: {{topic}}
목표 길이: {{duration}}분
추가 요청사항: {{additionalRequests}}

장면별로 구분하여 다음 형식으로 작성해 주세요:

[장면 1]
내레이션: (음성으로 읽을 내용)
화면 설명: (보여질 이미지나 영상에 대한 설명)

[장면 2]
내레이션: (음성으로 읽을 내용)  
화면 설명: (보여질 이미지나 영상에 대한 설명)

(이하 반복)`,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];
}

// 모든 프롬프트 조회
ipcMain.handle("prompts:getAll", async (_e) => {
  try {
    let prompts = store.get("prompts", []);
    
    // 기본 프롬프트가 없으면 생성
    if (!Array.isArray(prompts) || prompts.length === 0) {
      prompts = getDefaultPrompts();
      store.set("prompts", prompts);
      broadcastChanged({ key: "prompts", value: prompts });
    }
    
    return { ok: true, data: prompts };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// ID로 프롬프트 조회
ipcMain.handle("prompts:getById", async (_e, promptId) => {
  try {
    if (!promptId) {
      return { ok: false, message: "promptId is required" };
    }
    
    const prompts = store.get("prompts", []);
    const prompt = prompts.find(p => p.id === promptId);
    
    if (!prompt) {
      // 기본 프롬프트로 fallback
      const defaultPrompts = getDefaultPrompts();
      const defaultPrompt = defaultPrompts.find(p => p.category === "script");
      return { ok: true, data: defaultPrompt };
    }
    
    return { ok: true, data: prompt };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 카테고리별 기본 프롬프트 조회
ipcMain.handle("prompts:getDefault", async (_e, category = "script") => {
  try {
    const prompts = store.get("prompts", []);
    let defaultPrompt = prompts.find(p => p.category === category && p.isDefault);
    
    if (!defaultPrompt) {
      const defaultPrompts = getDefaultPrompts();
      defaultPrompt = defaultPrompts.find(p => p.category === category);
    }
    
    return { ok: true, data: defaultPrompt };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 프롬프트 생성
ipcMain.handle("prompts:create", async (_e, promptData) => {
  try {
    const { name, category, content } = promptData || {};
    
    if (!name?.trim() || !category?.trim() || !content?.trim()) {
      return { ok: false, message: "name, category, content are required" };
    }
    
    const prompts = store.get("prompts", []);
    const newPrompt = {
      id: generatePromptId(),
      name: name.trim(),
      category: category.trim(),
      content: content.trim(),
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedPrompts = [...prompts, newPrompt];
    store.set("prompts", updatedPrompts);
    broadcastChanged({ key: "prompts", value: updatedPrompts });
    
    return { ok: true, data: newPrompt };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 프롬프트 업데이트
ipcMain.handle("prompts:update", async (_e, promptId, promptData) => {
  try {
    if (!promptId) {
      return { ok: false, message: "promptId is required" };
    }
    
    const prompts = store.get("prompts", []);
    const index = prompts.findIndex(p => p.id === promptId);
    
    if (index === -1) {
      return { ok: false, message: `프롬프트를 찾을 수 없습니다: ${promptId}` };
    }
    
    const { name, category, content } = promptData || {};
    const updatedPrompt = {
      ...prompts[index],
      ...(name && { name: name.trim() }),
      ...(category && { category: category.trim() }),
      ...(content && { content: content.trim() }),
      updatedAt: Date.now()
    };
    
    const updatedPrompts = [...prompts];
    updatedPrompts[index] = updatedPrompt;
    
    store.set("prompts", updatedPrompts);
    broadcastChanged({ key: "prompts", value: updatedPrompts });
    
    return { ok: true, data: updatedPrompt };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 프롬프트 삭제
ipcMain.handle("prompts:delete", async (_e, promptId) => {
  try {
    if (!promptId) {
      return { ok: false, message: "promptId is required" };
    }
    
    const prompts = store.get("prompts", []);
    const index = prompts.findIndex(p => p.id === promptId);
    
    if (index === -1) {
      return { ok: false, message: `프롬프트를 찾을 수 없습니다: ${promptId}` };
    }
    
    // 기본 프롬프트는 삭제 불가
    if (prompts[index].isDefault) {
      return { ok: false, message: "기본 프롬프트는 삭제할 수 없습니다" };
    }
    
    const updatedPrompts = prompts.filter(p => p.id !== promptId);
    store.set("prompts", updatedPrompts);
    broadcastChanged({ key: "prompts", value: updatedPrompts });
    
    return { ok: true };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 카테고리별 프롬프트 조회
ipcMain.handle("prompts:getByCategory", async (_e, category) => {
  try {
    if (!category?.trim()) {
      return { ok: false, message: "category is required" };
    }
    
    const prompts = store.get("prompts", []);
    const categoryPrompts = prompts.filter(p => p.category === category.trim());
    
    return { ok: true, data: categoryPrompts };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

/* ========================================================================== */
/* 비밀 값 (keytar)                                                           */
/* ========================================================================== */
ipcMain.handle("secrets:get", async (_e, key) => {
  const k = ensureKey(key, "key is required");
  try {
    const v = await getSecret(k);
    return v ?? null;
  } catch (err) {
    // 렌더러가 문자열만 받도록
    return { ok: false, message: String(err?.message || err) };
  }
});

ipcMain.handle("secrets:set", async (_e, payload) => {
  // payload는 { key, value } 형태여야 함
  const { key, value } = payload || {};
  const k = ensureKey(key, "Account is required"); // keytar의 account 의미
  // value가 undefined면 빈 문자열로 저장 (keytar 안전)
  const v = value == null ? "" : String(value);
  try {
    await setSecret(k, v);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});
