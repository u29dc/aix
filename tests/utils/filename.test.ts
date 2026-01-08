import { describe, expect, test } from 'bun:test';

import { buildFilename } from '@/utils/filename';

describe('buildFilename', () => {
	test('generates filename with platform prefix', () => {
		const filename = buildFilename('Test Chat', 'chatgpt');
		expect(filename.startsWith('chatgpt-chat-')).toBe(true);
	});

	test('generates filename for claude platform', () => {
		const filename = buildFilename('Test Chat', 'claude');
		expect(filename.startsWith('claude-chat-')).toBe(true);
	});

	test('includes slugified title', () => {
		const filename = buildFilename('My Cool Chat', 'chatgpt');
		expect(filename).toContain('-my-cool-chat');
	});

	test('ends with .md extension', () => {
		const filename = buildFilename('Test', 'chatgpt');
		expect(filename.endsWith('.md')).toBe(true);
	});

	test('handles empty title', () => {
		const filename = buildFilename('', 'chatgpt');
		expect(filename).toMatch(/^chatgpt-chat-\d{8}-\d{6}\.md$/);
	});

	test('converts title to lowercase', () => {
		const filename = buildFilename('UPPERCASE TITLE', 'claude');
		expect(filename).toContain('-uppercase-title');
	});

	test('replaces special characters with hyphens', () => {
		const filename = buildFilename('Chat: How to code?', 'chatgpt');
		expect(filename).toContain('-chat-how-to-code');
	});

	test('removes leading and trailing hyphens from slug', () => {
		const filename = buildFilename('---Test---', 'chatgpt');
		expect(filename).toContain('-test.md');
		expect(filename).not.toContain('---');
	});

	test('truncates long titles to 60 characters', () => {
		const longTitle = 'A'.repeat(100);
		const filename = buildFilename(longTitle, 'chatgpt');
		const slug = filename.match(/-([a-z]+)\.md$/)?.[1] ?? '';
		expect(slug.length).toBeLessThanOrEqual(60);
	});

	test('includes timestamp in format YYYYMMDD-HHMMSS', () => {
		const filename = buildFilename('Test', 'chatgpt');
		expect(filename).toMatch(/chatgpt-chat-\d{8}-\d{6}/);
	});
});
