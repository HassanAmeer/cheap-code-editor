/**
 * Single source of truth for the `process.__cheap*` side-channel globals.
 *
 * The upstream pi-mono bundle cannot import from this repo's source directly,
 * so the patch code reads these flags straight off `process`.  All TypeScript
 * code in this repo should go through the functions below — never cast and
 * write to `process` directly — so the contract stays in one place.
 *
 * __cheapMultiModelEnabled — true while the virtual "multi-model" entry is
 *   the active selection.  Written by setMultiModelEnabled(); read by the
 *   model-selector patch to highlight the virtual entry.
 *
 * __cheapOrchestratorRef  — "provider/model-id" string of the current
 *   orchestrator role.  Written whenever roles change (or at module init).
 *   The patch uses this to inject the correct virtual entry and to resolve
 *   which real model backs "multi-model".  It must NOT change when only the
 *   enabled flag changes — that was the staleness bug this module fixes.
 */

type CheapProcess = NodeJS.Process & {
	__cheapMultiModelEnabled?: boolean
	__cheapOrchestratorRef?: string
}

const proc = process as CheapProcess

// ---------------------------------------------------------------------------
// __cheapMultiModelEnabled
// ---------------------------------------------------------------------------

export function getProcessMultiModelEnabled(): boolean | undefined {
	return proc.__cheapMultiModelEnabled
}

export function setProcessMultiModelEnabled(enabled: boolean): void {
	proc.__cheapMultiModelEnabled = enabled
}

// ---------------------------------------------------------------------------
// __cheapOrchestratorRef
// ---------------------------------------------------------------------------

export function getProcessOrchestratorRef(): string | undefined {
	return proc.__cheapOrchestratorRef
}

export function setProcessOrchestratorRef(ref: string): void {
	proc.__cheapOrchestratorRef = ref
}
