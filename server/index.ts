import { pathToFileURL } from "node:url";

import { loadArtifact } from "./artifacts";
import { publicClientFor } from "./chain";
import { configFromEnv, type ServerConfig } from "./config";
import { underwriteAndDeliver } from "./underwrite";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

type RequestLike = AsyncIterable<Uint8Array> & {
  method?: string;
  url?: string;
};

type ResponseLike = {
  writeHead: (statusCode: number, headers: Record<string, string>) => void;
  end: (body?: string) => void;
};

function send(res: ResponseLike, code: number, body: unknown): void {
  const payload = JSON.stringify(body, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  res.writeHead(code, { "content-type": "application/json", ...CORS_HEADERS });
  res.end(payload);
}

async function readJson(req: RequestLike): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

async function readPoolState(config: ServerConfig) {
  const publicClient = publicClientFor(config.chainId, config.rpcUrl);
  const stakeAbi = (await loadArtifact("StakeAndAdvance")).abi as never;
  const state = (await publicClient.readContract({
    address: config.contract,
    abi: stakeAbi,
    functionName: "poolState",
  })) as readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, number, number, boolean];

  return {
    totalAssets: state[0].toString(),
    cash: state[1].toString(),
    outstandingPrincipal: state[2].toString(),
    totalShares: state[3].toString(),
    navPerShare1e18: state[4].toString(),
    creditCap: state[5].toString(),
    capExpiry: state[6].toString(),
    interestRateBps: Number(state[7]),
    dueAt: state[8].toString(),
    defaulted: state[9],
  };
}

export function buildHandler(config: ServerConfig) {
  return async (req: RequestLike, res: ResponseLike): Promise<void> => {
    try {
      const url = req.url ?? "/";

      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      if (req.method === "GET" && url === "/health") {
        return send(res, 200, {
          ok: true,
          chainId: config.chainId,
          contract: config.contract,
          confidentialAi: config.confidentialAiEndpoint ? "cloud" : "dev",
        });
      }

      if (req.method === "GET" && url === "/pool/state") {
        return send(res, 200, await readPoolState(config));
      }

      if (req.method === "POST" && url === "/cre/underwrite") {
        const body = await readJson(req);
        const financials = (body.financials ?? body) as Record<string, unknown>;
        if (!financials.vendor) return send(res, 400, { error: "missing financials.vendor" });
        return send(res, 200, await underwriteAndDeliver(config, financials as never));
      }

      return send(res, 404, { error: "not found", path: url });
    } catch (error) {
      return send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

export async function startServer(
  config: ServerConfig,
): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const nodeHttp: any = await import("node:http");
  const server = nodeHttp.createServer(buildHandler(config));
  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.loadEnvFile();
  } catch {
    // Deployment environments can provide variables directly.
  }

  const config = configFromEnv();
  startServer(config).then(({ url }) => {
    console.log(`[server] listening on ${url}`);
    console.log(`[server] contract=${config.contract} chainId=${config.chainId}`);
  });
}
