# aix

Chrome extension for exporting ChatGPT and Claude conversations to clean markdown files.

## 1. Documentation

- **Extension**: `developer.chrome.com/docs/extensions/mv3`
- **DevTools**: `bun.sh/docs`, `biomejs.dev`, `github.com/nicolo-ribaudo/tsgo`

## 2. Repository Structure

```
.
├── src/
│   ├── index.ts
│   ├── constants.ts
│   ├── types.ts
│   ├── parsers/
│   │   ├── code-block.ts
│   │   ├── list.ts
│   │   ├── markdown.ts
│   │   └── table.ts
│   ├── platforms/
│   │   ├── chatgpt.ts
│   │   ├── claude.ts
│   │   └── types.ts
│   ├── ui/
│   │   ├── button.ts
│   │   ├── styles.ts
│   │   └── toast.ts
│   └── utils/
│       ├── dom.ts
│       ├── download.ts
│       ├── filename.ts
│       ├── markdown.ts
│       └── navigation.ts
├── tests/
│   ├── setup.ts
│   ├── parsers/
│   ├── ui/
│   └── utils/
├── assets/
├── dist/
├── biome.json
├── bunfig.toml
├── commitlint.config.js
├── lint-staged.config.js
├── manifest.json
├── package.json
└── tsconfig.json
```

## 3. Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Platform | Chrome Extension | Manifest V3, content script injection |
| Language | TypeScript | Strict mode, tsgo for type checking |
| Bundler | Bun | Build to single `dist/contentScript.js` |
| Testing | Bun Test | happy-dom for DOM simulation |
| Linting | Biome | Format + lint, replaces ESLint/Prettier |
| Hooks | Husky | lint-staged + commitlint on pre-commit |

## 4. Commands

- `bun run dev` - Build with watch mode
- `bun run build` - Production build to `dist/`
- `bun run util:check` - Format, lint, types, test (full quality gate)
- `bun run util:format` - Format with Biome
- `bun run util:lint` - Lint with Biome
- `bun run util:lint:fix` - Auto-fix lint issues
- `bun run util:types` - Type check with tsgo
- `bun test` - Run tests

## 5. Architecture

- **Entry**: `src/index.ts` detects platform, injects export button, handles click → parse → download flow
- **Platforms**: `src/platforms/chatgpt.ts` and `src/platforms/claude.ts` implement `PlatformAdapter` interface with `getMessages()`, `getTitle()`, `getConversationUrl()`, `getButtonContainer()`, `getExistingButton()`
- **Parsers**: `src/parsers/` converts DOM elements to markdown; `markdown.ts` composes final output with 100-char `=` separator between messages
- **UI**: `src/ui/button.ts` creates styled export button, `src/ui/toast.ts` shows success/error notifications
- **Utils**: DOM helpers, filename sanitization, blob download trigger, markdown text conversion

## 6. Conventions

- Use `@/` alias for all imports, even within same directory; no relative imports for TypeScript
- TypeScript strict mode, no `any`, no `console`
- No emojis in code, docs, or commits
- **Scopes**: `extension`, `parser`, `ui`, `platform`, `build`, `deps`, `docs`
- **Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`

## 7. Quality

- Quality gate after changes: `bun run util:check` (format, lint, types, test)
- All 63 tests must pass before commit
- Pre-commit: Husky + lint-staged runs `util:check`
- Commits: Always use Conventional Commits format `type(scope): description` with body required; read allowed types/scopes from `commitlint.config.js`
