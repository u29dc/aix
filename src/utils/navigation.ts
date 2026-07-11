/**
 * Observe SPA navigation by hooking into history API
 */
export function observeSpaNavigation(callback: () => void): void {
	const originalPushState = history.pushState.bind(history);
	const originalReplaceState = history.replaceState.bind(history);
	const notify = (): void => {
		window.setTimeout(callback, 0);
	};

	history.pushState = function pushStateProxy(...args: Parameters<typeof history.pushState>): void {
		originalPushState(...args);
		notify();
	};

	history.replaceState = function replaceStateProxy(...args: Parameters<typeof history.replaceState>): void {
		originalReplaceState(...args);
		notify();
	};

	window.addEventListener("popstate", notify);
}
