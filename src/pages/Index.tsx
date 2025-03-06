
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoginForm from "@/components/LoginForm";
import { Shield } from "lucide-react";

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background design elements */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-background"></div>
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-primary/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 opacity-50"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center p-4 md:p-8">
        <div className="w-full max-w-md mx-auto animate-fade-in">
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-2">
              <Shield className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-semibold">Gesture Safety Connect</h1>
            </div>
          </div>
          
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <LoginForm />
          </div>
          
          <div className="mt-8 text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <p>Advanced AI-powered gesture recognition system</p>
            <p className="mt-1">Authorized personnel access only</p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-muted-foreground">
        <p>Gesture Safety Connect • Emergency Response System</p>
      </footer>
    </div>
  );
};

export default Index;
