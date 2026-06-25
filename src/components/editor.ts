import { CustomEditor, type Theme } from "@earendil-works/pi-coding-agent"
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent"
import type { EditorTheme, TUI } from "@earendil-works/pi-tui"
import { Editor, isKittyProtocolActive, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui"
import { RST_FG } from "../ansi.js"

const CHEVRON_WIDTH = 2
const PLACEHOLDER_TEXT = "ask anything or type / for commands"

// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escapes
const ANSI_RE = /\x1b\[[^m]*m/g
const SCROLL_INDICATOR_RE = /^─── ([↑↓] \d+ more )/

function rebuildBorder(baseLine: string, targetWidth: number, borderFn: (s: string) => string): string {
	const raw = baseLine.replace(ANSI_RE, "")
	const match = raw.match(SCROLL_INDICATOR_RE)
	if (match) {
		const indicator = `─── ${match[1]}`
		return borderFn(indicator + "─".repeat(Math.max(0, targetWidth - indicator.length)))
	}
	return borderFn("─".repeat(targetWidth))
}

export class PromptEditor extends CustomEditor {
	private readonly appTheme: Theme
	private readonly kb: KeybindingsManager
	private expandHandler?: () => void
	private _pendingAttachmentIndicator: string | null = null
	private _pendingImageIndicator: string | null = null
	private _sessionIndicator: string | null = null

	private readonly isWorking: () => boolean

	constructor(tui: TUI, editorTheme: EditorTheme, keybindings: KeybindingsManager, appTheme: Theme, isWorking: () => boolean = () => false) {
		super(tui, editorTheme, keybindings)
		this.appTheme = appTheme
		this.kb = keybindings
		this.isWorking = isWorking
	}

	setExpandHandler(handler: () => void) {
		this.expandHandler = handler
	}

	/**
	 * Show a short status string in its own row just inside the editor's top
	 * border. Stays visible regardless of editor content until cleared with
	 * `null`. Used by the clipboard-image extension to surface pending pasted
	 * attachments.
	 */
	setPendingImageIndicator(text: string | null) {
		if (this._pendingImageIndicator === text) return
		this._pendingImageIndicator = text
		this.tui.requestRender()
	}

	/**
	 * Show a short status string for attached files.
	 */
	setPendingAttachmentIndicator(text: string | null) {
		if (this._pendingAttachmentIndicator === text) return
		this._pendingAttachmentIndicator = text
		this.tui.requestRender()
	}

	/**
	 * Show a short session label in its own row just inside the editor's top
	 * border. Used by the teleport extension to remind the user they are
	 * connected to a remote worker. Pass `null` to clear.
	 */
	setSessionIndicator(text: string | null) {
		if (this._sessionIndicator === text) return
		this._sessionIndicator = text
		this.tui.requestRender()
	}

	/**
	 * Compose the current session + pending-image indicators into a single
	 * raw string, or null if neither is set.
	 */
	private combinedIndicator(): string | null {
		const parts: string[] = []
		if (this._sessionIndicator) parts.push(this._sessionIndicator)
		if (this._pendingAttachmentIndicator) parts.push(this._pendingAttachmentIndicator)
		if (this._pendingImageIndicator) parts.push(this._pendingImageIndicator)
		return parts.length > 0 ? parts.join(" ") : null
	}

	/**
	 * Build a right-aligned, muted indicator row that fits inside `width`.
	 * Truncates with an ellipsis if the indicator text is wider than the row.
	 * Returns null when no indicator is set so the editor's row count stays
	 * unchanged when nothing is pending.
	 */
	private renderIndicatorRow(width: number): string | null {
		const raw = this.combinedIndicator()
		if (!raw) return null
		const muted = this.appTheme.getFgAnsi("muted")
		// truncateToWidth handles the wider-than-width case via cell-aware
		// truncation (preserves ANSI escapes, replaces the tail with "...").
		const truncated = truncateToWidth(raw, width)
		const tw = visibleWidth(truncated)
		const pad = " ".repeat(Math.max(0, width - tw))
		return `${pad}${muted}${truncated}${RST_FG}`
	}

	override handleInput(data: string) {
		if (this.expandHandler && this.kb.matches(data, "app.tools.expand")) {
			this.expandHandler()
			return
		}
		// tmux and some terminals send \x1b\r for Shift+Enter. Upstream parses
		// it as alt+enter when kitty protocol is not active, so app.message.followUp
		// intercepts it before Editor.handleInput can create a newline. Route it
		// directly to the Editor as \n, which the Editor always treats as newline.
		if (!isKittyProtocolActive() && (data === "\x1b\r" || data === "\x1b\n")) {
			// Re-emit as \n so Editor.handleInput treats it as a newline
			// (its explicit fallback catches \n before the submit path).
			// Going through super avoids brittle prototype-chain jumps.
			super.handleInput("\n")
			return
		}
		super.handleInput(data)
	}

	render(width: number): string[] {
		const border = (s: string) => (this.borderColor ? this.borderColor(s) : s)
		const chevronColor = this.appTheme.getFgAnsi("accent")
		const textColor = this.appTheme.getFgAnsi("text")
		const muted = this.appTheme.getFgAnsi("muted")
		// Using customMessageBg for the text area background. In terminals, actual opacity is not supported,
		// so this theme color represents a faint overlay (approx 15% visual contrast).
		const bg = this.appTheme.getBgAnsi("customMessageBg") || ""
		const RST_BG = "\x1b[49m"

		const innerWidth = width
		// Chevron width is 2 ("▌ ")
		const contentWidth = innerWidth - CHEVRON_WIDTH

		// Editor body always renders at the full content width
		const lines = super.render(contentWidth)

		// Find bottom border: scan backwards for a line starting with ─
		let bottomIdx = Math.min(2, lines.length - 1)
		for (let i = lines.length - 1; i >= 2; i--) {
			const stripped = lines[i].replace(ANSI_RE, "")
			if (/^─/.test(stripped)) {
				bottomIdx = i
				break
			}
		}

		const result: string[] = []
		const rowsToRender: string[] = []

		// Top scroll indicator from original top border
		const topRaw = lines[0].replace(ANSI_RE, "")
		const topMatch = topRaw.match(SCROLL_INDICATOR_RE)
		if (topMatch) {
			const indicator = topMatch[1].trim()
			rowsToRender.push(`${muted}${indicator}${RST_FG}`)
		}

		// Indicator row sits between the top scroll indicator and the first content row
		const indicatorRow = this.renderIndicatorRow(contentWidth)
		if (indicatorRow !== null) {
			rowsToRender.push(indicatorRow)
		}

		if (this.getText().length === 0) {
			const cursorMarker = "\x1b_pi:c\x07"
			// Use terminal's native cursor — no custom styling
			const cursor = `${cursorMarker} `
			const cursorCellWidth = 1
			const leadWidth = cursorCellWidth
			const placeholderBudget = contentWidth - leadWidth
			const placeholderText = placeholderBudget >= visibleWidth(PLACEHOLDER_TEXT) ? PLACEHOLDER_TEXT : ""
			// Use \x1b[90m\x1b[1m (bright black/grey + bold) for the placeholder to ensure it's visible and thick
			const placeholderRendered = placeholderText.length > 0 ? `\x1b[90m\x1b[1m${placeholderText}\x1b[22m${RST_FG}` : ""

			rowsToRender.push(`${cursor}${placeholderRendered}`)
			// Ensure min 3 lines
			rowsToRender.push("")
			rowsToRender.push("")
		} else {
			const contentLines = lines.slice(1, bottomIdx)
			let cursorIdx = contentLines.findIndex((l) => l.includes("\x1b_pi:c"))
			if (cursorIdx === -1) cursorIdx = 0

			// Pad to minimum 3 lines
			while (contentLines.length < 3) {
				contentLines.push("")
			}

			for (let i = 0; i < contentLines.length; i++) {
				let line = contentLines[i]

				// Apply text color and strip inverse-video cursor styling for the active line
				if (i === cursorIdx) {
					line = line.replace("\x1b[7m", "")
				}

				// Always restore textColor after any reset in the line so text remains visible
				const styled = line.replaceAll("\x1b[0m", `\x1b[0m${textColor}`)
				rowsToRender.push(`${textColor}${styled}${RST_FG}`)
			}
		}

		// Bottom scroll indicator from original bottom border
		const bottomRaw = lines[bottomIdx].replace(ANSI_RE, "")
		const bottomMatch = bottomRaw.match(SCROLL_INDICATOR_RE)
		if (bottomMatch) {
			const indicator = bottomMatch[1].trim()
			rowsToRender.push(`${muted}${indicator}${RST_FG}`)
		}

		const totalRows = rowsToRender.length
		const isGenerating = this.isWorking()

		// Helper to wrap content with left border, background, and right padding
		const renderRowWithBg = (content: string, w: number, rowIndex: number): string => {
			let prefixStr = ""
			if (isGenerating && totalRows > 0) {
				const waveSpeed = 150
				const litIdx = Math.floor(Date.now() / waveSpeed) % totalRows
				if (rowIndex === litIdx) {
					prefixStr = `\x1b[1m${chevronColor}▌${RST_FG}\x1b[22m `
				} else if (rowIndex === (litIdx - 1 + totalRows) % totalRows) {
					prefixStr = `\x1b[2m${chevronColor}▌\x1b[22m${RST_FG} `
				} else {
					prefixStr = `${muted}▌${RST_FG} `
				}
			} else {
				prefixStr = `${muted}▌${RST_FG} `
			}

			const vW = visibleWidth(content)
			const rightPad = " ".repeat(Math.max(0, w - vW))
			// If content contains ANSI resets (\x1b[0m), they reset both foreground and background.
			// We inject the background color after every reset to maintain the text area background,
			// and also right pad with the background color intact.
			const safeContent = bg ? content.replaceAll("\x1b[0m", `\x1b[0m${bg}`) : content
			return `${prefixStr}${bg}${safeContent}${rightPad}${RST_BG}`
		}

		for (let i = 0; i < totalRows; i++) {
			result.push(renderRowWithBg(rowsToRender[i], contentWidth, i))
		}

		// Add a faint bottom border line below the input field
		// Using 256-color palette \x1b[38;5;Nm
		// 235 is #262626 which is extremely close to #282828ff.
		const borderFaintColor = "\x1b[38;5;235m"
		// Using a thin line "─" for a 1px / 0.5px look
		result.push(`${borderFaintColor}${"⏥".repeat(innerWidth)}${RST_FG}`)

		// Suggestions and metadata (indented to match content width)
		for (let i = bottomIdx + 1; i < lines.length; i++) {
			result.push(`  ${lines[i]}`)
		}

		return result.map((line) => truncateToWidth(line, width))
	}
}
