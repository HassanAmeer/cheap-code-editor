import { BUILTIN_SLASH_COMMANDS } from "@earendil-works/pi-coding-agent/dist/core/slash-commands.js";
console.log("Commands:", BUILTIN_SLASH_COMMANDS.map(c => c.name).join(", "));
BUILTIN_SLASH_COMMANDS.splice(BUILTIN_SLASH_COMMANDS.findIndex(c => c.name === "login"), 1);
console.log("After:", BUILTIN_SLASH_COMMANDS.map(c => c.name).join(", "));
