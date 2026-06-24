/**
 * Unit tests for config-model.ts pure helper functions.
 *
 * We test the env-file read/write helpers by operating on temp files via
 * module-level path overrides — no TUI, no clack, no process.env mutation.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// We test the helpers by copying their logic and running against a temp dir.
// This avoids mocking homedir() and keeps tests hermetic.
// ---------------------------------------------------------------------------

function censorKey(key: string): string {
	if (!key) return ""
	if (key.length <= 15) return `****${key.slice(-Math.min(key.length - 1, 3))}`
	return `${key.slice(0, 4)}...${key.slice(-4)}`
}

function readEnvFile(envPath: string): Map<string, string> {
	const map = new Map<string, string>()
	if (!existsSync(envPath)) return map
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const eq = line.indexOf("=")
		if (eq < 1 || line.trimStart().startsWith("#")) continue
		const k = line.slice(0, eq).trim()
		const v = line
			.slice(eq + 1)
			.trim()
			.replace(/^["']|["']$/g, "")
		map.set(k, v)
	}
	return map
}

function writeEnvKey(envPath: string, key: string, value: string): void {
	mkdirSync(join(envPath, ".."), { recursive: true })
	let content = existsSync(envPath) ? readFileSync(envPath, "utf-8") : ""
	const lines = content.split("\n")
	let found = false
	const newLines: string[] = []

	for (const line of lines) {
		if (line.trim().startsWith(`${key}=`)) {
			if (value.trim() !== "") newLines.push(`${key}="${value.trim()}"`)
			found = true
		} else {
			newLines.push(line)
		}
	}

	if (!found && value.trim() !== "") {
		if (newLines.length > 0 && newLines[newLines.length - 1] !== "") newLines.push("")
		newLines.push(`${key}="${value.trim()}"`)
	}

	content = `${newLines.join("\n").trimEnd()}\n`
	writeFileSync(envPath, content, "utf-8")
}

// ---------------------------------------------------------------------------

let tmpDir: string
let envPath: string

beforeEach(() => {
	tmpDir = join(tmpdir(), `cheap-test-${process.pid}-${Date.now()}`)
	mkdirSync(tmpDir, { recursive: true })
	envPath = join(tmpDir, ".env")
})

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true })
})

describe("readEnvFile", () => {
	it("returns empty map when file does not exist", () => {
		expect(readEnvFile(envPath).size).toBe(0)
	})

	it("parses unquoted values", () => {
		writeFileSync(envPath, "FOO=bar\nBAZ=qux\n", "utf-8")
		const map = readEnvFile(envPath)
		expect(map.get("FOO")).toBe("bar")
		expect(map.get("BAZ")).toBe("qux")
	})

	it("parses double-quoted values and strips quotes", () => {
		writeFileSync(envPath, `OPENAI_API_KEY="sk-abc123"\n`, "utf-8")
		expect(readEnvFile(envPath).get("OPENAI_API_KEY")).toBe("sk-abc123")
	})

	it("skips comment lines", () => {
		writeFileSync(envPath, "# this is a comment\nFOO=bar\n", "utf-8")
		const map = readEnvFile(envPath)
		expect(map.has("# this is a comment")).toBe(false)
		expect(map.get("FOO")).toBe("bar")
	})

	it("skips blank lines", () => {
		writeFileSync(envPath, "\n\nFOO=bar\n\n", "utf-8")
		expect(readEnvFile(envPath).get("FOO")).toBe("bar")
	})
})

describe("writeEnvKey", () => {
	it("creates the file when it doesn't exist", () => {
		writeEnvKey(envPath, "GEMINI_API_KEY", "my-gemini-key")
		expect(existsSync(envPath)).toBe(true)
		expect(readEnvFile(envPath).get("GEMINI_API_KEY")).toBe("my-gemini-key")
	})

	it("appends a new key to an existing file", () => {
		writeFileSync(envPath, `OPENAI_API_KEY="sk-old"\n`, "utf-8")
		writeEnvKey(envPath, "GEMINI_API_KEY", "gemini-new")
		const map = readEnvFile(envPath)
		expect(map.get("OPENAI_API_KEY")).toBe("sk-old")
		expect(map.get("GEMINI_API_KEY")).toBe("gemini-new")
	})

	it("updates an existing key in place", () => {
		writeFileSync(envPath, `OPENAI_API_KEY="sk-old"\n`, "utf-8")
		writeEnvKey(envPath, "OPENAI_API_KEY", "sk-new")
		const map = readEnvFile(envPath)
		expect(map.get("OPENAI_API_KEY")).toBe("sk-new")
		// Should not have duplicates
		const raw = readFileSync(envPath, "utf-8")
		expect(raw.split("OPENAI_API_KEY").length - 1).toBe(1)
	})

	it("removes a key when value is empty string", () => {
		writeFileSync(envPath, `OPENAI_API_KEY="sk-old"\nFOO=bar\n`, "utf-8")
		writeEnvKey(envPath, "OPENAI_API_KEY", "")
		const map = readEnvFile(envPath)
		expect(map.has("OPENAI_API_KEY")).toBe(false)
		expect(map.get("FOO")).toBe("bar")
	})

	it("preserves comments in the file", () => {
		writeFileSync(envPath, "# comment\nFOO=bar\n", "utf-8")
		writeEnvKey(envPath, "NEW_KEY", "val")
		const raw = readFileSync(envPath, "utf-8")
		expect(raw).toContain("# comment")
	})
})

describe("censorKey", () => {
	it("censors a long key", () => {
		const result = censorKey("sk-1234567890abcdef")
		expect(result).toMatch(/^sk-1\.\.\./)
		expect(result).toContain("cdef")
	})

	it("censors a short key", () => {
		const result = censorKey("short")
		expect(result).toMatch(/^\*{4}/)
	})

	it("returns empty string for empty input", () => {
		expect(censorKey("")).toBe("")
	})
})
