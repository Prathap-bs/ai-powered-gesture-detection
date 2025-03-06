
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  BellIcon, 
  LogOut, 
  Menu, 
  Settings, 
  Shield, 
  User 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const Navbar = () => {
  const { officer, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="flex gap-2 md:gap-6 mr-4">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">
              Gesture Safety Connect
            </span>
          </Link>
        </div>

        {isMobile ? (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-auto" 
              onClick={toggleMobileMenu}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            {mobileMenuOpen && (
              <div className="fixed inset-0 top-16 z-50 bg-background animate-fade-in">
                <nav className="container grid gap-2 p-4">
                  <Link 
                    to="/dashboard" 
                    className="flex items-center px-4 py-2 text-primary rounded-md hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    to="/alerts" 
                    className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Alerts
                  </Link>
                  <Link 
                    to="/settings" 
                    className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Separator className="my-2" />
                  <div className="px-4 py-2">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={officer?.avatar} />
                        <AvatarFallback>{officer?.name ? getInitials(officer.name) : "U"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{officer?.name}</p>
                        <p className="text-xs text-muted-foreground">{officer?.role}</p>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="flex items-center justify-start px-4 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </nav>
              </div>
            )}
          </>
        ) : (
          <>
            <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
              <Link 
                to="/dashboard" 
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <Link 
                to="/alerts" 
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Alerts
              </Link>
              <Link 
                to="/settings" 
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Settings
              </Link>
            </nav>
            <div className="ml-auto flex items-center space-x-4">
              <Button variant="ghost" size="icon" className="relative">
                <BellIcon className="h-5 w-5" />
                <span className="absolute h-2 w-2 top-1 right-1 block rounded-full bg-red-500"></span>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar>
                      <AvatarImage src={officer?.avatar} />
                      <AvatarFallback>{officer?.name ? getInitials(officer.name) : "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{officer?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {officer?.role}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
                    onClick={logout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
