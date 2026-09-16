import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Home, RefreshCw } from "lucide-react";
import { usePermissions, ALL_PAGES } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  path: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ path, children }: ProtectedRouteProps) {
  const { canAccessPath, isReady } = usePermissions();
  const navigate = useNavigate();
  const [demorouDemais, setDemorouDemais] = useState(false);

  // Sem isto, qualquer falha ao carregar permissoes prende o usuario numa tela
  // sem botao e sem mensagem, sem forma de sair a nao ser fechar o app.
  useEffect(() => {
    if (isReady) return;
    const t = setTimeout(() => setDemorouDemais(true), 10_000);
    return () => clearTimeout(t);
  }, [isReady]);

  if (!isReady) {
    if (!demorouDemais) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-sm text-muted-foreground">Carregando permissões...</div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            Não foi possível carregar suas permissões
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A conexão com o servidor está demorando mais que o normal. Recarregue
            a página; se continuar assim, avise o administrador.
          </p>
          <Button className="mt-5 gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </Button>
        </div>
      </div>
    );
  }

  const page = ALL_PAGES.find((p) => p.path === path);

  if (!page) {
    return <>{children}</>;
  }

  if (!canAccessPath(path)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          </div>

          <h1 className="text-lg font-semibold text-foreground">
            Acesso não liberado
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Seu usuário não tem permissão para acessar esta área. Se você acredita
            que deveria ter acesso, solicite a liberação ao administrador.
          </p>

          <Button
            className="mt-5 gap-2"
            onClick={() => navigate("/", { replace: true })}
          >
            <Home className="h-4 w-4" />
            Ir para o início
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
