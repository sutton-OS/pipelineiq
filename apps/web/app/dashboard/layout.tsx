import { SidebarNav } from "@/components/sidebar-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      <aside style={{ background: "var(--paper-2)", color: "var(--ink)" }}>
        <SidebarNav />
      </aside>
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ background: "var(--paper)", color: "var(--ink)" }}
      >
        <header className="border-b border-border/70 px-6 py-3 md:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">
            PipelineIQ
          </p>
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
