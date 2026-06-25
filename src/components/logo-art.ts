import type { Theme } from "@earendil-works/pi-coding-agent"
import { RST_FG } from "../ansi.js"
import { getFolder, getGitBranch, getVersion } from "../utils.js"

let cachedVersion: string | undefined

/** Truncate a file-system path to fit `maxWidth` while preserving the basename. */
export function truncatePath(path: string, maxWidth: number): string {
	if (path.length <= maxWidth) return path

	const lastSlash = path.lastIndexOf("/")
	if (lastSlash <= 0 || lastSlash >= path.length - 1) {
		return `${path.slice(0, Math.max(0, maxWidth - 3))}...`
	}

	const dir = path.slice(0, lastSlash)
	const basename = path.slice(lastSlash + 1)
	const ellipsis = "..."
	const sep = "/"

	// Find the longest dir-component prefix (ending at a "/") that fits.
	// e.g. for "/home/user/cast" we try "/home", then "/hom", "/ho", "/h"…
	// Prefer a slash boundary: walk from the end of dir backwards through slashes first.
	const slashPositions: number[] = []
	for (let i = dir.length - 1; i >= 1; i--) {
		if (dir[i] === "/") slashPositions.push(i)
	}
	// Also allow mid-segment truncation as a fallback (all prefix lengths)
	for (let i = dir.length - 1; i >= 1; i--) {
		if (dir[i] !== "/") slashPositions.push(i)
	}

	for (const prefixLen of slashPositions) {
		const candidate = dir.slice(0, prefixLen) + ellipsis + sep + basename
		if (candidate.length <= maxWidth) return candidate
	}

	// Fall back to simple right truncation
	return `${path.slice(0, Math.max(0, maxWidth - 3))}...`
}

export function buildLogoLines(theme: Theme): string[] {
	const L = theme.getFgAnsi("accent")

	return [
		`${L}                          ██                                                          ${RST_FG}`,
		`${L}                      ▓▓██  ██                                                        ${RST_FG}`,
		`${L}                  ▓▓▓▓▒▒▒▒░░▒▒▒▒▓▓                                                    ${RST_FG}`,
		`${L}                  ▓▓░░▓▓░░░░░░░░░░▒▒▓▓▓▓▒▒                                            ${RST_FG}`,
		`${L}                  ▓▓░░░░▓▓▓▓░░░░░░▓▓▓▓░░░░▓▓▓▓                                        ${RST_FG}`,
		`${L}                  ▓▓░░░░░░░░▓▓▓▓▓▓░░▓▓░░░░░░░░▓▓▓▓                                    ${RST_FG}`,
		`${L}                  ▓▓░░░░░░░░░░▓▓░░░░▓▓░░░░  ██▓▓▓▓██                                  ${RST_FG}`,
		`${L}                  ▓▓██░░░░░░  ▓▓░░░░▓▓░░████░░░░░░▓▓                                  ${RST_FG}`,
		`${L}                ░░░░░░▒▒░░░░  ▓▓░░░░▓▓░░▒▒▒▒░░░░░░▓▓                                  ${RST_FG}`,
		`${L}              ▒▒░░░░░░  ▒▒▒▒  ▓▓░░░░▒▒▒▒░░░░░░░░░░▓▓                                  ${RST_FG}`,
		`${L}            ▓▓░░░░░░░░░░░░░░▓▓▓▓░░░░░░░░░░░░░░░░░░▓▓                                  ${RST_FG}`,
		`${L}          ▓▓░░░░░░░░░░░░░░  ▓▓▒▒░░░░░░░░░░░░░░░░░░▓▓                                  ${RST_FG}`,
		`${L}        ▓▓░░░░░░░░░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░▓▓                                  ${RST_FG}`,
		`${L}      ▓▓░░░░░░░░░░░░░░░░▓▓░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓                                  ${RST_FG}`,
		`${L}      ██  ░░░░░░░░░░░░██░░░░░░░░░░░░██▓▓                                              ${RST_FG}`,
		`${L}    ██  ░░░░░░░░░░░░██░░░░░░░░░░░░░░▓▓                                                ${RST_FG}`,
		`${L}    ▓▓░░░░░░░░░░░░██░░░░░░░░░░▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}  ░░▒▒░░░░░░░░░░▒▒▒▒░░░░░░░░▓▓▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░░░▓▓░░░░░░░░▓▓▒▒▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░▓▓░░░░░░░░▓▓▓▓▒▒▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░▓▓░░░░░░░░▓▓▒▒▒▒▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}▓▓░░░░░░░░░░░░▓▓░░░░░░░░██▒▒▒▒▓▓░░░░▓▓▓▓                                              ${RST_FG}`,
		`${L}▓▓░░░░░░░░░░██░░░░░░░░░░██▒▒▒▒▓▓░░░░▓▓▒▒▓▓██                                                      /$$                                    ${RST_FG}`,
		`${L}▓▓░░░░░░░░░░▓▓░░░░░░░░░░██▒▒▒▒▓▓░░░░▓▓▒▒▒▒▒▒████                                                | $$                                    ${RST_FG}`,
		`${L}▓▓░░░░░░░░░░▓▓░░▒▒░░░░░░░░▓▓▒▒▓▓░░░░▓▓▓▓▒▒▓▓▓▓▓▓▒▒▒▒                                    /$$$$$$$| $$$$$$$   /$$$$$$   /$$$$$$   /$$$$$$ ${RST_FG}`,
		`${L}░░██░░░░░░░░▓▓░░░░░░░░░░░░▒▒▒▒░░░░░░▓▓░░▒▒▒▒▒▒▒▒▒▒▒▒░░                                 /$$_____/| $$__  $$ /$$__  $$ |____  $$ /$$__  $$${RST_FG}`,
		`${L}  ▓▓░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░░░▒▒░░░░░░░░░░░░▓▓                                | $$      | $$  \\ $$| $$$$$$$$  /$$$$$$$| $$  \\ $$${RST_FG}`,
		`${L}  ░░▒▒░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▒▒▒                              | $$      | $$  | $$| $$_____/ /$$__  $$| $$  | $$${RST_FG}`,
		`${L}      ▓▓░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓                              |  $$$$$$$| $$  | $$|  $$$$$$$|  $$$$$$$| $$$$$$$/${RST_FG}`,
		`${L}        ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓                               \\_______/|__/  |__/ \\_______/ \\_______/| $$____/ ${RST_FG}`,
		`${L}            ██▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓                                                                      | $$      ${RST_FG}`,
		`${L}                ██▓▓░░░░░░░░░░░░░░░░▓▓▓▓▓▓░░░░░░░░░░░░▓▓                                                                      | $$      ${RST_FG}`,
		`${L}                    ██▓▓▓▓▓▓▓▓▓▓░░░░▓▓▒▒▒▒██░░░░░░░░░░▓▓                                                                      |__/      ${RST_FG}`,
		`${L}                  ██░░░░░░░░  ▓▓░░░░▓▓▒▒▒▒▓▓░░░░░░░░░░▓▓                              ${RST_FG}`,
		`${L}                  ▓▓░░░░░░░░  ▓▓░░░░▓▓▒▒▒▒▓▓░░░░░░░░░░▓▓                              ${RST_FG}`,
		`${L}                  ▓▓░░░░░░░░  ▓▓░░░░▓▓▒▒▒▒▓▓░░░░░░░░▓▓░░                              ${RST_FG}`,
		`${L}                  ▓▓░░░░░░░░  ▓▓░░░░▓▓▒▒▒▒▓▓░░░░░░░░▓▓                                ${RST_FG}`,
		`${L}                  ▓▓░░░░░░░░  ▓▓░░░░▓▓▒▒▓▓░░░░░░░░▓▓                                  ${RST_FG}`,
		`${L}              ▓▓▓▓▓▓▓▓▓▓  ░░  ▓▓░░░░▓▓▓▓░░░░░░░░░░▓▓                                  ${RST_FG}`,
		`${L}  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░██░░  ▓▓░░░░▓▓░░░░░░░░░░▓▓                                    ${RST_FG}`,
		`${L}  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░██  ▓▓░░░░░░░░░░░░░░▓▓                                      ${RST_FG}`,
		`${L}  ▓▓▓▓▒▒▒▒██░░░░░░░░░░░░░░▓▓██▓▓░░░░░░░░░░░░▒▒░░                                      ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░░░░░▓▓▓▓▓▓░░▓▓▓▓▒▒░░░░░░░░░░▓▓                                          ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░  ▓▓░░░░░░░░░░░░░░░░░░░░░░░░▓▓                                            ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░▓▓                                              ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░▓▓                                                ${RST_FG}`,
		`${L}  ▓▓░░░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░▓▓                                                ${RST_FG}`,
		`${L}    ▓▓▓▓  ░░░░▓▓░░░░░░░░░░░░▓▓▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}        ██▓▓  ▓▓░░░░░░░░▓▓▓▓░░▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}            ██▓▓▓▓▓▓▓▓▓▓░░░░  ▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}                      ▓▓░░░░  ▓▓░░░░▓▓                                                ${RST_FG}`,
		`${L}                      ░░▒▒▒▒  ▓▓░░██░░                                                ${RST_FG}`,
		`${L}                          ░░▓▓▓▓▓▓░░                                                  ${RST_FG}`,
		`${L}                            ▒▒▒▒▒▒                                                    ${RST_FG}`,
	]
}

export function buildInfoLines(
	theme: Theme,
	{ folderMaxWidth, getBranch }: { folderMaxWidth?: number; getBranch?(): string | undefined } = {},
): string[] {
	if (!cachedVersion) cachedVersion = getVersion()
	const dim = theme.getFgAnsi("dim")
	const branchColor = theme.getFgAnsi("mdLink")
	let folder = getFolder()
	if (folderMaxWidth !== undefined && folder.length > folderMaxWidth) {
		folder = truncatePath(folder, folderMaxWidth)
	}
	const branch = getBranch ? getBranch() : getGitBranch()
	const vdot = ` ${dim}·${RST_FG} `
	const lines: string[] = [`${dim}v${cachedVersion}${RST_FG}${vdot}${dim}${folder}${RST_FG}`]
	if (branch) {
		lines.push(`${branchColor}${branch}${RST_FG}`)
	}
	return lines
}
