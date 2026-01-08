import { describe, expect, test } from 'bun:test';

import { composeMarkdown } from '@/parsers/markdown';
import type { Message } from '@/types';

describe('composeMarkdown', () => {
	test('creates markdown with title as h1', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test Chat', 'chatgpt', 'https://chatgpt.com/c/123');
		expect(result.startsWith('# Test Chat\n')).toBe(true);
	});

	test('includes platform name in metadata', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://chatgpt.com/c/123');
		expect(result).toContain('Exported from ChatGPT');
	});

	test('includes Claude platform name', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test', 'claude', 'https://claude.ai/chat/123');
		expect(result).toContain('Exported from Claude');
	});

	test('includes URL in metadata', () => {
		const url = 'https://chatgpt.com/c/abc123';
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', url);
		expect(result).toContain(`URL: ${url}`);
	});

	test('formats user messages with User label', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello there' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result).toContain('**User:**');
		expect(result).toContain('Hello there');
	});

	test('formats assistant messages with Assistant label', () => {
		const messages: Message[] = [{ role: 'assistant', markdown: 'Hi!' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result).toContain('**Assistant:**');
		expect(result).toContain('Hi!');
	});

	test('handles multiple messages', () => {
		const messages: Message[] = [
			{ role: 'user', markdown: 'Question' },
			{ role: 'assistant', markdown: 'Answer' },
			{ role: 'user', markdown: 'Follow up' },
		];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result).toContain('Question');
		expect(result).toContain('Answer');
		expect(result).toContain('Follow up');
	});

	test('adds separator between messages', () => {
		const messages: Message[] = [
			{ role: 'user', markdown: 'Q1' },
			{ role: 'assistant', markdown: 'A1' },
		];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result).toContain('---');
	});

	test('does not end with separator', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result.trimEnd().endsWith('---')).toBe(false);
	});

	test('handles empty message content', () => {
		const messages: Message[] = [{ role: 'user', markdown: '' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result).toContain('_No content available._');
	});

	test('uses default title when empty', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, '', 'chatgpt', 'https://example.com');
		expect(result).toContain('# AI Conversation');
	});

	test('ends with newline', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result.endsWith('\n')).toBe(true);
	});

	test('includes ISO timestamp', () => {
		const messages: Message[] = [{ role: 'user', markdown: 'Hello' }];
		const result = composeMarkdown(messages, 'Test', 'chatgpt', 'https://example.com');
		expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});
});
