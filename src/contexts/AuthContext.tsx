
import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

type Officer = {
  id: string;
  name: string;
  badgeNumber: string;
  role: string;
  avatar?: string;
};

type AuthContextType = {
  officer: Officer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (badgeNumber: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
};

const defaultContext: AuthContextType = {
  officer: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  logout: () => {},
  error: null,
};

const AuthContext = createContext<AuthContextType>(defaultContext);

// Mock data for demonstration
const MOCK_OFFICERS = [
  {
    id: "1",
    name: "John Reynolds",
    badgeNumber: "12345",
    password: "password123",
    role: "Chief Inspector",
    avatar: "https://source.unsplash.com/random/300x300/?police,officer,1",
  },
  {
    id: "2",
    name: "Sarah Chen",
    badgeNumber: "67890",
    password: "password123",
    role: "Detective",
    avatar: "https://source.unsplash.com/random/300x300/?police,officer,2",
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in (from local storage)
    const storedOfficer = localStorage.getItem("officer");
    
    if (storedOfficer) {
      setOfficer(JSON.parse(storedOfficer));
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
  }, []);

  const login = async (badgeNumber: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API call with timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const foundOfficer = MOCK_OFFICERS.find(
        o => o.badgeNumber === badgeNumber && o.password === password
      );
      
      if (!foundOfficer) {
        throw new Error("Invalid badge number or password");
      }
      
      const { password: _, ...officerWithoutPassword } = foundOfficer;
      setOfficer(officerWithoutPassword);
      setIsAuthenticated(true);
      
      // Store in localStorage
      localStorage.setItem("officer", JSON.stringify(officerWithoutPassword));
      
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setOfficer(null);
    setIsAuthenticated(false);
    localStorage.removeItem("officer");
    navigate("/");
  };

  return (
    <AuthContext.Provider
      value={{
        officer,
        isAuthenticated,
        isLoading,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
