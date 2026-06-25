import { spinner } from "@clack/prompts"
const s = spinner()
s.start("Downloading...")
setTimeout(() => s.stop("Done!"), 2000)
