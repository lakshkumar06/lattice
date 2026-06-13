import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_USDC, STAKE_AND_ADVANCE_ADDRESS } from "./addresses";

const LIFI_BASE_URL = "https://li.quest/v1";
const DEPOSIT_SELECTOR = "0x47e7ef24";

export type IntakeQuoteInput = {
  fromChain: number;
  fromToken: string;
  fromAmount: string;
  fromAddress: string;
  user: string;
  slippage?: string;
};

export type YieldQuoteInput = {
  fromAmount: string;
  treasuryAddress: string;
  toChain: number;
  toToken: string;
  slippage?: string;
};

export function encodeDepositCall(user: string, amount: string): `0x${string}` {
  const normalizedUser = normalizeAddress(user);
  const normalizedAmount = BigInt(amount);
  if (normalizedAmount <= 0n) {
    throw new Error("amount must be positive");
  }

  const encodedUser = normalizedUser.slice(2).padStart(64, "0");
  const encodedAmount = normalizedAmount.toString(16).padStart(64, "0");
  return `${DEPOSIT_SELECTOR}${encodedUser}${encodedAmount}` as `0x${string}`;
}

export async function getIntakeQuote(input: IntakeQuoteInput) {
  const calldata = encodeDepositCall(input.user, input.fromAmount);
  const params = new URLSearchParams({
    fromChain: String(input.fromChain),
    toChain: String(ARC_TESTNET_CHAIN_ID),
    fromToken: normalizeAddress(input.fromToken),
    toToken: ARC_TESTNET_USDC,
    fromAmount: input.fromAmount,
    fromAddress: normalizeAddress(input.fromAddress),
    toAddress: STAKE_AND_ADVANCE_ADDRESS,
    toContractAddress: STAKE_AND_ADVANCE_ADDRESS,
    toContractCallData: calldata,
    integrator: "stake-and-advance",
    slippage: input.slippage ?? "0.005",
  });

  return fetchLifiQuote(params);
}

export async function getYieldQuote(input: YieldQuoteInput) {
  const treasury = normalizeAddress(input.treasuryAddress);
  const params = new URLSearchParams({
    fromChain: String(ARC_TESTNET_CHAIN_ID),
    toChain: String(input.toChain),
    fromToken: ARC_TESTNET_USDC,
    toToken: normalizeAddress(input.toToken),
    fromAmount: input.fromAmount,
    fromAddress: treasury,
    toAddress: treasury,
    integrator: "stake-and-advance",
    slippage: input.slippage ?? "0.005",
  });

  return fetchLifiQuote(params);
}

async function fetchLifiQuote(params: URLSearchParams) {
  const headers: Record<string, string> = {};
  if (process.env.LIFI_API_KEY) {
    headers["x-lifi-api-key"] = process.env.LIFI_API_KEY;
  }

  const response = await fetch(`${LIFI_BASE_URL}/quote?${params.toString()}`, {
    headers,
    cache: "no-store",
  });

  const body = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body,
    };
  }

  return {
    ok: true,
    quote: body,
    isComposer: body?.tool === "composer",
    includedTools: Array.isArray(body?.includedSteps)
      ? body.includedSteps.map((step: { tool?: string }) => step.tool).filter(Boolean)
      : [],
  };
}

function normalizeAddress(value: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`invalid EVM address: ${value}`);
  }
  return value.toLowerCase() as `0x${string}`;
}
