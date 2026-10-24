import { api } from "../../../services/api";
import { AuthResponse, AuthUser, LoginCredentials } from "../types/auth.types";

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
};
