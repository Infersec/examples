# Infersec + Mastra: Web Research Agent

A small [Mastra](https://mastra.ai) multi-agent workflow that researches questions on the web, powered by models hosted on [Infersec](https://infersec.ai).

A **researcher** agent uses two tools — web search and page fetching — to find sources, read them, and write a cited answer. A **reviewer** agent then checks the draft for grounding, accuracy, and completeness; if it finds gaps, the researcher revises. It demonstrates how to point Mastra's model layer at any OpenAI-compatible endpoint, in this case Infersec.

## How it works

- **Agents**: a `researcher` (web tools) and a `reviewer` (no tools, returns a structured verdict + critique), both served by Infersec through its OpenAI-compatible API.
- **Tools**: `web-search` (DuckDuckGo, no extra API key) and `fetch-url` (downloads a page and returns its text).
- **Workflow**: a Mastra workflow runs `research → review` in a loop (capped at 3 rounds). Each round the reviewer either approves the draft or sends a critique back to the researcher for revision.

## Connecting to Infersec

Infersec exposes an **OpenAI-compatible** API, so the agent uses Mastra's OpenAI-compatible model provider. The three values in `.env` build the request:

- **Base** — `INFERSEC_API_URL` (defaults to `https://api.infersec.ai`).
- **Endpoint** — `INFERSEC_ENDPOINT_ID` selects which inference endpoint serves the model.
- **Auth** — `INFERSEC_API_KEY` authenticates each request.

The endpoint URL is assembled as:

```text
{INFERSEC_API_URL}/api/inferencing/{INFERSEC_ENDPOINT_ID}/oai/v1
```

The `/oai/v1` path is Infersec's OpenAI-compatible surface; Mastra appends `/chat/completions` automatically. The model id is set to `infersec/default`, where `default` tells the endpoint to serve whichever model it is configured to use:

```ts
model: {
    apiKey,
    id: "infersec/default",
    url: `${apiUrl}/api/inferencing/${endpointId}/oai/v1`
}
```

Grab the endpoint ID and an API key from the Infersec console (see [Setup](#setup)).

## Prerequisites

- Node.js 22.13 or later
- An Infersec account with:
  - A model hosted on connected hardware
  - An **inference endpoint** created and enabled
  - An **API key**

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your Infersec details:

   ```bash
   cp .env.example .env
   ```

   - `INFERSEC_API_URL` — your Infersec API base URL
   - `INFERSEC_ENDPOINT_ID` — the endpoint ID from your Infersec console
   - `INFERSEC_API_KEY` — an API key from your Infersec console

## Run

Ask a question from the command line:

```bash
npm start -- "What changed in the latest release of Node.js?"
```

The runner prints each tool call as it happens, plus the reviewer's verdict each round, followed by the final answer.

`start` compiles the TypeScript to `dist/` (via `npm run build`) and then runs the compiled output, so no separate build step is needed. To compile manually, run `npm run build`; to produce the Mastra deploy bundle, run `npm run build:deploy`.

Or open the Mastra Studio UI to chat interactively:

```bash
npm run dev
```

Studio runs at http://localhost:4111.

## Project layout

```text
src/
  mastra/
    agents/
      researcher.ts        web research agent
      reviewer.ts          draft review agent (structured verdict)
    tools/
      web-search.ts        DuckDuckGo search tool
      fetch-url.ts         web page fetcher
    workflows/
      research.ts          research -> review loop workflow
    lib/
      model.ts             shared Infersec model config
      html.ts              small HTML-to-text helpers
    index.ts               Mastra entry point
  run.ts                   CLI runner
```

## Notes

- Web search uses DuckDuckGo's HTML endpoint, so no extra API key is required. It is intentionally simple; swap in a dedicated search API for production use.
- Tool calling depends on the model you host. Use a model that supports function calling for best results.
