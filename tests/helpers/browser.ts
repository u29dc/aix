export function getRequestUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	return input instanceof URL ? input.href : input.url;
}

export function setWindowLocation(values: Partial<Pick<Location, "href" | "hostname" | "pathname">>): void {
	const current = window.location;
	Object.defineProperty(window, "location", {
		value: {
			href: values.href ?? current.href,
			hostname: values.hostname ?? current.hostname,
			pathname: values.pathname ?? current.pathname,
		},
		writable: true,
	});
}
