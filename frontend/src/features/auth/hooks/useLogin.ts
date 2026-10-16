import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { LoginCredentials } from "../types/auth.types";
import { useAuthStore } from "./useAuthStore";
import axios from "axios";

export function useLogin() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((state) => state.setUser);

  const login = async (credentials: LoginCredentials) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Ensure CSRF token is set before login post
      try {
        await authService.getCsrfToken();
      } catch {
        // Continue even if CSRF preflight fails, as login endpoint handles csrf exemption/cookie
      }

      const response = await authService.login(credentials);
      setUser(response.user);

      // Navigate to intended route or default landing
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setErrorMessage("Invalid username or password. Please check your credentials.");
        } else if (err.response?.status === 403) {
          setErrorMessage(err.response.data?.detail || "Account is inactive or locked.");
        } else if (err.response?.data?.detail) {
          setErrorMessage(err.response.data.detail);
        } else if (err.response?.data?.errors) {
          const errors = err.response.data.errors;
          const firstKey = Object.keys(errors)[0];
          const firstVal = errors[firstKey];
          setErrorMessage(Array.isArray(firstVal) ? firstVal[0] : String(firstVal));
        } else if (err.code === "ERR_NETWORK") {
          setErrorMessage("Authentication service unavailable. Please check your network or try again later.");
        } else {
          setErrorMessage(err.message || "An unexpected authentication error occurred. Please try again.");
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    login,
    isSubmitting,
    errorMessage,
    clearError: () => setErrorMessage(null),
  };
}
