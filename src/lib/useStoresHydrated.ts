import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useBillStore } from "../store/billStore";

/**
 * With skipHydration: true, we manually rehydrate to avoid the "payload" race.
 * Waits for both stores to finish before rendering.
 */
export function useStoresHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let done = false;
    const check = () => {
      if (done) return;
      if (useAuthStore.persist.hasHydrated() && useBillStore.persist.hasHydrated()) {
        done = true;
        setHydrated(true);
      }
    };

    const unsubAuth = useAuthStore.persist.onFinishHydration(check);
    const unsubBill = useBillStore.persist.onFinishHydration(check);

    Promise.all([
      useAuthStore.persist.rehydrate(),
      useBillStore.persist.rehydrate(),
    ])
      .then(check)
      .catch(() => {
        if (!done) setHydrated(true);
      });

    const t = setTimeout(() => {
      if (!done) {
        done = true;
        setHydrated(true);
      }
    }, 3000);

    return () => {
      clearTimeout(t);
      unsubAuth();
      unsubBill();
    };
  }, []);

  return hydrated;
}
