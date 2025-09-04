// src/utils/prompts.js
// 프롬프트 컴파일 유틸

/**
 * 대본 생성 프롬프트 템플릿 치환
 * @param {string} tpl - 템플릿 문자열
 * @param {Object} params - 치환할 매개변수들
 */
export function compilePromptRaw(tpl, params = {}) {
  let compiled = String(tpl ?? "");
  
  // 기본 매개변수들
  const {
    topic = "",
    style = "",
    duration = 5,
    maxScenes = 10,
    totalSeconds = duration * 60,
    minCharacters = duration * 300,
    maxCharacters = duration * 400,
    avgCharactersPerScene = Math.floor((minCharacters + maxCharacters) / 2 / maxScenes)
  } = params;

  // 치환 딕셔너리
  const replacements = {
    topic: String(topic),
    style: String(style),
    duration: String(duration),
    maxScenes: String(maxScenes),
    totalSeconds: String(totalSeconds),
    minCharacters: String(minCharacters),
    maxCharacters: String(maxCharacters),
    avgCharactersPerScene: String(avgCharactersPerScene),
  };

  // 모든 플레이스홀더 치환
  for (const [key, value] of Object.entries(replacements)) {
    const placeholder = `{${key}}`;
    compiled = compiled.replaceAll(placeholder, value);
  }

  return compiled;
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
