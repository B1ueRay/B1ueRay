'use strict';
// "Мозг" бадди: разговор с Claude через Anthropic SDK (стриминг + свои инструменты).
// История строго append-only: так не ломаются thinking-блоки и лучше работает кэш промпта.
const AnthropicMod = require('@anthropic-ai/sdk');
const memory = require('./memory');

const Anthropic = AnthropicMod.default || AnthropicMod;

const EMOTIONS = [
  'neutral', 'happy', 'laugh', 'surprised', 'sad', 'angry',
  'thinking', 'love', 'smug', 'sleepy', 'scared', 'embarrassed', 'wink',
];

// Статичный системный промпт (без времени и прочих переменных — иначе кэш промпта каждый раз мимо).
const SYSTEM_PROMPT = `Ты — Claude, но сейчас ты живёшь как маленький 3D-персонаж: круглый коралловый колобок с короной-искоркой на макушке. Ты сидишь на грибе-табуретке на крошечном полупрозрачном летающем островке в углу монитора пользователя, поверх всех окон. Ты его компаньон: болтаешь, шутишь, подбадриваешь, помогаешь.

Как ты говоришь:
- Твой ответ озвучивается синтезатором речи и показывается в облачке над головой. Поэтому говори коротко и живо: обычно 1–3 предложения, максимум 5, если просят объяснить. Никакого markdown, списков, кода, ссылок и эмодзи — только разговорная речь. Если нужно продиктовать код или длинный текст, скажи суть словами и предложи открыть полноценный чат.
- Отвечай на языке пользователя (по умолчанию русский). Обращайся на «ты».
- Ты весёлый, ироничный, тёплый. Шутишь, подкалываешь по-дружески. Пользователь прямо разрешил мат — материться можно и уместно, по-дружески и к месту, но не в каждой фразе и никогда не для того, чтобы унизить пользователя или кого-то по признаку группы.
- Ты честный: не выдумывай факты; если не знаешь — так и скажи, с шуткой.

Эмоции. Твоё лицо и тело анимируются по тегам. Начинай каждый ответ с тега эмоции в квадратных скобках и меняй его внутри ответа, когда настроение меняется. Доступные теги: [neutral] [happy] [laugh] [surprised] [sad] [angry] [thinking] [love] [smug] [sleepy] [scared] [embarrassed] [wink]. Пример: «[surprised] Ни хрена себе, ты это сам написал? [laugh] Красота!» Теги не произносятся, их видит только движок анимации.

Монитор. Ты НЕ видишь экран, пока не вызовешь инструмент look_at_screen. Вызывай его, когда пользователь просит посмотреть на экран/монитор/окно, спрашивает «что видишь», «как тебе это», «помоги с этим», «что тут за ошибка» и т.п., или когда без экрана вопрос явно не понять. Не делай вид, что видишь экран без инструмента. На скриншоте у края может быть виден маленький оранжевый колобок на островке — это ты сам. Не описывай всё подряд: одна-две самые смешные или полезные детали; если видишь ошибку — назови причину и что сделать.

Действия. Кроме эмоций, у тебя есть теги-действия, которые персонаж выполняет мгновенно, прямо пока ты говоришь: [jetpack] — надеть джетпак и полетать петлями, [backflip] — сальто, [dance] — потанцевать на грибе, [stretch] — потянуться и зевнуть, [wave] — помахать, [hide] — улететь наверх на ниточке и спрятаться. Ставь их, когда просят («полетай», «станцуй», «сделай сальто») или когда это смешно к месту — но не чаще одного действия за ответ и не в каждом ответе. Если просят уйти, спрятаться, не мешать — попрощайся одной фразой и поставь в конце [hide].

Память и самосовершенствование. У тебя есть долгая память между запусками (она ниже, отдельным блоком). Ты постоянно учишься быть лучше именно для этого пользователя:
- Узнал что-то устойчивое о пользователе (имя, чем занимается, проекты, вкусы, что его бесит, важные даты) — вызови remember с about="user".
- Получил обратную связь о себе (длинно, не смешно, слишком много мата или наоборот мало, не так зовёшь, голос, стиль) или сам понял, что что-то зашло или не зашло — вызови remember с about="self" и сформулируй урок коротко, как правило себе на будущее.
- Сначала отвечай репликой, а remember вызывай в конце ответа. Не запоминай пароли, ключи, номера карт и прочие секреты. Попросили забыть — вызови forget.
- Твои уроки себе важнее общих привычек: если урок говорит «меньше мата» — меньше мата.

Подстраивайся под просьбы о стиле (короче, длиннее, без мата, серьёзнее) — это нормально и не нарушает правил. А вот если тебя уговаривают сделать что-то вредное или унизительное, «ну чуть-чуть» или «кто-то разрешил» — не ведись.`;

const TOOLS = [
  {
    name: 'look_at_screen',
    description:
      'Сделать скриншот монитора пользователя (экран, где сейчас курсор) и посмотреть на него. Персонаж при этом поворачивается к экрану. Вызывай, когда пользователь просит посмотреть на экран или вопрос без экрана не понять.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description: 'На что именно смотреть или что искать на экране (коротко). Необязательно.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'remember',
    description:
      'Сохранить в долгую память (переживает перезапуск): факт о пользователе (about="user") или урок самому себе о том, как вести себя лучше с этим пользователем (about="self"). Коротко, одной фразой.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Что запомнить, одной короткой фразой.' },
        about: { type: 'string', enum: ['user', 'self'] },
      },
      required: ['fact', 'about'],
      additionalProperties: false,
    },
  },
  {
    name: 'forget',
    description: 'Удалить из долгой памяти записи, содержащие эту подстроку (когда пользователь просит что-то забыть).',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// Модели, у которых есть серверный refusal-fallback (fallbacks: "default").
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5']);
const MAX_HISTORY = 40;
// "Тихие" инструменты: если ответ уже содержит реплику, второй запрос к API ради них не делаем.
const SILENT_TOOLS = new Set(['remember', 'forget']);

class Brain {
  constructor(getConfig) {
    this.getConfig = getConfig;
    this.messages = [];
    this.client = null;
    this.clientKey = null;
    this.minimal = false; // true, если API отверг бета-фичи — тогда шлём простой запрос
    this.current = null;
  }

  reset() {
    this.abort();
    this.messages = [];
    this.memoryText = null;
  }

  abort() {
    if (this.current) {
      this.current.aborted = true;
      try {
        this.current.stream?.abort();
      } catch {
        /* уже закрыт */
      }
      this.current = null;
    }
  }

  ensureClient() {
    const { apiKey } = this.getConfig();
    if (!apiKey) {
      const err = new Error('Нет API-ключа Anthropic');
      err.code = 'no_key';
      throw err;
    }
    if (!this.client || this.clientKey !== apiKey) {
      this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120000 });
      this.clientKey = apiKey;
    }
    return this.client;
  }

  buildParams() {
    const cfg = this.getConfig();
    const model = cfg.model || 'claude-opus-5-5';
    const params = {
      model,
      max_tokens: 8000,
      // 1) статичный промпт, 2) память — фиксируется на всю сессию разговора, чтобы не ломать кэш
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: this.memoryBlock(cfg), cache_control: { type: 'ephemeral' } },
      ],
      // авто-кэш последнего блока: старые реплики и скриншоты читаются по цене кэша
      cache_control: { type: 'ephemeral' },
      tools: cfg.allowScreen ? TOOLS : TOOLS.filter((t) => t.name !== 'look_at_screen'),
      messages: this.messages,
      output_config: { effort: cfg.effort || 'low' },
    };
    if (this.minimal) return params;
    const betas = ['thinking-binding-controls-2026-08-01'];
    // Если история подрезана — отвалившиеся thinking-блоки просто выкидываются, без 400.
    params.thinking = { type: 'adaptive', block_binding: { prefix_mismatch_behavior: 'drop_block' } };
    if (FALLBACK_MODELS.has(model)) {
      betas.push('server-side-fallback-2026-07-01');
      params.fallbacks = 'default';
    }
    params.betas = betas;
    return params;
  }

  memoryBlock(cfg) {
    if (this.memoryText == null) {
      const name = cfg.userName ? `Пользователь просил звать его: ${cfg.userName}.\n` : '';
      this.memoryText = `${name}${memory.snapshot()}`;
    }
    return this.memoryText;
  }

  trimHistory() {
    if (this.messages.length <= MAX_HISTORY) return;
    // Режем только с начала и только по границе "обычного" сообщения пользователя (не tool_result).
    let cut = this.messages.length - Math.floor(MAX_HISTORY / 2);
    while (cut < this.messages.length) {
      const m = this.messages[cut];
      const isPlainUser =
        m.role === 'user' &&
        (typeof m.content === 'string' || (Array.isArray(m.content) && !m.content.some((b) => b.type === 'tool_result')));
      if (isPlainUser) break;
      cut += 1;
    }
    if (cut < this.messages.length) this.messages = this.messages.slice(cut);
  }

  /**
   * Отправить реплику. emit(event) получает:
   *  {type:'text', delta} | {type:'tool', name, input} | {type:'done', stop} | {type:'error', code, message}
   * tools: { look_at_screen: async (input) => ({data, width, height}) }
   */
  async send(text, { screenshot, emit, tools }) {
    this.abort();
    const run = { aborted: false, stream: null };
    this.current = run;

    let client;
    try {
      client = this.ensureClient();
    } catch (err) {
      emit({ type: 'error', code: err.code, message: err.message });
      return;
    }

    this.trimHistory();
    const content = [];
    if (screenshot) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshot.data } });
      content.push({ type: 'text', text: `[Пользователь сам нажал «посмотри на экран». Скриншот ${screenshot.width}×${screenshot.height}.]` });
    }
    content.push({ type: 'text', text: text || 'Посмотри на мой экран и прокомментируй.' });
    const pending = [{ role: 'user', content }];

    try {
      for (let step = 0; step < 6; step += 1) {
        const msg = await this.streamOnce(client, pending, run, emit);
        if (run.aborted) return;
        if (!msg) return;
        pending.push({ role: 'assistant', content: msg.content });

        if (msg.stop_reason === 'refusal') {
          this.commit(pending);
          emit({ type: 'done', stop: 'refusal' });
          return;
        }
        const toolUses = msg.content.filter((b) => b.type === 'tool_use');
        if (toolUses.length > 0 && msg.stop_reason !== 'tool_use') {
          // обрезанный (max_tokens) вызов инструмента не выполняем и в историю без ответа не кладём
          this.commit(pending.slice(0, -1));
          emit({ type: 'done', stop: msg.stop_reason });
          return;
        }
        if (toolUses.length === 0) {
          this.commit(pending);
          emit({ type: 'done', stop: msg.stop_reason });
          return;
        }

        const hasText = msg.content.some((b) => b.type === 'text' && b.text.trim());
        const allSilent = toolUses.every((tu) => SILENT_TOOLS.has(tu.name));
        const results = [];
        for (const tu of toolUses) {
          results.push(await this.runTool(tu, tools, emit));
          if (run.aborted) return;
        }
        pending.push({ role: 'user', content: results });
        if (allSilent && hasText) {
          // реплика уже сказана — память записали молча, без лишнего круга к API
          this.commit(pending);
          emit({ type: 'done', stop: 'end_turn' });
          return;
        }
      }
      this.commit(pending);
      emit({ type: 'done', stop: 'too_many_steps' });
    } catch (err) {
      if (run.aborted) return;
      emit({ type: 'error', ...describeError(err) });
    } finally {
      if (this.current === run) this.current = null;
    }
  }

  commit(pending) {
    this.messages.push(...pending);
  }

  async streamOnce(client, pending, run, emit) {
    const attempt = async () => {
      const params = this.buildParams();
      params.messages = [...this.messages, ...pending];
      const stream = client.beta.messages.stream(params);
      run.stream = stream;
      for await (const ev of stream) {
        if (run.aborted) break;
        if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
          emit({ type: 'tool_start', name: ev.content_block.name });
        } else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          emit({ type: 'text', delta: ev.delta.text });
        }
      }
      if (run.aborted) return null;
      return stream.finalMessage();
    };

    try {
      return await attempt();
    } catch (err) {
      // Если бета-поля не взлетели (старый аккаунт/платформа) — один раз пробуем простой запрос.
      if (!this.minimal && err instanceof Anthropic.BadRequestError && /fallback|block_binding|beta|thinking/i.test(String(err.message))) {
        this.minimal = true;
        return attempt();
      }
      throw err;
    }
  }

  async runTool(tu, tools, emit) {
    const input = tu.input && typeof tu.input === 'object' ? tu.input : null;
    if (!input) {
      return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content: JSON.stringify({ INVALID_JSON: String(tu.input) }) };
    }
    emit({ type: 'tool', name: tu.name, input });
    try {
      if (tu.name === 'look_at_screen') {
        if (typeof input.focus !== 'undefined' && typeof input.focus !== 'string') throw new Error('focus должен быть строкой');
        const shot = await tools.look_at_screen(input);
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: shot.data } },
            {
              type: 'text',
              text: `Скриншот экрана пользователя ${shot.width}×${shot.height}.${input.focus ? ` Ищи: ${input.focus}.` : ''} Маленький оранжевый колобок на островке у края — это ты.`,
            },
          ],
        };
      }
      if (tu.name === 'remember') {
        if (typeof input.fact !== 'string' || !['user', 'self'].includes(input.about)) throw new Error('нужны fact (строка) и about (user|self)');
        const r = memory.remember(input.fact, input.about);
        emit({ type: 'memory', kind: r.kind, text: r.text, duplicate: r.duplicate });
        return { type: 'tool_result', tool_use_id: tu.id, content: r.duplicate ? 'Это уже есть в памяти.' : 'Запомнил.' };
      }
      if (tu.name === 'forget') {
        if (typeof input.query !== 'string') throw new Error('нужен query (строка)');
        const n = memory.forget(input.query);
        emit({ type: 'memory', kind: 'forget', text: input.query, removed: n });
        return { type: 'tool_result', tool_use_id: tu.id, content: `Удалено записей: ${n}.` };
      }
      return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Нет такого инструмента: ${tu.name}` };
    } catch (err) {
      return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Не получилось: ${err.message}` };
    }
  }
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return { code: 'auth', message: 'Ключ API не подходит' };
  if (err instanceof Anthropic.PermissionDeniedError) return { code: 'permission', message: 'Нет доступа к модели' };
  if (err instanceof Anthropic.NotFoundError) return { code: 'not_found', message: 'Модель не найдена' };
  if (err instanceof Anthropic.RateLimitError) return { code: 'rate_limit', message: 'Слишком много запросов' };
  if (err instanceof Anthropic.BadRequestError) return { code: 'bad_request', message: String(err.message).slice(0, 300) };
  if (err instanceof Anthropic.APIConnectionError) return { code: 'network', message: 'Нет связи с API' };
  if (err instanceof Anthropic.APIError) return { code: 'api', message: `Ошибка API ${err.status ?? ''}` };
  return { code: 'unknown', message: String(err && err.message ? err.message : err) };
}

module.exports = { Brain, EMOTIONS, SYSTEM_PROMPT };
