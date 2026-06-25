# Cheap CLI Updates

## Memory Upgrade (LangGraph & SQLite)
The session memory system of the Cheap CLI has been fully upgraded to eliminate RAM bloat and memory leaks. The following changes have been implemented:

- **SQLite Database Backend:** Sessions are no longer saved as massive `.jsonl` files. Instead, all session logs are safely and quickly written directly to `~/.cheap/cheap.db` using SQLite with WAL (Write-Ahead Logging) mode enabled for peak performance.
- **LangGraph Integration:** Checkpointing is now fully managed by LangGraph (`@langchain/langgraph-checkpoint-sqlite`). The state of every agent interaction is securely snapshotted in the SQLite database after every turn.
- **In-Memory Session Handling:** The native `@earendil-works/pi-coding-agent` session manager has been seamlessly intercepted. It now runs via `SessionManager.inMemory()`, and custom hooks sync its history back to the LangGraph checkpoint layer.
- **Time Travel / Revert Command:** Added `cheap revert <session-id>` command. This allows the user to immediately undo the most recent AI action (turn) by restoring the previous LangGraph checkpoint, ensuring mistakes can be instantly "forgotten" by the model.
- **CodeGraph Integration:** Integrated the `query_codegraph` tool. The agent can now intelligently query `CodeGraphClient` to understand code architecture and dependencies contextually rather than blindly searching.
