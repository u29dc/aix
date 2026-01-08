import { BUTTON_ID } from '@/constants';

export interface ButtonElement extends HTMLButtonElement {
	dataset: DOMStringMap & {
		state?: 'idle' | 'busy';
	};
}

/**
 * Create an export button element
 */
export function createButton(className: string): ButtonElement {
	const button = document.createElement('button') as ButtonElement;
	button.id = BUTTON_ID;
	button.type = 'button';
	button.textContent = 'Export chat';
	button.className = className;
	button.setAttribute('aria-label', 'Export chat');
	button.dataset['state'] = 'idle';
	return button;
}

/**
 * Get the existing export button
 */
export function getButton(): ButtonElement | null {
	return document.getElementById(BUTTON_ID) as ButtonElement | null;
}

/**
 * Remove the export button from the DOM
 */
export function removeButton(): void {
	const existing = document.getElementById(BUTTON_ID);
	existing?.parentElement?.removeChild(existing);
}

/**
 * Set button to busy state
 */
export function setButtonBusy(button: ButtonElement): void {
	button.dataset['state'] = 'busy';
	button.textContent = 'Exporting\u2026';
	button.disabled = true;
}

/**
 * Set button to idle state
 */
export function setButtonIdle(button: ButtonElement): void {
	button.dataset['state'] = 'idle';
	button.textContent = 'Export chat';
	button.disabled = false;
}
