import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

interface Match {
	patternName: string;
	filePath: string;
	line: number;
	excerpt: string;
}

interface LiteralPattern {
	name: string;
	value: string;
}

interface RegexPattern {
	name: string;
	regex: RegExp;
}

const cwd = process.cwd();

const literalPatterns: LiteralPattern[] = [
	{ name: 'chat bootstrap marker', value: ['client', '-', 'bootstrap'].join('') },
	{ name: 'auth token key', value: ['access', 'Token'].join('') },
	{ name: 'intercom hash key', value: ['intercom', '_hash'].join('') },
	{ name: 'cloudflare connecting IP key', value: ['cfConnecting', 'Ip'].join('') },
	{ name: 'stats payload key', value: ['statsig', 'Payload'].join('') },
	{ name: 'absolute home path', value: ['/Users/', 'han'].join('') },
	{ name: 'work email', value: ['han', '@', 'u29dc.com'].join('') },
	{ name: 'chat theme storage key', value: ['oai/apps/chat', 'Theme/', 'user-'].join('') },
];

const regexPatterns: RegexPattern[] = [
	{
		name: 'JWT-like token',
		regex: new RegExp(
			[
				['e', 'y', 'J'].join(''),
				'[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9._-]{10,}\\.[A-Za-z0-9._-]{10,}',
			].join(''),
			'g',
		),
	},
];

const retiredFixtureNames = Array.from({ length: 5 }, (_, index) =>
	['chatgpt', String(index + 1), '.html'].join(''),
);

function getTrackedFiles(): string[] {
	const result = Bun.spawnSync({
		cmd: ['git', 'ls-files', '-z'],
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	});

	if (result.exitCode !== 0) {
		const message = new TextDecoder().decode(result.stderr).trim() || 'git ls-files failed';
		throw new Error(message);
	}

	return new TextDecoder()
		.decode(result.stdout)
		.split('\0')
		.filter((value) => value.length > 0);
}

function isBinary(bytes: Uint8Array): boolean {
	return bytes.includes(0);
}

function getLine(content: string, index: number): { line: number; excerpt: string } {
	let line = 1;
	for (let cursor = 0; cursor < index; cursor += 1) {
		if (content[cursor] === '\n') line += 1;
	}

	const lineStart = content.lastIndexOf('\n', index - 1) + 1;
	const lineEnd = content.indexOf('\n', index);
	const excerpt = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

	return { line, excerpt };
}

function collectLiteralMatches(
	filePath: string,
	content: string,
	pattern: LiteralPattern,
): Match[] {
	const matches: Match[] = [];
	let index = content.indexOf(pattern.value);

	while (index !== -1) {
		const { line, excerpt } = getLine(content, index);
		matches.push({
			patternName: pattern.name,
			filePath,
			line,
			excerpt,
		});
		index = content.indexOf(pattern.value, index + pattern.value.length);
	}

	return matches;
}

function collectRegexMatches(filePath: string, content: string, pattern: RegexPattern): Match[] {
	const matches: Match[] = [];

	for (const result of content.matchAll(pattern.regex)) {
		const value = result[0];
		const index = result.index;
		if (!value || index === undefined) continue;

		const { line, excerpt } = getLine(content, index);
		matches.push({
			patternName: pattern.name,
			filePath,
			line,
			excerpt,
		});
	}

	return matches;
}

async function scan(): Promise<number> {
	const trackedFiles = getTrackedFiles();
	const matches: Match[] = [];

	for (const filePath of trackedFiles) {
		if (!existsSync(filePath)) continue;

		const basename = filePath.split('/').pop() ?? filePath;
		if (retiredFixtureNames.includes(basename)) {
			matches.push({
				patternName: 'retired fixture filename',
				filePath,
				line: 1,
				excerpt: basename,
			});
			continue;
		}

		const file = Bun.file(filePath);
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (isBinary(bytes)) continue;

		const content = new TextDecoder().decode(bytes);

		for (const pattern of literalPatterns) {
			matches.push(...collectLiteralMatches(filePath, content, pattern));
		}

		for (const pattern of regexPatterns) {
			matches.push(...collectRegexMatches(filePath, content, pattern));
		}
	}

	if (matches.length === 0) {
		console.log(`Sensitive scan passed across ${trackedFiles.length} tracked files.`);
		return 0;
	}

	console.error('Sensitive scan failed. Remove these matches before publishing:');
	for (const match of matches) {
		const displayPath = relative(cwd, resolve(cwd, match.filePath));
		console.error(`- ${displayPath}:${match.line} [${match.patternName}] ${match.excerpt}`);
	}

	return 1;
}

const exitCode = await scan();
process.exit(exitCode);
