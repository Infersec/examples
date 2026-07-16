import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { stripHtml } from "../lib/html.js";

interface SearchResult {
    snippet: string;
    title: string;
    url: string;
}

interface SearchLink {
    title: string;
    url: string;
}

const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const webSearch = createTool({
    description:
        "Search the web for current information. Returns a list of results, each with a title, url and short snippet.",
    execute: async ({ query, resultCount }) => {
        return { results: await runSearch({ limit: resultCount ?? 5, query }) };
    },
    id: "web-search",
    inputSchema: z.object({
        query: z.string().min(1).describe("The search query."),
        resultCount: z
            .number()
            .int()
            .min(1)
            .max(8)
            .optional()
            .describe("How many results to return. Defaults to 5.")
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                snippet: z.string(),
                title: z.string(),
                url: z.string()
            })
        )
    })
});

async function runSearch({ query, limit }: { limit: number; query: string }): Promise<SearchResult[]> {
    const response = await fetch(SEARCH_ENDPOINT, {
        body: new URLSearchParams({ q: query }).toString(),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT
        },
        method: "POST"
    });

    if (!response.ok) {
        throw new Error(`Web search failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    return combineResults({
        links: extractLinks(html),
        snippets: extractSnippets(html)
    }).slice(0, limit);
}

function extractLinks(html: string): SearchLink[] {
    const pattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const links: SearchLink[] = [];

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        const href = /href="([^"]*)"/.exec(match[0])?.[1] ?? "";
        const title = stripHtml(match[1]).trim();
        const url = resolveRedirect(href);
        if (title && url) {
            links.push({ title, url });
        }
    }

    return links;
}

function extractSnippets(html: string): string[] {
    const pattern = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        snippets.push(stripHtml(match[1]).trim());
    }

    return snippets;
}

function combineResults({ links, snippets }: { links: SearchLink[]; snippets: string[] }): SearchResult[] {
    return links.map((link, index) => ({
        snippet: snippets[index] ?? "",
        title: link.title,
        url: link.url
    }));
}

function resolveRedirect(href: string): string {
    try {
        const parsed = new URL(href, "https://duckduckgo.com");
        const target = parsed.searchParams.get("uddg");
        if (target) {
            return decodeURIComponent(target);
        }
        return parsed.toString();
    } catch {
        return href;
    }
}
