import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { IOSInstallPrompt } from "@/components/IOSInstallPrompt";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Eager-load Auth (first screen for unauthenticated users)
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";

// Lazy-load all authenticated pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jornada = lazy(() => import("./pages/Jornada"));
const Alunos = lazy(() => import("./pages/Alunos"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Turmas = lazy(() => import("./pages/Turmas"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const UsuariosADM = lazy(() => import("./pages/UsuariosADM"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const ProcessoIndividual = lazy(() => import("./pages/ProcessoIndividual"));
const ProcessoEmpresarial = lazy(() => import("./pages/ProcessoEmpresarial"));
const Profissionais = lazy(() => import("./pages/Profissionais"));
const Vendedores = lazy(() => import("./pages/Vendedores"));
const Aniversarios = lazy(() => import("./pages/Aniversarios"));
const MindMap = lazy(() => import("./pages/MindMap"));
const Metas = lazy(() => import("./pages/Metas"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Divulgacao = lazy(() => import("./pages/Divulgacao"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const PageFallback = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <LoadingScreen />
  </div>
);

const PR = ({ path, children }: { path: string; children: React.ReactNode }) => (
  <ProtectedRoute path={path}>{children}</ProtectedRoute>
);

const AppRoutes = () => {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<PR path="/"><Dashboard /></PR>} />
          <Route path="/alunos" element={<PR path="/alunos"><Alunos /></PR>} />
          <Route path="/jornada" element={<PR path="/jornada"><Jornada /></PR>} />
          <Route path="/produtos" element={<PR path="/produtos"><Produtos /></PR>} />
          <Route path="/turmas" element={<PR path="/turmas"><Turmas /></PR>} />
          <Route path="/eventos" element={<PR path="/eventos"><Eventos /></PR>} />
          <Route path="/processo-individual" element={<PR path="/processo-individual"><ProcessoIndividual /></PR>} />
          <Route path="/processo-empresarial" element={<PR path="/processo-empresarial"><ProcessoEmpresarial /></PR>} />
          <Route path="/profissionais" element={<PR path="/profissionais"><Profissionais /></PR>} />
          <Route path="/vendedores" element={<PR path="/vendedores"><Vendedores /></PR>} />
          <Route path="/financeiro" element={<PR path="/financeiro"><Financeiro /></PR>} />
          <Route path="/metas" element={<PR path="/metas"><Metas /></PR>} />
          <Route path="/relatorios" element={<PR path="/relatorios"><Relatorios /></PR>} />
          <Route path="/usuarios" element={<PR path="/usuarios"><UsuariosADM /></PR>} />
          <Route path="/configuracoes" element={<PR path="/configuracoes"><Configuracoes /></PR>} />
          <Route path="/aniversarios" element={<PR path="/aniversarios"><Aniversarios /></PR>} />
          <Route path="/mindmap" element={<PR path="/mindmap"><MindMap /></PR>} />
          <Route path="/auditoria" element={<PR path="/auditoria"><Auditoria /></PR>} />
          <Route path="/tarefas" element={<PR path="/tarefas"><Tarefas /></PR>} />
          <Route path="/divulgacao" element={<PR path="/divulgacao"><Divulgacao /></PR>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
            <PWAUpdatePrompt />
            <IOSInstallPrompt />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
