
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const LoginForm = () => {
  const [badgeNumber, setBadgeNumber] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(badgeNumber, password);
  };

  return (
    <Card className="w-full max-w-md mx-auto glass-card animate-scale-in">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-2">
          <div className="rounded-full bg-primary/10 p-4 backdrop-blur-sm">
            <Shield className="h-10 w-10 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-semibold text-center">Secure Access</CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access the system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="badgeNumber">Badge Number</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                id="badgeNumber"
                type="text"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                className="pl-10"
                placeholder="Enter your badge number"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
              {error}
            </div>
          )}
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90 transition-all" 
            disabled={isLoading}
          >
            {isLoading ? "Authenticating..." : "Log In"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-center text-muted-foreground w-full">
          Emergency Security System • Authorized Personnel Only
        </p>
      </CardFooter>
    </Card>
  );
};

export default LoginForm;
