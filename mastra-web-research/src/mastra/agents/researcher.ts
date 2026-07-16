import { Agent } from "@mastra/core/agent";

import { fetchUrl } from "../tools/fetch-url.js";
import { webSearch } from "../tools/web-search.js";

const apiUrl = process.env.INFERSEC_API_URL ?? "https://api.infersec.ai";
const apiKey = process.env.INFERSEC_API_KEY;
const endpointId = process.env.INFERSEC_ENDPOINT_ID;

if (!endpointId || !apiKey) {
    throw new Error(
        "INFERSEC_ENDPOINT_ID and INFERSEC_API_KEY are required. Copy .env.example to .env and fill them in."
    );
}

export const researcher = new Agent({
    id: "researcher",
    instructions: `You are a meticulous web research assistant. Answer the user's question using current information from the web.

For every question, work in steps:
1. Call the web-search tool with a focused query.
2. Use the fetch-url tool to read the most relevant pages you find.
3. Synthesize a clear, concise answer from what you read.

Rules:
- Ground every claim in the pages you fetched. Cite sources inline as [1], [2], ... and list them at the end with their URLs.
- If sources disagree, say so and explain the difference instead of picking one silently.
- If you cannot find enough reliable information, say so explicitly. Never invent facts or URLs.
- Prefer official documentation and primary sources over secondary commentary.
- Search again with a refined query if the first results are weak.`,
    // Infersec exposes an OpenAI-compatible API at /oai/v1 (Mastra appends /chat/completions).
    // The model id "default" tells the endpoint to serve its configured model.
    model: {
        apiKey,
        id: "infersec/default",
        url: `${apiUrl}/api/inferencing/${endpointId}/oai/v1`
    },
    name: "Infersec Researcher",
    tools: { fetchUrl, webSearch }
});
