import { isAddress, type Address } from "viem";

const defaultApiBase = "http://127.0.0.1:8788";
const defaultStakeAndAdvanceAddress = "0x851E0D7A37E3b2b4823794dbc68341D6db7c6441";

function normalizeOptionalEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeBackendBase(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : defaultApiBase;
}

function parseAddress(value: string, envVarName: string) {
  if (!isAddress(value)) {
    throw new Error(`${envVarName} must be a valid EVM address. Received: ${value}`);
  }

  return value as Address;
}

export const backendBase = normalizeBackendBase(import.meta.env.VITE_API_BASE_URL);
export const dynamicEnvironmentId = normalizeOptionalEnv(
  import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
);
export const stakeAndAdvanceAddress = parseAddress(
  normalizeOptionalEnv(import.meta.env.VITE_STAKE_AND_ADVANCE_ADDRESS) ??
    defaultStakeAndAdvanceAddress,
  "VITE_STAKE_AND_ADVANCE_ADDRESS",
);

export const frontendWarnings = [
  ...(dynamicEnvironmentId
    ? []
    : [
        "Wallet connect is disabled until VITE_DYNAMIC_ENVIRONMENT_ID is set. The dashboard is running in read-only mode.",
      ]),
];
