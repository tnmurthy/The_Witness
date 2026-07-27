import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ErrorBoundary } from "@/components/error/error-boundary";

interface AppShellProps {
  children: React.ReactNode;
  userEmail: string;
  userFullName?: string | null;
  showAdmin?: boolean;
}

/**
 * Composes the standard editorial-app layout: sidebar + topbar + main
 * content, per the Design System's Dashboard Layout and Navigation
 * sections. Each dashboard page's content is wrapped in its own
 * ErrorBoundary so a broken widget can't take down the sidebar/topbar
 * chrome around it.
 */
export function AppShell({ children, userEmail, userFullName, showAdmin = false }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-page">
      <Sidebar showAdmin={showAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={userEmail} fullName={userFullName} showAdmin={showAdmin} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <ErrorBoundary boundaryName="page content">{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
