> `aix` is a Manifest V3 Chrome extension that injects a fixed export button into Claude and ChatGPT conversation pages, extracts visible turns from live DOM trees, converts them to Markdown, and downloads a local `.md` file without a background worker, storage layer, or remote service.

## 1. Documentation

- Primary references: [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/mv3), [Bun docs](https://bun.sh/docs), [Biome docs](https://biomejs.dev), [tsgo](https://github.com/nicolo-ribaudo/tsgo)
- Local source-of-truth files: [`manifest.json`](manifest.json), [`package.json`](package.json), [`src/index.ts`](src/index.ts), [`src/platforms/claude.ts`](src/platforms/claude.ts), [`src/platforms/chatgpt.ts`](src/platforms/chatgpt.ts), [`src/parsers/markdown.ts`](src/parsers/markdown.ts)
- Regression surface: [`tests/integration/`](tests/integration/), [`tests/parsers/`](tests/parsers/), [`tests/fixtures/`](tests/fixtures/)
- Mirror contract: `AGENTS.md` is canonical; [`CLAUDE.md`](CLAUDE.md) and [`README.md`](README.md) symlink to it

## 2. Repository Structure

```text
.
├── src/
│   ├── index.ts              content-script entrypoint and export flow
│   ├── platforms/            Claude / ChatGPT detection, selectors, extraction
│   ├── parsers/              DOM -> Markdown conversion and sanitization
│   ├── ui/                   injected button, toast, and styles
│   └── utils/                download, filename, markdown, SPA navigation
├── tests/
│   ├── integration/          fixture-backed export flow coverage
│   ├── fixtures/             captured Claude and ChatGPT DOM snapshots
│   └── helpers/              happy-dom factories and fixture loaders
├── assets/                   extension icons copied into dist/
├── dist/                     generated unpacked-extension payload
└── AGENTS.md                 canonical repo instructions
```

- Start in [`src/platforms/`](src/platforms/) for site-compatibility work and in [`src/parsers/`](src/parsers/) for markdown fidelity changes
- Treat [`tests/fixtures/`](tests/fixtures/) as the DOM contract and [`dist/`](dist/) as generated output

## 3. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Extension | Chrome Extension MV3 | one content script, no popup, no service worker |
| Runtime | TypeScript + browser DOM | Bun bundles [`src/index.ts`](src/index.ts) for `--target browser` |
| Targets | Claude + ChatGPT | supports `claude.ai`, `chatgpt.com`, and legacy `chat.openai.com` |
| Testing | Bun Test + happy-dom | [`bunfig.toml`](bunfig.toml) preloads [`tests/setup.ts`](tests/setup.ts) |
| Tooling | Biome + tsgo + Husky | lint, typecheck, commitlint, and lint-staged are local only |
| Release build | Bun + terser | minifies [`dist/contentScript.js`](dist/contentScript.js) and strips `console` / `debugger` |

## 4. Commands

- `bun install` - install dependencies and Husky hooks
- `bun run dev` - watch-build only [`dist/contentScript.js`](dist/contentScript.js); it does not recopy [`manifest.json`](manifest.json) or [`assets/`](assets/)
- `bun run build` - produce the full unpacked extension in [`dist/`](dist/) with JS, manifest, and icons
- `bun run util:lint` - read-only Biome check
- `bun run util:types` - read-only `tsgo --noEmit`
- `bun test --concurrent` - run unit and integration tests against fixture DOM
- `bun run util:check` - write-enabled full gate; runs format, lint, types, and tests

## 5. Architecture

- [`src/index.ts`](src/index.ts): detects the host, injects shared styles, retries button insertion, hooks SPA navigation by patching `history.pushState` / `history.replaceState`, then executes click -> extract -> compose -> download
- [`src/platforms/types.ts`](src/platforms/types.ts): `PlatformConfig` is the only adapter contract; adapters return ordered `Message[]` plus a derived title
- [`src/platforms/claude.ts`](src/platforms/claude.ts): only activates on `/chat/<uuid>` routes, prefers `.standard-markdown*` blocks, extracts artifact cards, reads action-bar timestamps, and backfills missing timestamps across adjacent turns
- [`src/platforms/chatgpt.ts`](src/platforms/chatgpt.ts): accepts full conversation turns or `/c/` and `/g/` routes, deduplicates nested `.markdown` / `.whitespace-pre-wrap` blocks, and turns attached files into Markdown attachment sections
- [`src/platforms/selectors.ts`](src/platforms/selectors.ts): centralizes primary and fallback selectors; keep DOM drift isolated here before widening parser logic
- [`src/parsers/markdown.ts`](src/parsers/markdown.ts): central DOM -> Markdown dispatcher for paragraphs, headings, lists, tables, blockquotes, code fences, inline code, images, task lists, and separator-based message composition
- [`src/parsers/sanitizer.ts`](src/parsers/sanitizer.ts) and [`src/utils/dom.ts`](src/utils/dom.ts): clone-and-prune hidden or non-content nodes before conversion; ChatGPT intentionally uses a custom selector set that keeps checkbox inputs and role-based images
- [`src/ui/`](src/ui/) and [`src/utils/download.ts`](src/utils/download.ts): render a fixed overlay button plus toast, then download via `Blob` and object URL with no background messaging

## 6. Runtime and State

- [`manifest.json`](manifest.json) injects the content script at `document_idle` on `https://claude.ai/*`, `https://chatgpt.com/*`, and `https://chat.openai.com/*`
- The extension is stateless at runtime: no Chrome storage, no service worker, no popup UI, and no network fetches in the shipped code
- Markdown metadata uses `new Date().toISOString()` while filenames use local time in `platform-chat-YYYYMMDD-HHMMSS-<slug>.md`
- Generated artifacts live under [`dist/`](dist/): [`dist/contentScript.js`](dist/contentScript.js), [`dist/manifest.json`](dist/manifest.json), and [`dist/assets/`](dist/assets/); regenerate them, do not edit by hand
- Ignored scratch space exists under `.tmp/`, `tmp/`, `temp/`, and `coverage/`; `.tmp/` currently contains ad hoc HTML captures and screenshots that are not canonical test inputs
- The existing symlink mirror is intentional: [`CLAUDE.md`](CLAUDE.md) and [`README.md`](README.md) should keep pointing at [`AGENTS.md`](AGENTS.md)

## 7. Conventions

- Use `@/` for source imports and `@tests/` for test helpers; avoid relative TypeScript imports across the repo
- Keep selector drift in [`src/platforms/selectors.ts`](src/platforms/selectors.ts) or adapter-local extraction helpers; when a platform DOM changes, add or update fixture coverage first
- Preserve message order and duplicates; Claude timestamp backfill and ChatGPT chunk deduplication are intentional export behaviors
- Avoid depending on console output for debugging outcomes; existing debug logs are tolerated in source but removed from release builds by terser
- Commit messages must satisfy [`commitlint.config.js`](commitlint.config.js): types `feat|fix|refactor|docs|style|chore|test`, scopes `extension|parser|ui|platform|build|deps|docs`

## 8. Constraints

- Never hand-edit [`dist/`](dist/); `bun run dev` only refreshes JS and `bun run build` regenerates the full unpacked extension
- Treat [`tests/fixtures/chatgpt1.html`](tests/fixtures/chatgpt1.html), [`tests/fixtures/chatgpt2.html`](tests/fixtures/chatgpt2.html), [`tests/fixtures/chatgpt3.html`](tests/fixtures/chatgpt3.html), [`tests/fixtures/chatgpt4.html`](tests/fixtures/chatgpt4.html), and [`tests/fixtures/chatgpt5.html`](tests/fixtures/chatgpt5.html) as large real DOM captures with incidental scripts and unrelated markup; search surgically and avoid broad cleanup edits
- Do not relax sanitize rules or hidden-node checks without proving exports stay clean on both platforms; they intentionally strip copy controls, system messages, and presentation-only DOM
- Be careful changing [`src/utils/navigation.ts`](src/utils/navigation.ts); it monkey-patches the history API globally and has no teardown path in production code
- Do not rename files in [`assets/`](assets/) without updating [`manifest.json`](manifest.json) and rebuilding [`dist/`](dist/)
- Automated tests do not exercise live Chrome injection, CSP behavior, or actual browser downloads; selector and UI work still needs a manual browser smoke test

## 9. Validation

- Read-only completion gate: `bun run util:lint`, `bun run util:types`, `bun test --concurrent`
- Build gate when changing shipped code, icons, or manifest: `bun run build`
- Use `bun run util:check` only when you want the repo reformatted as part of the change; it runs [`util:format`](package.json) before lint, types, and tests
- If you change [`src/platforms/`](src/platforms/) or parser behavior, update fixture-backed coverage in [`tests/integration/`](tests/integration/) or [`tests/parsers/`](tests/parsers/) and keep [`tests/fixtures/`](tests/fixtures/) aligned with the new DOM assumptions
- Manual smoke for platform changes: load [`dist/`](dist/) as an unpacked extension, verify the button appears exactly once on one Claude `/chat/<uuid>` page and one ChatGPT `/c/...` or `/g/...` page, then confirm the exported markdown preserves order, code blocks, lists, tables, and attachment or artifact sections
- No CI or GitHub workflow is present in the repository; local validation is the completion bar
