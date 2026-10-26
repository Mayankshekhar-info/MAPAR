import { api } from "../../../services/api";
import {
  AuthResponse,
  AuthUser,
  ChangePasswordPayload,
  LoginCredentials,
  PasswordResetConfirmPayload,
  PasswordResetResponse,
} from "../types/auth.types";

export const authService = {
  /**
   * Fetches CSRF cookie and token from backend.
   */
  async getCsrfToken(): Promise<string> {
    const response = await api.get<{ csrfToken: string }>("/auth/csrf/");
    return response.data.csrfToken;
  },

  /**
   * Authenticates user with credentials.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload = {
      username: credentials.username.trim(),
      password: credentials.password,
      remember_me: credentials.rememberMe ?? false,
    };
    const response = await api.post<AuthResponse>("/auth/login/", payload);
    return response.data;
  },

  /**
   * Fetches current authenticated user session.
   */
  async getCurrentUser(): Promise<AuthUser> {
    const response = await api.get<{ is_authenticated: boolean; user: AuthUser }>("/auth/me/");
    return response.data.user;
  },

  /**
   * Logs out user and destroys session.
   */
  async logout(): Promise<void> {
    await api.post("/auth/logout/");
  },

  /**
   * Requests a password reset OTP verification code.
   */
  async requestPasswordReset(identifier: string): Promise<PasswordResetResponse> {
    const response = await api.post<PasswordResetResponse>("/auth/password-reset/request/", {
      identifier: identifier.trim(),
    });
    return response.data;
  },

  /**
   * Verifies the 6-digit OTP code received by user.
   */
  async verifyResetOtp(identifier: string, otp_code: string): Promise<PasswordResetResponse> {
    const response = await api.post<PasswordResetResponse>("/auth/password-reset/verify/", {
      identifier: identifier.trim(),
      otp_code: otp_code.trim(),
    });
    return response.data;
  },

  /**
   * Sets new password using verified single-use reset token.
   */
  async confirmPasswordReset(payload: PasswordResetConfirmPayload): Promise<PasswordResetResponse> {
    const response = await api.post<PasswordResetResponse>("/auth/password-reset/confirm/", payload);
    return response.data;
  },

  /**
   * Changes password for an active authenticated session.
   */
  async changePassword(payload: ChangePasswordPayload): Promise<{ success: boolean; detail: string }> {
    const response = await api.post<{ success: boolean; detail: string }>("/auth/change-password/", payload);
    return response.data;
  },
};
