# AI Chat Markdown Exporter

Chrome extension that captures the full conversation from ChatGPT and Claude and downloads it as a clean markdown file with a single click.

## Features

- Detects ChatGPT and Claude chats automatically.
- Extracts user and assistant messages in chronological order, preserving markdown, lists, code blocks, tables, and inline formatting.
- Strips UI chrome (toolbars, copy buttons, timers) for a focused transcript.
- Generates a markdown document with conversation metadata (export time, source URL).
- Lightweight content-script only architecture; no background worker or external dependencies.

## Setup

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and choose the `aix` directory.
4. Confirm the extension appears in the list (no build step required).

## Usage

1. Visit an existing conversation on either `chatgpt.com` or `claude.ai`.
2. Click the floating **Export chat** button (bottom-right of the viewport).
3. When the toast confirms success, locate the downloaded markdown file (named `chatgpt-chat-YYYYMMDD-HHMMSS-title.md` or `claude-chat-...`).

If the chat is still streaming when you export, the transcript notes the incomplete message so you can retry once generation completes.

## Testing Checklist

- Export long multi-turn chats on both platforms and spot-check the resulting markdown.
- Verify code blocks retain languages/fences and lists maintain proper indentation.
- Test chats with tables, images, or attachments to confirm links render correctly.
- Trigger export on a new/empty chat to confirm the “no messages found” error toast.

## Security & Permissions

- Runs entirely in the page context with read-only access to DOM content.
- Requires host permissions only for `https://chatgpt.com/*` and `https://claude.ai/*`.
- No background scripts, storage usage, or network access.
