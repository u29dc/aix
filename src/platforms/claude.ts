import { BUTTON_ID, CLAUDE_SHARE_CLASS_FALLBACK } from '@/constants';
import { convertNodeToMarkdown } from '@/parsers';
import type { PlatformConfig } from '@/platforms/types';
import type { Message } from '@/types';
import { createButton } from '@/ui/button';
import { pruneNode } from '@/utils/dom';

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
	return document.querySelector('main') ?? document.querySelector('[data-testid="chat-main"]') ?? document.body;
}

/**
 * Get the content source element for a message node
 */
function getMessageSource(node: Element, isUser: boolean): Element {
	if (isUser) return node;
	return node.querySelector('.font-claude-response .standard-markdown_, .font-claude-response .progressive-markdown_, .font-claude-response') ?? node;
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
function processMessageCandidate(node: Element, lastFingerprint: string | null): { message: Message | null; fingerprint: string } {
	const isUser = node.matches('[data-testid="user-message"]');
	const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
	const source = getMessageSource(node, isUser);

	const clone = source.cloneNode(true) as Element;
	pruneNode(clone);

	const rawText = clone.textContent?.trim() ?? '';
	const markdown = convertNodeToMarkdown(clone).trim();
	const fingerprint = `${role}:${rawText}`;

	if (!markdown && !rawText) {
		if (isStreamingMessage(node)) {
			return {
				message: { role, markdown: '> [Message is still streaming and was skipped]' },
				fingerprint,
			};
		}
		return { message: null, fingerprint };
	}

	if (fingerprint === lastFingerprint) {
		return { message: null, fingerprint };
	}

	return { message: { role, markdown }, fingerprint };
}

/**
 * Extract conversation messages from Claude DOM
 */
export function extractClaudeConversation(): Message[] {
	const root = findChatRoot();
	const candidates = Array.from(root.querySelectorAll('[data-testid="user-message"], div[data-is-streaming]'));
	const messages: Message[] = [];
	let lastFingerprint: string | null = null;

	for (const node of candidates) {
		const result = processMessageCandidate(node, lastFingerprint);
		if (result.message) {
			messages.push(result.message);
		}
		lastFingerprint = result.fingerprint;
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
	ensureButton: ensureClaudeButton,
	extractConversation: extractClaudeConversation,
	deriveTitle: deriveClaudeTitle,
	isEligibleConversation: isEligibleClaudeConversation,
};
