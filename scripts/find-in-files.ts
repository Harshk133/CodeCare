import fs from "fs";
import path from "path";

const filePath = path.resolve("node_modules/ai/dist/index.js");
const content = fs.readFileSync(filePath, "utf-8");

const lines = content.split("\n");
let matchCount = 0;
lines.forEach((line, index) => {
  if (line.includes("inputSchema") || line.includes("vercel.ai.schema") || line.includes("Symbol(")) {
    matchCount++;
    if (matchCount < 100) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
console.log(`Total matches: ${matchCount}`);
