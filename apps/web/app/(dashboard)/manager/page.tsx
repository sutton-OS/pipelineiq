import type { Metadata } from "next";
import { RepRoster } from "@/components/RepRoster";

export const metadata: Metadata = {
  title: "Team Dashboard",
};

export default function ManagerPage() {
  return (
    <main>
      <RepRoster />
    </main>
  );
}
