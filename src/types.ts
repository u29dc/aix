export type Platform = 'claude' | 'chatgpt';

export interface Message {
	role: 'user' | 'assistant';
	markdown: string;
}

export interface ConversionContext {
	listDepth: number;
}

export interface ToastElement extends HTMLDivElement {
	__hideTimer?: ReturnType<typeof setTimeout>;
}
