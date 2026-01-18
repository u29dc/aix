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

function getMaxBacktickRun(value: string): number {
	let maxRun = 0;
	let current = 0;
	for (const char of value) {
		if (char === '`') {
			current += 1;
			if (current > maxRun) maxRun = current;
		} else {
			current = 0;
		}
	}
	return maxRun;
}

/**
 * Wrap inline code without trimming content
 */
export function wrapInlineCode(value: string): string {
	if (!value) return '';
	if (value.trim() === '') return '';
	const fenceLength = getMaxBacktickRun(value) + 1;
	const fence = '`'.repeat(fenceLength);
	return `${fence}${value}${fence}`;
}

/**
 * Normalize markdown spacing - remove trailing whitespace and collapse multiple newlines
 */
export function normalizeSpacing(markdown: string): string {
	return markdown.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

interface FenceState {
	char: '`' | '~';
	length: number;
}

function parseFenceLine(line: string): FenceState | null {
	const match = line.match(/^\s*(?:>+\s*)?(?:[-*+]\s+|\d+\.\s+)?([`~]{3,})/);
	if (!match) return null;
	const fence = match[1] ?? '';
	return { char: fence[0] as '`' | '~', length: fence.length };
}

function updateFenceState(current: FenceState | null, parsed: FenceState): FenceState | null {
	if (!current) return parsed;
	if (current.char === parsed.char && parsed.length >= current.length) return null;
	return current;
}

function processContentLine(line: string): { text: string; isBlank: boolean } {
	const trailingMatch = line.match(/[ \t]+$/);
	const base = line.replace(/[ \t]+$/g, '');
	if (base === '') return { text: '', isBlank: true };
	const hasSoftBreak = trailingMatch !== null && trailingMatch[0].length >= 2;
	return { text: hasSoftBreak ? `${base}  ` : base, isBlank: false };
}

/**
 * Normalize markdown while preserving fenced code blocks
 */
export function normalizeMarkdown(markdown: string): string {
	const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');
	const output: string[] = [];
	let inFence: FenceState | null = null;
	let blankCount = 0;

	for (const line of lines) {
		const parsed = parseFenceLine(line);
		if (parsed) {
			inFence = updateFenceState(inFence, parsed);
			output.push(line);
			blankCount = 0;
			continue;
		}

		if (inFence) {
			output.push(line);
			continue;
		}

		const { text, isBlank } = processContentLine(line);
		if (isBlank) {
			blankCount += 1;
			if (blankCount <= 1) output.push('');
			continue;
		}

		blankCount = 0;
		output.push(text);
	}

	return output.join('\n');
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
