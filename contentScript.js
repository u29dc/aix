const EXTENSION_ID = "ai-chat-exporter";
const BUTTON_ID = `${EXTENSION_ID}-button`;
const TOAST_ID = `${EXTENSION_ID}-toast`;
const STYLE_ID = `${EXTENSION_ID}-styles`;
const CLAUDE_SHARE_CLASS_FALLBACK =
	"inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none text-text-000 font-base-bold border-0.5 border-border-200 overflow-hidden transition duration-100 hover:border-border-300/0 bg-bg-300/0 hover:bg-bg-400 backface-hidden h-8 rounded-md px-3 min-w-[4rem] active:scale-[0.985] whitespace-nowrap !text-xs";
const CHATGPT_SHARE_CLASS_FALLBACK =
	"btn relative btn-ghost text-token-text-primary mx-2";

const PLATFORM = detectPlatform();
let navigationHooked = false;

if (PLATFORM) {
	injectStyles();
	bootstrap();
}

function detectPlatform() {
	const host = window.location.hostname;
	if (/chatgpt\.com$/i.test(host)) return "chatgpt";
	if (/claude\.ai$/i.test(host)) return "claude";
	return null;
}

function bootstrap() {
	if (!document.body) {
		window.setTimeout(bootstrap, 50);
		return;
	}
	ensureButtonWithRetry();
	if (!navigationHooked) {
		navigationHooked = true;
		observeSpaNavigation(() => ensureButtonWithRetry());
	}
}

function ensureButton() {
	if (!isEligibleConversation()) {
		removeButton();
		return false;
	}
	const existing = document.getElementById(BUTTON_ID);
	if (existing && existing.isConnected) return true;
	if (PLATFORM === "chatgpt") {
		return ensureChatGPTButton();
	}
	if (PLATFORM === "claude") {
		return ensureClaudeButton();
	}
	return false;
}

function ensureChatGPTButton() {
	const shareButton = document.querySelector(
		'[data-testid="share-chat-button"]',
	);
	const container =
		shareButton?.parentElement ||
		document.querySelector('[data-testid="conversation-header-actions"]');
	if (!container) return false;
	const button = document.createElement("button");
	button.id = BUTTON_ID;
	button.type = "button";
	button.textContent = "Export chat";
	button.className = shareButton
		? shareButton.className
		: CHATGPT_SHARE_CLASS_FALLBACK;
	button.setAttribute("aria-label", "Export chat");
	button.dataset.state = "idle";
	button.addEventListener("click", handleExportClick);
	if (shareButton && shareButton.nextSibling) {
		container.insertBefore(button, shareButton.nextSibling);
	} else {
		container.appendChild(button);
	}
	return true;
}

function ensureClaudeButton() {
	const container =
		document.querySelector('[data-testid="chat-actions"]') ||
		document.querySelector(
			'[data-testid="page-header"] [data-testid="chat-actions"]',
		);
	if (!container) return false;
	const shareButton = Array.from(container.querySelectorAll("button")).find(
		(btn) =>
			btn.textContent && btn.textContent.trim().toLowerCase() === "share",
	);
	const button = document.createElement("button");
	button.id = BUTTON_ID;
	button.type = "button";
	button.textContent = "Export chat";
	button.className = shareButton
		? shareButton.className
		: CLAUDE_SHARE_CLASS_FALLBACK;
	button.setAttribute("aria-label", "Export chat");
	button.dataset.state = "idle";
	button.addEventListener("click", handleExportClick);
	if (shareButton && shareButton.nextSibling) {
		container.insertBefore(button, shareButton.nextSibling);
	} else {
		container.appendChild(button);
	}
	return true;
}

function handleExportClick() {
	const button = document.getElementById(BUTTON_ID);
	if (!button) return;
	if (button.dataset.state === "busy") return;
	button.dataset.state = "busy";
	button.textContent = "Exporting…";
	button.disabled = true;
	Promise.resolve()
		.then(exportConversation)
		.then((filename) => {
			if (filename) {
				showToast(`Conversation exported: ${filename}`, false);
			}
		})
		.catch((error) => {
			console.error("[AI Chat Exporter] Export failed", error);
			showToast(`Export failed: ${error.message}`, true);
		})
		.finally(() => {
			button.dataset.state = "idle";
			button.textContent = "Export chat";
			button.disabled = false;
		});
}

function removeButton() {
	const existing = document.getElementById(BUTTON_ID);
	if (existing && existing.parentElement) {
		existing.parentElement.removeChild(existing);
	}
}

function exportConversation() {
	const extractor =
		PLATFORM === "chatgpt"
			? extractChatGPTConversation
			: extractClaudeConversation;
	const messages = extractor();
	if (!messages.length) {
		throw new Error("No messages found in this conversation.");
	}
	const title = deriveTitle() || "AI Conversation";
	const markdown = composeMarkdown(messages, title);
	const filename = buildFilename(title);
	triggerDownload(markdown, filename);
	return filename;
}

function extractChatGPTConversation() {
	const turns = Array.from(
		document.querySelectorAll('[data-testid^="conversation-turn-"]'),
	);
	const messages = [];
	for (const turn of turns) {
		const declaredRole = (turn.getAttribute("data-turn") || "").toLowerCase();
		const role = declaredRole === "assistant" ? "assistant" : "user";
		const container =
			turn.querySelector(`[data-message-author-role="${role}"]`) ||
			turn.querySelector("[data-message-author-role]");
		if (!container) continue;
		const clone = container.cloneNode(true);
		pruneNode(clone);
		const markdown = convertNodeToMarkdown(clone).trim();
		if (markdown) {
			messages.push({ role, markdown });
			continue;
		}
		const streaming = Boolean(
			turn.querySelector(
				'[data-message-is-streaming="true"], [data-is-streaming="true"]',
			),
		);
		if (streaming) {
			messages.push({
				role,
				markdown: "> [Message is still streaming and was skipped]",
			});
		}
	}
	return messages;
}

function extractClaudeConversation() {
	const root =
		document.querySelector("main") ||
		document.querySelector('[data-testid="chat-main"]') ||
		document.body;
	const candidates = Array.from(
		root.querySelectorAll(
			'[data-testid="user-message"], div[data-is-streaming]',
		),
	);
	const messages = [];
	let lastFingerprint = null;
	for (const node of candidates) {
		const isUser = node.matches('[data-testid="user-message"]');
		const role = isUser ? "user" : "assistant";
		const source = isUser
			? node
			: node.querySelector(
					".font-claude-response .standard-markdown_, .font-claude-response .progressive-markdown_, .font-claude-response",
				) || node;
		const clone = source.cloneNode(true);
		pruneNode(clone);
		const rawText = clone.textContent ? clone.textContent.trim() : "";
		const markdown = convertNodeToMarkdown(clone).trim();
		const fingerprint = `${role}:${rawText}`;
		if (!markdown && !rawText) {
			const streamingContainer = node.closest("[data-is-streaming]");
			if (
				streamingContainer &&
				streamingContainer.getAttribute("data-is-streaming") === "true"
			) {
				messages.push({
					role,
					markdown: "> [Message is still streaming and was skipped]",
				});
			}
			continue;
		}
		if (fingerprint && fingerprint === lastFingerprint) {
			continue;
		}
		lastFingerprint = fingerprint;
		messages.push({ role, markdown });
	}
	return messages;
}

function deriveTitle() {
	if (PLATFORM === "chatgpt") {
		const titleNode =
			document.querySelector('[data-testid="conversation-title"]') ||
			document.querySelector('[data-testid="conversation-info-name"]');
		if (titleNode && titleNode.textContent) {
			return titleNode.textContent.trim();
		}
	}
	if (PLATFORM === "claude") {
		const titleButton = document.querySelector(
			'[data-testid="chat-title-button"]',
		);
		if (titleButton && titleButton.textContent) {
			return titleButton.textContent.trim();
		}
	}
	return document.title ? document.title.replace(/\s+[-|].*$/, "").trim() : "";
}

function composeMarkdown(messages, title) {
	const now = new Date();
	const timestamp = now.toISOString();
	const lines = [];
	lines.push(`# ${title || "AI Conversation"}`);
	lines.push("");
	lines.push(
		`- Exported from ${PLATFORM === "chatgpt" ? "ChatGPT" : "Claude"} on ${timestamp}`,
	);
	lines.push(`- URL: ${window.location.href}`);
	lines.push("");
	for (const { role, markdown } of messages) {
		const label = role === "assistant" ? "Assistant" : "User";
		lines.push(`**${label}:**`);
		lines.push(markdown || "_No content available._");
		lines.push("");
		lines.push("---");
		lines.push("");
	}
	// Remove trailing separator
	while (lines.length && lines[lines.length - 1].trim() === "") {
		lines.pop();
	}
	if (lines.length && lines[lines.length - 1] === "---") {
		lines.pop();
	}
	while (lines.length && lines[lines.length - 1].trim() === "") {
		lines.pop();
	}
	return normalizeSpacing(lines.join("\n")).trimEnd() + "\n";
}

function buildFilename(title) {
	const date = new Date();
	const pad = (value) => String(value).padStart(2, "0");
	const timestamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
		date.getHours(),
	)}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
	return `${PLATFORM}-chat-${timestamp}${slug ? `-${slug}` : ""}.md`;
}

function triggerDownload(content, filename) {
	const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	requestAnimationFrame(() => {
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	});
}

function pruneNode(root) {
	const selectorsToRemove = [
		"button",
		"svg",
		"style",
		"script",
		"form",
		"textarea",
		"input",
		'[aria-hidden="true"]',
		'[role="img"]',
		'[data-testid="message-actions"]',
		'[data-testid="hover-card"]',
		'[data-testid="conversation-turn-badge"]',
		'[data-testid="action-bar-copy"]',
		'[data-message-author-role="system"]',
		".sr-only",
		".visually-hidden",
	];
	for (const selector of selectorsToRemove) {
		root.querySelectorAll(selector).forEach((el) => el.remove());
	}
}

function convertNodeToMarkdown(node, context = { listDepth: 0 }) {
	if (!node) return "";
	if (node.nodeType === Node.TEXT_NODE) {
		return escapeMarkdown(node.nodeValue || "");
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return "";
	}
	const element = node;
	if (shouldSkipElement(element)) return "";
	const tag = element.tagName.toLowerCase();
	switch (tag) {
		case "p":
			return `${collectChildrenMarkdown(element, context).trim()}\n\n`;
		case "br":
			return "  \n";
		case "strong":
		case "b":
			return wrapMarkdown("**", collectChildrenMarkdown(element, context));
		case "em":
		case "i":
			return wrapMarkdown("*", collectChildrenMarkdown(element, context));
		case "code": {
			if (
				element.parentElement &&
				element.parentElement.tagName.toLowerCase() === "pre"
			) {
				return "";
			}
			return wrapMarkdown("`", element.textContent || "");
		}
		case "pre":
			return formatCodeBlock(element);
		case "ul":
			return formatList(element, context, false);
		case "ol":
			return formatList(element, context, true);
		case "li":
			return collectChildrenMarkdown(element, context).trim();
		case "blockquote": {
			const inner = collectChildrenMarkdown(element, context).trim();
			if (!inner) return "";
			return inner
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n")
				.concat("\n\n");
		}
		case "a": {
			const href = element.getAttribute("href") || "";
			const label = collectChildrenMarkdown(element, context).trim() || href;
			if (!href) return label;
			return `[${label}](${href})`;
		}
		case "img": {
			const alt = element.getAttribute("alt") || "Image";
			const src = element.getAttribute("src") || "";
			return src ? `![${alt}](${src})` : `![${alt}]`;
		}
		case "hr":
			return "\n---\n\n";
		case "h1":
		case "h2":
		case "h3":
		case "h4":
		case "h5":
		case "h6": {
			const level = Number(tag[1]);
			const hashes = "#".repeat(Math.min(Math.max(level, 1), 6));
			return `${hashes} ${collectChildrenMarkdown(element, context).trim()}\n\n`;
		}
		case "table":
			return formatTable(element, context);
		default:
			return collectChildrenMarkdown(element, context);
	}
}

function collectChildrenMarkdown(element, context) {
	let output = "";
	element.childNodes.forEach((child) => {
		output += convertNodeToMarkdown(child, context);
	});
	return output;
}

function shouldSkipElement(element) {
	if (element.isConnected) {
		const style = window.getComputedStyle(element);
		if (style && (style.display === "none" || style.visibility === "hidden")) {
			return true;
		}
	}
	if (element.matches('[contenteditable="false"][role="presentation"]')) {
		return true;
	}
	return false;
}

function wrapMarkdown(wrapper, value) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return `${wrapper}${trimmed}${wrapper}`;
}

function escapeMarkdown(text) {
	if (!text) return "";
	return text
		.replace(/\u00a0/g, " ")
		.replace(/([\\`*_{}\[\]()#+\-!>])/g, "\\$1");
}

function formatCodeBlock(preElement) {
	const codeElement = preElement.querySelector("code");
	const rawText = codeElement
		? codeElement.textContent || ""
		: preElement.textContent || "";
	const language = detectLanguage(codeElement);
	const fence = pickFence(rawText);
	const header = language ? `${fence}${language}` : fence;
	return `${header}\n${rawText.replace(/\n$/, "")}\n${fence}\n\n`;
}

function detectLanguage(codeElement) {
	if (!codeElement) return "";
	const explicit = codeElement.getAttribute("data-language") || "";
	if (explicit) return explicit.trim();
	const classAttr = codeElement.getAttribute("class") || "";
	const match = classAttr.match(/language-([a-z0-9+#]+)/i);
	return match ? match[1] : "";
}

function pickFence(text) {
	const hasTriple = text.includes("```");
	if (!hasTriple) return "```";
	const hasTilde = text.includes("~~~");
	return hasTilde ? "```" : "~~~";
}

function formatList(listElement, context, ordered) {
	const depth = context.listDepth || 0;
	const indent = "  ".repeat(depth);
	const items = [];
	let index = ordered ? Number(listElement.getAttribute("start") || 1) : 0;
	const nextContext = { ...context, listDepth: depth + 1 };
	Array.from(listElement.children).forEach((child) => {
		if (child.tagName && child.tagName.toLowerCase() === "li") {
			const value = ordered ? `${index}. ` : "- ";
			const content = convertNodeToMarkdown(child, nextContext).trim();
			const lines = content.split("\n");
			const firstLine = `${indent}${value}${lines.shift() || ""}`;
			const extraLines = lines.map(
				(line) => `${indent}${ordered ? "   " : "  "}${line}`,
			);
			items.push([firstLine, ...extraLines].join("\n"));
			if (ordered) index += 1;
		}
	});
	if (!items.length) return "";
	return `${items.join("\n")}\n\n`;
}

function formatTable(tableElement) {
	const rows = Array.from(tableElement.querySelectorAll("tr"));
	if (!rows.length) return "";
	const headerCells = Array.from(rows.shift().cells || []);
	if (!headerCells.length) return "";
	const headers = headerCells.map(
		(cell) => convertNodeToMarkdown(cell).trim() || " ",
	);
	const divider = headers.map(() => "---");
	const bodyRows = rows.map((row) => {
		const cells = Array.from(row.cells || []);
		return cells.map((cell) => convertNodeToMarkdown(cell).trim());
	});
	const lines = [];
	lines.push(`| ${headers.join(" | ")} |`);
	lines.push(`| ${divider.join(" | ")} |`);
	for (const cells of bodyRows) {
		const padded = [...cells];
		while (padded.length < headers.length) padded.push("");
		lines.push(`| ${padded.join(" | ")} |`);
	}
	return `${lines.join("\n")}\n\n`;
}

function normalizeSpacing(markdown) {
	return markdown.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function showToast(message, isError) {
	if (!message) return;
	let toast = document.getElementById(TOAST_ID);
	if (!toast) {
		toast = document.createElement("div");
		toast.id = TOAST_ID;
		document.body.appendChild(toast);
	}
	toast.textContent = message;
	toast.dataset.type = isError ? "error" : "success";
	toast.classList.add("visible");
	clearTimeout(toast.__hideTimer);
	toast.__hideTimer = window.setTimeout(() => {
		toast.classList.remove("visible");
	}, 4000);
}

function injectStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
    #${TOAST_ID} {
      position: fixed;
      bottom: 90px;
      right: 24px;
      max-width: 320px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      color: ${prefersDark ? "#0f172a" : "#0f172a"};
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 160ms ease, transform 160ms ease;
      z-index: 2147483647;
    }
    #${TOAST_ID}[data-type="error"] {
      background: rgba(248, 113, 113, 0.95);
      color: #111827;
    }
    #${TOAST_ID}.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
	document.head.appendChild(style);
}

function observeSpaNavigation(callback) {
	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;
	const notify = () => window.setTimeout(callback, 0);
	history.pushState = function pushStateProxy(...args) {
		originalPushState.apply(this, args);
		notify();
	};
	history.replaceState = function replaceStateProxy(...args) {
		originalReplaceState.apply(this, args);
		notify();
	};
	window.addEventListener("popstate", notify);
}

function isEligibleConversation() {
	const pathname = window.location.pathname || "";
	if (PLATFORM === "chatgpt") {
		if (!/\/c\//.test(pathname)) return false;
		const match = pathname.match(/\/c\/([a-z0-9-]+)/i);
		return Boolean(match && match[1]);
	}
	if (PLATFORM === "claude") {
		return /^\/chat\/[0-9a-f-]+\/?$/i.test(pathname);
	}
	return false;
}

function ensureButtonWithRetry(maxRetries = 6, delay = 150) {
	let attempts = 0;
	const tryEnsure = () => {
		if (ensureButton()) return;
		attempts += 1;
		if (attempts <= maxRetries) {
			window.setTimeout(tryEnsure, delay);
		}
	};
	tryEnsure();
}
