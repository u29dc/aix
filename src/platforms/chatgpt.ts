import { BUTTON_ID, CHATGPT_BUTTON_CLASS_FALLBACK, SANITIZE_SELECTORS } from '@/constants';
import { convertNodeToMarkdown } from '@/parsers';
import { sanitizeElement } from '@/parsers/sanitizer';
import {
	ChatGPTApiUnavailableError,
	extractChatGPTConversationFromApi,
	type ChatGPTTurnShell,
} from '@/platforms/chatgpt-api';
import {
	buildCombinedSelector,
	CHATGPT_SELECTORS,
	querySelector,
	querySelectorAll,
} from '@/platforms/selectors';
import type { PlatformConfig } from '@/platforms/types';
import type { Message } from '@/types';
import { createButton } from '@/ui/button';
import { escapeMarkdown } from '@/utils/markdown';

const CHATGPT_HOST_REGEX = /(^|\.)chatgpt\.com$/i;
const OPENAI_CHAT_HOST_REGEX = /(^|\.)chat\.openai\.com$/i;

const CHATGPT_SANITIZE_SELECTORS = SANITIZE_SELECTORS.filter(
	(selector) => selector !== 'input' && selector !== '[role="img"]',
);

const TURN_SELECTOR = buildCombinedSelector(CHATGPT_SELECTORS.conversationTurn);
const USER_SELECTOR = buildCombinedSelector(CHATGPT_SELECTORS.userMessage);
const ASSISTANT_SELECTOR = buildCombinedSelector(CHATGPT_SELECTORS.assistantMessage);
const CHATGPT_ASSISTANT_BLOCK_SELECTOR = '.markdown, .prose, [data-message-content]';
const CHATGPT_USER_BLOCK_SELECTOR =
	'.whitespace-pre-wrap, .markdown, .prose, [data-message-content]';
const DEFAULT_HYDRATION_TIMEOUT_MS = 3000;
const DEFAULT_HYDRATION_POLL_INTERVAL_MS = 40;

interface ChatGPTPreparationOptions {
	hydrationTimeoutMs?: number;
	pollIntervalMs?: number;
	fetcher?: typeof fetch;
}

interface PreparedMessage {
	message: Message;
}

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
	return elements.filter(
		(element) => !elements.some((other) => other !== element && element.contains(other)),
	);
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
	const candidates = Array.from(turn.querySelectorAll(CHATGPT_ASSISTANT_BLOCK_SELECTOR));
	if (candidates.length === 0) return [];

	const filtered = candidates.filter((element) => {
		const closestMarkdown = element.closest('.markdown');
		if (
			element.classList.contains('prose') &&
			closestMarkdown !== null &&
			closestMarkdown !== element
		) {
			return false;
		}
		return true;
	});

	return selectInnermost(filtered);
}

function extractFileCards(root: Element): string[] {
	const links = Array.from(root.querySelectorAll('a[target="_blank"]'));
	const entries: string[] = [];

	for (const link of links) {
		const name = normalizeInlineText(
			link.querySelector('.truncate.font-semibold')?.textContent ?? '',
		);
		if (!name) continue;
		const type = normalizeInlineText(
			link.querySelector('.text-token-text-secondary.truncate')?.textContent ?? '',
		);
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
	const blocks = collectMessageBlocks(message, CHATGPT_USER_BLOCK_SELECTOR);
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

function extractTurnMessage(turn: Element): Message | null {
	const role = deriveRole(turn);
	if (!role) return null;

	const markdown = role === 'user' ? extractUserMarkdown(turn) : extractAssistantMarkdown(turn);
	if (!markdown.trim()) return null;

	return { role, markdown };
}

function getTurnKey(turn: Element, index: number): string {
	return (
		turn.getAttribute('data-turn-id') ??
		turn.getAttribute('data-testid') ??
		`conversation-turn-${index}`
	);
}

function getConversationId(pathname: string): string | null {
	const match = pathname.match(/\/c\/([^/]+)/i);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getOrderedTurnShells(turns: Element[]): ChatGPTTurnShell[] | null {
	const shells: ChatGPTTurnShell[] = [];
	for (const turn of turns) {
		const id = turn.getAttribute('data-turn-id');
		const role = deriveRole(turn);
		if (!id || !role) return null;
		shells.push({ id, role });
	}
	return shells;
}

function hasSameTurnShells(expected: ChatGPTTurnShell[]): boolean {
	const currentTurns = querySelectorAll(document, CHATGPT_SELECTORS.conversationTurn);
	const current = getOrderedTurnShells(currentTurns);
	if (!current || current.length !== expected.length) return false;
	return current.every(
		(shell, index) => shell.id === expected[index]?.id && shell.role === expected[index]?.role,
	);
}

function collectHydratedMessages(turns: Element[], prepared: Map<string, PreparedMessage>): void {
	for (const [index, turn] of turns.entries()) {
		const key = getTurnKey(turn, index);
		if (prepared.has(key)) continue;
		if (turn.childElementCount === 0) continue;

		const message = extractTurnMessage(turn);
		if (message) prepared.set(key, { message });
	}
}

function findScrollableAncestor(turn: Element): HTMLElement | null {
	let current = turn.parentElement;
	while (current) {
		const overflowY = window.getComputedStyle(current).overflowY;
		if (/(auto|scroll)/i.test(overflowY) && current.scrollHeight > current.clientHeight) {
			return current;
		}
		current = current.parentElement;
	}

	return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
}

function wait(delay: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, delay));
}

async function waitForTurnHydration(
	turns: Element[],
	targetKey: string,
	prepared: Map<string, PreparedMessage>,
	timeoutMs: number,
	pollIntervalMs: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	do {
		collectHydratedMessages(turns, prepared);
		if (prepared.has(targetKey)) {
			// Neighbouring turns can mount just after the target. Give that batch one
			// final opportunity to settle before moving the virtualized viewport.
			await wait(pollIntervalMs);
			collectHydratedMessages(turns, prepared);
			return true;
		}
		await wait(pollIntervalMs);
	} while (Date.now() < deadline);

	collectHydratedMessages(turns, prepared);
	return prepared.has(targetKey);
}

/**
 * Hydrate ChatGPT's virtualized turn shells and snapshot each message before it
 * can be unmounted again. The snapshot is returned directly to the export flow
 * and is never persisted in module state.
 */
async function prepareChatGPTConversationViaDom(
	options: ChatGPTPreparationOptions = {},
): Promise<Message[]> {
	const turns = querySelectorAll(document, CHATGPT_SELECTORS.conversationTurn);
	if (turns.length === 0) return extractChatGPTConversation();
	const conversationUrl = window.location.href;
	const turnKeys = turns.map((turn, index) => getTurnKey(turn, index));

	const prepared = new Map<string, PreparedMessage>();
	collectHydratedMessages(turns, prepared);

	if (prepared.size === turns.length) {
		return turns
			.map((turn, index) => prepared.get(getTurnKey(turn, index))?.message)
			.filter((message): message is Message => message !== undefined);
	}

	const scrollContainer = findScrollableAncestor(turns[0] as Element);
	if (!scrollContainer) {
		throw new Error('ChatGPT conversation scroller was not found. Export cancelled.');
	}

	const originalScrollTop = scrollContainer.scrollTop;
	const originalMaxScrollTop = Math.max(
		0,
		scrollContainer.scrollHeight - scrollContainer.clientHeight,
	);
	const wasAtBottom = originalMaxScrollTop - originalScrollTop <= 2;
	const hydrationTimeoutMs = options.hydrationTimeoutMs ?? DEFAULT_HYDRATION_TIMEOUT_MS;
	const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_HYDRATION_POLL_INTERVAL_MS;

	try {
		for (const [index, turn] of turns.entries()) {
			const key = getTurnKey(turn, index);
			if (prepared.has(key)) continue;
			if (window.location.href !== conversationUrl || !turn.isConnected) {
				throw new Error('ChatGPT conversation changed during export. Export cancelled.');
			}

			turn.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
			const hydrated = await waitForTurnHydration(
				turns,
				key,
				prepared,
				hydrationTimeoutMs,
				pollIntervalMs,
			);
			if (!hydrated) {
				throw new Error(
					`ChatGPT did not load turn ${index + 1} of ${turns.length}. Export cancelled to avoid a partial file.`,
				);
			}
		}

		const messages = turns.map((turn, index) => prepared.get(getTurnKey(turn, index))?.message);
		const currentTurns = querySelectorAll(document, CHATGPT_SELECTORS.conversationTurn);
		const currentTurnKeys = currentTurns.map((turn, index) => getTurnKey(turn, index));
		if (
			window.location.href !== conversationUrl ||
			currentTurnKeys.length !== turnKeys.length ||
			currentTurnKeys.some((key, index) => key !== turnKeys[index])
		) {
			throw new Error('ChatGPT conversation changed during export. Export cancelled.');
		}
		if (messages.some((message) => message === undefined)) {
			throw new Error('ChatGPT did not load every conversation turn. Export cancelled.');
		}

		return messages.filter((message): message is Message => message !== undefined);
	} finally {
		scrollContainer.scrollTop = wasAtBottom
			? Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
			: originalScrollTop;
	}
}

/**
 * Prefer ChatGPT's complete same-origin conversation response, using the DOM's
 * lightweight turn shells as the authoritative order and role manifest. Fall
 * back to progressive DOM hydration when the private API or its schema changes.
 */
export async function prepareChatGPTConversationForExport(
	options: ChatGPTPreparationOptions = {},
): Promise<Message[]> {
	const turns = querySelectorAll(document, CHATGPT_SELECTORS.conversationTurn);
	if (turns.length === 0) return extractChatGPTConversation();

	const conversationUrl = window.location.href;
	const conversationId = getConversationId(window.location.pathname);
	const shells = getOrderedTurnShells(turns);
	if (conversationId && shells) {
		try {
			const messages = await extractChatGPTConversationFromApi({
				conversationId,
				shells,
				...(options.fetcher ? { fetcher: options.fetcher } : {}),
			});
			if (window.location.href !== conversationUrl || !hasSameTurnShells(shells)) {
				throw new Error('ChatGPT conversation changed during export. Export cancelled.');
			}
			return messages;
		} catch (error) {
			if (!(error instanceof ChatGPTApiUnavailableError)) throw error;
		}
	}

	return prepareChatGPTConversationViaDom(options);
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
		const message = extractTurnMessage(turn);
		if (message) messages.push(message);
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
	prepareForExport: prepareChatGPTConversationForExport,
	extractConversation: extractChatGPTConversation,
	deriveTitle: deriveChatGPTTitle,
	isEligibleConversation: isEligibleChatGPTConversation,
};
