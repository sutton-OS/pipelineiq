import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Reports",
    template: "Reports — %s",
  },
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
