import { describe, expect, test } from 'bun:test';

import { pickFence } from '@/utils/markdown';

describe('code block formatting', () => {
	test('pickFence returns backticks for normal code', () => {
		const code = 'function hello() { return "world"; }';
		expect(pickFence(code)).toBe('```');
	});

	test('pickFence returns tildes when code contains backticks', () => {
		const code = 'Use ``` to create code blocks';
		expect(pickFence(code)).toBe('~~~');
	});

	test('pickFence returns backticks when both are present', () => {
		const code = 'Both ``` and ~~~ are used';
		expect(pickFence(code)).toBe('```');
	});

	test('pickFence handles empty string', () => {
		expect(pickFence('')).toBe('```');
	});

	test('pickFence handles multiline code', () => {
		const code = `line 1
line 2
line 3`;
		expect(pickFence(code)).toBe('```');
	});
});
