import { describe, expect, test } from 'bun:test';

import { buildFilename } from '@/utils/filename';

describe('buildFilename', () => {
	test('generates filename with platform prefix', () => {
		const filename = buildFilename('Test Chat', 'claude');
		expect(filename.startsWith('claude-chat-')).toBe(true);
	});

	test('includes slugified title', () => {
		const filename = buildFilename('My Cool Chat', 'claude');
		expect(filename).toContain('-my-cool-chat');
	});

	test('ends with .md extension', () => {
		const filename = buildFilename('Test', 'claude');
		expect(filename.endsWith('.md')).toBe(true);
	});

	test('handles empty title', () => {
		const filename = buildFilename('', 'claude');
		expect(filename).toMatch(/^claude-chat-\d{8}-\d{6}\.md$/);
	});

	test('converts title to lowercase', () => {
		const filename = buildFilename('UPPERCASE TITLE', 'claude');
		expect(filename).toContain('-uppercase-title');
	});

	test('replaces special characters with hyphens', () => {
		const filename = buildFilename('Chat: How to code?', 'claude');
		expect(filename).toContain('-chat-how-to-code');
	});

	test('removes leading and trailing hyphens from slug', () => {
		const filename = buildFilename('---Test---', 'claude');
		expect(filename).toContain('-test.md');
		expect(filename).not.toContain('---');
	});

	test('truncates long titles to 60 characters', () => {
		const longTitle = 'A'.repeat(100);
		const filename = buildFilename(longTitle, 'claude');
		const slug = filename.match(/-([a-z]+)\.md$/)?.[1] ?? '';
		expect(slug.length).toBeLessThanOrEqual(60);
	});

	test('includes timestamp in format YYYYMMDD-HHMMSS', () => {
		const filename = buildFilename('Test', 'claude');
		expect(filename).toMatch(/claude-chat-\d{8}-\d{6}/);
	});
});
