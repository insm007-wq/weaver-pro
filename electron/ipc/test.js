// (파일 하단쯤에 추가)
// Anthropic 연결 테스트
ipcMain.handle("testAnthropic", async (_evt, key) => {
  const apiKey = key;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply with: pong" }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, message: txt, status: res.status };
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text || "";
  return { ok: /pong/i.test(text), message: text };
});

// Google TTS 연결 테스트
ipcMain.handle("testGoogleTTS", async (_evt, key) => {
  const res = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize?key=" + key,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { text: "테스트" },
        voice: { languageCode: "ko-KR", name: "ko-KR-Wavenet-A" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, message: txt, status: res.status };
  }
  const data = await res.json();
  return { ok: !!data?.audioContent };
});
