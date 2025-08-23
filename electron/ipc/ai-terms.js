// electron/ipc/ai-terms.js
const { ipcMain } = require("electron");
const https = require("https");

function postJSON(host, path, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(bodyObj);
    const req = https.request(
      { host, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers } },
      (res) => {
        let s = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (s += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(s || "{}") });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function register() {
  ipcMain.handle("ai:translateTerms", async (_evt, payload = {}) => {
    try {
      const { apiKey, terms = [] } = payload || {};
      const clean = (Array.isArray(terms) ? terms : []).map((s) => String(s || "").trim()).filter(Boolean);
      if (!clean.length) return { ok: true, terms: [] };
      if (!apiKey) return { ok: true, terms: clean }; // 키 없으면 원문 반환

      const prompt = `Translate each of the following Korean (or mixed) short terms into concise English search terms for stock video sites. Keep nouns, drop particles. 1~3 words each. Return ONLY a JSON array of strings.\n\nTerms:\n${clean
        .map((t) => `- ${t}`)
        .join("\n")}`;
      const { status, json } = await postJSON(
        "api.openai.com",
        "/v1/chat/completions",
        { Authorization: `Bearer ${apiKey}` },
        {
          model: "gpt-5-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You translate short terms to concise English search keywords." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 200,
        }
      );

      if (status !== 200) return { ok: true, terms: clean };
      let arr = [];
      try {
        const content = json.choices?.[0]?.message?.content || "{}";
        const obj = JSON.parse(content);
        if (Array.isArray(obj)) arr = obj;
        else if (Array.isArray(obj.terms)) arr = obj.terms;
      } catch {
        arr = [];
      }
      const out = clean.map((orig, i) => (arr[i] && String(arr[i]).trim()) || orig);
      return { ok: true, terms: out };
    } catch (err) {
      return { ok: true, terms: Array.isArray(payload?.terms) ? payload.terms : [] };
    }
  });
}

module.exports = { register };
