export type ServerConfig = {
  port: number;
  rpcUrl: string;
  chainId: number;
  contract: `0x${string}`;
  reporterKey: `0x${string}`;
  confidentialAiEndpoint: string | undefined;
  confidentialAiApiKey: string | undefined;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function privateKey(name: string): `0x${string}` {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte private key`);
  }
  return value as `0x${string}`;
}

function address(name: string): `0x${string}` {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed EVM address`);
  }
  return value as `0x${string}`;
}

export function configFromEnv(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 8788),
    rpcUrl: process.env.RPC_URL ?? process.env.ARC_RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.CHAIN_ID ?? process.env.ARC_CHAIN_ID ?? 5042002),
    contract: address("STAKE_AND_ADVANCE_ADDRESS"),
    reporterKey: privateKey("REPORTER_PRIVATE_KEY"),
    confidentialAiEndpoint: process.env.CONFIDENTIAL_AI_ENDPOINT,
    confidentialAiApiKey: process.env.CONFIDENTIAL_AI_API_KEY,
    ...overrides,
  };
}
