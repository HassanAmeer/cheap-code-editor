import { END, START, StateGraph } from "@langchain/langgraph"
import { CodeGraphClient } from "../context/codegraph-client.js"

interface AgentState {
	task: string
	contextFiles: string[]
	plan: string
	codeChanges: string
	testsPassed: boolean
	errors: string[]
}

const codegraph = new CodeGraphClient()

async function plannerNode(state: AgentState): Promise<Partial<AgentState>> {
	console.log("-> [Planner] Analyzing task and building plan...")
	// 1. Ask CodeGraph for relevant context
	const contextNodes = await codegraph.queryContext(state.task, process.cwd())
	const contextFiles = contextNodes.map((n) => n.filePath)

	// Simulated LLM planning
	return {
		contextFiles,
		plan: "Step 1: Update DB. Step 2: Fix UI.",
	}
}

async function builderNode(state: AgentState): Promise<Partial<AgentState>> {
	console.log("-> [Builder] Writing code based on plan...")
	return {
		codeChanges: "Added new SQLite tables.",
	}
}

async function reviewerNode(state: AgentState): Promise<Partial<AgentState>> {
	console.log("-> [Reviewer] Testing code changes...")
	// Simulated QA testing
	const passed = Math.random() > 0.3 // 70% chance to pass

	if (!passed) {
		return { testsPassed: false, errors: ["SQLite Error: locked"] }
	}
	return { testsPassed: true, errors: [] }
}

function reviewerToNext(state: AgentState): "builderNode" | typeof END {
	if (state.testsPassed) {
		console.log("-> [QA Passed] Proceeding to End.")
		return END
	}
	console.log("-> [QA Failed] Looping back to Builder.")
	return "builderNode"
}

// Build the LangGraph workflow
export const agentWorkflow = new StateGraph<AgentState>({
	channels: {
		task: { value: (a, b) => b ?? a, default: () => "" },
		contextFiles: { value: (a, b) => b ?? a, default: () => [] },
		plan: { value: (a, b) => b ?? a, default: () => "" },
		codeChanges: { value: (a, b) => b ?? a, default: () => "" },
		testsPassed: { value: (a, b) => b ?? a, default: () => false },
		errors: { value: (a, b) => b ?? a, default: () => [] },
	},
})
	.addNode("plannerNode", plannerNode)
	.addNode("builderNode", builderNode)
	.addNode("reviewerNode", reviewerNode)
	.addEdge(START, "plannerNode")
	.addEdge("plannerNode", "builderNode")
	.addEdge("builderNode", "reviewerNode")
	.addConditionalEdges("reviewerNode", reviewerToNext)

import { MemorySaver } from "@langchain/langgraph-checkpoint"

export const compiledWorkflow = agentWorkflow.compile({ checkpointer: new MemorySaver() })

/**
 * Execute the agent workflow for a given task.
 */
export async function runWorkflow(taskId: string, userPrompt: string) {
	const config = { configurable: { thread_id: taskId } }

	console.log(`\n=== Starting Workflow for Task: ${taskId} ===`)
	const stream = await compiledWorkflow.stream({ task: userPrompt }, config)

	for await (const chunk of stream) {
		console.log("Agent Step Output:", chunk)
	}
	console.log("=== Workflow Completed ===\n")
}
