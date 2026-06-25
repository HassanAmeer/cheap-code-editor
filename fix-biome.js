import fs from "fs";
import { globSync } from "glob";

const files = globSync(["src/**/*.ts", "src/**/*.js", "scripts/**/*.ts"]);
for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const orig = content;
  content = content.replace(/[ \t]*\/\/\s*biome-ignore\s+lint\/(suspicious\/noExplicitAny|style\/noNonNullAssertion|suspicious\/noConfusingLabels)[^\n]*\n/g, "");
  if (content !== orig) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
}
