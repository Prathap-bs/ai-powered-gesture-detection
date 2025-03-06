
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="container max-w-md mx-auto p-6 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-destructive/10">
            <ShieldAlert className="h-16 w-16 text-destructive" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold mb-2 animate-fade-in">404</h1>
        <p className="text-xl text-muted-foreground mb-6 animate-fade-in" style={{ animationDelay: "150ms" }}>
          Access Restricted
        </p>
        
        <p className="text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: "300ms" }}>
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>
        
        <Button 
          asChild
          className="animate-fade-in"
          style={{ animationDelay: "450ms" }}
        >
          <Link to="/" className="inline-flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Secure Area
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
