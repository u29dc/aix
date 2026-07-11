import type { Message } from '@/types';
import { escapeMarkdown, pickFence } from '@/utils/markdown';

export interface ChatGPTTurnShell {
	id: string;
	role: 'user' | 'assistant';
}

export interface ChatGPTApiExtractionOptions {
	conversationId: string;
	shells: ChatGPTTurnShell[];
	fetcher?: typeof fetch;
}

interface ChatGPTApiMessage {
	id?: unknown;
	author?: unknown;
	content?: unknown;
	metadata?: unknown;
}

interface ChatGPTApiNode {
	id?: unknown;
	parent?: unknown;
	message?: ChatGPTApiMessage;
}

interface BranchNode {
	key: string;
	node: ChatGPTApiNode;
}

interface FormattedApiMessage {
	message: Message | null;
	supported: boolean;
}

const HIDDEN_CONTENT_TYPES = new Set([
	'execution_output',
	'model_editable_context',
	'reasoning_recap',
	'thoughts',
	'user_editable_context',
]);

export class ChatGPTApiUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ChatGPTApiUnavailableError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	return value.trim() ? value : null;
}

function getField(record: Record<string, unknown>, key: string): unknown {
	return record[key];
}

async function requestJson(
	fetcher: typeof fetch,
	input: string,
	init: RequestInit,
	label: string,
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetcher(input, init);
	} catch {
		throw new ChatGPTApiUnavailableError(`${label} request failed.`);
	}

	if (!response.ok) {
		throw new ChatGPTApiUnavailableError(`${label} request returned HTTP ${response.status}.`);
	}

	try {
		return await response.json();
	} catch {
		throw new ChatGPTApiUnavailableError(`${label} response was not valid JSON.`);
	}
}

async function fetchConversation(
	fetcher: typeof fetch,
	conversationId: string,
): Promise<Record<string, unknown>> {
	const sessionValue = await requestJson(
		fetcher,
		'/api/auth/session',
		{
			credentials: 'same-origin',
			headers: { Accept: 'application/json' },
		},
		'ChatGPT session',
	);
	if (!isRecord(sessionValue)) {
		throw new ChatGPTApiUnavailableError('ChatGPT session response had an unexpected shape.');
	}

	const accountValue = getField(sessionValue, 'account');
	const accessToken = getNonEmptyString(getField(sessionValue, 'accessToken'));
	const account = isRecord(accountValue) ? accountValue : null;
	const accountId = account ? getNonEmptyString(getField(account, 'id')) : null;
	if (!accessToken || !accountId) {
		throw new ChatGPTApiUnavailableError('ChatGPT session credentials were unavailable.');
	}

	const conversationValue = await requestJson(
		fetcher,
		`/backend-api/conversation/${encodeURIComponent(conversationId)}`,
		{
			credentials: 'same-origin',
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${accessToken}`,
				'ChatGPT-Account-ID': accountId,
			},
		},
		'ChatGPT conversation',
	);
	if (!isRecord(conversationValue)) {
		throw new ChatGPTApiUnavailableError('ChatGPT conversation response had an unexpected shape.');
	}

	return conversationValue;
}

function formatText(value: string, role: ChatGPTTurnShell['role']): string {
	const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
	if (!normalized) return '';
	return role === 'user' ? escapeMarkdown(normalized) : normalized;
}

function resolveFileCitations(
	value: string,
	metadataValue: unknown,
	role: ChatGPTTurnShell['role'],
): string | null {
	if (!/[\uE000-\uF8FF]/u.test(value)) return value;
	if (!isRecord(metadataValue)) return null;
	const citations = getField(metadataValue, 'citations');
	if (!Array.isArray(citations)) return null;

	const replacements: Array<{ start: number; end: number; value: string }> = [];
	for (const citation of citations) {
		if (!isRecord(citation)) return null;
		const start = getField(citation, 'start_ix');
		const end = getField(citation, 'end_ix');
		const citationMetadata = getField(citation, 'metadata');
		if (
			typeof start !== 'number' ||
			typeof end !== 'number' ||
			!Number.isInteger(start) ||
			!Number.isInteger(end) ||
			start < 0 ||
			end <= start ||
			end > value.length ||
			!isRecord(citationMetadata)
		) {
			return null;
		}
		const name = getNonEmptyString(getField(citationMetadata, 'name'));
		if (!name || !/[\uE000-\uF8FF]/u.test(value.slice(start, end))) return null;
		const label = role === 'assistant' ? `[Source: ${escapeMarkdown(name)}]` : `Source: ${name}`;
		replacements.push({ start, end, value: label });
	}

	let output = value;
	for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
		output = `${output.slice(0, replacement.start)}${replacement.value}${output.slice(replacement.end)}`;
	}
	return /[\uE000-\uF8FF]/u.test(output) ? null : output;
}

function formatParts(
	parts: unknown,
	metadata: unknown,
	role: ChatGPTTurnShell['role'],
): string | null {
	if (!Array.isArray(parts)) return null;
	const chunks: string[] = [];

	for (const part of parts) {
		if (typeof part === 'string') {
			if (part.trim()) chunks.push(part);
			continue;
		}

		if (!isRecord(part)) return null;
		const text = getNonEmptyString(getField(part, 'text'));
		if (!text) return null;
		chunks.push(text);
	}

	const resolved = resolveFileCitations(chunks.join('\n\n'), metadata, role);
	return resolved === null ? null : formatText(resolved, role);
}

function formatCode(content: Record<string, unknown>): string | null {
	const text = getNonEmptyString(getField(content, 'text'));
	if (!text) return null;
	const language =
		getNonEmptyString(getField(content, 'language'))?.replace(/[^a-z0-9_+#.-]/gi, '') ?? '';
	const fence = pickFence(text);
	return `${fence}${language}\n${text.trimEnd()}\n${fence}`;
}

function formatContent(
	contentValue: unknown,
	metadata: unknown,
	role: ChatGPTTurnShell['role'],
): { markdown: string; supported: boolean } {
	if (!isRecord(contentValue)) return { markdown: '', supported: false };
	const contentType = getNonEmptyString(getField(contentValue, 'content_type'));

	switch (contentType) {
		case 'text':
		case 'multimodal_text': {
			const markdown = formatParts(getField(contentValue, 'parts'), metadata, role);
			return markdown === null ? { markdown: '', supported: false } : { markdown, supported: true };
		}
		case 'code': {
			const markdown = formatCode(contentValue);
			return markdown === null ? { markdown: '', supported: false } : { markdown, supported: true };
		}
		case 'tether_browsing_display': {
			const summary =
				getNonEmptyString(getField(contentValue, 'summary')) ??
				getNonEmptyString(getField(contentValue, 'result'));
			return summary
				? { markdown: formatText(summary, role), supported: true }
				: { markdown: '', supported: false };
		}
		default:
			return { markdown: '', supported: false };
	}
}

function formatAttachmentEntries(metadataValue: unknown): string[] {
	if (!isRecord(metadataValue)) return [];
	const attachments = getField(metadataValue, 'attachments');
	if (!Array.isArray(attachments)) return [];
	const entries: string[] = [];
	const seen = new Set<string>();

	for (const attachment of attachments) {
		if (!isRecord(attachment)) continue;
		const name = getNonEmptyString(getField(attachment, 'name'));
		if (!name) continue;
		const mimeType = getNonEmptyString(getField(attachment, 'mime_type'));
		const entry = mimeType
			? `${escapeMarkdown(name)} (${escapeMarkdown(mimeType)})`
			: escapeMarkdown(name);
		if (seen.has(entry)) continue;
		seen.add(entry);
		entries.push(entry);
	}

	return entries;
}

function formatApiMessage(
	message: ChatGPTApiMessage,
	role: ChatGPTTurnShell['role'],
): FormattedApiMessage {
	const content = formatContent(message.content, message.metadata, role);
	if (!content.supported) return { message: null, supported: false };

	const chunks: string[] = [];
	if (content.markdown.trim()) chunks.push(content.markdown.trimEnd());

	const attachmentEntries = formatAttachmentEntries(message.metadata);
	if (attachmentEntries.length > 0) {
		const label = role === 'user' ? 'Attachments' : 'Artifacts';
		chunks.push(`**${label}:**\n${attachmentEntries.map((entry) => `- ${entry}`).join('\n')}`);
	}

	const markdown = chunks.join('\n\n').trimEnd();
	return { message: markdown ? { role, markdown } : null, supported: true };
}

function getConversationMapping(value: Record<string, unknown>): Record<string, ChatGPTApiNode> {
	const mappingValue = getField(value, 'mapping');
	if (!isRecord(mappingValue)) {
		throw new ChatGPTApiUnavailableError('ChatGPT conversation mapping was unavailable.');
	}

	const mapping: Record<string, ChatGPTApiNode> = {};
	for (const [key, node] of Object.entries(mappingValue)) {
		if (isRecord(node)) mapping[key] = node as ChatGPTApiNode;
	}
	return mapping;
}

function buildCurrentBranch(
	conversation: Record<string, unknown>,
	mapping: Record<string, ChatGPTApiNode>,
): BranchNode[] {
	let key = getNonEmptyString(getField(conversation, 'current_node'));
	if (!key) {
		throw new ChatGPTApiUnavailableError('ChatGPT current conversation branch was unavailable.');
	}

	const reversed: BranchNode[] = [];
	const visited = new Set<string>();
	while (key && !visited.has(key)) {
		const node = mapping[key];
		if (!node) {
			throw new ChatGPTApiUnavailableError('ChatGPT current branch referenced a missing node.');
		}
		visited.add(key);
		reversed.push({ key, node });
		key = getNonEmptyString(node.parent);
	}

	return reversed.reverse();
}

function indexBranch(branch: BranchNode[]): Map<string, number> {
	const output = new Map<string, number>();
	for (const [index, entry] of branch.entries()) {
		output.set(entry.key, index);
		const nodeId = getNonEmptyString(entry.node.id);
		if (nodeId) output.set(nodeId, index);
		const messageId = getNonEmptyString(entry.node.message?.id);
		if (messageId) output.set(messageId, index);
	}
	return output;
}

function getMessageAuthorRole(message: ChatGPTApiMessage): string | null {
	if (!isRecord(message.author)) return null;
	return getNonEmptyString(getField(message.author, 'role'));
}

function getContentType(message: ChatGPTApiMessage): string | null {
	if (!isRecord(message.content)) return null;
	return getNonEmptyString(getField(message.content, 'content_type'));
}

function shouldSkipMessage(message: ChatGPTApiMessage): boolean {
	if (!isRecord(message.metadata)) return false;
	return (
		getField(message.metadata, 'is_visually_hidden_from_conversation') === true ||
		getField(message.metadata, 'is_thinking_preamble_message') === true ||
		getField(message.metadata, 'is_user_system_message') === true
	);
}

function formatShellSegment(segment: BranchNode[], shell: ChatGPTTurnShell): Message {
	const chunks: string[] = [];
	for (const entry of segment) {
		const apiMessage = entry.node.message;
		if (!apiMessage || getMessageAuthorRole(apiMessage) !== shell.role) continue;
		if (shouldSkipMessage(apiMessage)) continue;

		const contentType = getContentType(apiMessage);
		if (contentType && HIDDEN_CONTENT_TYPES.has(contentType)) continue;

		const formatted = formatApiMessage(apiMessage, shell.role);
		if (!formatted.supported) {
			throw new ChatGPTApiUnavailableError(
				'ChatGPT API response contained an unsupported visible turn.',
			);
		}
		if (formatted.message) chunks.push(formatted.message.markdown);
	}

	const markdown = chunks.join('\n\n').trimEnd();
	if (!markdown) {
		throw new ChatGPTApiUnavailableError('ChatGPT API response omitted a visible turn.');
	}
	return { role: shell.role, markdown };
}

export async function extractChatGPTConversationFromApi(
	options: ChatGPTApiExtractionOptions,
): Promise<Message[]> {
	const { conversationId, shells } = options;
	if (!conversationId || shells.length === 0) {
		throw new ChatGPTApiUnavailableError('ChatGPT API export prerequisites were unavailable.');
	}
	if (new Set(shells.map((shell) => shell.id)).size !== shells.length) {
		throw new ChatGPTApiUnavailableError('ChatGPT turn identifiers were not unique.');
	}

	const fetcher = options.fetcher ?? window.fetch.bind(window);
	const conversation = await fetchConversation(fetcher, conversationId);
	const mapping = getConversationMapping(conversation);
	const branch = buildCurrentBranch(conversation, mapping);
	const branchIndex = indexBranch(branch);
	const shellIndexes = shells.map((shell) => branchIndex.get(shell.id));
	if (shellIndexes.some((index) => index === undefined)) {
		throw new ChatGPTApiUnavailableError('ChatGPT API response omitted a visible turn.');
	}
	for (let index = 1; index < shellIndexes.length; index += 1) {
		if ((shellIndexes[index] ?? -1) <= (shellIndexes[index - 1] ?? -1)) {
			throw new ChatGPTApiUnavailableError(
				'ChatGPT visible turn order did not match the API branch.',
			);
		}
	}

	const messages: Message[] = [];
	for (const [index, shell] of shells.entries()) {
		const start = shellIndexes[index] as number;
		const end = shellIndexes[index + 1] ?? branch.length;
		messages.push(formatShellSegment(branch.slice(start, end), shell));
	}

	return messages;
}
