import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("Email ou senha incorretos");
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Informe seu email"); return; }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSent(true);
    setLoading(false);
  };

  if (forgotMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] dark:from-[#1b120c] dark:via-[#0A0A0F] dark:to-[#0A0A0F] p-4">
        <Card className="w-full max-w-md glass-panel relative z-10 transition-all duration-500">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold dark:text-white">Recuperar Senha</CardTitle>
            <CardDescription className="dark:text-muted-foreground">
              {resetSent
                ? "Verifique sua caixa de entrada"
                : "Informe seu email para receber o link de recuperação"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Se este email estiver cadastrado, você receberá um link para redefinir sua senha.
                </p>
                <Button variant="outline" className="w-full dark:border-white/10 dark:hover:border-primary dark:bg-transparent transition-all" onClick={() => { setForgotMode(false); setResetSent(false); }}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label className="dark:text-white">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@email.com" className="dark:bg-[#1A1A2E] dark:border-white/10 dark:text-white dark:focus:border-primary" required />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 dark:bg-gradient-to-r dark:from-[#F97316] dark:to-[#F59E0B] dark:hover:brightness-110 transition-all" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar link de recuperação
                </Button>
                <Button variant="ghost" className="w-full dark:hover:bg-white/5 transition-all" type="button" onClick={() => setForgotMode(false)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark:bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] dark:from-[#1b120c] dark:via-[#0A0A0F] dark:to-[#0A0A0F] p-4 text-foreground transition-colors duration-500">
      {/* Decorative Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden dark:block">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      <Card className="w-full max-w-md glass-panel relative z-10 transition-all duration-500">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold dark:text-white flex items-center justify-center gap-2">
            <span>Grupo Excellence</span>
          </CardTitle>
          <CardDescription className="dark:text-muted-foreground">Acesse sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="dark:text-white">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@email.com" className="dark:bg-[#1A1A2E] dark:border-white/10 dark:text-white dark:focus:border-primary transition-all" required />
            </div>
            <div>
              <Label className="dark:text-white">Senha</Label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="dark:bg-[#1A1A2E] dark:border-white/10 dark:text-white dark:focus:border-primary transition-all" />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 dark:bg-gradient-to-r dark:from-[#F97316] dark:to-[#F59E0B] dark:hover:brightness-110 dark:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all duration-200" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Entrar
            </Button>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="text-sm text-muted-foreground hover:text-primary dark:text-[#8B8B9E] dark:hover:text-[#F97316] transition-colors underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
