"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  ActivitySquare,
  AlertTriangle,
  Bot,
  FileText,
  LayoutDashboard,
  ListChecks,
  Menu,
  Upload,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SHOW_EXPERIMENTAL_GOLDBOT_FEATURES } from "@/lib/features";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Workflow",
    items: [
      { href: "/dashboard", label: "Follow-up", icon: LayoutDashboard },
      { href: "/dashboard/leads", label: "Leads", icon: ListChecks },
      { href: "/dashboard/intake", label: "Intake", icon: Upload },
      { href: "/dashboard/staff-queue", label: "Staff Queue", icon: AlertTriangle },
      { href: "/dashboard/settings/automation", label: "Automations", icon: Bot },
    ],
  },
  {
    title: "Reports",
    items: [
      { href: "/dashboard/upload", label: "Upload", icon: Upload },
      { href: "/dashboard/reports", label: "Reports", icon: FileText },
    ],
  },
  ...(SHOW_EXPERIMENTAL_GOLDBOT_FEATURES
    ? [
        {
          title: "Experimental",
          items: [
            { href: "/dashboard/audit", label: "Audit Log", icon: ActivitySquare },
            { href: "/dashboard/inbound-sim", label: "Inbound Simulator", icon: Upload },
            { href: "/dashboard/settings/env", label: "Env Status", icon: Settings },
          ],
        } satisfies NavSection,
      ]
    : []),
  {
    title: "Settings",
    items: [{ href: "/dashboard/settings", label: "Billing & Settings", icon: Settings }],
  },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  mobile = false,
}: {
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <nav className="space-y-4">
      {navSections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;

            const link = (
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-[rgba(255,255,255,0.08)] text-white"
                    : "text-[rgba(255,255,255,0.45)] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );

            if (mobile) {
              return (
                <SheetClose asChild key={item.href}>
                  {link}
                </SheetClose>
              );
            }

            return <div key={item.href}>{link}</div>;
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--ink)", color: "white" }}
    >
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-[18px] leading-none">
          <span className="font-sans font-medium" style={{ color: "var(--accent)" }}>
            Pipeline{" "}
          </span>
          <span
            className="font-serif italic"
            style={{ color: "var(--accent)" }}
          >
            IQ
          </span>
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
          Workflow Suite
        </p>
      </div>

      <div className="flex-1 px-3 py-4">
        <NavLinks pathname={pathname} />
      </div>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
          Account
        </p>
        <UserButton />
      </div>
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden h-screen w-[220px] shrink-0 md:sticky md:top-0 md:block">
        <SidebarContent pathname={pathname} />
      </aside>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation"
              className="fixed top-4 left-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-[var(--ink)] text-white shadow-sm transition-opacity duration-150 hover:opacity-90"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[220px] border-r-0 p-0"
            style={{ background: "var(--ink)" }}
          >
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="border-b border-white/10 px-5 py-5">
                <div className="text-[18px] leading-none">
                  <span
                    className="font-sans font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    Pipeline{" "}
                  </span>
                  <span
                    className="font-serif italic"
                    style={{ color: "var(--accent)" }}
                  >
                    IQ
                  </span>
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                  Workflow Suite
                </p>
              </div>

              <div className="flex-1 px-3 py-4">
                <NavLinks pathname={pathname} mobile />
              </div>

              <div className="border-t border-white/10 px-4 py-4">
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                  Account
                </p>
                <UserButton />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
