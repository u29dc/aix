import { STYLE_ID, TOAST_ID } from '@/constants';

/**
 * Inject extension styles into the page
 */
export function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return;

	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
    #${TOAST_ID} {
      position: fixed;
      bottom: 90px;
      right: 24px;
      max-width: 320px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      color: ${prefersDark ? '#0f172a' : '#0f172a'};
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 160ms ease, transform 160ms ease;
      z-index: 2147483647;
    }
    #${TOAST_ID}[data-type="error"] {
      background: rgba(248, 113, 113, 0.95);
      color: #111827;
    }
    #${TOAST_ID}.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
	document.head.appendChild(style);
}
