import { useCallback, useState } from "react";

export function useAuthState(initialPhone = "9841439865") {
  const [userProfile, setUserProfile] = useState(null);
  const [loginPhone, setLoginPhone] = useState(initialPhone);
  const [loginPassword, setLoginPassword] = useState("");

  const login = useCallback(() => {
    if (!loginPhone.trim() || !loginPassword.trim()) {
      return false;
    }

    setUserProfile({
      name: "Jebasingh Joshua",
      phone: loginPhone.trim(),
    });
    setLoginPassword("");
    return true;
  }, [loginPassword, loginPhone]);

  const logout = useCallback(() => {
    setUserProfile(null);
    setLoginPassword("");
  }, []);

  return {
    userProfile,
    loginPhone,
    loginPassword,
    setLoginPhone,
    setLoginPassword,
    login,
    logout,
  };
}
