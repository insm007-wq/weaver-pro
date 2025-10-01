// electron/ipc/settings.js
const { ipcMain, BrowserWindow } = require("electron");
const store = require("../services/store");
const { getSecret, setSecret } = require("../services/secrets");
const fs = require("fs").promises;
const path = require("path");
const { app } = require("electron");

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

/* ===== prompts 유틸: (name, category) 유일하게 보장 ===== */
function keyOf(p) {
  return `${(p?.name || "").trim()}__${(p?.category || "").trim()}`;
}

function dedupePrompts(list = []) {
  const map = new Map();
  for (const p of Array.isArray(list) ? list : []) {
    const k = keyOf(p);
    if (!map.has(k)) {
      map.set(k, p);
      continue;
    }
    const prev = map.get(k);
    // 기본 프롬프트 우선 규칙
    if (p.isDefault && !prev.isDefault) {
      map.set(k, p);
      continue;
    }
    if (!p.isDefault && prev.isDefault) {
      continue;
    }
    // 최신 updatedAt 우선
    const prevAt = prev.updatedAt ?? 0;
    const curAt = p.updatedAt ?? 0;
    if (curAt >= prevAt) map.set(k, p);
  }
  return Array.from(map.values());
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
  if (!Array.isArray(items)) return { ok: false, message: "items must be array" };

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

// 백업 폴더 경로 가져오기
function getBackupDir() {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "prompt-backups");
}

// 자동 백업 생성
async function createBackup(prompts, reason = "auto") {
  try {
    const backupDir = getBackupDir();

    // 백업 폴더가 없으면 생성
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(backupDir, `prompts-backup-${timestamp}.json`);

    const backupData = {
      version: "1.0",
      timestamp: Date.now(),
      reason,
      prompts: prompts || store.get("prompts", []),
    };

    await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), "utf8");

    // 오래된 백업 정리 (최대 10개 유지)
    await cleanupOldBackups();

    return { ok: true, backupFile };
  } catch (error) {
    console.error("백업 생성 실패:", error);
    return { ok: false, message: String(error?.message || error) };
  }
}

// 오래된 백업 파일 정리
async function cleanupOldBackups() {
  try {
    const backupDir = getBackupDir();
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter((file) => file.startsWith("prompts-backup-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
        stat: null,
      }));

    // 파일 통계 정보 가져오기
    for (const file of backupFiles) {
      try {
        file.stat = await fs.stat(file.path);
      } catch (e) {
        console.warn("백업 파일 통계 조회 실패:", file.name);
      }
    }

    // 수정 시간 기준으로 정렬 (최신순)
    const sortedFiles = backupFiles.filter((file) => file.stat).sort((a, b) => b.stat.mtime - a.stat.mtime);

    // 10개 초과 시 오래된 파일 삭제
    if (sortedFiles.length > 10) {
      const filesToDelete = sortedFiles.slice(10);
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          console.warn("백업 파일 삭제 실패:", file.name);
        }
      }
    }
  } catch (error) {
    console.warn("백업 정리 실패:", error);
  }
}

// 기본 프롬프트 생성 중 플래그 (동시성 문제 방지)
let isCreatingDefaultPrompts = false;

// 기본 프롬프트 생성 함수
function createDefaultPrompts() {
  const { DEFAULT_GENERATE_PROMPT, DEFAULT_REFERENCE_PROMPT, DEFAULT_TEMPLATE } = require("../../src/constants/prompts");
  const now = Date.now();

  return [
    {
      id: generatePromptId(),
      name: "기본 프롬프트",
      category: "script",
      content: DEFAULT_GENERATE_PROMPT,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generatePromptId(),
      name: "기본 프롬프트",
      category: "reference",
      content: DEFAULT_REFERENCE_PROMPT,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generatePromptId(),
      name: "기본 프롬프트",
      category: "thumbnail",
      content: DEFAULT_TEMPLATE,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    }
  ];
}

// 모든 프롬프트 조회 (중복 자동 정리)
ipcMain.handle("prompts:getAll", async (_e) => {
  try {
    let prompts = store.get("prompts", []);

    // 중복 제거(최신 우선)
    if (Array.isArray(prompts) && prompts.length > 0) {
      const deduped = dedupePrompts(prompts);
      if (deduped.length !== prompts.length) {
        prompts = deduped;
        store.set("prompts", prompts);
        broadcastChanged({ key: "prompts", value: prompts });
      }
    } else {
      prompts = [];
    }

    // 기본 프롬프트가 없으면 실제 데이터로 생성하여 저장 (동시성 안전)
    const hasDefaultPrompt = prompts.some(p => p.name === "기본 프롬프트");
    if (!hasDefaultPrompt && !isCreatingDefaultPrompts) {
      isCreatingDefaultPrompts = true;
      try {
        // 다시 한 번 확인 (race condition 방지)
        const currentPrompts = store.get("prompts", []);
        const stillNeedsDefault = !currentPrompts.some(p => p.name === "기본 프롬프트");

        if (stillNeedsDefault) {
          const defaultPrompts = createDefaultPrompts();
          prompts = [...defaultPrompts, ...prompts];
          store.set("prompts", prompts);
          broadcastChanged({ key: "prompts", value: prompts });
          console.log("[settings] 기본 프롬프트 생성 완료");
        }
      } finally {
        isCreatingDefaultPrompts = false;
      }
    }

    return { ok: true, data: prompts };
  } catch (error) {
    isCreatingDefaultPrompts = false; // 에러 시에도 플래그 리셋
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
    const prompt = prompts.find((p) => p.id === promptId);
    if (!prompt) {
      return { ok: false, message: "not found" };
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
    let defaultPrompt = prompts.find((p) => p.category === category && p.isDefault);

    if (!defaultPrompt) {
      const defaultPrompts = getDefaultPrompts();
      defaultPrompt = defaultPrompts.find((p) => p.category === category);
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

    if (!name?.trim() || !category?.trim()) {
      return { ok: false, message: "name, category are required" };
    }

    let prompts = store.get("prompts", []);

    // 생성 전 백업
    await createBackup(prompts, "before_create");

    // 내용이 비어있으면 카테고리 기본 프롬프트로 대체(백엔드 방어)
    let finalContent = (content ?? "").trim();
    if (!finalContent) {
      const defaults = getDefaultPrompts();
      const found = defaults.find((p) => p.category === category.trim());
      finalContent = found?.content || "# 새 프롬프트\n\n여기에 프롬프트 내용을 입력하세요.";
    }

    const newPrompt = {
      id: generatePromptId(),
      name: name.trim(),
      category: category.trim(),
      content: finalContent,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    prompts = [...prompts, newPrompt];
    prompts = dedupePrompts(prompts);

    store.set("prompts", prompts);
    broadcastChanged({ key: "prompts", value: prompts });

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

    let prompts = store.get("prompts", []);
    const index = prompts.findIndex((p) => p.id === promptId);

    if (index === -1) {
      return { ok: false, message: `프롬프트를 찾을 수 없습니다: ${promptId}` };
    }

    // 업데이트 전 백업
    await createBackup(prompts, "before_update");

    const { name, category, content } = promptData || {};

    // 내용이 변경되는 경우 버전 히스토리 저장
    if (content && content.trim() !== prompts[index].content) {
      await savePromptVersion(promptId, prompts[index].content, "before_update");
    }

    const updatedPrompt = {
      ...prompts[index],
      ...(name && { name: name.trim() }),
      ...(category && { category: category.trim() }),
      ...(content && { content: content.trim() }),
      updatedAt: Date.now(),
    };

    prompts = [...prompts];
    prompts[index] = updatedPrompt;
    prompts = dedupePrompts(prompts);

    store.set("prompts", prompts);
    broadcastChanged({ key: "prompts", value: prompts });

    // 업데이트 후 새 내용을 버전으로 저장
    if (content && content.trim() !== (prompts[index]?.content ?? "")) {
      await savePromptVersion(promptId, updatedPrompt.content, "updated");
    }

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

    let prompts = store.get("prompts", []);
    const index = prompts.findIndex((p) => p.id === promptId);

    if (index === -1) {
      return { ok: false, message: `프롬프트를 찾을 수 없습니다: ${promptId}` };
    }

    // 기본 프롬프트는 삭제 불가
    if (prompts[index].isDefault) {
      return { ok: false, message: "기본 프롬프트는 삭제할 수 없습니다" };
    }

    // 삭제 전 백업
    await createBackup(prompts, "before_delete");

    prompts = prompts.filter((p) => p.id !== promptId);
    prompts = dedupePrompts(prompts);

    store.set("prompts", prompts);
    broadcastChanged({ key: "prompts", value: prompts });

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

    const prompts = dedupePrompts(store.get("prompts", []));
    const categoryPrompts = prompts.filter((p) => p.category === category.trim());

    return { ok: true, data: categoryPrompts };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

/* ===== 이름 기준 페어 조회/저장/삭제 (원자적 동작) ===== */

// 이름으로 script/reference/thumbnail 각각 최신 1개 반환 (없으면 null)
ipcMain.handle("prompts:getPairByName", async (_e, name) => {
  try {
    const nm = (name || "").trim();
    if (!nm) return { ok: false, message: "name is required" };

    const prompts = dedupePrompts(store.get("prompts", []));
    const pick = (cat) => {
      // 기본 프롬프트도 선택 가능하도록 변경
      const list = prompts.filter((p) => p.name === nm && p.category === cat);
      if (!list.length) return null;
      return list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    };
    return {
      ok: true,
      data: {
        script: pick("script"),
        reference: pick("reference"),
        thumbnail: pick("thumbnail")
      }
    };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

// 세 카테고리(script/reference/thumbnail)를 한 번에 저장/생성해서 원자적으로 반영
ipcMain.handle("prompts:savePair", async (_e, payload) => {
  try {
    const { name, scriptContent, referenceContent, thumbnailContent } = payload || {};
    const nm = (name || "").trim();
    if (!nm) return { ok: false, message: "name is required" };

    let prompts = dedupePrompts(store.get("prompts", []));

    // 백업
    await createBackup(prompts, "before_savePair");

    const upsert = (cat, content) => {
      if (content == null) return null; // 지정 안 하면 건너뜀
      const now = Date.now();
      // 기본 프롬프트도 수정 가능하도록 변경
      const idx = prompts.findIndex((p) => p.name === nm && p.category === cat);
      if (idx >= 0) {
        prompts[idx] = { ...prompts[idx], content: String(content).trim(), updatedAt: now };
        return prompts[idx];
      } else {
        const created = {
          id: generatePromptId(),
          name: nm,
          category: cat,
          content: String(content).trim(),
          isDefault: false,
          createdAt: now,
          updatedAt: now,
        };
        prompts.push(created);
        return created;
      }
    };

    const s = upsert("script", scriptContent);
    const r = upsert("reference", referenceContent);
    const t = upsert("thumbnail", thumbnailContent);

    prompts = dedupePrompts(prompts);
    store.set("prompts", prompts);
    broadcastChanged({ key: "prompts", value: prompts });

    return { ok: true, data: { script: s || null, reference: r || null, thumbnail: t || null } };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

// 같은 이름의 사용자 프롬프트(script/reference 모두) 삭제
ipcMain.handle("prompts:deleteByName", async (_e, name) => {
  try {
    const nm = (name || "").trim();
    if (!nm) return { ok: false, message: "name is required" };

    const current = store.get("prompts", []);
    const targets = current.filter((p) => !p.isDefault && p.name === nm);
    if (!targets.length) return { ok: true, data: { deleted: 0 } };

    await createBackup(current, "before_deleteByName");

    const updated = current.filter((p) => !(!p.isDefault && p.name === nm));
    const deduped = dedupePrompts(updated);
    store.set("prompts", deduped);
    broadcastChanged({ key: "prompts", value: deduped });

    return { ok: true, data: { deleted: targets.length } };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

/* ========================================================================== */
/* 백업 관리 API                                                              */
/* ========================================================================== */

// 수동 백업 생성
ipcMain.handle("prompts:createBackup", async (_e, reason = "manual") => {
  try {
    const result = await createBackup(null, reason);
    return result;
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 백업 목록 조회
ipcMain.handle("prompts:getBackups", async (_e) => {
  try {
    const backupDir = getBackupDir();

    try {
      await fs.access(backupDir);
    } catch {
      return { ok: true, data: [] };
    }

    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter((file) => file.startsWith("prompts-backup-") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
      }));

    const backups = [];
    for (const file of backupFiles) {
      try {
        const stat = await fs.stat(file.path);
        const content = await fs.readFile(file.path, "utf8");
        const data = JSON.parse(content);

        backups.push({
          filename: file.name,
          path: file.path,
          timestamp: data.timestamp || stat.mtime.getTime(),
          reason: data.reason || "unknown",
          version: data.version || "1.0",
          promptCount: Array.isArray(data.prompts) ? data.prompts.length : 0,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        });
      } catch (e) {
        console.warn("백업 파일 읽기 실패:", file.name, e);
      }
    }

    // 최신순으로 정렬
    backups.sort((a, b) => b.timestamp - a.timestamp);

    return { ok: true, data: backups };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 백업 복원
ipcMain.handle("prompts:restoreBackup", async (_e, backupPath) => {
  try {
    if (!backupPath) {
      return { ok: false, message: "backupPath is required" };
    }

    // 현재 프롬프트 백업 (복원 전)
    await createBackup(null, "before_restore");

    const content = await fs.readFile(backupPath, "utf8");
    const backupData = JSON.parse(content);

    if (!Array.isArray(backupData.prompts)) {
      return { ok: false, message: "잘못된 백업 파일 형식입니다" };
    }

    store.set("prompts", backupData.prompts);
    broadcastChanged({ key: "prompts", value: backupData.prompts });

    return { ok: true, data: { promptCount: backupData.prompts.length } };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 백업 삭제
ipcMain.handle("prompts:deleteBackup", async (_e, backupPath) => {
  try {
    if (!backupPath) {
      return { ok: false, message: "backupPath is required" };
    }

    // 백업 폴더 내부 파일인지 확인 (보안)
    const backupDir = getBackupDir();
    const resolvedPath = path.resolve(backupPath);
    const resolvedBackupDir = path.resolve(backupDir);

    if (!resolvedPath.startsWith(resolvedBackupDir)) {
      return { ok: false, message: "잘못된 백업 경로입니다" };
    }

    await fs.unlink(backupPath);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

/* ========================================================================== */
/* 임포트/익스포트 기능                                                       */
/* ========================================================================== */

// 프롬프트 데이터 익스포트 (JSON)
ipcMain.handle("prompts:exportJson", async (_e, options = {}) => {
  try {
    const { dialog } = require("electron");
    const prompts = store.get("prompts", []);

    if (prompts.length === 0) {
      return { ok: false, message: "익스포트할 프롬프트가 없습니다" };
    }

    // 파일 저장 대화상자
    const result = await dialog.showSaveDialog({
      title: "프롬프트 데이터 익스포트",
      defaultPath: `prompts-export-${new Date().toISOString().split("T")[0]}.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { ok: false, message: "사용자가 취소했습니다" };
    }

    const exportData = {
      version: "1.0",
      exportedAt: Date.now(),
      exportedBy: "weaver-pro",
      totalCount: prompts.length,
      prompts: options.includeDefaults ? prompts : prompts.filter((p) => !p.isDefault),
    };

    await fs.writeFile(result.filePath, JSON.stringify(exportData, null, 2), "utf8");

    return {
      ok: true,
      data: {
        filePath: result.filePath,
        exportedCount: exportData.prompts.length,
      },
    };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 프롬프트 데이터 익스포트 (Markdown)
ipcMain.handle("prompts:exportMarkdown", async (_e, options = {}) => {
  try {
    const { dialog } = require("electron");
    const prompts = store.get("prompts", []);

    if (prompts.length === 0) {
      return { ok: false, message: "익스포트할 프롬프트가 없습니다" };
    }

    // 파일 저장 대화상자
    const result = await dialog.showSaveDialog({
      title: "프롬프트 데이터 익스포트 (Markdown)",
      defaultPath: `prompts-export-${new Date().toISOString().split("T")[0]}.md`,
      filters: [
        { name: "Markdown Files", extensions: ["md"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled) {
      return { ok: false, message: "사용자가 취소했습니다" };
    }

    const filteredPrompts = options.includeDefaults ? prompts : prompts.filter((p) => !p.isDefault);

    // Markdown 형식으로 변환
    let markdown = `# 프롬프트 템플릿 익스포트\n\n`;
    markdown += `- 익스포트 날짜: ${new Date().toLocaleString("ko-KR")}\n`;
    markdown += `- 총 프롬프트 수: ${filteredPrompts.length}\n\n`;

    // 카테고리별로 그룹화
    const categories = [...new Set(filteredPrompts.map((p) => p.category))];

    for (const category of categories) {
      const categoryPrompts = filteredPrompts.filter((p) => p.category === category);

      markdown += `## ${category === "script" ? "📝 대본 생성 프롬프트" : "🔍 레퍼런스 분석 프롬프트"}\n\n`;

      for (const prompt of categoryPrompts) {
        markdown += `### ${prompt.name}\n\n`;
        markdown += `- **ID**: ${prompt.id}\n`;
        markdown += `- **카테고리**: ${prompt.category}\n`;
        markdown += `- **생성일**: ${new Date(prompt.createdAt).toLocaleString("ko-KR")}\n`;
        markdown += `- **수정일**: ${new Date(prompt.updatedAt).toLocaleString("ko-KR")}\n`;
        if (prompt.isDefault) markdown += `- **기본 프롬프트**: ✅\n`;
        markdown += `\n**내용:**\n\n\`\`\`\n${prompt.content}\n\`\`\`\n\n`;
        markdown += `---\n\n`;
      }
    }

    await fs.writeFile(result.filePath, markdown, "utf8");

    return {
      ok: true,
      data: {
        filePath: result.filePath,
        exportedCount: filteredPrompts.length,
      },
    };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 프롬프트 데이터 임포트
ipcMain.handle("prompts:import", async (_e, options = {}) => {
  try {
    const { dialog } = require("electron");

    // 파일 선택 대화상자
    const result = await dialog.showOpenDialog({
      title: "프롬프트 데이터 임포트",
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, message: "사용자가 취소했습니다" };
    }

    // 현재 데이터 백업
    await createBackup(null, "before_import");

    const content = await fs.readFile(result.filePaths[0], "utf8");
    const importData = JSON.parse(content);

    if (!Array.isArray(importData.prompts)) {
      return { ok: false, message: "잘못된 파일 형식입니다" };
    }

    const currentPrompts = store.get("prompts", []);
    let importedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    for (const importPrompt of importData.prompts) {
      // 필수 필드 검증
      if (!importPrompt.name || !importPrompt.category || !importPrompt.content) {
        skippedCount++;
        continue;
      }

      // 기존 프롬프트 찾기 (이름 + 카테고리로 매칭)
      const existingIndex = currentPrompts.findIndex((p) => p.name === importPrompt.name && p.category === importPrompt.category);

      if (existingIndex >= 0) {
        if (options.overwrite) {
          // 기존 프롬프트 업데이트
          currentPrompts[existingIndex] = {
            ...currentPrompts[existingIndex],
            content: importPrompt.content,
            updatedAt: Date.now(),
          };
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // 새 프롬프트 추가
        const newPrompt = {
          id: generatePromptId(),
          name: importPrompt.name,
          category: importPrompt.category,
          content: importPrompt.content,
          isDefault: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        currentPrompts.push(newPrompt);
        importedCount++;
      }
    }

    const deduped = dedupePrompts(currentPrompts);
    store.set("prompts", deduped);
    broadcastChanged({ key: "prompts", value: deduped });

    return {
      ok: true,
      data: {
        importedCount,
        updatedCount,
        skippedCount,
        totalProcessed: importData.prompts.length,
      },
    };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

/* ========================================================================== */
/* 버전 관리 시스템                                                           */
/* ========================================================================== */

// 프롬프트 버전 히스토리 저장
async function savePromptVersion(promptId, content, reason = "update") {
  try {
    const versions = store.get("prompt_versions", {});

    if (!versions[promptId]) {
      versions[promptId] = [];
    }

    const version = {
      id: `v${Date.now()}`,
      content,
      reason,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };

    versions[promptId].unshift(version); // 최신 버전을 맨 앞에

    // 최대 20개 버전 유지
    if (versions[promptId].length > 20) {
      versions[promptId] = versions[promptId].slice(0, 20);
    }

    store.set("prompt_versions", versions);
    return version;
  } catch (error) {
    console.error("버전 저장 실패:", error);
    return null;
  }
}

// 프롬프트 버전 히스토리 조회
ipcMain.handle("prompts:getVersions", async (_e, promptId) => {
  try {
    if (!promptId) {
      return { ok: false, message: "promptId is required" };
    }

    const versions = store.get("prompt_versions", {});
    const promptVersions = versions[promptId] || [];

    return { ok: true, data: promptVersions };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 특정 버전으로 복원
ipcMain.handle("prompts:restoreVersion", async (_e, promptId, versionId) => {
  try {
    if (!promptId || !versionId) {
      return { ok: false, message: "promptId and versionId are required" };
    }

    const versions = store.get("prompt_versions", {});
    const promptVersions = versions[promptId] || [];

    const targetVersion = promptVersions.find((v) => v.id === versionId);
    if (!targetVersion) {
      return { ok: false, message: "버전을 찾을 수 없습니다" };
    }

    const prompts = store.get("prompts", []);
    const promptIndex = prompts.findIndex((p) => p.id === promptId);

    if (promptIndex === -1) {
      return { ok: false, message: "프롬프트를 찾을 수 없습니다" };
    }

    // 현재 내용을 버전으로 저장 (복원 전)
    await savePromptVersion(promptId, prompts[promptIndex].content, "before_restore");

    // 복원 진행
    prompts[promptIndex] = {
      ...prompts[promptIndex],
      content: targetVersion.content,
      updatedAt: Date.now(),
    };

    store.set("prompts", prompts);
    broadcastChanged({ key: "prompts", value: prompts });

    // 복원 후 버전 저장
    await savePromptVersion(promptId, targetVersion.content, "restored");

    return { ok: true, data: prompts[promptIndex] };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 버전 비교
ipcMain.handle("prompts:compareVersions", async (_e, promptId, versionId1, versionId2) => {
  try {
    if (!promptId || !versionId1 || !versionId2) {
      return { ok: false, message: "promptId, versionId1, versionId2 are required" };
    }

    const versions = store.get("prompt_versions", {});
    const promptVersions = versions[promptId] || [];

    const version1 = promptVersions.find((v) => v.id === versionId1);
    const version2 = promptVersions.find((v) => v.id === versionId2);

    if (!version1 || !version2) {
      return { ok: false, message: "비교할 버전을 찾을 수 없습니다" };
    }

    return {
      ok: true,
      data: {
        version1: {
          id: version1.id,
          content: version1.content,
          timestamp: version1.timestamp,
          reason: version1.reason,
        },
        version2: {
          id: version2.id,
          content: version2.content,
          timestamp: version2.timestamp,
          reason: version2.reason,
        },
      },
    };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 버전 삭제
ipcMain.handle("prompts:deleteVersion", async (_e, promptId, versionId) => {
  try {
    if (!promptId || !versionId) {
      return { ok: false, message: "promptId and versionId are required" };
    }

    const versions = store.get("prompt_versions", {});
    const promptVersions = versions[promptId] || [];

    const filteredVersions = promptVersions.filter((v) => v.id !== versionId);

    if (filteredVersions.length === promptVersions.length) {
      return { ok: false, message: "삭제할 버전을 찾을 수 없습니다" };
    }

    versions[promptId] = filteredVersions;
    store.set("prompt_versions", versions);

    return { ok: true };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 모든 템플릿 조회
ipcMain.handle("templates:getAll", async (_e) => {
  try {
    let templates = store.get("prompt_templates", []);

    // 기본 템플릿이 없으면 생성
    if (!Array.isArray(templates) || templates.length === 0) {
      templates = getDefaultTemplates();
      store.set("prompt_templates", templates);
    }

    return { ok: true, data: templates };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 템플릿으로 프롬프트 생성
ipcMain.handle("templates:generatePrompt", async (_e, templateId, variables = {}) => {
  try {
    if (!templateId) {
      return { ok: false, message: "templateId is required" };
    }

    const templates = store.get("prompt_templates", []);
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      return { ok: false, message: "템플릿을 찾을 수 없습니다" };
    }

    let generatedContent = template.template;

    // 변수 치환
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      generatedContent = generatedContent.replace(new RegExp(placeholder, "g"), value || `{${key}}`);
    }

    return {
      ok: true,
      data: {
        template: template,
        generatedContent,
        usedVariables: variables,
      },
    };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 새 템플릿 생성
ipcMain.handle("templates:create", async (_e, templateData) => {
  try {
    const { name, description, category, variables, template } = templateData || {};

    if (!name?.trim() || !category?.trim() || !template?.trim()) {
      return { ok: false, message: "name, category, template are required" };
    }

    const templates = store.get("prompt_templates", []);

    const newTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      description: description?.trim() || "",
      category: category.trim(),
      variables: Array.isArray(variables) ? variables : [],
      template: template.trim(),
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updatedTemplates = [...templates, newTemplate];
    store.set("prompt_templates", updatedTemplates);

    return { ok: true, data: newTemplate };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 템플릿 업데이트
ipcMain.handle("templates:update", async (_e, templateId, templateData) => {
  try {
    if (!templateId) {
      return { ok: false, message: "templateId is required" };
    }

    const templates = store.get("prompt_templates", []);
    const index = templates.findIndex((t) => t.id === templateId);

    if (index === -1) {
      return { ok: false, message: "템플릿을 찾을 수 없습니다" };
    }

    const { name, description, category, variables, template } = templateData || {};
    const updatedTemplate = {
      ...templates[index],
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(category && { category: category.trim() }),
      ...(variables && { variables: Array.isArray(variables) ? variables : [] }),
      ...(template && { template: template.trim() }),
      updatedAt: Date.now(),
    };

    const updatedTemplates = [...templates];
    updatedTemplates[index] = updatedTemplate;

    store.set("prompt_templates", updatedTemplates);

    return { ok: true, data: updatedTemplate };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 템플릿 삭제
ipcMain.handle("templates:delete", async (_e, templateId) => {
  try {
    if (!templateId) {
      return { ok: false, message: "templateId is required" };
    }

    const templates = store.get("prompt_templates", []);
    const template = templates.find((t) => t.id === templateId);

    if (!template) {
      return { ok: false, message: "템플릿을 찾을 수 없습니다" };
    }

    // 기본 템플릿은 삭제 불가
    if (template.isDefault) {
      return { ok: false, message: "기본 템플릿은 삭제할 수 없습니다" };
    }

    const updatedTemplates = templates.filter((t) => t.id !== templateId);
    store.set("prompt_templates", updatedTemplates);

    return { ok: true };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});

// 카테고리별 템플릿 조회
ipcMain.handle("templates:getByCategory", async (_e, category) => {
  try {
    if (!category?.trim()) {
      return { ok: false, message: "category is required" };
    }

    const templates = store.get("prompt_templates", []);
    const categoryTemplates = templates.filter((t) => t.category === category.trim());

    return { ok: true, data: categoryTemplates };
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

/* ========================================================================== */
/* 프롬프트 저장소 초기화                                                     */
/* ========================================================================== */
ipcMain.handle("prompts:reset", async (_e) => {
  try {
    // 기존 프롬프트 데이터 백업
    const currentPrompts = store.get("prompts", []);
    await createBackup(currentPrompts, "before_reset");

    // 더 강력한 초기화 - 저장소 전체 클리어
    store.clear();

    // 물리적 저장소 파일도 삭제 시도
    try {
      const storePath = store.path;
      if (storePath && require("fs").existsSync(storePath)) {
        require("fs").unlinkSync(storePath);
      }
    } catch (fileError) {
      console.warn("저장소 파일 삭제 실패 (무시됨):", fileError.message);
    }

    // 기본 프롬프트만 다시 생성
    const defaultPrompts = getDefaultPrompts();
    store.set("prompts", defaultPrompts);

    broadcastChanged({ key: "prompts", value: defaultPrompts });

    return { ok: true, message: "프롬프트 저장소가 완전히 초기화되었습니다." };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
});
