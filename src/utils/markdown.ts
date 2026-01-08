/**
 * Escape special markdown characters in text
 */
export function escapeMarkdown(text: string): string {
	if (!text) return '';
	return text.replace(/\u00a0/g, ' ').replace(/([\\`*_{}[\]()#+\-!>])/g, '\\$1');
}

/**
 * Wrap text with markdown delimiters (e.g., ** for bold)
 */
export function wrapMarkdown(wrapper: string, value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	return `${wrapper}${trimmed}${wrapper}`;
}

/**
 * Normalize markdown spacing - remove trailing whitespace and collapse multiple newlines
 */
export function normalizeSpacing(markdown: string): string {
	return markdown.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Pick appropriate fence for code blocks
 */
export function pickFence(text: string): string {
	const hasTriple = text.includes('```');
	if (!hasTriple) return '```';
	const hasTilde = text.includes('~~~');
	return hasTilde ? '```' : '~~~';
}

/**
 * Detect language from code element
 */
export function detectLanguage(codeElement: Element | null): string {
	if (!codeElement) return '';
	const explicit = codeElement.getAttribute('data-language') ?? '';
	if (explicit) return explicit.trim();
	const classAttr = codeElement.getAttribute('class') ?? '';
	const match = classAttr.match(/language-([a-z0-9+#]+)/i);
	return match?.[1] ?? '';
}
