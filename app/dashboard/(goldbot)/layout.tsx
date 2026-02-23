import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "GoldBot",
    template: "GoldBot — %s",
  },
};

export default function GoldBotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
