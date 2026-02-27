import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createLeadIntakeAction } from "@/app/actions/goldbot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Intake",
};

async function submitLeadIntake(formData: FormData) {
  "use server";

  const result = await createLeadIntakeAction(formData);
  if (!result.ok) {
    redirect(`/dashboard/intake?error=${encodeURIComponent(result.message)}`);
  }

  redirect("/dashboard/leads");
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-4xl font-serif">Intake</h1>
        <p className="text-sm text-ink-2">
          Manual intake with phone deduplication and consent tracking.
        </p>
      </header>

      <Card className="border-border bg-white/70">
        <CardHeader>
          <CardTitle>Create Lead</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <form action={submitLeadIntake} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" name="fullName" required placeholder="Jane Doe" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                required
                placeholder="+1 (555) 555-0101"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consentStatus">Consent Status</Label>
              <select
                id="consentStatus"
                name="consentStatus"
                defaultValue="consented"
                className="border-input bg-background focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              >
                <option value="consented">consented</option>
                <option value="unknown">unknown</option>
                <option value="revoked">revoked</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">Create Lead & Enqueue</Button>
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
