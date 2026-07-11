import { TOAST_ID } from "@/constants";
import type { ToastElement } from "@/types";

/**
 * Show a toast notification
 */
export function showToast(message: string, isError: boolean): void {
	if (!message) return;

	let toast = document.getElementById(TOAST_ID) as ToastElement | null;
	if (!toast) {
		toast = document.createElement("div");
		toast.id = TOAST_ID;
		document.body.appendChild(toast);
	}

	toast.textContent = message;
	toast.setAttribute("data-type", isError ? "error" : "success");
	toast.classList.add("visible");

	if (toast.hideTimer !== undefined) {
		clearTimeout(toast.hideTimer);
	}

	toast.hideTimer = setTimeout(() => {
		toast?.classList.remove("visible");
	}, 4000);
}
