# AI Chat Markdown Exporter

Chrome extension that captures the full conversation from ChatGPT and Claude and downloads it as a clean markdown file with a single click.

## Features

- Detects ChatGPT and Claude chats automatically
- Extracts user and assistant messages in chronological order, preserving markdown, lists, code blocks, tables, and inline formatting
- Strips UI chrome (toolbars, copy buttons, timers) for a focused transcript
- Generates a markdown document with conversation metadata (export time, source URL)
- Lightweight content-script only architecture; no background worker or external dependencies

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [tsgo](https://github.com/nicolo-ribaudo/tsgo) (TypeScript native compiler) - installed via `@typescript/native-preview`

### Setup

```bash
# Install dependencies
bun install

# Build the extension
bun run build

# Development mode (watch)
bun run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Build extension to `dist/` |
| `bun run dev` | Build with file watching |
| `bun run util:format` | Format code with Biome |
| `bun run util:lint` | Lint code with Biome |
| `bun run util:types` | Type check with tsgo |
| `bun run util:check` | Run all checks (format, lint, types, tests) |
| `bun test` | Run tests |

### Project Structure

```
src/
├── index.ts           # Entry point - bootstrap + orchestration
├── constants.ts       # Extension IDs, CSS fallbacks, selectors
├── types.ts           # TypeScript interfaces
├── platforms/         # Platform-specific adapters
│   ├── chatgpt.ts     # ChatGPT button injection + extraction
│   └── claude.ts      # Claude button injection + extraction
├── parsers/           # DOM to markdown conversion
│   ├── markdown.ts    # Main conversion logic
│   ├── code-block.ts  # Code block formatting
│   ├── list.ts        # List formatting
│   └── table.ts       # Table formatting
├── ui/                # UI components
│   ├── button.ts      # Export button management
│   ├── toast.ts       # Toast notifications
│   └── styles.ts      # CSS injection
└── utils/             # Utilities
    ├── dom.ts         # DOM helpers
    ├── download.ts    # File download
    ├── filename.ts    # Filename generation
    ├── markdown.ts    # Markdown text utilities
    └── navigation.ts  # SPA navigation observer
```

## Installation

1. Run `bun run build` to build the extension
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and choose the `dist` directory
5. Confirm the extension appears in the list

## Usage

1. Visit an existing conversation on either `chatgpt.com` or `claude.ai`
2. Click the **Export chat** button in the conversation header
3. When the toast confirms success, locate the downloaded markdown file (named `chatgpt-chat-YYYYMMDD-HHMMSS-title.md` or `claude-chat-...`)

If the chat is still streaming when you export, the transcript notes the incomplete message so you can retry once generation completes.

## Testing

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch
```

## Code Quality

This project uses:

- **TypeScript** with strict mode enabled
- **Biome** for formatting and linting
- **tsgo** for fast type checking
- **Husky** + **lint-staged** for pre-commit hooks
- **commitlint** for conventional commit messages

### Commit Message Format

```
type(scope): subject

# Examples:
feat(extension): add dark mode support
fix(parser): handle empty code blocks
refactor(ui): simplify button state management
```

Allowed types: `feat`, `fix`, `refactor`, `docs`, `style`, `chore`, `test`
Allowed scopes: `extension`, `parser`, `ui`, `platform`, `build`, `deps`, `docs`

## Security & Permissions

- Runs entirely in the page context with read-only access to DOM content
- Requires host permissions only for `https://chatgpt.com/*` and `https://claude.ai/*`
- No background scripts, storage usage, or network access
