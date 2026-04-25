"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

type MockWalletState = {
  deltaInit: number;
  usdc: number;
  updatedAt: string;
};

const STORAGE_PREFIX = "initia-agent:mock-wallet:";
const MOCK_WALLET_UPDATED_EVENT = "initia-agent:mock-wallet-updated";

const DEFAULT_STATE: MockWalletState = {
  deltaInit: 0,
  usdc: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function sanitize(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`;
}

// Cache parsed snapshots per address so useSyncExternalStore gets a stable
// reference between reads when underlying data is unchanged.
const snapshotCache = new Map<string, { raw: string | null; value: MockWalletState }>();

function readState(address: string): MockWalletState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  const key = storageKey(address);
  const raw = window.localStorage.getItem(key);
  const cached = snapshotCache.get(address);
  if (cached && cached.raw === raw) return cached.value;

  let next: MockWalletState;
  if (!raw) {
    next = { ...DEFAULT_STATE };
  } else {
    try {
      const parsed = JSON.parse(raw) as Partial<MockWalletState>;
      next = {
        deltaInit: sanitize(parsed.deltaInit, 0),
        usdc: Math.max(0, sanitize(parsed.usdc, 0)),
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : DEFAULT_STATE.updatedAt,
      };
    } catch {
      next = { ...DEFAULT_STATE };
    }
  }
  snapshotCache.set(address, { raw, value: next });
  return next;
}

function writeState(address: string, nextState: MockWalletState): void {
  if (typeof window === "undefined") return;
  const key = storageKey(address);
  const serialized = JSON.stringify(nextState);
  window.localStorage.setItem(key, serialized);
  snapshotCache.set(address, { raw: serialized, value: nextState });
  window.dispatchEvent(
    new CustomEvent(MOCK_WALLET_UPDATED_EVENT, { detail: { address: address.toLowerCase() } }),
  );
}

function subscribe(address: string, callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(address)) return;
    callback();
  };
  const onUpdated = (event: Event) => {
    const detailAddress = (event as CustomEvent<{ address?: string }>).detail?.address;
    if (detailAddress && detailAddress !== address.toLowerCase()) return;
    callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(MOCK_WALLET_UPDATED_EVENT, onUpdated);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(MOCK_WALLET_UPDATED_EVENT, onUpdated);
  };
}

export function useMockWallet(address: string | undefined, walletInitBalance: number) {
  const subscribeFn = useCallback(
    (callback: () => void) => (address ? subscribe(address, callback) : () => {}),
    [address],
  );
  const getSnapshot = useCallback(
    () => (address ? readState(address) : DEFAULT_STATE),
    [address],
  );
  const getServerSnapshot = useCallback(() => DEFAULT_STATE, []);

  const state = useSyncExternalStore(subscribeFn, getSnapshot, getServerSnapshot);

  const initBalance = useMemo(() => {
    const base = Math.max(0, sanitize(walletInitBalance, 0));
    return Math.max(0, base + sanitize(state.deltaInit, 0));
  }, [walletInitBalance, state.deltaInit]);

  const upsertState = useCallback(
    (updater: (prev: MockWalletState) => MockWalletState) => {
      if (!address) return;
      const current = readState(address);
      const next = updater(current);
      writeState(address, next);
    },
    [address],
  );

  const creditInit = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      upsertState((prev) => ({
        ...prev,
        deltaInit: sanitize(prev.deltaInit, 0) + amount,
        updatedAt: new Date().toISOString(),
      }));
    },
    [upsertState],
  );

  const spendInit = useCallback(
    (amount: number): boolean => {
      if (!Number.isFinite(amount) || amount <= 0) return false;
      if (initBalance < amount) return false;
      upsertState((prev) => ({
        ...prev,
        deltaInit: sanitize(prev.deltaInit, 0) - amount,
        updatedAt: new Date().toISOString(),
      }));
      return true;
    },
    [initBalance, upsertState],
  );

  return {
    initBalance,
    usdcBalance: Math.max(0, sanitize(state.usdc, 0)),
    formattedInit: initBalance.toFixed(2),
    creditInit,
    spendInit,
  };
}
