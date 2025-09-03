// src/utils/prompts.js
// 프롬프트 컴파일 유틸

export function compilePromptRaw(tpl) {
  return String(tpl ?? "");
}

/**
 * 템플릿 내 {referenceText},{duration},{topic},{maxScenes} 치환
 */
export function compileRefPrompt(
  tpl,
  { referenceText, duration, topic, maxScenes }
) {
  let s = String(tpl ?? "");
  const dict = {
    referenceText: referenceText ?? "",
    duration: duration ?? "",
    topic: topic ?? "",
    maxScenes: maxScenes ?? "",
  };
  for (const [k, v] of Object.entries(dict))
    s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
