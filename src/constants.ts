export const EXTENSION_ID = 'ai-chat-exporter';
export const BUTTON_ID = `${EXTENSION_ID}-button`;
export const TOAST_ID = `${EXTENSION_ID}-toast`;
export const STYLE_ID = `${EXTENSION_ID}-styles`;

export const CLAUDE_SHARE_CLASS_FALLBACK =
	'inline-flex items-center justify-center relative shrink-0 can-focus select-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none text-text-000 font-base-bold border-0.5 border-border-200 overflow-hidden transition duration-100 hover:border-border-300/0 bg-bg-300/0 hover:bg-bg-400 backface-hidden h-8 rounded-md px-3 min-w-[4rem] active:scale-[0.985] whitespace-nowrap !text-xs';

export const SANITIZE_SELECTORS = [
	'script',
	'style',
	'svg',
	'button',
	'input',
	'textarea',
	'form',
	'[hidden]',
	'[aria-hidden="true"]',
	'[role="img"]',
	'.copy-button',
	'[data-testid*="copy"]',
	'[data-testid="message-actions"]',
	'[data-testid="hover-card"]',
	'[data-testid="conversation-turn-badge"]',
	'[data-testid="action-bar-copy"]',
	'[data-message-author-role="system"]',
	'.hidden',
	'.sr-only',
	'.visually-hidden',
] as const;
