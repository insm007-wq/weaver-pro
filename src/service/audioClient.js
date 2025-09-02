// src/services/audioClient.js
export async function saveTimemapAlongsideMp3(outPath, timemap) {
  if (!outPath) throw new Error("outPath is required");
  if (!timemap || typeof timemap !== "object")
    throw new Error("timemap is required");

  // preload에서 노출한 IPC 호출
  const r = await window.api.audio.concatScenes({ outPath, timemap });
  if (!r?.ok) throw new Error(r?.error || "failed to save timemap");
  return r.timemapPath; // e.g. C:\...\final.timemap.json
}
