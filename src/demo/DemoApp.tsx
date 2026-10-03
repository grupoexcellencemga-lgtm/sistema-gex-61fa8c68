import { Navigate, Route, Routes } from "react-router-dom";
import { DemoBrandProvider } from "@/demo/DemoBrandContext";
import { DemoShell } from "@/demo/components/DemoShell";
import HomePage from "@/demo/pages/HomePage";
import DashboardPage from "@/demo/pages/DashboardPage";
import ClientsPage from "@/demo/pages/ClientsPage";
import CrmPage from "@/demo/pages/CrmPage";
import ProductsPage from "@/demo/pages/ProductsPage";
import AgendaPage from "@/demo/pages/AgendaPage";
import TasksPage from "@/demo/pages/TasksPage";
import FinancePage from "@/demo/pages/FinancePage";
import AiPage from "@/demo/pages/AiPage";
import ClassesPage from "@/demo/pages/ClassesPage";
import EventsPage from "@/demo/pages/EventsPage";
import ReportsPage from "@/demo/pages/ReportsPage";
import SettingsPage from "@/demo/pages/SettingsPage";

export default function DemoApp() {
  return (
    <DemoBrandProvider>
      <Routes>
        <Route path="/demo" element={<DemoShell />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="tarefas" element={<TasksPage />} />
          <Route path="financeiro" element={<FinancePage />} />
          <Route path="ia" element={<AiPage />} />
          <Route path="turmas" element={<ClassesPage />} />
          <Route path="eventos" element={<EventsPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Route>
      </Routes>
    </DemoBrandProvider>
  );
}
