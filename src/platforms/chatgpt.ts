import { BUTTON_ID, CHATGPT_BUTTON_CLASS_FALLBACK, SANITIZE_SELECTORS } from '@/constants';
import { convertNodeToMarkdown } from '@/parsers';
import { sanitizeElement } from '@/parsers/sanitizer';
import { buildCombinedSelector, CHATGPT_SELECTORS, querySelector, querySelectorAll } from '@/platforms/selectors';
import type { PlatformConfig } from '@/platforms/types';
import type { Message } from '@/types';
import { createButton } from '@/ui/button';
import { escapeMarkdown } from '@/utils/markdown';

const CHATGPT_HOST_REGEX = /(^|\.)chatgpt\.com$/i;
const OPENAI_CHAT_HOST_REGEX = /(^|\.)chat\.openai\.com$/i;

const CHATGPT_SANITIZE_SELECTORS = SANITIZE_SELECTORS.filter((selector) => selector !== 'input' && selector !== '[role="img"]');

const TURN_SELECTOR = buildCombinedSelector(CHATGPT_SELECTORS.conversationTurn);
const USER_SELECTOR = buildCombinedSelector(CHATGPT_SELECTORS.userMessage);
const ASSISTANT_SELECTOR = buildCombinedSelector(CHATGPT_SELECTORS.assistantMessage);

/**
 * Check if current page is an eligible ChatGPT conversation
 */
export function isEligibleChatGPTConversation(): boolean {
	const host = window.location.hostname;
	if (!CHATGPT_HOST_REGEX.test(host) && !OPENAI_CHAT_HOST_REGEX.test(host)) return false;

	if (document.querySelector(TURN_SELECTOR)) return true;

	const pathname = window.location.pathname;
	return /^\/c\//i.test(pathname) || /\/g\//i.test(pathname);
}

/**
 * Ensure export button exists for ChatGPT
 */
export function ensureChatGPTButton(): boolean {
	if (document.getElementById(BUTTON_ID)?.isConnected) return true;

	const button = createButton(CHATGPT_BUTTON_CLASS_FALLBACK);
	button.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        z-index: 9999 !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        background: #111827 !important;
        color: #fff !important;
        border: 1px solid #1f2937 !important;
        cursor: pointer !important;
        font-size: 14px !important;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
    `;
	document.body.appendChild(button);
	return true;
}

function normalizeInlineText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const value of values) {
		const normalized = normalizeInlineText(value);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		output.push(normalized);
	}
	return output;
}

function selectInnermost(elements: Element[]): Element[] {
	return elements.filter((element) => !elements.some((other) => other !== element && element.contains(other)));
}

function formatListSection(label: string, entries: string[]): string {
	if (entries.length === 0) return '';
	const lines = [`**${label}:**`, ...entries.map((entry) => `- ${entry}`)];
	return lines.join('\n');
}

function collectMessageBlocks(root: Element, selector: string): Element[] {
	const blocks = Array.from(root.querySelectorAll(selector));
	if (blocks.length === 0) return [];
	return selectInnermost(blocks);
}

function collectAssistantBlocks(turn: Element): Element[] {
	const candidates = Array.from(turn.querySelectorAll('.markdown, .prose'));
	if (candidates.length === 0) return [];

	const filtered = candidates.filter((element) => {
		if (element.classList.contains('prose') && element.closest('.markdown')) return false;
		return true;
	});

	return selectInnermost(filtered);
}

function extractFileCards(root: Element): string[] {
	const links = Array.from(root.querySelectorAll('a[target="_blank"]'));
	const entries: string[] = [];

	for (const link of links) {
		const name = normalizeInlineText(link.querySelector('.truncate.font-semibold')?.textContent ?? '');
		if (!name) continue;
		const type = normalizeInlineText(link.querySelector('.text-token-text-secondary.truncate')?.textContent ?? '');
		if (type) {
			entries.push(`${escapeMarkdown(name)} (${escapeMarkdown(type)})`);
		} else {
			entries.push(escapeMarkdown(name));
		}
	}

	return uniqueStrings(entries);
}

function extractUserMarkdown(turn: Element): string {
	const message = querySelector(turn, CHATGPT_SELECTORS.userMessage) ?? turn;
	const blocks = collectMessageBlocks(message, '.whitespace-pre-wrap, .markdown');
	const markdownChunks: string[] = [];

	if (blocks.length > 0) {
		const seen = new Set<string>();
		for (const block of blocks) {
			const sanitized = sanitizeElement(block, { removeSelectors: CHATGPT_SANITIZE_SELECTORS });
			const markdown = convertNodeToMarkdown(sanitized).trim();
			if (!markdown || seen.has(markdown)) continue;
			seen.add(markdown);
			markdownChunks.push(markdown);
		}
	} else {
		const sanitized = sanitizeElement(message, { removeSelectors: CHATGPT_SANITIZE_SELECTORS });
		const markdown = convertNodeToMarkdown(sanitized).trim();
		if (markdown) markdownChunks.push(markdown);
	}

	const attachments = extractFileCards(message);
	const attachmentSection = formatListSection('Attachments', attachments);
	if (attachmentSection) markdownChunks.push(attachmentSection);

	return markdownChunks.join('\n\n').trimEnd();
}

function extractAssistantMarkdown(turn: Element): string {
	const blocks = collectAssistantBlocks(turn);
	const markdownChunks: string[] = [];

	if (blocks.length > 0) {
		const seen = new Set<string>();
		for (const block of blocks) {
			const sanitized = sanitizeElement(block, { removeSelectors: CHATGPT_SANITIZE_SELECTORS });
			const markdown = convertNodeToMarkdown(sanitized).trim();
			if (!markdown || seen.has(markdown)) continue;
			seen.add(markdown);
			markdownChunks.push(markdown);
		}
	} else {
		const message = querySelector(turn, CHATGPT_SELECTORS.assistantMessage) ?? turn;
		const sanitized = sanitizeElement(message, { removeSelectors: CHATGPT_SANITIZE_SELECTORS });
		const markdown = convertNodeToMarkdown(sanitized).trim();
		if (markdown) markdownChunks.push(markdown);
	}

	const artifacts = extractFileCards(turn);
	const artifactSection = formatListSection('Artifacts', artifacts);
	if (artifactSection) markdownChunks.push(artifactSection);

	return markdownChunks.join('\n\n').trimEnd();
}

function deriveRole(turn: Element): 'user' | 'assistant' | null {
	const role = turn.getAttribute('data-turn');
	if (role === 'user' || role === 'assistant') return role;
	if (turn.querySelector(USER_SELECTOR)) return 'user';
	if (turn.querySelector(ASSISTANT_SELECTOR)) return 'assistant';
	return null;
}

/**
 * Extract conversation messages from ChatGPT DOM
 */
export function extractChatGPTConversation(): Message[] {
	const turns = querySelectorAll(document, CHATGPT_SELECTORS.conversationTurn);
	const messages: Message[] = [];

	if (turns.length === 0) {
		const markdownBlocks = collectMessageBlocks(document.body, '.markdown');
		for (const block of markdownBlocks) {
			const sanitized = sanitizeElement(block, { removeSelectors: CHATGPT_SANITIZE_SELECTORS });
			const markdown = convertNodeToMarkdown(sanitized).trimEnd();
			if (markdown) messages.push({ role: 'assistant', markdown });
		}
		return messages;
	}

	for (const turn of turns) {
		const role = deriveRole(turn);
		if (!role) continue;

		const markdown = role === 'user' ? extractUserMarkdown(turn) : extractAssistantMarkdown(turn);
		if (!markdown.trim()) continue;

		messages.push({ role, markdown });
	}

	return messages;
}

/**
 * Derive conversation title from ChatGPT page
 */
export function deriveChatGPTTitle(): string {
	const docTitle = document.title?.trim() ?? '';
	if (!docTitle) return '';
	return docTitle.replace(/^ChatGPT\s*[-|:]\s*/i, '').trim();
}

export const chatgptAdapter: PlatformConfig = {
	platform: 'chatgpt',
	displayName: 'ChatGPT',
	ensureButton: ensureChatGPTButton,
	extractConversation: extractChatGPTConversation,
	deriveTitle: deriveChatGPTTitle,
	isEligibleConversation: isEligibleChatGPTConversation,
};
