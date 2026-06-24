import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "../db/client.js";
import { contextNodes as contextNodesTable } from "../db/schema.js";

const execFileAsync = promisify(execFile);

export interface CodeGraphNode {
    id: string;
    filePath: string;
    type: string;
    content: string;
    dependencies: string[];
}

export class CodeGraphClient {
    private binaryPath: string;

    constructor(binaryPath = "codegraph") {
        this.binaryPath = binaryPath;
    }

    /**
     * Query the CodeGraph for dependencies of a specific file or symbol.
     */
    async queryContext(query: string, cwd: string): Promise<CodeGraphNode[]> {
        try {
            // Simulated codegraph execution
            // In reality, this would be: await execFileAsync(this.binaryPath, ["query", "--json", query], { cwd })
            const { stdout } = await execFileAsync(this.binaryPath, ["--version"]).catch(() => ({ stdout: '{"nodes": []}' }));
            
            // Fallback for demonstration if binary is not installed
            if (!stdout.includes("codegraph")) {
                console.warn("CodeGraph binary not found. Returning empty context.");
                return [];
            }
            
            const rawOutput = JSON.parse(stdout);
            const nodes: CodeGraphNode[] = rawOutput.nodes || [];

            // Cache results in SQLite
            for (const node of nodes) {
                db.insert(contextNodesTable).values({
                    id: node.id,
                    filePath: node.filePath,
                    astType: node.type,
                    content: node.content,
                    dependencies: JSON.stringify(node.dependencies)
                }).onConflictDoUpdate({
                    target: contextNodesTable.id,
                    set: { content: node.content, dependencies: JSON.stringify(node.dependencies) }
                }).run();
            }

            return nodes;
        } catch (error) {
            console.error("CodeGraph query failed:", error);
            return [];
        }
    }
}
