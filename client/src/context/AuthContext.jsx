import { createContext, useContext, useEffect, useState } from "react";
import { post, setToken } from "../services/api";

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = "coep-venue-booking.auth";

function readStoredSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session?.token || !session?.account) return null;

    setToken(session.token);
    return session;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(() => readStoredSession()?.account ?? null);

  function logout() {
    setToken(null);
    setAccount(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  useEffect(() => {
    window.addEventListener("session-expired", logout);
    return () => window.removeEventListener("session-expired", logout);
  }, []);
  async function login(credentials) {
    const result = await post("/auth/login", credentials);
    setToken(result.token);
    setAccount(result.account);
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: result.token, account: result.account }),
    );
  }
  return (
    <AuthContext.Provider value={{ account, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
