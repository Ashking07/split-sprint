import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useBillStore } from "../store/billStore";

function safeHasHydrated(store: { persist?: { hasHydrated?: () => boolean } }) {
  try {
    return store?.persist?.hasHydrated?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Waits for Zustand persist stores to rehydrate before rendering.
 * Prevents "Cannot read properties of undefined (reading 'payload')" race on first load.
 */
export function useStoresHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => {
    if (typeof window === "undefined") return false;
    return safeHasHydrated(useAuthStore) && safeHasHydrated(useBillStore);
  });

  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (safeHasHydrated(useAuthStore) && safeHasHydrated(useBillStore)) {
        setHydrated(true);
      }
    };
    try {
      const unsubAuth = useAuthStore.persist?.onFinishHydration?.(check);
      const unsubBill = useBillStore.persist?.onFinishHydration?.(check);
      check();
      return () => {
        unsubAuth?.();
        unsubBill?.();
      };
    } catch {
      setHydrated(true);
      return () => {};
    }
  }, [hydrated]);

  return hydrated;
}
