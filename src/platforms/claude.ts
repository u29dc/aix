import { BUTTON_ID, CLAUDE_SHARE_CLASS_FALLBACK, SANITIZE_SELECTORS } from '@/constants';
import { convertNodeToMarkdown } from '@/parsers';
import { sanitizeElement } from '@/parsers/sanitizer';
import { buildCombinedSelector, CLAUDE_SELECTORS, querySelector } from '@/platforms/selectors';
import type { PlatformConfig } from '@/platforms/types';
import type { Message } from '@/types';
import { createButton } from '@/ui/button';

/**
 * Check if current page is an eligible Claude conversation
 */
export function isEligibleClaudeConversation(): boolean {
	const pathname = window.location.pathname;
	return /^\/chat\/[0-9a-f-]+\/?$/i.test(pathname);
}

/**
 * Ensure export button exists for Claude
 */
export function ensureClaudeButton(): boolean {
	if (document.getElementById(BUTTON_ID)?.isConnected) return true;

	// Create button as fixed overlay - doesn't depend on Claude's DOM structure
	const button = createButton(CLAUDE_SHARE_CLASS_FALLBACK);
	button.style.cssText = `
		position: fixed !important;
		bottom: 20px !important;
		right: 20px !important;
		z-index: 9999 !important;
		padding: 8px 16px !important;
		border-radius: 8px !important;
		background: #1a1a1a !important;
		color: #fff !important;
		border: 1px solid #333 !important;
		cursor: pointer !important;
		font-size: 14px !important;
		box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
	`;
	document.body.appendChild(button);
	// biome-ignore lint/suspicious/noConsole: debug logging
	console.log('[AIX] Button injected as fixed overlay');
	return true;
}

/**
 * Find the chat container element
 */
function findChatRoot(): Element {
	return querySelector(document, CLAUDE_SELECTORS.chatContainer) ?? document.body;
}

/**
 * Get the content source element for a message node
 */
function getMessageSource(node: Element, isUser: boolean): Element {
	if (isUser) return node;
	return querySelector(node, CLAUDE_SELECTORS.messageContent) ?? node;
}

/**
 * Check if a message is currently streaming
 */
function isStreamingMessage(node: Element): boolean {
	const streamingContainer = node.closest('[data-is-streaming]');
	return streamingContainer?.getAttribute('data-is-streaming') === 'true';
}

/**
 * Process a single message candidate and return the message if valid
 */
const USER_SELECTOR = buildCombinedSelector(CLAUDE_SELECTORS.userMessage);
const ASSISTANT_SELECTOR = buildCombinedSelector(CLAUDE_SELECTORS.assistantMessage);
const MESSAGE_SELECTOR = `${USER_SELECTOR}, ${ASSISTANT_SELECTOR}`;

function isSystemMessage(node: Element): boolean {
	return node.closest('[data-message-author-role="system"]') !== null;
}

function processMessageCandidate(node: Element): Message | null {
	if (isSystemMessage(node)) return null;
	const isUser = node.matches(USER_SELECTOR);
	const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
	const source = getMessageSource(node, isUser);

	const sanitized = sanitizeElement(source, {
		removeSelectors: SANITIZE_SELECTORS,
	});

	const markdown = convertNodeToMarkdown(sanitized).trimEnd();

	if (!markdown.trim()) {
		if (isStreamingMessage(node)) {
			return { role, markdown: '> [Message is still streaming and was skipped]' };
		}
		return null;
	}

	return { role, markdown };
}

/**
 * Extract conversation messages from Claude DOM
 */
export function extractClaudeConversation(): Message[] {
	const root = findChatRoot();
	const candidates = Array.from(root.querySelectorAll(MESSAGE_SELECTOR)).filter((node) => node.parentElement?.closest(MESSAGE_SELECTOR) === null);
	const messages: Message[] = [];

	for (const node of candidates) {
		const message = processMessageCandidate(node);
		if (message) messages.push(message);
	}

	return messages;
}

/**
 * Derive conversation title from Claude page
 */
export function deriveClaudeTitle(): string {
	const titleButton = document.querySelector('[data-testid="chat-title-button"]');
	if (titleButton?.textContent) {
		return titleButton.textContent.trim();
	}
	return document.title?.replace(/\s+[-|].*$/, '').trim() ?? '';
}

export const claudeAdapter: PlatformConfig = {
	platform: 'claude',
	displayName: 'Claude',
	ensureButton: ensureClaudeButton,
	extractConversation: extractClaudeConversation,
	deriveTitle: deriveClaudeTitle,
	isEligibleConversation: isEligibleClaudeConversation,
};
