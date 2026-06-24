import { describe, expect, it } from "vitest"
import { isWithinCheapPlans } from "./index.js"

describe("isWithinCheapPlans", () => {
	const cwd = "/home/user/myproject"

	it("allows absolute path within .cheap/plans/", () => {
		expect(isWithinCheapPlans("/home/user/myproject/.cheap/plans/my-plan.md", cwd)).toBe(true)
	})

	it("allows absolute path in nested subdir of .cheap/plans/", () => {
		expect(isWithinCheapPlans("/home/user/myproject/.cheap/plans/sub/plan.md", cwd)).toBe(true)
	})

	it("blocks absolute path outside .cheap/plans/", () => {
		expect(isWithinCheapPlans("/home/user/myproject/src/index.ts", cwd)).toBe(false)
	})

	it("blocks absolute path in .cheap/ but not plans/", () => {
		expect(isWithinCheapPlans("/home/user/myproject/.cheap/agents/my-agent.md", cwd)).toBe(false)
	})

	it("allows relative path .cheap/plans/foo.md", () => {
		expect(isWithinCheapPlans(".cheap/plans/foo.md", cwd)).toBe(true)
	})

	it("blocks relative path outside plans", () => {
		expect(isWithinCheapPlans("src/index.ts", cwd)).toBe(false)
	})

	it("blocks path traversal attempt", () => {
		expect(isWithinCheapPlans("/home/user/myproject/.cheap/plans/../../../etc/passwd", cwd)).toBe(false)
	})

	it("blocks absolute path from a different project", () => {
		expect(isWithinCheapPlans("/home/user/otherproject/.cheap/plans/plan.md", cwd)).toBe(false)
	})

	it("cwd with trailing slash works correctly", () => {
		expect(isWithinCheapPlans("/home/user/myproject/.cheap/plans/plan.md", "/home/user/myproject/")).toBe(true)
	})
})
