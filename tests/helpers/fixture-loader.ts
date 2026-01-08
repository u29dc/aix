import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Get the absolute path to a fixture file
 */
export function getFixturePath(name: string): string {
	return resolve(import.meta.dir, '..', 'fixtures', name);
}

/**
 * Load a fixture file as a string
 */
export function loadFixture(name: string): string {
	const path = getFixturePath(name);
	return readFileSync(path, 'utf-8');
}

/**
 * Parse a fixture file as a Document
 */
export function parseFixture(name: string): Document {
	const html = loadFixture(name);
	const parser = new DOMParser();
	return parser.parseFromString(html, 'text/html');
}

/**
 * Parse an HTML string as a Document
 */
export function parseHTML(html: string): Document {
	const parser = new DOMParser();
	return parser.parseFromString(html, 'text/html');
}

/**
 * Extract the first element matching a selector from fixture
 */
export function getFixtureElement(name: string, selector: string): Element | null {
	const doc = parseFixture(name);
	return doc.querySelector(selector);
}
