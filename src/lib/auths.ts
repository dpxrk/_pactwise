export interface LoginCredentials {
  email: string;
  password: string;
  user_agent?: string;
  mfa_code?: string | null;
}
export interface AuthData {
  access_token: string | null;
  refresh_token: string | null;
  user_id: number | null;
  enterprise_id: number | null;
  is_superuser: boolean;
  isAuthenticated: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  user_id: number;
  enterprise_id: number;
  is_superuser: boolean;
}

export interface AuthFailureLog {
  email: string;
  error: string;
  timestamp: string;
  user_agent?: string;
}

export const login = async (
  credentials: LoginCredentials
): Promise<AuthResponse> => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(getErrorMessage(data.error_type, data.message));
  }

  return response.json();
};

export const logAuthFailure = async (log: AuthFailureLog): Promise<void> => {
  try {
    await fetch("/api/auth/log-failure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(log),
    });
  } catch (error) {
    console.error("Failed to log authentication failure:", error);
  }
};

export const getAuthData = (): AuthData => {
  const access_token = localStorage.getItem("access_token");
  const refresh_token = localStorage.getItem("refresh_token");
  const user_id = localStorage.getItem("user_id");
  const enterprise_id = localStorage.getItem("enterprise_id");
  const is_superuser = localStorage.getItem("is_superuser");

  return {
    access_token,
    refresh_token,
    user_id: user_id ? parseInt(user_id, 10) : null,
    enterprise_id: enterprise_id ? parseInt(enterprise_id, 10) : null,
    is_superuser: is_superuser === "true",
    isAuthenticated: !!access_token,
  };
};

export const setAuthData = (data: AuthResponse): void => {
  localStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) {
    localStorage.setItem("refresh_token", data.refresh_token);
  }
  localStorage.setItem("user_id", data.user_id.toString());
  localStorage.setItem("enterprise_id", data.enterprise_id.toString());
  localStorage.setItem("is_superuser", data.is_superuser.toString());
};

const getErrorMessage = (
  errorType?: string,
  defaultMessage?: string
): string => {
  switch (errorType) {
    case "INVALID_CREDENTIALS":
      return "Invalid email or password";
    case "ACCOUNT_LOCKED":
      return "Account locked due to too many failed attempts. Please try again later.";
    case "MFA_REQUIRED":
      return "MFA authentication required";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email address before signing in";
    case "ACCOUNT_INACTIVE":
      return "Your account is inactive. Please contact support.";
    default:
      return defaultMessage || "An error occurred during authentication";
  }
};
