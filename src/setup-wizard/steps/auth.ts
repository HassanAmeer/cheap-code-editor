import { spinner } from "@clack/prompts"
import { validateApiKey } from "../../auth/validator.js"
import { readApiKeyFromConfigFile, writeApiKey } from "../../config.js"
import { confirm, password } from "../prompt.js"
import type { WizardState } from "../state.js"

/**
 * Auth step — secure an API key for the rest of the wizard. Two frames:
 *
 *   1. **Saved-key frame** — when a key is already available (env var or
 *      ~/.config/cheap/config.json), offer "use saved / enter new" (Y/n).
 *      On Y the existing key is validated and accepted; on N we fall
 *      through to the input frame so the user can replace it.
 *   2. **Input frame** — prompt for a key, validate, retry on failure
 *      (with the validator's suggestions printed). On success the key is
 *      written to config.json so future runs land in frame 1.
 *
 * The wizard's persistence is split with runDoneStep: this step writes
 * a newly-entered key to ~/.config/cheap/config.json; runDoneStep then
 * exports state.apiKey to the user's shell profile so future shells see
 * $CHEAP_API_KEY automatically. The current shell session keeps
 * whatever $CHEAP_API_KEY was set to on entry until it's reloaded or
 * unset.
 */
export async function runAuthStep(state: WizardState, opts: { backable: boolean }): Promise<void> {
	const envKey = process.env.CHEAP_API_KEY
	const fileKey = readApiKeyFromConfigFile()
	const fromEnv = !!(envKey && envKey.length > 0)
	const currentKey = fromEnv ? (envKey as string) : (fileKey ?? "")

	if (currentKey.length > 0) {
		const r = await confirm({
			message: "An API key is already configured. Keep it?",
			initialValue: true,
			backable: opts.backable,
		})
		if (r.kind === "back") {
			state.back = true
			return
		}
		if (r.kind === "cancel") {
			state.cancelled = true
			return
		}
		if (r.value) {
			const s = spinner()
			s.start("Validating saved API key…")
			const result = await validateApiKey(currentKey)
			if (result.valid) {
				s.stop("Saved API key valid.")
				state.apiKey = currentKey
				return
			}
			s.stop(`Saved key failed validation: ${result.error ?? "unknown error"}`)
			console.log("  Replace it below, press Esc to go back, or Ctrl-C to abort.")
		} else if (fromEnv) {
			console.log(
				"  Note: this shell still has $CHEAP_API_KEY set; the new key will be written to config.json and your shell profile, so new shells pick it up automatically. To use it here, run 'unset CHEAP_API_KEY' or open a new terminal.",
			)
		}
	}

	await promptAndValidateKey(state, opts.backable)
}

async function promptAndValidateKey(state: WizardState, backable: boolean): Promise<void> {
	for (;;) {
		const entered = await password({
			message: "Paste your API key, or press Enter to skip (for local models)",
			backable,
		})
		if (entered.kind === "back") {
			state.back = true
			return
		}
		if (entered.kind === "cancel") {
			state.cancelled = true
			return
		}

		let tokenToValidate: string

		if (entered.value.length === 0) {
			// User skipped API key setup because they use local models
			state.apiKey = ""
			return
		}

		tokenToValidate = entered.value

		const s = spinner()
		s.start("Validating API key…")
		const result = await validateApiKey(tokenToValidate)
		if (result.valid) {
			s.stop("API key valid.")
			state.apiKey = tokenToValidate
			writeApiKey(state.apiKey)
			return
		}
		s.stop(`Validation failed: ${result.error ?? "unknown error"}`)
		for (const sug of result.suggestions ?? ["Try a different key, press Esc to go back, or Ctrl-C to abort."]) {
			console.log(`  - ${sug}`)
		}
	}
}
