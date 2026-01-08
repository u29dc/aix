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

	const container = document.querySelector('[data-testid="chat-actions"]') ?? document.querySelector('[data-testid="page-header"] [data-testid="chat-actions"]');
	if (!container) return false;

	const shareButton = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim().toLowerCase() === 'share');

	const button = createButton(shareButton?.className ?? CLAUDE_SHARE_CLASS_FALLBACK);
	if (shareButton?.nextSibling) {
		container.insertBefore(button, shareButton.nextSibling);
	} else {
		container.appendChild(button);
	}
	return true;
}

/**
 * Extract conversation messages from Claude DOM
 */
export function extractClaudeConversation(): Message[] {
	const root = document.querySelector('main') ?? document.querySelector('[data-testid="chat-main"]') ?? document.body;
	const candidates = Array.from(root.querySelectorAll('[data-testid="user-message"], div[data-is-streaming]'));
	const messages: Message[] = [];
	let lastFingerprint: string | null = null;

	for (const node of candidates) {
		const isUser = node.matches('[data-testid="user-message"]');
		const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';

		const source = isUser ? node : (node.querySelector('.font-claude-response .standard-markdown_, .font-claude-response .progressive-markdown_, .font-claude-response') ?? node);

		const clone = source.cloneNode(true) as Element;
		pruneNode(clone);

		const rawText = clone.textContent?.trim() ?? '';
		const markdown = convertNodeToMarkdown(clone).trim();
		const fingerprint = `${role}:${rawText}`;

		if (!markdown && !rawText) {
			const streamingContainer = node.closest('[data-is-streaming]');
			if (streamingContainer?.getAttribute('data-is-streaming') === 'true') {
				messages.push({
					role,
					markdown: '> [Message is still streaming and was skipped]',
				});
			}
			continue;
		}

		if (fingerprint === lastFingerprint) {
			continue;
		}

		lastFingerprint = fingerprint;
		messages.push({ role, markdown });
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
