import { getSelectListTheme, initTheme } from "@earendil-works/pi-coding-agent"
initTheme()
const t = getSelectListTheme()
console.log(t.selectedText("hello"))
