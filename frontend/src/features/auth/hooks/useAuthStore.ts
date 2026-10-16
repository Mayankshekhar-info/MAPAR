import { create } from "zustand";
import { AuthState, AuthUser } from "../types/auth.types";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  setUser: (user: AuthUser | null) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
    }),
  setError: (error: string | null) =>
    set({
      error,
      isLoading: false,
    }),
  setLoading: (isLoading: boolean) =>
    set({
      isLoading,
    }),
  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    }),
}));
