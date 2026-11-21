# Мульти-ИИ: PAL MCP + Claude Code Router

Две штуки, чтобы гонять несколько моделей и не жечь токены Claude на всякую мелочь.
Токены всё равно тратятся, только у OpenRouter / Gemini / DeepSeek / Ollama, а не у Anthropic.
Локальная Ollama бесплатна.

## 1. PAL MCP (бывший Zen MCP): Claude зовёт другие модели на совет

Репо: https://github.com/BeehiveInnovations/pal-mcp-server (зафиксирован коммит `fa78edc` = тег `v9.8.2`; коммит, а не тег, потому что тег могут перевесить).

Уже подключён в этом репозитории через `.mcp.json` (сервер `pal`, запускается через `uvx`).

- **Локально:** при первом запуске `claude` в папке репо Claude Code спросит, доверять ли серверу `pal`. Ответь «да».
- **В облаке:** setup-скрипт окружения прописывает `pal` в `~/.claude/settings.json` (`enabledMcpjsonServers`)
  и заранее прогревает кэш `uvx`, так что сервер стартует сразу.

Зачем `--with "mcp<2"`: PAL не фиксирует версию библиотеки `mcp`, а в `mcp` 2.x убрали старый API
(`Server.list_tools`), и сервер падает на старте. Убрать флаг можно, когда апстрим это починит.

Инструменты: `chat`, `thinkdeep`, `planner`, `consensus`, `codereview`, `precommit`, `debug`,
`challenge`, `apilookup`, `clink`, `listmodels`, `version`.

`clink` работает, только если установлен внешний CLI (`gemini`, `codex` и т.п.).

### Ключи

PAL включает того провайдера, для которого задана переменная окружения:

| Переменная | Провайдер |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter: один ключ на кучу моделей (GPT, Gemini, DeepSeek, Grok, Llama…) |
| `GEMINI_API_KEY` | Google Gemini |
| `OPENAI_API_KEY` | OpenAI |
| `XAI_API_KEY` | Grok |

- **Локально:** `export OPENROUTER_API_KEY=sk-or-...` в шелле до запуска `claude`. Нужен установленный
  [uv](https://docs.astral.sh/uv/getting-started/installation/).
- **В облачных сессиях Claude Code:** ключ хранится как сетевой секрет окружения для `openrouter.ai`,
  прокси подставляет его сам. В переменной окружения лежит только заглушка `proxy-injected`.

### Примеры промптов

```
Use pal consensus with gemini pro and gpt-5 to decide: SQLite or Postgres for this app
Use pal codereview with deepseek on src/
Use pal chat with flash: придумай 10 названий для приложения
```

## 2. Claude Code Router (CCR): подменяет модель под самим Claude Code

Репо: https://github.com/musistudio/claude-code-router

Пускает запросы Claude Code через локальный шлюз `127.0.0.1:3456` к нужному провайдеру:
мелочь в DeepSeek или локальную Ollama, серьёзное в Claude. Работает **на твоём компьютере**.
Облачную сессию Claude Code так не перенаправить: модель там выбирает сам сервис.

### Установка на ПК

Вариант A, десктоп-приложение (проще): скачать со страницы
[Releases](https://github.com/musistudio/claude-code-router/releases) (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).

Вариант B, CLI (нужен Node.js 22+):

```sh
npm install -g @musistudio/claude-code-router@latest
ccr ui          # веб-морда на http://127.0.0.1:3458
```

Дальше:

1. **Providers → Add Provider:** выбрать OpenRouter / DeepSeek / Ollama, вставить ключ, выбрать модели.
2. **Server → Start:** шлюз поднимается на `http://127.0.0.1:3456`.
3. **Agent Config → Claude Code:** выбрать модель, применить профиль.
4. **Routing:** правила вроде «фоновые задачи → дешёвая модель, думать → Claude», фолбэки.
5. **Logs:** что куда ушло, сколько токенов, сколько денег.

Без хотя бы одного провайдера с моделью CCR не стартует («No available models») — это нормально.
