import { createContext, useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { mobileLogin, getCurrentEmployee } from "@/services/api/authApi";
import { getAccessToken, saveAccessToken, removeAccessToken } from "@/services/storage/authStorage";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const queryClient = useQueryClient();

  // On app launch: if a token was saved from a previous session, validate it
  // against the backend rather than trusting it blindly (it may have expired
  // or the account may have been deactivated since).
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const current = await getCurrentEmployee();
        setEmployee(current);
      } catch {
        await removeAccessToken();
        setEmployee(null);
      } finally {
        setIsBootstrapping(false);
      }
    })();
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { accessToken, employee: loggedInEmployee } = await mobileLogin({ email, password });
    await saveAccessToken(accessToken);
    setEmployee(loggedInEmployee);
    return loggedInEmployee;
  }, []);

  const logout = useCallback(async () => {
    await removeAccessToken();
    setEmployee(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshEmployee = useCallback(async () => {
    const current = await getCurrentEmployee();
    setEmployee(current);
    return current;
  }, []);

  const value = {
    employee,
    isAuthenticated: Boolean(employee),
    isBootstrapping,
    login,
    logout,
    refreshEmployee,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
