import {
  INITIA_AUTO_SIGN_CHAIN_IDS,
  INITIA_EVM_CHAIN_ID_STR,
  INITIA_EVM_CHAIN_SLUG,
} from "@initia-agent/shared";

/** @deprecated Import `INITIA_EVM_CHAIN_SLUG` from `@initia-agent/shared`. */
export const INTERWOVEN_EVM_CHAIN_ID = INITIA_EVM_CHAIN_SLUG;
/** @deprecated Import `INITIA_EVM_CHAIN_ID_STR` from `@initia-agent/shared`. */
export const INTERWOVEN_EVM_CHAIN_ID_NUMERIC = INITIA_EVM_CHAIN_ID_STR;
export const INTERWOVEN_AUTO_SIGN_CHAIN_IDS = INITIA_AUTO_SIGN_CHAIN_IDS;
let autoSignEnabledOptimistic = false;

type AutoSignController = {
  isEnabledByChain?: Record<string, boolean | undefined>;
  enable?: (chainId: string) => Promise<unknown>;
  disable?: (chainId: string) => Promise<unknown>;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isUserRejectedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("rejected") || message.includes("user denied");
}

function isIgnorableDisableError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes("authorization not found");
}

export function getAutoSignErrorMessage(error: unknown): string {
  return getErrorMessage(error);
}

export function isAutoSignEnabled(autoSign: AutoSignController | null | undefined): boolean {
  if (autoSignEnabledOptimistic) return true;
  return INTERWOVEN_AUTO_SIGN_CHAIN_IDS.some(
    (chainId) => autoSign?.isEnabledByChain?.[chainId] === true
  );
}

export async function ensureAutoSignEnabled(
  autoSign: AutoSignController | null | undefined
): Promise<boolean> {
  if (isAutoSignEnabled(autoSign)) return true;
  if (!autoSign?.enable) return false;

  let lastError: unknown;
  for (const chainId of INTERWOVEN_AUTO_SIGN_CHAIN_IDS) {
    try {
      await autoSign.enable(chainId);
      autoSignEnabledOptimistic = true;
      return true;
    } catch (error) {
      lastError = error;
      if (isUserRejectedError(error)) throw error;
    }
  }

  if (lastError) {
    console.warn("[AutoSign] Failed enabling auto-sign:", getErrorMessage(lastError));
  }
  return isAutoSignEnabled(autoSign);
}

export async function disableAutoSign(
  autoSign: AutoSignController | null | undefined
): Promise<void> {
  if (!autoSign?.disable) return;

  let firstUnexpectedError: unknown;
  for (const chainId of INTERWOVEN_AUTO_SIGN_CHAIN_IDS) {
    try {
      await autoSign.disable(chainId);
    } catch (error) {
      if (isIgnorableDisableError(error)) continue;
      if (!firstUnexpectedError) firstUnexpectedError = error;
    }
  }

  if (firstUnexpectedError) throw firstUnexpectedError;
  autoSignEnabledOptimistic = false;
}
