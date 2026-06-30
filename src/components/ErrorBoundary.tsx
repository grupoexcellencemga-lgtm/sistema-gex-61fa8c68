import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Quando este valor muda (ex.: a rota atual), o erro é limpo automaticamente. */
  resetKey?: unknown;
  /** Renderiza o erro dentro do conteúdo (sem ocupar a tela toda), preservando o menu. */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: Props) {
    // Ao navegar para outra página, recupera sozinho sem precisar recarregar.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorMessage = this.state.error?.message || "Erro desconhecido";
      const errorStack = this.state.error?.stack || "";

      return (
        <div
          className={
            this.props.inline
              ? "flex flex-1 items-center justify-center p-6"
              : "min-h-screen flex items-center justify-center bg-background p-6"
          }
        >
          <div className="text-center max-w-md space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <details className="text-left bg-muted rounded-md p-3">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer">Detalhes do erro</summary>
              <pre className="mt-2 text-xs text-destructive whitespace-pre-wrap break-all overflow-auto max-h-40">
                {errorMessage}
                {"\n\n"}
                {errorStack}
              </pre>
            </details>
            <div className="flex items-center justify-center gap-2">
              {this.props.inline && (
                <Button variant="outline" onClick={this.handleReset} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              )}
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
