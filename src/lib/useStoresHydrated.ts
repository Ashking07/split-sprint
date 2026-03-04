import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useBillStore } from "../store/billStore";

/**
 * Waits for Zustand persist stores to rehydrate before rendering.
 * Prevents "Cannot read properties of undefined (reading 'payload')" race on first load.
 */
export function useStoresHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      useAuthStore.persist.hasHydrated() && useBillStore.persist.hasHydrated()
    );
  });

  useEffect(() => {
    if (hydrated) return;
    const check = () => {
      if (
        useAuthStore.persist.hasHydrated() &&
        useBillStore.persist.hasHydrated()
      ) {
        setHydrated(true);
      }
    };
    const unsubAuth = useAuthStore.persist.onFinishHydration(check);
    const unsubBill = useBillStore.persist.onFinishHydration(check);
    check();
    return () => {
      unsubAuth();
      unsubBill();
    };
  }, [hydrated]);

  return hydrated;
}
