import { execSync, spawn } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"

// The dynamic voice extension
export default function voiceToCodeExtension(pi: ExtensionAPI) {
	pi.registerCommand("voice", {
		description: "Start voice recording for Voice to Code (auto-downloads model on first run)",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			if (!ctx.hasUI) {
				console.error("Voice command requires an interactive UI.")
				return
			}

			// Step 1: Ensure dependencies are installed in a global cache directory so it works everywhere
			const homedir = require("node:os").homedir()
			const voiceDepsPath = join(homedir, ".cheap", "voice-deps")

			if (!existsSync(voiceDepsPath)) {
				require("node:fs").mkdirSync(voiceDepsPath, { recursive: true })
				// Write a basic package.json so bun install creates node_modules here
				writeFileSync(join(voiceDepsPath, "package.json"), JSON.stringify({ name: "voice-deps", private: true }))
			}

			const transformersPath = join(voiceDepsPath, "node_modules", "@xenova/transformers")
			const recordPath = join(voiceDepsPath, "node_modules", "node-record-lpcm16")

			if (!existsSync(transformersPath) || !existsSync(recordPath)) {
				ctx.ui.notify("Voice module not found. Downloading dependencies in background... (One time only)", "info")
				try {
					execSync("bun install @xenova/transformers node-record-lpcm16", { cwd: voiceDepsPath, stdio: "ignore" })
					ctx.ui.notify("Dependencies downloaded successfully!", "info")
				} catch (err) {
					ctx.ui.notify("Failed to install dependencies globally. Please check your internet connection.", "error")
					return
				}
			}

			// Step 2: Load dynamically using absolute paths from the global cache directory
			const record = require(recordPath)

			// Ensure sox is installed, as it is required by node-record-lpcm16 on macOS
			try {
				execSync("which sox", { stdio: "ignore" })
			} catch (err) {
				ctx.ui.notify("Sox not found. Auto-installing via Homebrew... (Please wait)", "info")
				try {
					execSync("brew install sox", { stdio: "ignore" })
					ctx.ui.notify("Sox installed successfully!", "info")
				} catch (brewErr) {
					ctx.ui.notify("Failed to auto-install sox. Please install it manually using: brew install sox", "error")
					return
				}
			}

			ctx.ui.notify("🎤 Recording started! Speak now... (Press Ctrl+C to stop recording)", "info")

			const audioPath = join(tmpdir(), "voice_input.wav")
			const file = require("node:fs").createWriteStream(audioPath, { encoding: "binary" })

			// Step 3: Record audio using node-record-lpcm16
			const recording = record.record({
				sampleRate: 16000,
				channels: 1,
				audioType: "raw", // whisper expects raw PCM
			})

			recording.stream().pipe(file)

			// We need a way to stop recording.
			// In CLI, we can listen to stdin data to stop when the user presses Enter or Space.
			await new Promise<void>((resolve) => {
				const stdin = process.stdin
				const handleInput = (key: Buffer) => {
					// Stop on Enter or Ctrl+C
					if (key.toString() === "\n" || key.toString() === "\r" || key[0] === 3) {
						recording.stop()
						stdin.removeListener("data", handleInput)
						resolve()
					}
				}
				stdin.on("data", handleInput)
			})

			ctx.ui.notify("⏳ Processing voice and transcribing...", "info")

			try {
				// Step 4: Transcribe using Whisper in a background process to silence ONNX C++ warnings
				// that write directly to fd 2 (stderr) and cannot be suppressed otherwise.
				const resultPath = join(tmpdir(), "voice_result_" + Date.now() + ".json")
				const script = `
					const fs = require("node:fs");
					const { pipeline, env } = require("${transformersPath.replace(/\\/g, "\\\\")}");
					env.allowLocalModels = false;
					env.useBrowserCache = false;
					async function run() {
						try {
							const t = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
							const buf = fs.readFileSync("${audioPath.replace(/\\/g, "\\\\")}");
							const f32 = new Float32Array(buf.length / 2);
							for(let i=0; i<buf.length/2; i++) f32[i] = buf.readInt16LE(i*2) / 32768.0;
							const res = await t(f32);
							fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ text: res.text }));
						} catch(e) {
							fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ error: e.message }));
						}
					}
					run();
				`

				const worker = spawn("bun", ["-e", script], {
					stdio: "ignore", // IGNORE STDERR AND STDOUT ENTIRELY
				})

				await new Promise<void>((resolve, reject) => {
					worker.on("close", () => resolve())
					worker.on("error", reject)
				})

				const resultStr = require("node:fs").readFileSync(resultPath, "utf-8")
				const result = JSON.parse(resultStr)
				require("node:fs").unlinkSync(resultPath)

				if (result.error) {
					ctx.ui.notify(`Error transcribing: ${result.error}`, "error")
					return
				}

				const text = result.text?.trim()
				if (text) {
					pi.sendUserMessage(text)
				} else {
					ctx.ui.notify("⚠️ No speech detected.", "error")
				}
			} catch (err: any) {
				ctx.ui.notify(`Error transcribing: ${err.message}`, "error")
			}
		},
	})
}
