import { BUTTON_ID, CLAUDE_SHARE_CLASS_FALLBACK, SANITIZE_SELECTORS } from '@/constants';
import { convertNodeToMarkdown } from '@/parsers';
import { sanitizeElement } from '@/parsers/sanitizer';
import { buildCombinedSelector, CLAUDE_SELECTORS, querySelector } from '@/platforms/selectors';
import type { PlatformConfig } from '@/platforms/types';
import type { Message } from '@/types';
import { createButton } from '@/ui/button';
import { escapeMarkdown } from '@/utils/markdown';

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
const MARKDOWN_BLOCK_SELECTORS = ['.standard-markdown', '.standard-markdown_', '.progressive-markdown', '.progressive-markdown_', '.markdown', '.prose'].join(', ');
const ARTIFACT_CARD_SELECTOR = '[aria-label="Preview contents"]';
const FILE_THUMBNAIL_SELECTOR = '[data-testid="file-thumbnail"]';

function isSystemMessage(node: Element): boolean {
	return node.closest('[data-message-author-role="system"]') !== null;
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

function collectMarkdownBlocks(node: Element): Element[] {
	const blocks = Array.from(node.querySelectorAll(MARKDOWN_BLOCK_SELECTORS));
	if (blocks.length === 0) return [];
	const standardBlocks = blocks.filter((block) => block.classList.contains('standard-markdown') || block.classList.contains('standard-markdown_'));
	const preferred = standardBlocks.length > 0 ? standardBlocks : blocks;
	return selectInnermost(preferred);
}

function formatListSection(label: string, entries: string[]): string {
	if (entries.length === 0) return '';
	const lines = [`**${label}:**`, ...entries.map((entry) => `- ${entry}`)];
	return lines.join('\n');
}

function collectLeafTexts(card: Element): string[] {
	const leafTexts: string[] = [];
	const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT);
	let current = walker.nextNode();

	while (current) {
		const element = current as Element;
		const isLeafElement = element.childElementCount === 0;
		const isNotButton = !element.closest('button');
		const isNotSvg = element.tagName.toLowerCase() !== 'svg';

		if (isLeafElement && isNotButton && isNotSvg) {
			const text = normalizeInlineText(element.textContent ?? '');
			if (text) leafTexts.push(text);
		}
		current = walker.nextNode();
	}

	return leafTexts;
}

function extractCardTitleAndMeta(card: Element): { title: string; meta: string } {
	const clamped = Array.from(card.querySelectorAll('[class*="line-clamp-"]'));
	const clampedTitle = normalizeInlineText(clamped[0]?.textContent ?? '');
	const clampedMeta = normalizeInlineText(clamped[1]?.textContent ?? '');

	if (clampedTitle) return { title: clampedTitle, meta: clampedMeta };

	const leafTexts = collectLeafTexts(card);
	const [fallbackTitle = '', fallbackMeta = ''] = uniqueStrings(leafTexts);
	return { title: fallbackTitle, meta: fallbackMeta };
}

function formatArtifactEntry(title: string, meta: string): string {
	if (meta) return `${escapeMarkdown(title)} (${escapeMarkdown(meta)})`;
	return escapeMarkdown(title);
}

function extractArtifactEntries(node: Element): string[] {
	const cards = Array.from(node.querySelectorAll(ARTIFACT_CARD_SELECTOR));
	if (cards.length === 0) return [];

	const entries: string[] = [];
	for (const card of cards) {
		const { title, meta } = extractCardTitleAndMeta(card);
		if (!title) continue;
		entries.push(formatArtifactEntry(title, meta));
	}

	return uniqueStrings(entries);
}

function extractUserAttachments(node: Element): string[] {
	const wrapper = node.closest('[data-test-render-count]');
	if (!wrapper) return [];

	const thumbnails = Array.from(wrapper.querySelectorAll(FILE_THUMBNAIL_SELECTOR));
	if (thumbnails.length === 0) return [];

	const entries = thumbnails
		.map((thumb) => {
			const name = normalizeInlineText(thumb.querySelector('h3')?.textContent ?? '');
			const type = normalizeInlineText(thumb.querySelector('p')?.textContent ?? '');
			if (!name && !type) return '';
			if (type) return `${escapeMarkdown(name || 'Attachment')} (${escapeMarkdown(type)})`;
			return escapeMarkdown(name || 'Attachment');
		})
		.filter((entry) => entry.length > 0);

	return uniqueStrings(entries);
}

function extractAssistantMarkdown(node: Element): string {
	const blocks = collectMarkdownBlocks(node);
	const markdownChunks: string[] = [];

	if (blocks.length > 0) {
		const seen = new Set<string>();
		for (const block of blocks) {
			const sanitized = sanitizeElement(block, {
				removeSelectors: SANITIZE_SELECTORS,
			});
			const markdown = convertNodeToMarkdown(sanitized).trim();
			if (!markdown || seen.has(markdown)) continue;
			seen.add(markdown);
			markdownChunks.push(markdown);
		}
	} else {
		const source = getMessageSource(node, false);
		const sanitized = sanitizeElement(source, {
			removeSelectors: SANITIZE_SELECTORS,
		});
		const markdown = convertNodeToMarkdown(sanitized).trim();
		if (markdown) markdownChunks.push(markdown);
	}

	const artifacts = extractArtifactEntries(node);
	const artifactSection = formatListSection('Artifacts', artifacts);
	if (artifactSection) markdownChunks.push(artifactSection);

	return markdownChunks.join('\n\n').trimEnd();
}

function extractUserMarkdown(node: Element): string {
	const sanitized = sanitizeElement(node, {
		removeSelectors: SANITIZE_SELECTORS,
	});
	const markdownChunks: string[] = [];
	const markdown = convertNodeToMarkdown(sanitized).trim();
	if (markdown) markdownChunks.push(markdown);

	const attachments = extractUserAttachments(node);
	const attachmentSection = formatListSection('Attachments', attachments);
	if (attachmentSection) markdownChunks.push(attachmentSection);

	return markdownChunks.join('\n\n').trimEnd();
}

function processMessageCandidate(node: Element): Message | null {
	if (isSystemMessage(node)) return null;
	const isUser = node.matches(USER_SELECTOR);
	const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
	const markdown = isUser ? extractUserMarkdown(node) : extractAssistantMarkdown(node);

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
