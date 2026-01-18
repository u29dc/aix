import { BUTTON_ID } from '@/constants';
import { composeMarkdown } from '@/parsers';
import { detectPlatform, getPlatformAdapter } from '@/platforms';
import type { PlatformConfig } from '@/platforms/types';
import { getButton, removeButton, setButtonBusy, setButtonIdle } from '@/ui/button';
import { injectStyles } from '@/ui/styles';
import { showToast } from '@/ui/toast';
import { buildFilename, observeSpaNavigation, triggerDownload } from '@/utils';

let navigationHooked = false;
let adapter: PlatformConfig | null = null;

/**
 * Main bootstrap function
 */
function bootstrap(): void {
	if (!document.body) {
		window.setTimeout(bootstrap, 50);
		return;
	}

	ensureButtonWithRetry();

	if (!navigationHooked) {
		navigationHooked = true;
		observeSpaNavigation(() => ensureButtonWithRetry());
	}
}

/**
 * Ensure the export button exists (with retry)
 */
function ensureButton(): boolean {
	// biome-ignore lint/suspicious/noConsole: debug logging
	console.log('[AIX] ensureButton called, adapter:', !!adapter);
	if (!adapter) return false;

	const isEligible = adapter.isEligibleConversation();
	// biome-ignore lint/suspicious/noConsole: debug logging
	console.log('[AIX] isEligibleConversation:', isEligible, 'pathname:', window.location.pathname);
	if (!isEligible) {
		removeButton();
		return false;
	}

	const existing = document.getElementById(BUTTON_ID);
	// biome-ignore lint/suspicious/noConsole: debug logging
	console.log('[AIX] existing button:', existing, 'isConnected:', existing?.isConnected);
	if (existing?.isConnected) return true;

	const success = adapter.ensureButton();
	// biome-ignore lint/suspicious/noConsole: debug logging
	console.log('[AIX] adapter.ensureButton() result:', success);
	if (success) {
		const button = getButton();
		if (button) {
			button.addEventListener('click', handleExportClick);
		}
	}
	return success;
}

/**
 * Try to ensure button with retries
 */
function ensureButtonWithRetry(maxRetries = 6, delay = 150): void {
	let attempts = 0;

	const tryEnsure = (): void => {
		if (ensureButton()) return;
		attempts += 1;
		if (attempts <= maxRetries) {
			window.setTimeout(tryEnsure, delay);
		}
	};

	tryEnsure();
}

/**
 * Handle export button click
 */
function handleExportClick(): void {
	const button = getButton();
	if (!button) return;
	if (button.dataset['state'] === 'busy') return;

	setButtonBusy(button);

	Promise.resolve()
		.then(() => exportConversation())
		.then((filename) => {
			if (filename) {
				showToast(`Conversation exported: ${filename}`, false);
			}
		})
		.catch((error: Error) => {
			showToast(`Export failed: ${error.message}`, true);
		})
		.finally(() => {
			const btn = getButton();
			if (btn) {
				setButtonIdle(btn);
			}
		});
}

/**
 * Export the conversation
 */
function exportConversation(): string {
	if (!adapter) {
		throw new Error('No platform adapter available');
	}

	const messages = adapter.extractConversation();
	if (!messages.length) {
		throw new Error('No messages found in this conversation.');
	}

	const title = adapter.deriveTitle() || 'AI Conversation';
	const markdown = composeMarkdown(messages, title, adapter.platform, adapter.displayName, window.location.href);
	const filename = buildFilename(title, adapter.platform);

	triggerDownload(markdown, filename);
	return filename;
}

// Initialize extension
const platform = detectPlatform();
// biome-ignore lint/suspicious/noConsole: debug logging
console.log('[AIX] Platform detected:', platform);
if (platform) {
	adapter = getPlatformAdapter(platform);
	injectStyles();
	bootstrap();
} else {
	// biome-ignore lint/suspicious/noConsole: debug logging
	console.log('[AIX] No platform detected, extension inactive');
}
