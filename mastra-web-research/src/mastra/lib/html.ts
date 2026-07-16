export function decodeEntities(value: string): string {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

function safeFromCodePoint(code: number): string {
    return Number.isSafeInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "\uFFFD";
}

export function stripHtml(value: string): string {
    return collapseWhitespace(decodeEntities(value.replace(/<[^>]*>/g, "")));
}

export function extractTitle(html: string): string {
    return stripHtml(/<title[^>]*>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "");
}

export function extractText(html: string, maxChars = 8000): string {
    const stripped = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
        .replace(/<[^>]*>/g, " ");

    return collapseWhitespace(decodeEntities(stripped)).slice(0, maxChars);
}

function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}
