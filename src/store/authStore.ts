import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiLogin, apiSignup, apiMe } from "../lib/api";
import { hapticSuccess, hapticError } from "../lib/haptic";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isChecked: boolean;
  hasHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      isChecked: false,
      hasHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { token, user } = await apiLogin(email, password);
          localStorage.setItem("splitsprint-token", token);
          set({ token, user, isLoading: false });
          hapticSuccess();
        } catch (err) {
          set({ isLoading: false });
          hapticError();
          throw err;
        }
      },

      signup: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const { token, user } = await apiSignup(email, password, name);
          localStorage.setItem("splitsprint-token", token);
          set({ token, user, isLoading: false });
          hapticSuccess();
        } catch (err) {
          set({ isLoading: false });
          hapticError();
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("splitsprint-token");
        set({ token: null, user: null });
      },

      checkAuth: async () => {
        const token = localStorage.getItem("splitsprint-token");
        if (!token) {
          set({ isChecked: true });
          return;
        }
        // Optimistic: show cached user immediately for returning users
        let cachedUser: User | null = null;
        try {
          const stored = localStorage.getItem("splitsprint-auth");
          if (stored) {
            const parsed = JSON.parse(stored);
            cachedUser = parsed?.state?.user ?? null;
          }
        } catch {
          /* ignore */
        }
        if (cachedUser) {
          set({ token, user: cachedUser, isChecked: true });
          apiMe()
            .then((user) => {
              if (!user) {
                localStorage.removeItem("splitsprint-token");
                set({ token: null, user: null });
              } else {
                set({ user });
              }
            })
            .catch(() => {
              localStorage.removeItem("splitsprint-token");
              set({ token: null, user: null });
            });
          return;
        }
        try {
          const user = await apiMe();
          if (!user) {
            localStorage.removeItem("splitsprint-token");
            set({ token: null, user: null, isChecked: true });
            return;
          }
          set({ token, user, isChecked: true });
        } catch {
          localStorage.removeItem("splitsprint-token");
          set({ token: null, user: null, isChecked: true });
        }
      },
    }),
    {
      name: "splitsprint-auth",
      partialize: (s) => ({ token: s.token, user: s.user }), // hasHydrated not persisted
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem("splitsprint-token", state.token);
        }
      },
    }
  )
);

useAuthStore.persist.onFinishHydration(() => {
  const { token } = useAuthStore.getState();
  if (token) localStorage.setItem("splitsprint-token", token);
  useAuthStore.setState({ hasHydrated: true });
});
