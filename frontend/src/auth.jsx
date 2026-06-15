import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      setLoading(false);
      return;
    }
    // Render immediately using the cached identity so a refresh never blocks on
    // a cold backend. Verify the session in the background; the api interceptor
    // handles a hard 401 (expired token) by redirecting to /login.
    const cached = localStorage.getItem("username");
    if (cached) setUser({ username: cached });
    setLoading(false);
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        localStorage.setItem("username", r.data.username);
      })
      .catch(() => {});
  }, []);

  async function login(username, password) {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    const me = await api.get("/auth/me");
    setUser(me.data);
    localStorage.setItem("username", me.data.username);
  }

  async function register(username, email, password) {
    await api.post("/auth/register", { username, email, password });
    await login(username, password);
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
