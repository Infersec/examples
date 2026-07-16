const apiUrl = process.env.INFERSEC_API_URL ?? "https://api.infersec.ai";
const apiKey = process.env.INFERSEC_API_KEY;
const endpointId = process.env.INFERSEC_ENDPOINT_ID;

if (!endpointId || !apiKey) {
    throw new Error(
        "INFERSEC_ENDPOINT_ID and INFERSEC_API_KEY are required. Copy .env.example to .env and fill them in."
    );
}

// Infersec exposes an OpenAI-compatible API at /oai/v1 (Mastra appends /chat/completions).
// The model id "default" tells the endpoint to serve its configured model.
export const infersecModel = {
    apiKey,
    id: "infersec/default" as const,
    url: `${apiUrl}/api/inferencing/${endpointId}/oai/v1`
};
