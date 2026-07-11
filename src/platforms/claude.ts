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
const MARKDOWN_BLOCK_SELECTORS = [
	'.standard-markdown',
	'.standard-markdown_',
	'.progressive-markdown',
	'.progressive-markdown_',
	'.markdown',
	'.prose',
].join(', ');
const LEGACY_ARTIFACT_CARD_SELECTOR = '[aria-label="Preview contents"]';
const ARTIFACT_BUTTON_SELECTOR = 'button[aria-label*="Open artifact"]';
const FILE_THUMBNAIL_SELECTOR = '[data-testid="file-thumbnail"]';
const MESSAGE_ACTIONS_SELECTOR = '[aria-label="Message actions"]';
const THINKING_STATUS_SELECTOR = 'button[aria-expanded]';
const COLLAPSED_THINKING_SELECTOR = `${CLAUDE_SELECTORS.assistantMessage.primary} ${THINKING_STATUS_SELECTOR}[aria-expanded="false"]`;

function isSystemMessage(node: Element): boolean {
	return node.closest('[data-message-author-role="system"]') !== null;
}

function normalizeInlineText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function looksLikeTimestamp(value: string): boolean {
	if (!value) return false;
	return (
		/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(value) ||
		/^\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:z|[+-]\d{2}:?\d{2})?)?$/i.test(
			value,
		) ||
		/\b\d{1,2}:\d{2}(?:\s?[ap]m)?\b/i.test(value) ||
		/^(today|yesterday)$/i.test(value)
	);
}

function extractMessageTimestamp(node: Element): string | undefined {
	const wrapper = node.closest('[data-test-render-count]') ?? node.parentElement;
	if (!wrapper) return undefined;

	const actions = wrapper.querySelector(MESSAGE_ACTIONS_SELECTOR);
	if (!actions) return undefined;

	const dateTimeAttr = normalizeInlineText(
		actions.querySelector('time[datetime]')?.getAttribute('datetime') ?? '',
	);
	if (dateTimeAttr) return dateTimeAttr;

	const timeText = normalizeInlineText(actions.querySelector('time')?.textContent ?? '');
	if (looksLikeTimestamp(timeText)) return timeText;

	const spans = Array.from(actions.querySelectorAll('span'));
	for (const span of spans) {
		const text = normalizeInlineText(span.textContent ?? '');
		if (looksLikeTimestamp(text)) return text;
	}

	return undefined;
}

function fillMissingTimestamps(messages: Message[]): void {
	let previousTimestamp: string | undefined;
	for (const message of messages) {
		if (message.timestamp) {
			previousTimestamp = message.timestamp;
			continue;
		}
		if (previousTimestamp) {
			message.timestamp = previousTimestamp;
		}
	}

	let nextTimestamp: string | undefined;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message) continue;
		if (message.timestamp) {
			nextTimestamp = message.timestamp;
			continue;
		}
		if (nextTimestamp) {
			message.timestamp = nextTimestamp;
		}
	}
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
	return elements.filter(
		(element) => !elements.some((other) => other !== element && element.contains(other)),
	);
}

function isWithinThinkingPanel(element: Element): boolean {
	for (let current: Element | null = element; current; current = current.parentElement) {
		if (!current.classList.contains('overflow-hidden')) continue;
		const section = current.closest('.min-w-0.pl-2.py-1\\.5');
		if (section?.querySelector(THINKING_STATUS_SELECTOR)) return true;
	}

	return false;
}

function collectMarkdownBlocks(node: Element): Element[] {
	const blocks = Array.from(node.querySelectorAll(MARKDOWN_BLOCK_SELECTORS)).filter(
		(block) => !isWithinThinkingPanel(block),
	);
	if (blocks.length === 0) return [];
	const standardBlocks = blocks.filter(
		(block) =>
			block.classList.contains('standard-markdown') ||
			block.classList.contains('standard-markdown_'),
	);
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

function extractArtifactLabel(button: Element): string {
	const ariaLabel = normalizeInlineText(button.getAttribute('aria-label') ?? '');
	if (!ariaLabel) return '';

	return ariaLabel
		.replace(/\.\s*open artifact\.?$/i, '')
		.replace(/\s+open artifact\.?$/i, '')
		.trim();
}

function extractArtifactEntries(node: Element): string[] {
	const entries: string[] = [];

	for (const card of Array.from(node.querySelectorAll(LEGACY_ARTIFACT_CARD_SELECTOR))) {
		const { title, meta } = extractCardTitleAndMeta(card);
		if (!title) continue;
		entries.push(formatArtifactEntry(title, meta));
	}

	for (const button of Array.from(node.querySelectorAll(ARTIFACT_BUTTON_SELECTOR))) {
		const card = button.parentElement ?? button;
		const { title: cardTitle, meta } = extractCardTitleAndMeta(card);
		const title = cardTitle || extractArtifactLabel(button);
		if (!title) continue;
		entries.push(formatArtifactEntry(title, meta));
	}

	return uniqueStrings(entries);
}

function extractThinkingSummaries(node: Element): string[] {
	const summaries = Array.from(node.querySelectorAll(THINKING_STATUS_SELECTOR))
		.map((button) => {
			const buttonText = normalizeInlineText(button.textContent ?? '');
			if (buttonText) return buttonText;

			const statusText = normalizeInlineText(
				button.parentElement?.querySelector('[role="status"]')?.textContent ?? '',
			);
			return statusText;
		})
		.filter((summary) => summary.length > 0);

	return uniqueStrings(summaries);
}

function stripThinkingOnlyNodes(root: Element): void {
	for (const image of Array.from(root.querySelectorAll('img, picture, source'))) {
		image.remove();
	}

	for (const link of Array.from(root.querySelectorAll('a'))) {
		link.remove();
	}
}

function cleanThinkingMarkdown(markdown: string): string {
	const paragraphs = markdown
		.split(/\n{2,}/)
		.map((paragraph) =>
			paragraph
				.replace(/!\[[^\]]*]\([^)]+\)/g, '')
				.replace(/\[[^\]]+]\([^)]+\)/g, '')
				.replace(/(?:^|\s)Done\.?(?=$|\s)/g, ' ')
				.replace(/[ \t]+\n/g, '\n')
				.replace(/\n{3,}/g, '\n\n')
				.trim(),
		)
		.filter((paragraph) => paragraph.length > 0 && !/^Done\.?$/i.test(paragraph));

	return uniqueStrings(paragraphs).join('\n\n');
}

function extractExpandedThinkingDetails(node: Element): string[] {
	const details: string[] = [];

	for (const button of Array.from(node.querySelectorAll(THINKING_STATUS_SELECTOR))) {
		const section = button.closest('.min-w-0.pl-2.py-1\\.5') ?? button.parentElement?.parentElement;
		if (!section) continue;

		const panel = Array.from(section.children).find(
			(child) =>
				child !== button &&
				!child.matches('[role="status"]') &&
				child.querySelector('.overflow-hidden') !== null,
		);
		if (!panel) continue;

		const contentRoot = panel.querySelector('.overflow-hidden');
		if (!contentRoot) continue;

		const sanitized = sanitizeElement(contentRoot, {
			removeSelectors: SANITIZE_SELECTORS,
		});
		stripThinkingOnlyNodes(sanitized);
		const markdown = cleanThinkingMarkdown(convertNodeToMarkdown(sanitized).trim());
		if (!markdown) continue;

		details.push(markdown);
	}

	return uniqueStrings(details);
}

function waitForNextFrame(): Promise<void> {
	return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

/**
 * Expand Claude thinking/status panels before extraction so visible inner reasoning
 * and progress outlines are captured when Claude lazily renders them on open.
 */
export async function prepareClaudeConversationForExport(): Promise<Message[] | undefined> {
	const root = findChatRoot();
	const buttons = Array.from(root.querySelectorAll(COLLAPSED_THINKING_SELECTOR));
	if (buttons.length === 0) return undefined;

	for (const button of buttons) {
		if (!(button instanceof HTMLElement)) continue;
		button.click();
	}

	// Claude mounts panel content after the toggle; wait for the DOM to settle.
	await waitForNextFrame();
	await waitForNextFrame();
	await new Promise((resolve) => window.setTimeout(resolve, 75));
	return undefined;
}

function parseAttachmentAriaLabel(label: string): { title: string; meta: string } {
	const parts = label
		.split(',')
		.map((part) => normalizeInlineText(part))
		.filter((part) => part.length > 0);

	const [title = '', ...metaParts] = parts;
	return { title, meta: metaParts.join(', ') };
}

function extractUserAttachments(node: Element): string[] {
	const wrapper = node.closest('[data-test-render-count]');
	if (!wrapper) return [];

	const thumbnails = Array.from(wrapper.querySelectorAll(FILE_THUMBNAIL_SELECTOR));
	if (thumbnails.length === 0) return [];

	const entries = thumbnails
		.map((thumb) => {
			const button = thumb.querySelector('button[aria-label]');
			const parsedLabel = parseAttachmentAriaLabel(
				normalizeInlineText(button?.getAttribute('aria-label') ?? ''),
			);
			if (parsedLabel.title) {
				return formatArtifactEntry(parsedLabel.title, parsedLabel.meta);
			}

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
	const markdownChunks: string[] = [];
	const thinking = extractThinkingSummaries(node);
	const thinkingSection = formatListSection('Thinking', thinking);
	if (thinkingSection) markdownChunks.push(thinkingSection);

	const thinkingDetails = extractExpandedThinkingDetails(node);
	markdownChunks.push(...thinkingDetails);

	const blocks = collectMarkdownBlocks(node);

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
	const wrapper = node.closest('[data-test-render-count]');
	if (!isUser && !wrapper && !node.matches(CLAUDE_SELECTORS.assistantMessage.primary)) {
		return null;
	}

	const role: 'user' | 'assistant' = isUser ? 'user' : 'assistant';
	const markdown = isUser ? extractUserMarkdown(node) : extractAssistantMarkdown(node);
	const timestamp = extractMessageTimestamp(node);

	if (!markdown.trim()) {
		if (isStreamingMessage(node)) {
			if (timestamp) {
				return { role, markdown: '> [Message is still streaming and was skipped]', timestamp };
			}
			return { role, markdown: '> [Message is still streaming and was skipped]' };
		}
		return null;
	}

	if (timestamp) {
		return { role, markdown, timestamp };
	}

	return { role, markdown };
}

/**
 * Extract conversation messages from Claude DOM
 */
export function extractClaudeConversation(): Message[] {
	const root = findChatRoot();
	const candidates = Array.from(root.querySelectorAll(MESSAGE_SELECTOR)).filter(
		(node) => node.parentElement?.closest(MESSAGE_SELECTOR) === null,
	);
	const messages: Message[] = [];

	for (const node of candidates) {
		const message = processMessageCandidate(node);
		if (message) messages.push(message);
	}

	fillMissingTimestamps(messages);

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
	prepareForExport: prepareClaudeConversationForExport,
	extractConversation: extractClaudeConversation,
	deriveTitle: deriveClaudeTitle,
	isEligibleConversation: isEligibleClaudeConversation,
};
