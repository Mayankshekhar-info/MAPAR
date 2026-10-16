export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  role: string;
  role_name: string;
  status?: string;
  circle_id?: number | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  permissions?: string[];
  accessible_modules?: string[];
  effective_circles?: number[] | null;
}

export interface AuthResponse {
  success: boolean;
  user: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}
