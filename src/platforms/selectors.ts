/**
 * Selector configuration with primary and fallback selectors
 */
export interface SelectorConfig {
	primary: string;
	fallbacks: readonly string[];
}

/**
 * Claude-specific selectors with fallbacks for robustness against UI changes
 */
export const CLAUDE_SELECTORS = {
	userMessage: {
		primary: '[data-testid="user-message"]',
		fallbacks: ['[data-testid*="human"]', '.human-message', '[class*="user-message"]'],
	},
	assistantMessage: {
		primary: 'div[data-is-streaming]',
		fallbacks: ['[data-testid*="assistant"]', '.assistant-message', '[class*="claude-response"]'],
	},
	messageContent: {
		primary: '.font-claude-response .standard-markdown',
		fallbacks: [
			'.font-claude-response .standard-markdown_',
			'.font-claude-response .progressive-markdown',
			'.font-claude-response .progressive-markdown_',
			'.font-claude-response',
			'.markdown',
			'.prose',
		],
	},
	chatContainer: {
		primary: 'main',
		fallbacks: ['[data-testid="chat-main"]', '[role="main"]', '#main'],
	},
	chatActions: {
		primary: '[data-testid="chat-actions"]',
		fallbacks: ['[data-testid="page-header"] [data-testid="chat-actions"]', '[class*="chat-actions"]'],
	},
	chatTitle: {
		primary: '[data-testid="chat-title-button"]',
		fallbacks: ['[data-testid*="title"]', 'h1', '[class*="chat-title"]'],
	},
} as const;

/**
 * Query for a single element using primary selector with fallbacks
 */
export function querySelector(root: Element | Document, config: SelectorConfig): Element | null {
	const result = root.querySelector(config.primary);
	if (result) return result;

	for (const fallback of config.fallbacks) {
		const fallbackResult = root.querySelector(fallback);
		if (fallbackResult) return fallbackResult;
	}

	return null;
}

/**
 * Query for all elements using primary selector with fallbacks
 */
export function querySelectorAll(root: Element | Document, config: SelectorConfig): Element[] {
	const results = root.querySelectorAll(config.primary);
	if (results.length > 0) return Array.from(results);

	for (const fallback of config.fallbacks) {
		const fallbackResults = root.querySelectorAll(fallback);
		if (fallbackResults.length > 0) return Array.from(fallbackResults);
	}

	return [];
}

/**
 * Build a combined selector string from config for use with querySelectorAll
 */
export function buildCombinedSelector(config: SelectorConfig): string {
	return [config.primary, ...config.fallbacks].join(', ');
}
