import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { simulateInboundSmsAction } from "@/app/actions/goldbot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Inbound SMS Simulator",
};

async function submitInboundSimulation(formData: FormData) {
  "use server";

  const result = await simulateInboundSmsAction(formData);
  if (!result.ok) {
    redirect(`/dashboard/inbound-sim?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/dashboard/leads");
}

export default async function InboundSimulatorPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Inbound SMS Simulator</h1>
        <p className="text-sm text-ink-2">
          Local development helper that stores inbound rows and enqueues `inbound_received` jobs.
        </p>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Simulate Inbound Message</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <form action={submitInboundSimulation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fromPhone">From Phone</Label>
              <Input
                id="fromPhone"
                name="fromPhone"
                required
                placeholder="+1 (555) 555-0101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Message Body</Label>
              <textarea
                id="body"
                name="body"
                required
                rows={4}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                placeholder="YES"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">Save Inbound & Enqueue</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard/leads">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
