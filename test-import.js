import("@earendil-works/pi-coding-agent/dist/core/slash-commands.js").then((mod) => {
    console.log(mod.BUILTIN_SLASH_COMMANDS.map(c => c.name));
}).catch(console.error)
