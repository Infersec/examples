import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { extractText, extractTitle } from "../lib/html.js";

const MAX_BODY_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const fetchUrl = createTool({
    description:
        "Fetch a web page and return its main text content. Use this to read pages found with the web-search tool.",
    execute: async ({ url }) => {
        const response = await safeFetch(url);
        const html = await readLimitedText(response);
        return {
            text: extractText(html),
            title: extractTitle(html),
            url: response.url
        };
    },
    id: "fetch-url",
    inputSchema: z.object({
        url: z.string().url().describe("The absolute URL of the page to read.")
    }),
    outputSchema: z.object({
        text: z.string(),
        title: z.string(),
        url: z.string()
    })
});

async function safeFetch(initialUrl: string): Promise<Response> {
    let currentUrl = initialUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        await assertPublicUrl(currentUrl);

        const response = await fetch(currentUrl, {
            headers: { "User-Agent": USER_AGENT },
            redirect: "manual",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) {
                throw new Error(`Redirect response without Location header from ${currentUrl}`);
            }
            currentUrl = new URL(location, currentUrl).toString();
            continue;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch ${currentUrl}: ${response.status} ${response.statusText}`);
        }

        return response;
    }
    throw new Error(`Too many redirects from ${initialUrl}`);
}

async function assertPublicUrl(rawUrl: string): Promise<void> {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
    }

    const host = parsed.hostname;
    const resolved = isIP(host)
        ? [host]
        : (await lookup(host, { all: true }).catch(() => [])).map((record) => record.address);

    for (const address of resolved) {
        if (!isPublicAddress(address)) {
            throw new Error(`Refusing to fetch non-public host ${host} (${address})`);
        }
    }
}

function isPublicAddress(address: string): boolean {
    const parts = address.split(".").map(Number);
    if (parts.length === 4) {
        const [a, b] = parts;
        if (a === 0) return false;
        if (a === 10) return false;
        if (a === 127) return false;
        if (a === 169 && b === 254) return false;
        if (a === 172 && b >= 16 && b <= 31) return false;
        if (a === 192 && b === 168) return false;
        if (a === 100 && b >= 64 && b <= 127) return false;
        return true;
    }

    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return false;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
    if (lower.startsWith("fe80")) return false;
    return true;
}

async function readLimitedText(response: Response): Promise<string> {
    const declared = response.headers.get("content-length");
    if (declared && Number(declared) > MAX_BODY_BYTES) {
        throw new Error(`Response declares ${declared} bytes, exceeding ${MAX_BODY_BYTES}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        return response.text();
    }

    const decoder = new TextDecoder();
    let received = 0;
    let text = "";
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        received += value.byteLength;
        if (received > MAX_BODY_BYTES) {
            await reader.cancel();
            throw new Error(`Response exceeded ${MAX_BODY_BYTES} bytes`);
        }
        text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
}
