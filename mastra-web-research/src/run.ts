import { createInterface } from "node:readline/promises";

import { mastra } from "./mastra/index.js";

const researcher = mastra.getAgentById("researcher");

const arg = process.argv[2];
const question = (arg ?? (await readQuestion())).trim();

if (!question) {
    console.error('Usage: npm start -- "your question here"');
    process.exit(1);
}

console.log(`\nResearching: ${question}\n`);

const result = await researcher.generate(question, {
    maxSteps: 8,
    onStepFinish: ({ toolCalls }) => {
        for (const call of toolCalls) {
            const payload = call.payload;
            if (payload?.toolName) {
                console.log(`  -> ${payload.toolName}(${JSON.stringify(payload.args ?? {})})`);
            }
        }
    }
});

console.log(`\n${result.text}\n`);

async function readQuestion(): Promise<string> {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return await readline.question("What would you like to research? ");
    } finally {
        readline.close();
    }
}
