import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { login } from "@/lib/api";

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = await login(email, password); // chama a API via api.ts

      // se quiser, aqui você tem: data.token e data.user
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        // força o app a recarregar já logado
        window.location.href = "/";
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      // jsonOrThrow já joga uma mensagem decente na Error
      setError(err?.message || "Erro ao conectar ao servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 rounded-2xl shadow-lg border border-border space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-24 w-24 rounded-2xl flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">
              <img
                src="/Icehot_Logo_FundoBranco.png"
                alt="Icehot"
                className="h-24 md:h-28 lg:h-32 w-auto object-contain drop-shadow-sm"
              />
            </span>
          </div>
          <h1 className="text-2xl font-bold">Icehot Dashboard</h1>
          <p className="text-sm text-muted-foreground text-center">
            Acesse com seu e-mail e senha cadastrados para ver os dados do seu
            contrato.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="voce@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full mt-2" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
