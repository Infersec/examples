import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

import { researcher } from "../agents/researcher.js";
import { reviewer, reviewSchema } from "../agents/reviewer.js";

// Caps the research -> review -> revise loop so a fussy reviewer can't loop forever.
const MAX_ROUNDS = 3;

// Carried across loop iterations: the draft, the latest review, and every critique so far.
const loopSchema = z.object({
    critiques: z.array(z.string()),
    critique: z.string(),
    draft: z.string(),
    question: z.string(),
    rounds: z.number(),
    verdict: z.enum(["approved", "needs_revision"])
});

const seedStep = createStep({
    id: "seed",
    inputSchema: z.object({ question: z.string() }),
    outputSchema: loopSchema,
    execute: async ({ inputData }) => ({
        critiques: [] as string[],
        critique: "",
        draft: "",
        question: inputData.question,
        rounds: 0,
        verdict: "needs_revision" as const
    })
});

const researchReviewStep = createStep({
    id: "research-and-review",
    inputSchema: loopSchema,
    outputSchema: loopSchema,
    execute: async ({ inputData }) => {
        const priorCritique = inputData.critiques.at(-1);
        const prompt = priorCritique
            ? `${inputData.question}\n\nA reviewer gave this feedback on your previous draft:\n${priorCritique}\n\nResearch further and write a revised, fully-cited answer.`
            : inputData.question;

        console.log(`\n  Round ${inputData.rounds + 1}: ${priorCritique ? "revising" : "researching"}...`);

        const research = await researcher.generate(prompt, {
            maxSteps: 8,
            onStepFinish: ({ toolCalls }) => {
                for (const call of toolCalls) {
                    const payload = call.payload;
                    if (payload?.toolName) {
                        console.log(`    -> ${payload.toolName}(${JSON.stringify(payload.args ?? {})})`);
                    }
                }
            }
        });

        console.log("  Reviewing draft...");
        // Infersec's endpoint accepts response_format text/json_object but not json_schema,
        // so coerce structured output via prompt injection rather than the native response format.
        const review = await reviewer.generate(
            `Question:\n${inputData.question}\n\nDraft answer:\n${research.text}\n\nReview this draft.`,
            { structuredOutput: { jsonPromptInjection: true, schema: reviewSchema } }
        );
        const { critique, verdict } = review.object;

        console.log(`  Review: ${verdict}`);
        return {
            critiques: [...inputData.critiques, critique],
            critique,
            draft: research.text,
            question: inputData.question,
            rounds: inputData.rounds + 1,
            verdict
        };
    }
});

const finalizeStep = createStep({
    id: "finalize",
    inputSchema: loopSchema,
    outputSchema: z.object({
        answer: z.string(),
        critiques: z.array(z.string()),
        rounds: z.number()
    }),
    execute: async ({ inputData }) => ({
        answer: inputData.draft,
        critiques: inputData.critiques,
        rounds: inputData.rounds
    })
});

export const researchWorkflow = createWorkflow({
    id: "researchWorkflow",
    inputSchema: z.object({ question: z.string() }),
    outputSchema: z.object({
        answer: z.string(),
        critiques: z.array(z.string()),
        rounds: z.number()
    })
})
    .then(seedStep)
    .dountil(
        researchReviewStep,
        async ({ getStepResult }) => {
            const result = getStepResult(researchReviewStep);
            return result.verdict === "approved" || result.rounds >= MAX_ROUNDS;
        }
    )
    .then(finalizeStep)
    .commit();
