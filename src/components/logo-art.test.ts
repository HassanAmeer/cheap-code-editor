import type { Theme } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"
import { buildLogoLines, truncatePath } from "./logo-art.js"

describe("truncatePath", () => {
	it("returns short paths unchanged", () => {
		expect(truncatePath("~/project", 20)).toBe("~/project")
		expect(truncatePath("/home/user/foo", 20)).toBe("/home/user/foo")
	})

	it("truncates from the right when there is no slash", () => {
		expect(truncatePath("someverylongname", 10)).toBe("somever...")
		expect(truncatePath("someverylongname", 5)).toBe("so...")
	})

	it("preserves the basename with ellipsis in the directory part", () => {
		// /home/user/cast → last slash-prefix that fits within 14: /home.../cheap (14 chars)
		expect(truncatePath("/home/user/cast/cheap", 14)).toBe("/home.../cheap")
	})

	it("preserves the tilde prefix and basename", () => {
		expect(truncatePath("~/very/long/path/cheap", 16)).toBe("~/very.../cheap")
	})

	it("preserves an absolute root path prefix", () => {
		// /very/long/path/to → last slash-prefix that fits within 16: /very.../cheap (14 chars)
		expect(truncatePath("/very/long/path/to/cheap", 16)).toBe("/very.../cheap")
	})

	it("falls back to right truncation when even the minimal prefix does not fit", () => {
		expect(truncatePath("/home/user/cast/cheap", 5)).toBe("/h...")
	})
})

describe("buildLogoLines", () => {
	const mockTheme = {
		getFgAnsi: (color: string) => `[${color}]`,
		fg: (color: string, text: string) => `[${color}]${text}[reset]`,
	} as unknown as Theme

	it("falls back to KIMCHI when no environment variables are set", () => {
		const originalEnv = { ...process.env }
		process.env.CLI_NAME = ""
		process.env.COMMAND_NAME = ""
		process.env.APP_NAME = ""
		process.env.NAME = ""

		try {
			const lines = buildLogoLines(mockTheme)
			// K row-0 starts with "█  █", M row-0 contains "█▄ ▄█"
			expect(lines[0]).toContain("█  █")
			expect(lines[0]).toContain("█▄ ▄█")
		} finally {
			process.env = originalEnv
		}
	})

	it("renders CLI_NAME from environment variable", () => {
		const originalEnv = { ...process.env }
		process.env.CLI_NAME = "CHEAP"
		process.env.COMMAND_NAME = ""
		process.env.APP_NAME = ""
		process.env.NAME = ""

		try {
			const lines = buildLogoLines(mockTheme)
			// C H E A P in block art row-0: C=▄▀▀ , H=█  █, E=██▀▀, A=▄▀▀▄, P=██▀▄
			expect(lines[0]).toContain("▄▀▀ ")
			expect(lines[0]).toContain("██▀▄")
		} finally {
			process.env = originalEnv
		}
	})

	it("strips surrounding quotes from the environment variable", () => {
		const originalEnv = { ...process.env }
		process.env.CLI_NAME = '"CHEAP"'
		process.env.COMMAND_NAME = ""
		process.env.APP_NAME = ""
		process.env.NAME = ""

		try {
			const lines = buildLogoLines(mockTheme)
			// After quote stripping, renders CHEAP
			expect(lines[0]).toContain("▄▀▀ ")
			expect(lines[0]).toContain("██▀▄")
		} finally {
			process.env = originalEnv
		}
	})

	it("falls back to KIMCHI if name contains unsupported characters", () => {
		const originalEnv = { ...process.env }
		process.env.CLI_NAME = "CHEAP⭐"
		process.env.COMMAND_NAME = ""
		process.env.APP_NAME = ""
		process.env.NAME = ""

		try {
			const lines = buildLogoLines(mockTheme)
			// Falls back to KIMCHI — K row-0 and M row-0 appear
			expect(lines[0]).toContain("█  █")
			expect(lines[0]).toContain("█▄ ▄█")
		} finally {
			process.env = originalEnv
		}
	})
})
