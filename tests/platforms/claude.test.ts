import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
	createClaudeAssistantMessage,
	createClaudeUserMessage,
	createElement,
} from '@tests/helpers';
import {
	deriveClaudeTitle,
	extractClaudeConversation,
	isEligibleClaudeConversation,
	prepareClaudeConversationForExport,
} from '@/platforms/claude';

describe('isEligibleClaudeConversation', () => {
	const originalLocation = window.location;

	beforeEach(() => {
		Object.defineProperty(window, 'location', {
			value: { ...originalLocation },
			writable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', {
			value: originalLocation,
			writable: true,
		});
	});

	test('returns true for valid Claude chat URL', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/12345678-1234-1234-1234-123456789abc' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(true);
	});

	test('returns true for UUID with trailing slash', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/12345678-1234-1234-1234-123456789abc/' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(true);
	});

	test('returns false for root path', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for /chat without ID', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for /chat/ without ID', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for invalid UUID format', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/chat/not-a-uuid' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});

	test('returns false for settings page', () => {
		Object.defineProperty(window, 'location', {
			value: { pathname: '/settings' },
			writable: true,
		});
		expect(isEligibleClaudeConversation()).toBe(false);
	});
});

describe('deriveClaudeTitle', () => {
	let originalTitle: string;

	beforeEach(() => {
		originalTitle = document.title;
	});

	afterEach(() => {
		document.title = originalTitle;
		const titleButton = document.querySelector('[data-testid="chat-title-button"]');
		titleButton?.remove();
	});

	test('extracts title from chat-title-button', () => {
		const titleButton = createElement('button', { 'data-testid': 'chat-title-button' }, [
			'My Conversation',
		]);
		document.body.appendChild(titleButton);
		expect(deriveClaudeTitle()).toBe('My Conversation');
	});

	test('trims whitespace from title button', () => {
		const titleButton = createElement('button', { 'data-testid': 'chat-title-button' }, [
			'  Spaced Title  ',
		]);
		document.body.appendChild(titleButton);
		expect(deriveClaudeTitle()).toBe('Spaced Title');
	});

	test('falls back to document.title when button not found', () => {
		document.title = 'Chat Title - Claude';
		expect(deriveClaudeTitle()).toBe('Chat Title');
	});

	test('removes suffix after pipe in document.title', () => {
		document.title = 'My Chat | Claude';
		expect(deriveClaudeTitle()).toBe('My Chat');
	});

	test('handles document.title with no suffix', () => {
		document.title = 'Simple Title';
		expect(deriveClaudeTitle()).toBe('Simple Title');
	});

	test('returns empty string when no title available', () => {
		document.title = '';
		expect(deriveClaudeTitle()).toBe('');
	});
});

describe('extractClaudeConversation', () => {
	let container: HTMLElement;

	function wrapClaudeMessage(message: Element, timestamp?: string): HTMLDivElement {
		const actionChildren: (Node | string)[] = [];
		if (timestamp) {
			actionChildren.push(
				createElement(
					'span',
					{ class: 'text-text-500 text-xs flex items-center mr-2', 'data-state': 'closed' },
					[timestamp],
				),
			);
		}
		actionChildren.push(
			createElement('div', { class: 'w-fit', 'data-state': 'closed' }, [
				createElement('button', { 'aria-label': 'Copy' }),
			]),
		);

		return createElement('div', { 'data-test-render-count': '1' }, [
			createElement('div', undefined, [message]),
			createElement(
				'div',
				{ class: 'flex justify-start', role: 'group', 'aria-label': 'Message actions' },
				[createElement('div', undefined, [createElement('div', undefined, actionChildren)])],
			),
		]);
	}

	beforeEach(() => {
		document.body.innerHTML = '';
		container = createElement('main');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	test('extracts user message', () => {
		const userMsg = createClaudeUserMessage('Hello Claude!');
		container.appendChild(userMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.role).toBe('user');
		expect(messages[0]?.markdown).toContain('Hello Claude');
	});

	test('extracts assistant message', () => {
		const assistantMsg = createClaudeAssistantMessage('Hello! How can I help?');
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.role).toBe('assistant');
		expect(messages[0]?.markdown).toContain('Hello');
	});

	test('extracts multi-turn conversation in order', () => {
		container.appendChild(createClaudeUserMessage('First question'));
		container.appendChild(createClaudeAssistantMessage('First answer'));
		container.appendChild(createClaudeUserMessage('Second question'));
		container.appendChild(createClaudeAssistantMessage('Second answer'));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(4);
		expect(messages[0]?.role).toBe('user');
		expect(messages[1]?.role).toBe('assistant');
		expect(messages[2]?.role).toBe('user');
		expect(messages[3]?.role).toBe('assistant');
	});

	test('returns empty array when no messages found', () => {
		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(0);
	});

	test('handles streaming message state', () => {
		const streamingMsg = createClaudeAssistantMessage('', true);
		container.appendChild(streamingMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('streaming');
		expect(messages[0]?.markdown).toContain('skipped');
	});

	test('preserves consecutive identical messages', () => {
		const wrapper1 = createElement('div');
		const wrapper2 = createElement('div');

		const user1 = createClaudeUserMessage('Same message');
		const user2 = createClaudeUserMessage('Same message');

		wrapper1.appendChild(user1);
		wrapper2.appendChild(user2);
		container.appendChild(wrapper1);
		container.appendChild(wrapper2);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(2);
	});

	test('extracts message with inline formatting', () => {
		const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [
			createElement('p', undefined, [
				'Text with ',
				createElement('strong', undefined, ['bold']),
				' and ',
				createElement('code', undefined, ['code']),
			]),
		]);
		const assistantMsg = createClaudeAssistantMessage(content);
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('**bold**');
		expect(messages[0]?.markdown).toContain('`code`');
	});

	test('skips hidden elements inside message content', () => {
		const hidden = createElement('span', { style: 'display: none' }, ['Secret']);
		const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [
			createElement('p', undefined, ['Visible ', hidden]),
		]);
		const assistantMsg = createClaudeAssistantMessage(content);
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('Visible');
		expect(messages[0]?.markdown).not.toContain('Secret');
	});

	test('extracts message with code block', () => {
		const codeBlock = createElement('pre', undefined, [
			createElement('code', { class: 'language-javascript' }, ['const x = 1;']),
		]);
		const content = createElement('div', { class: 'standard-markdown grid-cols-1 grid gap-4' }, [
			codeBlock,
		]);
		const assistantMsg = createClaudeAssistantMessage(content);
		container.appendChild(assistantMsg);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('```javascript');
		expect(messages[0]?.markdown).toContain('const x = 1;');
	});

	test('falls back to chat-main testid when main not found', () => {
		container.remove();
		const altContainer = createElement('div', { 'data-testid': 'chat-main' });
		altContainer.appendChild(createClaudeUserMessage('Test message'));
		document.body.appendChild(altContainer);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);

		altContainer.remove();
	});

	test('extracts timestamp from action bar and applies it to following assistant message', () => {
		container.appendChild(
			wrapClaudeMessage(createClaudeUserMessage('Question with date'), 'Feb 13'),
		);
		container.appendChild(
			wrapClaudeMessage(createClaudeAssistantMessage('Answer without visible date')),
		);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(2);
		expect(messages[0]?.timestamp).toBe('Feb 13');
		expect(messages[1]?.timestamp).toBe('Feb 13');
	});

	test('backfills timestamp for leading assistant messages when first visible date appears later', () => {
		container.appendChild(
			wrapClaudeMessage(createClaudeAssistantMessage('Opening assistant message')),
		);
		container.appendChild(
			wrapClaudeMessage(createClaudeUserMessage('User message with date'), 'Feb 14'),
		);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(2);
		expect(messages[0]?.timestamp).toBe('Feb 14');
		expect(messages[1]?.timestamp).toBe('Feb 14');
	});

	test('preserves Claude thinking summaries ahead of assistant content', () => {
		const content = createElement('div', undefined, [
			createElement('div', { class: 'grid grid-rows-[auto_auto] min-w-0' }, [
				createElement('div', { class: 'row-start-1 col-start-1 min-w-0' }, [
					createElement('div', { class: 'min-w-0 pl-2 py-1.5' }, [
						createElement(
							'button',
							{
								type: 'button',
								class: 'group/status flex items-center gap-2 py-1 text-sm',
								'aria-expanded': 'false',
							},
							[
								createElement('div', { class: 'inline-flex items-center gap-1 min-w-0' }, [
									createElement('span', { class: 'truncate text-sm font-base' }, [
										'Prepared final response',
									]),
								]),
							],
						),
						createElement('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' }, [
							'Prepared final response',
						]),
						createElement(
							'div',
							{
								class: 'grid transition-[grid-template-rows] duration-300 ease-out',
								style: 'grid-template-rows: 1fr;',
							},
							[
								createElement('div', { class: 'overflow-hidden min-w-0' }, [
									createElement('div', { class: 'flex flex-col font-ui leading-normal' }, [
										createElement('div', undefined, [
											createElement(
												'div',
												{
													class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown',
												},
												[
													createElement('p', undefined, ['The user wants two things:']),
													createElement('ol', undefined, [
														createElement('li', undefined, ['First item']),
														createElement('li', undefined, ['Second item']),
													]),
												],
											),
										]),
										createElement('div', { class: 'pl-2.5 pt-0.5 text-text-300' }, ['Done']),
									]),
								]),
							],
						),
					]),
				]),
				createElement('div', { class: 'row-start-2 col-start-1 relative grid isolate min-w-0' }, [
					createElement('div', { class: 'row-start-1 col-start-1 relative z-[2] min-w-0' }, [
						createElement('div', undefined, [
							createElement(
								'div',
								{ class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown' },
								[createElement('p', undefined, ['Final response text'])],
							),
						]),
					]),
				]),
			]),
		]);

		container.appendChild(wrapClaudeMessage(createClaudeAssistantMessage(content)));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('**Thinking:**');
		expect(messages[0]?.markdown).toContain('Prepared final response');
		expect(messages[0]?.markdown).toContain('The user wants two things:');
		expect(messages[0]?.markdown).toContain('1. First item');
		expect(messages[0]?.markdown).not.toContain('\n\nDone\n\n');
		expect(messages[0]?.markdown).toContain('Final response text');
		expect(messages[0]?.markdown.indexOf('Prepared final response')).toBeLessThan(
			messages[0]?.markdown.indexOf('The user wants two things:') ?? Number.MAX_SAFE_INTEGER,
		);
		expect(messages[0]?.markdown.indexOf('The user wants two things:')).toBeLessThan(
			messages[0]?.markdown.indexOf('Final response text') ?? Number.MAX_SAFE_INTEGER,
		);
	});

	test('extracts artifact cards from Claude open artifact buttons', () => {
		const artifactCard = createElement('div', { class: 'group/artifact-block relative flex' }, [
			createElement('button', {
				type: 'button',
				'aria-label': 'Todo. Open artifact.',
			}),
			createElement('div', { class: 'artifact-block-cell flex flex-1' }, [
				createElement('div', { class: 'flex flex-col gap-1 py-4 min-w-0 flex-1' }, [
					createElement('div', { class: 'leading-tight text-sm line-clamp-1' }, ['Todo']),
					createElement('div', { class: 'text-xs line-clamp-1 text-text-400' }, ['Document · MD']),
				]),
			]),
		]);

		const assistant = createClaudeAssistantMessage(
			createElement('div', undefined, [
				createElement(
					'div',
					{ class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown' },
					[createElement('p', undefined, ['Artifact summary'])],
				),
				artifactCard,
			]),
		);
		container.appendChild(wrapClaudeMessage(assistant));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('**Artifacts:**');
		expect(messages[0]?.markdown).toContain('Todo');
		expect(messages[0]?.markdown).toContain('Document');
	});

	test('preserves assistant content inside non-thinking overflow-hidden containers', () => {
		const assistant = createClaudeAssistantMessage(
			createElement('div', undefined, [
				createElement('div', { class: 'overflow-hidden' }, [
					createElement(
						'div',
						{ class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown' },
						[createElement('p', undefined, ['Actual assistant response'])],
					),
				]),
			]),
		);

		container.appendChild(wrapClaudeMessage(assistant));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('Actual assistant response');
	});

	test('uses concise attachment labels from Claude file thumbnails', () => {
		const thumbnail = createElement('div', { 'data-testid': 'file-thumbnail' }, [
			createElement(
				'button',
				{
					'aria-label': 'Pasted Text, pasted, 277 lines',
				},
				[
					createElement('p', undefined, [
						'Context handoff for continuing this discussion on my phone',
					]),
				],
			),
		]);

		const wrapper = createElement('div', { 'data-test-render-count': '1' }, [
			thumbnail,
			createClaudeUserMessage('Attached a handoff note.'),
		]);
		container.appendChild(wrapper);

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('**Attachments:**');
		expect(messages[0]?.markdown).toContain('Pasted Text');
		expect(messages[0]?.markdown).toContain('277 lines');
		expect(messages[0]?.markdown).not.toContain('Context handoff for continuing this discussion');
	});

	test('ignores orphan claude-response fallback nodes outside message wrappers', () => {
		container.appendChild(
			createElement('div', { class: 'font-claude-response' }, [
				createElement('p', undefined, ['[HAN]']),
			]),
		);
		container.appendChild(createClaudeAssistantMessage('Actual assistant message'));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain('Actual assistant message');
		expect(messages[0]?.markdown).not.toContain('[HAN]');
	});

	test('expands collapsed Claude thinking panels before export', async () => {
		const originalRequestAnimationFrame = window.requestAnimationFrame;
		const originalSetTimeout = window.setTimeout;
		const detailRoot = createElement('div', { class: 'overflow-hidden min-w-0' });
		const toggle = createElement(
			'button',
			{
				type: 'button',
				class: 'group/status flex items-center gap-2 py-1 text-sm',
				'aria-expanded': 'false',
			},
			['Prepared final response'],
		);

		toggle.addEventListener('click', () => {
			toggle.setAttribute('aria-expanded', 'true');
			detailRoot.appendChild(
				createElement(
					'div',
					{ class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown' },
					[createElement('p', undefined, ['The user wants two things:'])],
				),
			);
		});

		const assistant = createElement(
			'div',
			{ 'data-is-streaming': 'false', class: 'group relative' },
			[
				createElement('div', { class: 'font-claude-response' }, [
					createElement('div', { class: 'min-w-0 pl-2 py-1.5' }, [
						createElement('div', { class: 'flex items-center gap-2' }, [toggle]),
						createElement(
							'div',
							{
								class: 'grid transition-[grid-template-rows] duration-300 ease-out',
								style: 'grid-template-rows: 0fr;',
							},
							[detailRoot],
						),
					]),
					createElement(
						'div',
						{ class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown' },
						[createElement('p', undefined, ['Final response text'])],
					),
				]),
			],
		);

		container.appendChild(wrapClaudeMessage(assistant));

		window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		}) as typeof window.requestAnimationFrame;
		window.setTimeout = ((handler: TimerHandler, _timeout?: number, ..._arguments: unknown[]) => {
			if (typeof handler === 'function') handler();
			return 1;
		}) as unknown as typeof window.setTimeout;

		try {
			await prepareClaudeConversationForExport();

			const messages = extractClaudeConversation();
			expect(messages).toHaveLength(1);
			expect(messages[0]?.markdown).toContain('The user wants two things:');
			expect(messages[0]?.markdown).toContain('Final response text');
		} finally {
			window.requestAnimationFrame = originalRequestAnimationFrame;
			window.setTimeout = originalSetTimeout;
		}
	});

	test('strips thinking-panel favicon and link noise while keeping narrative text', () => {
		const content = createElement('div', undefined, [
			createElement('div', { class: 'grid grid-rows-[auto_auto] min-w-0' }, [
				createElement('div', { class: 'row-start-1 col-start-1 min-w-0' }, [
					createElement('div', { class: 'min-w-0 pl-2 py-1.5' }, [
						createElement('div', { class: 'flex items-center gap-2' }, [
							createElement(
								'button',
								{
									type: 'button',
									class: 'group/status flex items-center gap-2 py-1 text-sm',
									'aria-expanded': 'true',
								},
								['Searched the web'],
							),
						]),
						createElement(
							'div',
							{
								class: 'grid transition-[grid-template-rows] duration-300 ease-out',
								style: 'grid-template-rows: 1fr;',
							},
							[
								createElement('div', { class: 'overflow-hidden min-w-0' }, [
									createElement(
										'div',
										{
											class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown',
										},
										[
											createElement('p', undefined, [
												'Now let me research the WhatsApp Cloud API webhook requirements.',
												createElement('img', {
													src: 'https://www.google.com/s2/favicons?domain=facebook.com&sz=32',
													alt: '',
												}),
												createElement(
													'a',
													{
														href: 'https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/',
													},
													['Webhooks - WhatsApp Cloud API'],
												),
											]),
											createElement('p', undefined, [
												'Key finding: WhatsApp Cloud API requires a dedicated phone number.',
											]),
											createElement('p', undefined, ['Done']),
										],
									),
								]),
							],
						),
					]),
				]),
				createElement('div', { class: 'row-start-2 col-start-1 relative grid isolate min-w-0' }, [
					createElement('div', { class: 'row-start-1 col-start-1 relative z-[2] min-w-0' }, [
						createElement(
							'div',
							{ class: 'standard-markdown grid-cols-1 grid gap-3 standard-markdown' },
							[createElement('p', undefined, ['Final response text'])],
						),
					]),
				]),
			]),
		]);

		container.appendChild(wrapClaudeMessage(createClaudeAssistantMessage(content)));

		const messages = extractClaudeConversation();
		expect(messages).toHaveLength(1);
		expect(messages[0]?.markdown).toContain(
			'Now let me research the WhatsApp Cloud API webhook requirements.',
		);
		expect(messages[0]?.markdown).toContain(
			'Key finding: WhatsApp Cloud API requires a dedicated phone number.',
		);
		expect(messages[0]?.markdown).toContain('Final response text');
		expect(messages[0]?.markdown).not.toContain('google.com/s2');
		expect(messages[0]?.markdown).not.toContain('developers.facebook.com');
		expect(messages[0]?.markdown).not.toContain('Webhooks - WhatsApp Cloud API');
		expect(messages[0]?.markdown).not.toContain('\n\nDone\n\n');
	});
});
