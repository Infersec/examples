import { createInterface } from "node:readline/promises";

import { mastra } from "./mastra/index.js";

const workflow = mastra.getWorkflow("researchWorkflow");

const arg = process.argv[2];
const question = (arg ?? (await readQuestion())).trim();

if (!question) {
    console.error('Usage: npm start -- "your question here"');
    process.exit(1);
}

console.log(`\nResearching: ${question}`);

const run = await workflow.createRun();
const result = await run.start({ inputData: { question } });

if (result.status === "success") {
    console.log(`\n${result.result.answer}\n`);
    if (result.result.rounds > 1) {
        console.log(`(Completed in ${result.result.rounds} research/review rounds.)\n`);
    }
} else {
    console.error(`\nResearch failed: ${result.status}\n`);
    process.exit(1);
}

async function readQuestion(): Promise<string> {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return await readline.question("What would you like to research? ");
    } finally {
        readline.close();
    }
}
