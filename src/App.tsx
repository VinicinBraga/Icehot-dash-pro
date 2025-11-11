// src/App.tsx
import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { LoginForm } from "./components/LoginForm";
import { getToken } from "./lib/auth";

const queryClient = new QueryClient();

const App = () => {
  const [token, setTokenState] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const t = getToken();
    setTokenState(t);
    setBooting(false);
  }, []);

  const handleLoginSuccess = () => {
    const t = getToken();
    setTokenState(t);
  };

  // Enquanto verifica o token no load
  if (booting) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-sm text-muted-foreground">Carregando...</div>
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Sem token => mostra tela de login
  if (!token) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Com token => libera dashboard
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* rotas extras futuras entram aqui */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
