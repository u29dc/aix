import { BUTTON_ID, CHATGPT_SHARE_CLASS_FALLBACK } from '@/constants';
import { convertNodeToMarkdown } from '@/parsers';
import type { PlatformConfig } from '@/platforms/types';
import type { Message } from '@/types';
import { createButton } from '@/ui/button';
import { pruneNode } from '@/utils/dom';

/**
 * Check if current page is an eligible ChatGPT conversation
 */
export function isEligibleChatGPTConversation(): boolean {
	const pathname = window.location.pathname;
	if (!/\/c\//.test(pathname)) return false;
	const match = pathname.match(/\/c\/([a-z0-9-]+)/i);
	return Boolean(match?.[1]);
}

/**
 * Ensure export button exists for ChatGPT
 */
export function ensureChatGPTButton(): boolean {
	if (document.getElementById(BUTTON_ID)?.isConnected) return true;

	const shareButton = document.querySelector('[data-testid="share-chat-button"]');
	const container = shareButton?.parentElement ?? document.querySelector('[data-testid="conversation-header-actions"]');
	if (!container) return false;

	const button = createButton(shareButton?.className ?? CHATGPT_SHARE_CLASS_FALLBACK);
	if (shareButton?.nextSibling) {
		container.insertBefore(button, shareButton.nextSibling);
	} else {
		container.appendChild(button);
	}
	return true;
}

/**
 * Extract conversation messages from ChatGPT DOM
 */
export function extractChatGPTConversation(): Message[] {
	const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
	const messages: Message[] = [];

	for (const turn of turns) {
		const declaredRole = (turn.getAttribute('data-turn') ?? '').toLowerCase();
		const role: 'user' | 'assistant' = declaredRole === 'assistant' ? 'assistant' : 'user';

		const container = turn.querySelector(`[data-message-author-role="${role}"]`) ?? turn.querySelector('[data-message-author-role]');
		if (!container) continue;

		const clone = container.cloneNode(true) as Element;
		pruneNode(clone);
		const markdown = convertNodeToMarkdown(clone).trim();

		if (markdown) {
			messages.push({ role, markdown });
			continue;
		}

		const streaming = Boolean(turn.querySelector('[data-message-is-streaming="true"], [data-is-streaming="true"]'));
		if (streaming) {
			messages.push({
				role,
				markdown: '> [Message is still streaming and was skipped]',
			});
		}
	}

	return messages;
}

/**
 * Derive conversation title from ChatGPT page
 */
export function deriveChatGPTTitle(): string {
	const titleNode = document.querySelector('[data-testid="conversation-title"]') ?? document.querySelector('[data-testid="conversation-info-name"]');
	if (titleNode?.textContent) {
		return titleNode.textContent.trim();
	}
	return document.title?.replace(/\s+[-|].*$/, '').trim() ?? '';
}

export const chatgptAdapter: PlatformConfig = {
	platform: 'chatgpt',
	ensureButton: ensureChatGPTButton,
	extractConversation: extractChatGPTConversation,
	deriveTitle: deriveChatGPTTitle,
	isEligibleConversation: isEligibleChatGPTConversation,
};
