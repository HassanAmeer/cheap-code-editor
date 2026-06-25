import { getKeybindings } from "@earendil-works/pi-tui"

const kb = getKeybindings();
console.log(kb.matches("\u001b[D", "tui.editor.cursorLeft"));
console.log(kb.matches("\u001b[C", "tui.editor.cursorRight"));
