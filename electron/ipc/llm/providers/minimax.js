const axios = require("axios");
const { getSecret } = require("../../../services/secrets");
const {
  dumpRaw,
  stripFence,
  tryParse,
  pickText,
  coerceToScenesShape,
  validateScriptDocLoose,
  formatScenes,
  estimateMaxTokens,
  RATE_GUIDE,
  buildRepairInput,
  buildRepairInstruction,
} = require("../common");

/* ===== 기본 엔드포인트 ===== */
const URLS_BASE = [
  "https://api.minimax.chat/v1/text/chatcompletion",
  "https://api.minimax.chat/v1/text/chatcompletion_pro",
  "https://api.minimax.chat/v1/chat/completions",
];

const MODEL = "abab5.5-chat";

/* URL 변형: 일부 테넌트는 ?GroupId= 쿼리로만 인식 */
function buildUrlPermutations(groupId) {
  const gid = (groupId || "").trim();
  if (!gid) return [...URLS_BASE];
  const withQuery = URLS_BASE.map(
    (u) => `${u}?GroupId=${encodeURIComponent(gid)}`
  );
  return [...URLS_BASE, ...withQuery];
}

/* 응답 텍스트/JSON 최대 추출 */
function extractAny(resp) {
  if (!resp) return { text: "", json: null, err: null };
  if (
    resp.base_resp &&
    resp.base_resp.status_code &&
    resp.base_resp.status_code !== 0
  ) {
    return { text: "", json: null, err: resp.base_resp };
  }
  if (typeof resp === "object" && resp.scenes && Array.isArray(resp.scenes)) {
    return { text: "", json: resp, err: null };
  }
  const maybe = resp?.output_json || resp?.json || resp?.data_json;
  if (maybe && typeof maybe === "object")
    return { text: "", json: maybe, err: null };

  const c0 = resp?.choices?.[0];
  const m = c0?.message;
  if (m?.content) {
    const mc = m.content;
    if (typeof mc === "string" && mc.trim())
      return { text: mc, json: null, err: null };
    if (Array.isArray(mc) && mc.length) {
      const joined = mc
        .map((x) =>
          typeof x === "string" ? x : x?.text || x?.content || x?.value || ""
        )
        .join("");
      if (joined.trim()) return { text: joined, json: null, err: null };
    }
    if (typeof mc === "object") {
      const cand = mc?.text || mc?.content || mc?.value || "";
      if (typeof cand === "string" && cand.trim())
        return { text: cand, json: null, err: null };
    }
  }

  const lists = [
    c0?.messages,
    c0?.message_list,
    c0?.outputs,
    resp?.messages,
    resp?.outputs,
  ].filter(Array.isArray);
  for (const list of lists) {
    const last = list[list.length - 1] || {};
    const t =
      last?.content || last?.text || last?.value || last?.output_text || "";
    if (typeof t === "string" && t.trim())
      return { text: t, json: null, err: null };
    if (Array.isArray(last?.content)) {
      const joined = last.content
        .map((x) => x?.text || x?.content || "")
        .join("");
      if (joined.trim()) return { text: joined, json: null, err: null };
    }
  }

  const fallbacks = [
    c0?.text,
    resp?.output_text,
    resp?.text,
    resp?.data,
    resp?.reply,
  ];
  for (const t of fallbacks)
    if (typeof t === "string" && t.trim())
      return { text: t, json: null, err: null };
  return { text: "", json: null, err: null };
}

/* 가장 큰 JSON 블록 추출 (중첩 안전) */
function extractLargestJson(raw = "") {
  const plain = stripFence(raw);
  let parsed = tryParse(plain);
  if (parsed) return parsed;

  const s = plain;
  const stack = [];
  let best = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") stack.push(i);
    else if (ch === "}" && stack.length) {
      const start = stack.pop();
      const cand = s.slice(start, i + 1);
      const obj = tryParse(cand);
      if (obj && (!best || cand.length > best.len))
        best = { len: cand.length, obj };
    }
  }
  if (best) return best.obj;

  const a = s.indexOf("["),
    b = s.lastIndexOf("]");
  if (a !== -1 && b > a) return tryParse(s.slice(a, b + 1));
  return null;
}

/* 사용자 프롬프트 */
function buildUserPrompt({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt,
}) {
  const useCompiled =
    typeof compiledPrompt === "string" && compiledPrompt.trim().length > 0;
  if (useCompiled) return compiledPrompt;
  return [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    `목표 길이(분): ${duration}`,
    `최대 장면 수(상한): ${maxScenes}`,
    type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
    "\n요구사항:",
    RATE_GUIDE,
    '최상위는 {"title": "...", "scenes":[{ "text": "...", "duration": number }]} 형태의 JSON만.',
    "마크다운/코드펜스/설명 문구 금지. JSON 외 텍스트 금지.",
  ].join("\n");
}
function buildFormatOnlyPrompt() {
  return [
    "아래 텍스트에서 JSON만 추출하여 반환하세요.",
    '최상위는 {"title": "...", "scenes":[...]} 형태여야 합니다.',
    "마크다운/코드펜스 금지. JSON 외에는 아무것도 출력하지 마세요.",
  ].join("\n");
}

/* 인증 헤더 조합 */
function h_auth_bearer_pair(groupId, apiKey) {
  return {
    Authorization: `Bearer ${groupId}:${apiKey}`,
    "Content-Type": "application/json",
  };
}
function h_auth_bearer_key(apiKey, groupId) {
  const h = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (groupId) h["X-Group-Id"] = groupId;
  return h;
}
function h_auth_plain(apiKey, groupId) {
  const h = { Authorization: apiKey, "Content-Type": "application/json" };
  if (groupId) h["X-Group-Id"] = groupId;
  return h;
}
/* (추가) 어떤 계정은 MM-GroupId 헤더를 요구 */
function h_auth_mmgroup(apiKey, groupId) {
  const h = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (groupId) h["MM-GroupId"] = groupId;
  return h;
}

/* Body 변형: group_id/GroupId 필드 유무 + lite/full */
function buildBodyPermutations(baseBody, groupId) {
  const gid = (groupId || "").trim();
  const full = { ...baseBody };
  const lite = { ...baseBody };
  delete lite.tokens_to_generate;

  const bodies = [full, lite];

  if (gid) {
    bodies.push({ ...full, group_id: gid });
    bodies.push({ ...full, GroupId: gid });
    bodies.push({ ...lite, group_id: gid });
    bodies.push({ ...lite, GroupId: gid });
  }
  return bodies;
}

/* 여러 URL/헤더/바디 조합으로 POST 시도 */
async function postWithPermutations(urls, bodies, headerList) {
  let lastErr = null;
  let lastNote = "";
  for (const headers of headerList) {
    for (const u of urls) {
      for (const b of bodies) {
        try {
          const r = await axios.post(u, b, {
            headers,
            timeout: 45000,
            validateStatus: () => true,
          });
          if (
            r.data?.base_resp &&
            r.data.base_resp.status_code &&
            r.data.base_resp.status_code !== 0
          ) {
            return { ok: false, data: r.data };
          }
          if (r.status >= 200 && r.status < 300)
            return { ok: true, data: r.data };
          lastErr = new Error(`${r.status} ${r.statusText}`);
          lastNote = `${u} :: HTTP`;
        } catch (e) {
          lastErr = e;
          lastNote = `${u} :: THROW`;
        }
      }
    }
  }
  if (lastErr) {
    dumpRaw("minimax-last-error", `${lastNote} :: ${lastErr?.message || ""}`);
    throw lastErr;
  }
  throw new Error("No Minimax endpoint reachable");
}

async function callMinimaxAbab({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt,
  customPrompt,
}) {
  const apiKey = ((await getSecret("minimaxKey")) || "").trim();
  const groupId = ((await getSecret("minimaxGroupId")) || "").trim();
  if (!apiKey) throw new Error("Minimax API Key가 설정되지 않았습니다.");

  dumpRaw("minimax-secrets-snapshot", {
    key_len: apiKey.length,
    gid_len: groupId.length,
    gid_head: groupId.slice(0, 4),
  });

  const budget = estimateMaxTokens({
    maxScenes: Number(maxScenes) || 10,
    duration: Number(duration) || 5,
  });

  const userPrompt = buildUserPrompt({
    type,
    topic,
    style,
    duration,
    maxScenes,
    referenceText,
    compiledPrompt,
  });

  const baseBody = {
    model: MODEL,
    max_tokens: budget,
    tokens_to_generate: budget,
    temperature: 0.2,
    response_format: { type: "json_object" }, // 무시돼도 무해
    messages: [
      {
        role: "system",
        content:
          "You are a professional Korean scriptwriter. Return ONLY JSON.",
      },
      { role: "user", content: userPrompt },
    ],
  };

  const urlPerms = buildUrlPermutations(groupId);
  const bodyPerms = buildBodyPermutations(baseBody, groupId);
  const headerPerms = [
    h_auth_bearer_pair(groupId, apiKey),
    h_auth_bearer_key(apiKey, groupId),
    h_auth_plain(apiKey, groupId),
    h_auth_mmgroup(apiKey, groupId),
  ];

  // 1차 요청
  const first = await postWithPermutations(urlPerms, bodyPerms, headerPerms);
  if (!first.ok) {
    dumpRaw("minimax-error-base_resp", first.data);
    const code = first.data?.base_resp?.status_code;
    const msg = first.data?.base_resp?.status_msg || "unknown error";
    throw new Error(`Minimax 에러(${code}): ${msg}`);
  }
  dumpRaw("minimax-response-first", first.data);

  // 본문 추출
  let { text: raw, json } = extractAny(first.data);
  if (!raw && !json) {
    const serialized = JSON.stringify(first.data || {});
    json = extractLargestJson(serialized);
    if (!json) dumpRaw("minimax-serialized", serialized);
  }

  // 2차: JSON만 추출 요청
  if (!json) {
    dumpRaw("minimax-raw-first", raw || "(empty)");
    const fmtBase = {
      model: MODEL,
      max_tokens: Math.max(1000, Math.floor(budget * 0.5)),
      tokens_to_generate: Math.max(1000, Math.floor(budget * 0.5)),
      temperature: 0.0,
      messages: [
        { role: "system", content: "Return ONLY JSON. No Markdown." },
        { role: "user", content: buildFormatOnlyPrompt() },
        { role: "user", content: raw || JSON.stringify(first.data || {}) },
      ],
    };
    const fmtBodies = buildBodyPermutations(fmtBase, groupId);
    const second = await postWithPermutations(urlPerms, fmtBodies, headerPerms);
    if (!second.ok) {
      dumpRaw("minimax-format-fail", second.data);
      const code = second.data?.base_resp?.status_code;
      const msg = second.data?.base_resp?.status_msg || "unknown error";
      throw new Error(`Minimax 에러(${code}): ${msg}`);
    }
    dumpRaw("minimax-response-second", second.data);
    const ext2 = extractAny(second.data);
    json =
      ext2.json ||
      extractLargestJson(ext2.text) ||
      extractLargestJson(JSON.stringify(second.data || {}));
    if (!json) {
      dumpRaw("minimax-raw-second", ext2.text || "(empty)");
      throw new Error("Minimax 응답 JSON 파싱 실패");
    }
  }

  // 정규화/검증
  let parsed = coerceToScenesShape(json);
  if (!validateScriptDocLoose(parsed)) {
    dumpRaw("minimax-json-invalid", parsed);
    throw new Error("Minimax 응답 구조가 유효하지 않습니다.");
  }
  parsed.scenes = parsed.scenes.map((s, i) => ({
    ...(typeof s === "object" ? s : {}),
    id: s?.id ? String(s.id) : `s${i + 1}`,
    text: pickText(s),
    duration: Number.isFinite(s?.duration)
      ? Math.round(Number(s.duration))
      : undefined,
  }));

  let out = formatScenes(parsed, topic, duration, maxScenes, {
    fromCustomPrompt:
      !!customPrompt ||
      (typeof compiledPrompt === "string" && compiledPrompt.trim().length > 0),
  });

  // 자동/레퍼런스 길이 보정
  if (!customPrompt && (type === "auto" || type === "reference")) {
    const { needsRepair } = require("../common");
    if (needsRepair(out.scenes)) {
      const repairPrompt = buildRepairInstruction(topic, style);
      const repairInput = buildRepairInput(out);
      const fixBase = {
        model: MODEL,
        max_tokens: Math.max(1200, Math.floor(budget * 0.6)),
        tokens_to_generate: Math.max(1200, Math.floor(budget * 0.6)),
        temperature: 0.2,
        messages: [
          { role: "system", content: "Return ONLY JSON." },
          {
            role: "user",
            content: repairPrompt + "\n\n[INPUT JSON]\n" + repairInput,
          },
        ],
      };
      const fixBodies = buildBodyPermutations(fixBase, groupId);
      const rfix = await postWithPermutations(urlPerms, fixBodies, headerPerms);
      if (rfix.ok) {
        dumpRaw("minimax-response-repair", rfix.data);
        const extFix = extractAny(rfix.data);
        const fixed = coerceToScenesShape(
          extFix.json ||
            extractLargestJson(extFix.text) ||
            extractLargestJson(JSON.stringify(rfix.data || {})) ||
            {}
        );
        if (validateScriptDocLoose(fixed)) {
          fixed.scenes = fixed.scenes.map((s, i) => ({
            ...(typeof s === "object" ? s : {}),
            id: out.scenes[i]?.id || `s${i + 1}`,
            text: pickText(s),
            duration: Number.isFinite(s?.duration)
              ? Math.round(Number(s.duration))
              : out.scenes[i].duration,
          }));
          out = formatScenes(fixed, topic, duration, maxScenes, {
            fromCustomPrompt: false,
          });
        }
      } else {
        dumpRaw("minimax-repair-fail", rfix.data);
      }
    }
  }

  return out;
}

module.exports = { callMinimaxAbab };
