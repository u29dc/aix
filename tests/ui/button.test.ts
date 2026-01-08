import { describe, expect, test } from 'bun:test';

import { BUTTON_ID } from '@/constants';
import type { ButtonElement } from '@/ui/button';
import { createButton, setButtonBusy, setButtonIdle } from '@/ui/button';

describe('createButton', () => {
	test('creates button with correct ID', () => {
		const button = createButton('test-class');
		expect(button.id).toBe(BUTTON_ID);
	});

	test('creates button with type button', () => {
		const button = createButton('test-class');
		expect(button.type).toBe('button');
	});

	test('creates button with Export chat text', () => {
		const button = createButton('test-class');
		expect(button.textContent).toBe('Export chat');
	});

	test('creates button with provided className', () => {
		const button = createButton('my-custom-class');
		expect(button.className).toBe('my-custom-class');
	});

	test('creates button with aria-label', () => {
		const button = createButton('test-class');
		expect(button.getAttribute('aria-label')).toBe('Export chat');
	});

	test('creates button with idle state', () => {
		const button = createButton('test-class');
		expect(button.dataset['state']).toBe('idle');
	});
});

describe('setButtonBusy', () => {
	test('sets state to busy', () => {
		const button = createButton('test') as ButtonElement;
		setButtonBusy(button);
		expect(button.dataset['state']).toBe('busy');
	});

	test('sets text to Exporting', () => {
		const button = createButton('test') as ButtonElement;
		setButtonBusy(button);
		expect(button.textContent).toBe('Exporting\u2026');
	});

	test('disables the button', () => {
		const button = createButton('test') as ButtonElement;
		setButtonBusy(button);
		expect(button.disabled).toBe(true);
	});
});

describe('setButtonIdle', () => {
	test('sets state to idle', () => {
		const button = createButton('test') as ButtonElement;
		setButtonBusy(button);
		setButtonIdle(button);
		expect(button.dataset['state']).toBe('idle');
	});

	test('sets text back to Export chat', () => {
		const button = createButton('test') as ButtonElement;
		setButtonBusy(button);
		setButtonIdle(button);
		expect(button.textContent).toBe('Export chat');
	});

	test('enables the button', () => {
		const button = createButton('test') as ButtonElement;
		setButtonBusy(button);
		setButtonIdle(button);
		expect(button.disabled).toBe(false);
	});
});
