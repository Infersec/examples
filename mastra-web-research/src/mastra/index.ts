import net from "node:net";

import { Mastra } from "@mastra/core";

import { researcher } from "./agents/researcher.js";

// Disable Node's "Happy Eyeballs" (autoSelectFamily): when the API resolves to an unreachable IPv6 and a high-latency IPv4, the 250ms fallback timer kills the IPv4 connect before it completes.
net.setDefaultAutoSelectFamily(false);

export const mastra = new Mastra({
    agents: { researcher }
});
