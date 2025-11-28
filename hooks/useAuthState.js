import { useCallback, useMemo, useState } from "react";

export function useAuthState({
  initialPhone = "9841439865",
  baseUrl = "",
} = {}) {
  const REQUEST_TIMEOUT_MS = 15000;
  const [userProfile, setUserProfile] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [loginPhone, setLoginPhone] = useState(initialPhone);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const normalizedBaseUrl = useMemo(() => {
    if (!baseUrl) return "";
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  }, [baseUrl]);

  const login = useCallback(async () => {
    const trimmedIdentifier = loginPhone.trim();
    if (!trimmedIdentifier || !loginPassword.trim()) {
      setLoginError("Phone/email and password are required.");
      return false;
    }
    if (!normalizedBaseUrl) {
      setLoginError("Mobile BFF base URL is not configured.");
      return false;
    }

    setLoginLoading(true);
    setLoginError(null);

    let timeoutId;
    try {
      const fetchPromise = fetch(`${normalizedBaseUrl}/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneOrEmail: trimmedIdentifier,
          password: loginPassword,
        }),
      });
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("timeout")),
          REQUEST_TIMEOUT_MS
        );
      });
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const message = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        const errorMessage =
          typeof message === "string"
            ? message
            : message?.title || message?.message || "Login failed";
        setLoginError(errorMessage);
        return false;
      }

      const data = await response.json();
      if (!data?.token) {
        setLoginError("Invalid response from server.");
        return false;
      }

      setAuthToken(data.token);
      const firstName = data.user?.firstName ?? "";
      const lastName = data.user?.lastName ?? "";
      const displayName = `${firstName} ${lastName}`.trim() || "User";
      setUserProfile({
        name: displayName,
        phone: data.user?.phoneNumber ?? trimmedIdentifier,
        raw: data.user,
      });
      setLoginPassword("");
      return true;
    } catch (error) {
      if (error?.message === "timeout") {
        setLoginError(
          "Request timed out. Please check your connection and try again."
        );
      } else {
        setLoginError("Unable to reach the server. Please try again.");
      }
      return false;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoginLoading(false);
    }
  }, [loginPassword, loginPhone, normalizedBaseUrl]);

  const logout = useCallback(() => {
    setUserProfile(null);
    setAuthToken(null);
    setLoginPassword("");
  }, []);

  const clearAuthError = useCallback(() => setLoginError(null), []);

  return {
    userProfile,
    authToken,
    loginPhone,
    loginPassword,
    loginLoading,
    loginError,
    setLoginPhone,
    setLoginPassword,
    login,
    logout,
    clearAuthError,
  };
}
