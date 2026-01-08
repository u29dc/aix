export type Platform = 'claude';

export interface Message {
	role: 'user' | 'assistant';
	markdown: string;
}

export interface ConversionContext {
	listDepth: number;
}

export interface PlatformAdapter {
	readonly platform: Platform;
	ensureButton(): boolean;
	extractConversation(): Message[];
	deriveTitle(): string;
}

export interface ToastElement extends HTMLDivElement {
	__hideTimer?: ReturnType<typeof setTimeout>;
}
