import { useCallback, useState } from "react";
import { useAuthState } from "./useAuthState";

const useAuthUiState = (options) => {
  const {
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
  } = useAuthState(options);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const handleProfilePress = useCallback(() => {
    if (userProfile) {
      setProfileMenuVisible((prev) => !prev);
      return;
    }
    clearAuthError();
    setAuthModalVisible(true);
  }, [clearAuthError, userProfile]);

  const handleAuthSubmit = useCallback(async () => {
    const success = await login();
    if (success) {
      setAuthModalVisible(false);
      setProfileMenuVisible(true);
    }
  }, [login]);

  const handleLogout = useCallback(() => {
    logout();
    setProfileMenuVisible(false);
  }, [logout]);

  const closeAuthModal = useCallback(() => {
    setAuthModalVisible(false);
    setLoginPassword("");
    clearAuthError();
  }, [clearAuthError, setLoginPassword]);

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
    profileMenuVisible,
    setProfileMenuVisible,
    authModalVisible,
    setAuthModalVisible,
    handleProfilePress,
    handleAuthSubmit,
    handleLogout,
    closeAuthModal,
  };
};

export default useAuthUiState;
