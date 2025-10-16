// src/hooks/usePersistProject.js
// -----------------------------------------------------------------------------
import { basename, guessMimeByExt } from "../utils/media";

/** 파일/경로를 프로젝트 assets로 저장(또는 참조) */
export function usePersistProject() {
  const persistFileToProject = async (file) => {
    const ab = await file.arrayBuffer();
    const buffer = new Uint8Array(ab);
    const res = await window.api.saveBufferToProject?.({
      category: "assets",
      fileName: file.name || `asset_${Date.now()}`,
      buffer,
    });
    if (!res?.ok || !res?.path) throw new Error(res?.message || "파일 저장 실패");
    return { path: res.path, name: file.name, type: file.type || guessMimeByExt(file.name) };
  };

  const persistPathToProject = async (pathStrOrObj) => {
    const p = typeof pathStrOrObj === "string" ? pathStrOrObj : pathStrOrObj?.path;
    if (!p) throw new Error("invalid_path");

    // 이미 프로젝트 내부면 그대로 사용
    if (/ContentWeaver|projects|assets/i.test(p)) {
      const name = basename(p);
      return { path: p, name, type: guessMimeByExt(name) };
    }

    // 외부 파일은 읽어서 복사 저장
    const r = await window.api.readBinary?.(p);
    if (!r?.ok || !r?.data) throw new Error(r?.message || "read_failed");
    const bin = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
    const name = basename(p) || `asset_${Date.now()}`;
    const res = await window.api.saveBufferToProject?.({
      category: "assets",
      fileName: name,
      buffer: bin,
    });
    if (!res?.ok || !res?.path) throw new Error(res?.message || "save_failed");
    return { path: res.path, name, type: guessMimeByExt(name) };
  };

  const normalizePicked = async (payload) => {
    const f1 = payload?.target?.files?.[0];
    if (f1) return persistFileToProject(f1);

    const f2 = payload?.file instanceof File ? payload.file : payload;
    if (f2 instanceof File) return persistFileToProject(f2);

    if (typeof payload === "string" || (payload?.path && typeof payload.path === "string")) {
      return persistPathToProject(payload);
    }
    return null;
  };

  return { persistFileToProject, persistPathToProject, normalizePicked };
}
