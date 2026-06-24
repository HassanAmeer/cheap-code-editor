import { describe, expect, it } from "vitest"
import { updateModelsConfig } from "./models.js"
import { join } from "node:path"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"

describe("updateModelsConfig", () => {
	it("returns empty models when no local config exists", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "cheap-models-test-"))
		const modelsJsonPath = join(tempDir, "models.json")

		const result = await updateModelsConfig(modelsJsonPath, "test-key")
		expect(result.models.length).toBeGreaterThan(0)

		rmSync(tempDir, { recursive: true, force: true })
	})
})
