#!/usr/bin/env bun

// Thin entrypoint that sets environment variables BEFORE any pi-mono code is imported.
// Static ESM imports are hoisted and initialized before the module body runs, so cli.ts
// (which statically imports extensions that transitively pull in pi-mono's config.js)
// cannot set PI_PACKAGE_DIR early enough. This module has zero pi-mono transitive deps,
// guaranteeing the env var is in place before config.js reads it.

import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config as dotenvConfig } from "dotenv"
import { resolveAuxiliaryFilesDir } from "./auxiliary-files/resolver.js"
import { validateAuxiliaryFiles } from "./auxiliary-files/validator.js"
import { installPasteInterceptor } from "./paste-interceptor.js"
import { installProxyAgent } from "./proxy.js"
import { isProxyMode, runProxy } from "./ssh-proxy.js"

// Must happen before installPasteInterceptor / installProxyAgent touch stdin/stdout.
// SSH ProxyCommand wires stdin/stdout as a raw binary pipe — any bytes written
// before exec corrupts the handshake.
const rawArgv = process.argv.slice(2)
if (isProxyMode(rawArgv)) {
	runProxy(rawArgv[rawArgv.indexOf("--ssh-proxy") + 1])
}

const preSet = !!process.env.PI_PACKAGE_DIR
const auxiliaryDir = resolveAuxiliaryFilesDir(process.env, homedir(), process.execPath)
if (!preSet) {
	try {
		validateAuxiliaryFiles(auxiliaryDir)
	} catch (err) {
		console.error((err as Error).message)
		process.exit(1)
	}
}
process.env.PI_PACKAGE_DIR = auxiliaryDir

// Load environment variables for custom CLI/command names and providers
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
dotenvConfig({ path: resolve(process.cwd(), ".env.local") })
dotenvConfig({ path: resolve(process.cwd(), ".env") })
dotenvConfig({ path: resolve(packageRoot, ".env.local") })
dotenvConfig({ path: resolve(packageRoot, ".env") })
dotenvConfig({ path: resolve(auxiliaryDir, ".env.local") })
dotenvConfig({ path: resolve(auxiliaryDir, ".env") })

const oauthTemplateDir = resolve(process.env.PI_PACKAGE_DIR, "resources", "oauth")
if (existsSync(oauthTemplateDir)) {
	process.env.CHEAP_OAUTH_TEMPLATE_DIR = oauthTemplateDir
} else {
	process.env.CHEAP_OAUTH_TEMPLATE_DIR = resolve(process.env.PI_PACKAGE_DIR, "oauth")
}

const inheritedPiAgentDir = process.env.PI_CODING_AGENT_DIR
const agentDir = resolve(homedir(), ".config", "cheap", "harness")
process.env.CHEAP_CODING_AGENT_DIR = agentDir
if (inheritedPiAgentDir && !process.env.CHEAP_ORIGINAL_PI_CODING_AGENT_DIR) {
	process.env.CHEAP_ORIGINAL_PI_CODING_AGENT_DIR = inheritedPiAgentDir
}
process.env.PI_CODING_AGENT_DIR = agentDir

process.title = process.env.COMMAND_NAME || "cheap"
process.env.PI_SKIP_VERSION_CHECK = "1"
process.env.CHEAP_DISABLE_BUILTIN_PROVIDERS = "1"

installProxyAgent()

// Install before the dynamic cli.js import - the interceptor must wrap process.stdin.emit before any pi-* listener attaches. See src/paste-interceptor.ts for the rationale (LLM-1358).
installPasteInterceptor()

await import("./cli.js")
