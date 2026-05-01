"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

interface User {
  role: "admin" | "student" | "teacher";
  name: string;
  no: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (role: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("LIBRARY_TOKEN");
    const storedUser = localStorage.getItem("LIBRARY_USER");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (role: string, username: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/api/login", "POST", {
      role,
      username,
      password,
    });

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("LIBRARY_TOKEN", data.token);
    localStorage.setItem("LIBRARY_USER", JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("LIBRARY_TOKEN");
    localStorage.removeItem("LIBRARY_USER");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
