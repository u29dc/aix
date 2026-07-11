import { defineConfig } from "rolldown";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
	input: "src/index.ts",
	platform: "browser",
	tsconfig: true,
	onLog(level, log, defaultHandler) {
		defaultHandler(level === "warn" ? "error" : level, log);
	},
	output: {
		file: "dist/contentScript.js",
		format: "iife",
		comments: false,
		minify: isProduction
			? {
					compress: {
						dropConsole: true,
						dropDebugger: true,
					},
					mangle: {
						toplevel: true,
					},
					codegen: {
						removeWhitespace: true,
					},
				}
			: false,
		sourcemap: false,
	},
});
