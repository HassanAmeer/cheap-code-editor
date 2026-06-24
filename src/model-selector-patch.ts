import { InteractiveMode, ModelSelectorComponent } from "@earendil-works/pi-coding-agent"
import { Text, Spacer, getKeybindings } from "@earendil-works/pi-tui"
import { modelsAreEqual } from "@earendil-works/pi-ai"
import { fg, ANSI, semanticFg } from "./ansi.js"
import { modelInfoMap } from "./providers/index.js"

// ---------------------------------------------------------------------------
// Patch InteractiveMode to disable upstream /login and /logout commands
// ---------------------------------------------------------------------------
// biome-ignore lint/suspicious/noExplicitAny: private upstream prototype mutation
const imProto = InteractiveMode.prototype as any
imProto.showOAuthSelector = async function (this: any, mode: "login" | "logout") {
	this.ui?.notify(`${mode === "login" ? "Login" : "Logout"} is disabled. Use /config model to configure providers.`, "info")
}

// ---------------------------------------------------------------------------
// Patch ModelSelectorComponent to group models by Fast/Grid/Slow
// ---------------------------------------------------------------------------
const modelSelectorProto = ModelSelectorComponent.prototype as any
const originalLoadModels = modelSelectorProto.loadModels

const providerOrder = ["Fast", "Sometimes Slow"]
const sortFn = (a: any, b: any) => {
	const idxA = providerOrder.indexOf(a.provider)
	const idxB = providerOrder.indexOf(b.provider)
	if (idxA !== idxB) return idxA - idxB
	return 0
}

modelSelectorProto.loadModels = async function (this: any) {
	await originalLoadModels.call(this)

	const categorizeItem = (item: any) => {
		// Use modelInfoMap (survives models.json round-trip) to get category
		const modelId = item.model?.id || item.id || ""
		const info = modelInfoMap.get(modelId)
		const cat = info?.category ?? (item.model as any)?._category ?? ""
		if (cat === "Fast" || cat === "Grid") {
			item.provider = "Fast"
		} else {
			item.provider = "Sometimes Slow"
		}
	}

	for (const item of this.allModels || []) {
		categorizeItem(item)
	}
	for (const item of this.scopedModelItems || []) {
		categorizeItem(item)
	}

	this.allModels.sort(sortFn)
	this.scopedModelItems.sort(sortFn)

	this.activeModels = this.scope === "scoped" ? this.scopedModelItems : this.allModels
	this.filteredModels = [...this.activeModels]

	const currentIndex = this.filteredModels.findIndex((item: any) => modelsAreEqual(this.currentModel, item.model))
	this.selectedIndex = currentIndex >= 0 ? currentIndex : Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1))
}

const originalFilterModels = modelSelectorProto.filterModels
modelSelectorProto.filterModels = function (this: any, term: string) {
	originalFilterModels.call(this, term)
	// Re-apply our category grouping after the upstream filter (which resets item.provider)
	for (const item of this.filteredModels || []) {
		const modelId = item.model?.id || item.id || ""
		const info = modelInfoMap.get(modelId)
		const cat = info?.category ?? (item.model as any)?._category ?? ""
		item.provider = (cat === "Fast" || cat === "Grid") ? "Fast" : "Sometimes Slow"
	}
	this.filteredModels.sort(sortFn)

	const currentIndex = this.filteredModels.findIndex((item: any) => modelsAreEqual(this.currentModel, item.model))
	this.selectedIndex = currentIndex >= 0 ? currentIndex : Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1))
}

const originalHandleInput = modelSelectorProto.handleInput

modelSelectorProto.handleInput = function (this: any, keyData: any) {
	const kb = getKeybindings()
	
	if (kb.matches(keyData, "tui.input.tab")) {
		if (this.scopedModelItems.length > 0) {
			const nextScope = this.scope === "all" ? "scoped" : "all"
			this.setScope(nextScope)
			if (this.scopeHintText) {
				this.scopeHintText.setText(this.getScopeHintText())
			}
		}
		return
	}

	if (this.filteredModels.length === 0) {
		if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback()
		} else {
			this.searchInput.handleInput(keyData)
			this.filterModels(this.searchInput.getValue())
		}
		return
	}

	const currentItem = this.selectableItemsCoords?.[this.selectedIndex]
	if (!currentItem) {
		return originalHandleInput.call(this, keyData)
	}

	if (kb.matches(keyData, "tui.select.up")) {
		let targetY = -1
		for (let i = this.selectedIndex - 1; i >= 0; i--) {
			if (this.selectableItemsCoords[i].y < currentItem.y) {
				targetY = this.selectableItemsCoords[i].y
				break
			}
		}
		if (targetY !== -1) {
			let best = -1
			let bestDist = Infinity
			for (let i = 0; i < this.selectableItemsCoords.length; i++) {
				if (this.selectableItemsCoords[i].y === targetY) {
					const dist = Math.abs(this.selectableItemsCoords[i].x - currentItem.x)
					if (dist < bestDist) {
						bestDist = dist
						best = i
					}
				}
			}
			if (best !== -1) this.selectedIndex = best
		} else if (this.selectedIndex > 0) {
			this.selectedIndex--
		}
		this.updateList()
	} else if (kb.matches(keyData, "tui.select.down")) {
		let targetY = -1
		for (let i = this.selectedIndex + 1; i < this.selectableItemsCoords.length; i++) {
			if (this.selectableItemsCoords[i].y > currentItem.y) {
				targetY = this.selectableItemsCoords[i].y
				break
			}
		}
		if (targetY !== -1) {
			let bestIdx = -1
			let bestDist = Infinity
			for (let i = this.selectedIndex + 1; i < this.selectableItemsCoords.length; i++) {
				if (this.selectableItemsCoords[i].y === targetY) {
					const dist = Math.abs(this.selectableItemsCoords[i].x - currentItem.x)
					if (dist < bestDist) {
						bestDist = dist
						bestIdx = i
					}
				}
			}
			if (bestIdx !== -1) this.selectedIndex = bestIdx
		} else if (this.selectedIndex < this.selectableItemsCoords.length - 1) {
			this.selectedIndex++
		}
		this.updateList()
	} else if (keyData.name === "left") {
		if (this.selectedIndex > 0 && this.selectableItemsCoords[this.selectedIndex - 1].y === currentItem.y) {
			this.selectedIndex--
			this.updateList()
		}
	} else if (keyData.name === "right") {
		if (this.selectedIndex < this.selectableItemsCoords.length - 1 && this.selectableItemsCoords[this.selectedIndex + 1].y === currentItem.y) {
			this.selectedIndex++
			this.updateList()
		}
	} else if (kb.matches(keyData, "tui.select.confirm")) {
		const selectedModel = this.filteredModels[this.selectedIndex]
		if (selectedModel) {
			this.handleSelect(selectedModel.model)
		}
	} else if (kb.matches(keyData, "tui.select.cancel")) {
		this.onCancelCallback()
	} else {
		this.searchInput.handleInput(keyData)
		this.filterModels(this.searchInput.getValue())
	}
}

modelSelectorProto.updateList = function (this: any) {
	this.listContainer.clear()

	if (this.errorMessage) {
		const errorLines = this.errorMessage.split("\n")
		for (const line of errorLines) {
			this.listContainer.addChild(new Text(fg(ANSI.dim, line), 0, 0))
		}
		return
	}

	if (this.filteredModels.length === 0) {
		this.listContainer.addChild(new Text(fg(ANSI.dim, "  No matching models"), 0, 0))
		return
	}

	const termWidth = process.stdout.columns || 80
	const columns = termWidth < 90 ? 1 : 2
	const colWidth = Math.floor(termWidth / columns) - 2

	const gridRows: any[] = []
	let currentY = 0

	const groupsMap = new Map<string, any[]>()
	for (const item of this.filteredModels) {
		if (!groupsMap.has(item.provider)) groupsMap.set(item.provider, [])
		groupsMap.get(item.provider)!.push(item)
	}

	this.selectableItemsCoords = []

	for (const [provider, models] of groupsMap.entries()) {
		gridRows.push({ type: "heading", text: provider, y: currentY })
		currentY++
		for (let i = 0; i < models.length; i += columns) {
			const rowModels = models.slice(i, i + columns)
			const rowItems: any[] = []
			for (let x = 0; x < rowModels.length; x++) {
				const item = rowModels[x]
				const flatIndex = this.filteredModels.indexOf(item)
				const gridItem = { ...item, x, y: currentY, flatIndex }
				rowItems.push(gridItem)
				this.selectableItemsCoords[flatIndex] = gridItem
			}
			gridRows.push({ type: "models", items: rowItems, y: currentY })
			currentY++
		}
		gridRows.push({ type: "space", y: currentY })
		currentY++
	}

	const termHeight = process.stdout.rows || 24
	const maxVisibleRows = Math.max(5, termHeight - 12)

	const currentItem = this.selectableItemsCoords[this.selectedIndex]
	if (!this.scrollOffset) this.scrollOffset = 0

	if (currentItem) {
		if (currentItem.y < this.scrollOffset) {
			this.scrollOffset = currentItem.y
		} else if (currentItem.y >= this.scrollOffset + maxVisibleRows) {
			this.scrollOffset = currentItem.y - maxVisibleRows + 1
		}
	}

	if (this.scrollOffset + maxVisibleRows > gridRows.length) {
		this.scrollOffset = Math.max(0, gridRows.length - maxVisibleRows)
	}

	if (this.scrollOffset > 0) {
		this.listContainer.addChild(new Text(fg(ANSI.dim, "  ▲  (More models above...)"), 0, 0))
	}

	const visibleRows = gridRows.slice(this.scrollOffset, this.scrollOffset + maxVisibleRows)
	
	for (const row of visibleRows) {
		if (row.type === "heading") {
			this.listContainer.addChild(new Text(fg(ANSI.accent, `[ ${row.text} ]`), 0, 0))
		} else if (row.type === "space") {
			this.listContainer.addChild(new Spacer(1))
		} else if (row.type === "models") {
			let rowStr = ""
			for (let idx = 0; idx < row.items.length; idx++) {
				const item = row.items[idx]
				const isSelected = item.flatIndex === this.selectedIndex
				const isMultiModelEnabled = !!(process as any).__cheapMultiModelEnabled
				const isCurrent = item._isMultiModel
					? isMultiModelEnabled
					: !isMultiModelEnabled && modelsAreEqual(this.currentModel, item.model)

				const prefix = isSelected ? fg(ANSI.accent, "> ") : "  "

				// Display name (already includes provider in parentheses)
				const displayName = item._isMultiModel ? "multi-model" : (item.model.name || item.id)
				const nameColor = isSelected ? fg(ANSI.accent, displayName) : fg(ANSI.dim, displayName)

				// Tokens from modelInfoMap (survives round-trip) or fall back to _tokens / contextWindow
				const modelId = item._isMultiModel ? "" : (item.model?.id || item.id || "")
				const mapInfo = modelInfoMap.get(modelId)
				const tokensLabel: string = mapInfo?.tokens
					?? (item.model as any)._tokens
					?? (() => {
						const n = item.model.contextWindow || 0
						return n >= 1048576 ? `${Math.round(n / 1048576)}M` : n >= 1024 ? `${Math.round(n / 1024)}k` : "8k"
					})()
				const tokenText = ` (${tokensLabel} tokens)`
				const tokenColor = isSelected ? fg("36", tokenText) : fg(ANSI.dim, tokenText)

				// Support tags from modelInfoMap or fall back to _support
				const supportArr: string[] = mapInfo?.support ?? (item.model as any)._support ?? []
				const supportText = supportArr.length > 0 ? ` [${supportArr.join(", ")}]` : ""
				const supportColor = isSelected ? fg("33", supportText) : fg(ANSI.dim, supportText)

				const checkmark = isCurrent ? semanticFg("success") + " ✓" : ""

				const cellText = `${prefix}${nameColor}${tokenColor}${supportColor}${checkmark}`

				const rawLength = 2 + displayName.length + tokenText.length + supportText.length + (isCurrent ? 2 : 0)

				if (columns > 1 && idx < row.items.length - 1) {
					const padding = Math.max(0, colWidth - rawLength)
					rowStr += cellText + " ".repeat(padding)
				} else {
					rowStr += cellText
				}
			}
			this.listContainer.addChild(new Text(rowStr, 0, 0))
		}
	}

	if (this.scrollOffset + maxVisibleRows < gridRows.length) {
		this.listContainer.addChild(new Text(fg(ANSI.dim, "  ▼  (More models below...)"), 0, 0))
	}
	
	const selected = this.filteredModels[this.selectedIndex]
	if (selected) {
		this.listContainer.addChild(new Spacer(1))
		this.listContainer.addChild(new Text(fg(ANSI.dim, `  Model ID: ${selected.model.id || selected.id}`), 0, 0))
	}
}
