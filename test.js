import { MemorySaver } from "@langchain/langgraph-checkpoint";
const m = new MemorySaver();
console.log(m.storage, m.writes);
