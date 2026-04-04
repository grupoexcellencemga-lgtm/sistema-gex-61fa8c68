import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-full flex w-full" style={{ minHeight: '-webkit-fill-available' }}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 flex items-center justify-between border-b bg-card px-2 sm:px-4 shrink-0 pt-safe">
            <div className="flex items-center lg:hidden">
              <SidebarTrigger />
              <span className="ml-2 font-semibold text-sm hidden sm:inline">Sistema GEx</span>
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <GlobalSearch />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 pb-safe" style={{ WebkitOverflowScrolling: 'touch' }}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
