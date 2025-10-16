// electron/ipc/script/toSrt.js
const { ipcMain } = require("electron");

// 00:00:00,000 포맷
function fmtSrtTime(sec = 0) {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(ss)},${String(ms).padStart(3, "0")}`;
}

module.exports = function registerToSrt() {
  ipcMain.handle("script/toSrt", async (evt, payload) => {
    try {
      console.log("🔧 toSrt.js - script/toSrt 호출됨:", { payload });

      const doc = payload?.doc || {};
      const ttsMarks = Array.isArray(payload?.ttsMarks) ? payload.ttsMarks : null;

      const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
      console.log("📝 toSrt.js - 변환할 장면 수:", scenes.length);

      if (!scenes.length) {
        console.warn("⚠️ toSrt.js - 변환할 장면이 없음");
        return { success: false, error: "변환할 장면이 없습니다." };
      }

    // 1) 씬별 "실제" duration 얻기
    //    - ttsMarks 가 있으면: duration = end - start
    //    - 없으면: 기존 doc.duration 또는 균등 분할(폴백)
    const durations = [];
    if (ttsMarks && ttsMarks.length === scenes.length) {
      for (let i = 0; i < scenes.length; i++) {
        const mk = ttsMarks[i];
        const d = Number(mk?.duration || 0);
        durations.push(
          d > 0 ? d : Math.max(0.5, Number(scenes[i]?.duration || 0))
        );
      }
    } else {
      for (let i = 0; i < scenes.length; i++) {
        durations.push(Math.max(0.5, Number(scenes[i]?.duration || 0)));
      }
    }

    // 2) 누적 타임라인 계산
    const timeline = [];
    let cursor = 0;
    for (let i = 0; i < scenes.length; i++) {
      const start = cursor;
      const end = start + durations[i];
      cursor = end;
      timeline.push({ start, end });
    }

    // 3) SRT 생성
    const rows = [];
    for (let i = 0; i < scenes.length; i++) {
      const text = String(scenes[i]?.text || "").trim();
      if (!text) continue;
      const { start, end } = timeline[i];
      rows.push(
        [
          String(i + 1),
          `${fmtSrtTime(start)} --> ${fmtSrtTime(end)}`,
          text,
          "", // 블랭크 라인
        ].join("\n")
      );
    }
    const srt = rows.join("\n");
    console.log("✅ toSrt.js - SRT 변환 완료, 길이:", srt.length);
    console.log("📄 toSrt.js - SRT 내용 미리보기:", srt.substring(0, 200) + "...");

    // 4) (선택) 프론트에서 미리보기용으로 쓸 수 있게 보정 씬도 반환
    const outScenes = scenes.map((s, i) => ({
      ...s,
      start: timeline[i].start,
      end: timeline[i].end,
    }));

      console.log("📤 toSrt.js - 반환값 정보:", {
        srtLength: srt.length,
        srtHasContent: srt.length > 0,
        scenesCount: outScenes.length,
        srtPreview: srt.substring(0, 100) + "..."
      });
      return { success: true, data: { srt, scenes: outScenes } };
    } catch (error) {
      console.error("❌ toSrt.js - SRT 변환 중 오류:", error);
      return { success: false, error: error.message };
    }
  });
};
