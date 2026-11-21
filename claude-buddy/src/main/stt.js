'use strict';
// Распознавание речи через любой OpenAI-совместимый эндпоинт /audio/transcriptions
// (OpenAI whisper-1 / gpt-4o-transcribe, Groq whisper-large-v3-turbo, локальный faster-whisper-server и т.д.).

async function transcribe(buffer, mime, cfg) {
  if (!cfg.sttApiKey || !cfg.sttBaseUrl || !cfg.sttModel) {
    const err = new Error('STT не настроен');
    err.code = 'stt_not_configured';
    throw err;
  }
  const ext = /ogg/.test(mime) ? 'ogg' : /mp4|m4a/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime || 'audio/webm' }), `speech.${ext}`);
  form.append('model', cfg.sttModel);
  if (cfg.language) form.append('language', cfg.language);
  form.append('response_format', 'json');

  const url = `${cfg.sttBaseUrl.replace(/\/+$/, '')}/audio/transcriptions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.sttApiKey}` },
    body: form,
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`STT ${res.status}: ${body.slice(0, 200)}`);
    err.code = res.status === 401 ? 'stt_auth' : 'stt_http';
    throw err;
  }
  const json = await res.json();
  return String(json.text || '').trim();
}

module.exports = { transcribe };
