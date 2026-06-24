import { ANSI, fg } from "../ansi.js"
import { COMMANDS } from "./registry.js"

const SECTION_HEADER = "\x1b[1m"
const RESET = "\x1b[0m"

function bold(text: string): string {
	return `${SECTION_HEADER}${text}${RESET}`
}

function dim(text: string): string {
	return fg(ANSI.dim, text)
}

interface FlagDoc {
	name: string
	description: string
}

const CHEAP_FLAGS: FlagDoc[] = [
	{ name: "--provider <name>", description: "Provider (default: cheap-dev)" },
	{ name: "--model <pattern>", description: "Model id or pattern, optionally `provider/id` and/or `:<thinking>`" },
	{ name: "--thinking <level>", description: "Thinking level: off, minimal, low, medium, high, xhigh" },
	{ name: "--mode <mode>", description: "Output mode: text (default), json, rpc, acp" },
	{ name: "--print, -p", description: "Non-interactive mode: process prompt and exit" },
	{ name: "--continue, -c", description: "Resume the most recent session" },
	{ name: "--resume, -r", description: "Pick a previous session interactively" },
	{ name: "--session <path>", description: "Resume a specific session file (full path or partial UUID)" },
	{ name: "--no-session", description: "Run ephemerally — don't write a session file" },
	{ name: "--export <file>", description: "Export a session to HTML and exit" },
	{ name: "--list-models [search]", description: "Print available models (optionally fuzzy-filtered)" },
	{ name: "--allow-tool <rule>", description: "Add session permission allow rules (comma-separated)" },
	{ name: "--deny-tool <rule>", description: "Add session permission deny rules (comma-separated)" },
	{ name: "--plan", description: "Start in plan mode (read-only)" },
	{ name: "--auto", description: "Start in auto mode (run freely, classifier guards)" },
	{ name: "--yolo", description: "Start in yolo mode (run freely, no classifier - DANGER)" },
	{ name: "--permissions-config <path>", description: "Replace the merged permissions config with this file" },
	{ name: "--verbose", description: "Force verbose startup (overrides quietStartup)" },
	{ name: "--help, -h", description: "Show this help" },
	{ name: "--version, -v", description: "Show the cheap version" },
]

const CHEAP_ENV: FlagDoc[] = [
	{ name: "CHEAP_API_KEY", description: "Cheap API key (overrides config.json apiKey)" },
	{ name: "CHEAP_PERMISSIONS", description: "Initial permissions mode: default | plan | auto | yolo" },
	{
		name: "CHEAP_TELEMETRY_ENABLED",
		description: "Override telemetry (1/true to enable, 0/false to disable). On by default.",
	},
	{ name: "CHEAP_TAGS", description: "Comma-separated `key:value` tags applied to every LLM request" },
	{ name: "CHEAP_NO_UPDATE_CHECK", description: "Disable the background self-update probe" },
]

function printSection(rows: FlagDoc[], pad: number): void {
	for (const row of rows) {
		console.log(`  ${row.name.padEnd(pad)}${row.description}`)
	}
}

function maxNameWidth(rows: FlagDoc[]): number {
	return Math.max(...rows.map((r) => r.name.length))
}

/**
 * Print a self-contained help screen: cheap-specific subcommands, flags, and
 * env vars only. We deliberately don't delegate to pi-coding-agent's printer —
 * that would surface options and env vars (e.g. ANTHROPIC_API_KEY) and
 * extension-management commands that are not exposed by cheap.
 *
 * Flags listed here are forwarded verbatim to pi-coding-agent's parser when
 * the user runs the harness (no subcommand). Keep the list curated: only flags
 * that meaningfully affect cheap behaviour and that we expect to support
 * indefinitely.
 */
export async function printMergedHelp(): Promise<void> {
	console.log(`${bold("cheap")} — code with powerful open-source LLMs`)
	console.log()
	console.log(`${bold("Usage:")} cheap [subcommand] [options] [@files…] [messages…]`)
	console.log()

	console.log(bold("Subcommands:"))
	const cmdPad = Math.max(...COMMANDS.map((c) => c.name.length)) + 4
	for (const cmd of COMMANDS) {
		console.log(`  cheap ${cmd.name.padEnd(cmdPad)}${cmd.summary}`)
	}
	console.log(`  cheap ${"".padEnd(cmdPad)}${dim("(no subcommand)")} Launch the coding harness`)
	console.log()

	console.log(`${bold("Harness flags")} ${dim("(no subcommand)")}:`)
	printSection(CHEAP_FLAGS, maxNameWidth(CHEAP_FLAGS) + 2)
	console.log()

	console.log(bold("Environment variables:"))
	printSection(CHEAP_ENV, maxNameWidth(CHEAP_ENV) + 2)
	console.log()

	console.log(bold("Examples:"))
	console.log(`  cheap setup                                ${dim("# first-time interactive setup")}`)
	console.log(`  cheap setup-tools                          ${dim("# configure coding tools")}`)
	console.log(`  cheap config model                         ${dim("# configure AI providers & API keys")}`)
	console.log(`  cheap                                      ${dim("# launch the interactive harness")}`)
	console.log(`  cheap -p "explain src/cli.ts"              ${dim("# one-shot prompt, no session")}`)
	console.log(`  cheap --continue                           ${dim("# resume the most recent session")}`)
	console.log(`  cheap claude -p "review this PR"           ${dim("# run Claude Code via Cheap")}`)
}
