import { useEffect } from "react";
import { authService } from "../services/authService";
import { useAuthStore } from "./useAuthStore";

export function useAuth() {
  const { user, isAuthenticated, isLoading, error, setUser, setError, setLoading, clearAuth } =
    useAuthStore();

  const checkAuth = async () => {
    setLoading(true);
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      clearAuth();
    }
  };

  useEffect(() => {
    // Only check once on mount if user is not loaded
    if (user === null) {
      checkAuth();
    }
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    checkAuth,
    logout,
  };
}
