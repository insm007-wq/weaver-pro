// src/utils/media.js
export const basename = (p = "") => String(p).split(/[\\/]/).pop();
export const stripExt = (n = "") => String(n).replace(/\.[^.]+$/, "");
export const extname = (n = "") => (/\.[^.]+$/.exec(n)?.[0] || "").toLowerCase();

export const guessMimeByExt = (name = "") => (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(extname(name)) ? "image/*" : "video/*");
