import { loadArtifact } from "./artifacts";
import { publicClientFor, walletClientFor } from "./chain";
import type { ServerConfig } from "./config";
import {
  underwriteVendor,
  type ConfidentialInferenceResult,
  type FinancialInputs,
} from "../cre/src/creditUnderwriting";

function devInfer(input: FinancialInputs): ConfidentialInferenceResult {
  const burnPressure = input.monthlyBurnUsd > input.cashBalanceUsd ? 30 : 0;
  const delinquency = Math.min(40, Math.floor(input.delinquencyRateBps / 50));
  const riskScore = Math.max(1, Math.min(99, 20 + burnPressure + delinquency));
  const approvedMultiple = riskScore > 70 ? 1 : riskScore > 50 ? 2 : 3;
  return { riskScore, approvedMultiple, rationale: `dev-model risk=${riskScore}` };
}

async function cloudInfer(
  config: ServerConfig,
  input: FinancialInputs,
): Promise<ConfidentialInferenceResult> {
  const res = await fetch(config.confidentialAiEndpoint as string, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.confidentialAiApiKey ?? ""}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ task: "underwrite_usdc_credit_line", financials: input }),
  });
  if (!res.ok) throw new Error(`confidential AI endpoint returned ${res.status}`);
  return (await res.json()) as ConfidentialInferenceResult;
}

export async function underwriteAndDeliver(config: ServerConfig, financials: FinancialInputs) {
  const wallet = walletClientFor(config.reporterKey, config.chainId, config.rpcUrl);
  const publicClient = publicClientFor(config.chainId, config.rpcUrl);
  const stakeAbi = (await loadArtifact("StakeAndAdvance")).abi as never;
  const now = (await publicClient.getBlock()).timestamp;
  const infer = config.confidentialAiEndpoint
    ? (input: FinancialInputs) => cloudInfer(config, input)
    : async (input: FinancialInputs) => devInfer(input);

  const report = await underwriteVendor(financials, infer, now);
  const hash = await wallet.writeContract({
    address: config.contract,
    abi: stakeAbi,
    functionName: "onReport",
    args: ["0x", report.encodedPayload],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    vendor: report.vendor,
    cap: report.cap.toString(),
    expiry: report.expiry.toString(),
    interestRateBps: report.interestRateBps,
    inference: report.inference,
    mode: config.confidentialAiEndpoint ? "cloud" : "dev",
    txHash: hash,
    status: receipt.status,
  };
}
