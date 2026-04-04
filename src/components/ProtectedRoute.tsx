import { Navigate } from "react-router-dom";
import { usePermissions, ALL_PAGES } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  path: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ path, children }: ProtectedRouteProps) {
  const { canAccessPath, isReady } = usePermissions();

  if (!isReady) return null;

  const page = ALL_PAGES.find((p) => p.path === path);
  if (!page) return <>{children}</>;

  if (!canAccessPath(path)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
