"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type BillingControlsProps = {
  isPaid: boolean;
};

export function BillingControls({ isPaid }: BillingControlsProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    const endpoint = "/api/portal";
    setIsLoading(true);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Could not start billing flow.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start billing flow.";
      toast.error(message);
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant={isPaid ? "default" : "outline"}>
        <Link href="/pricing">{isPaid ? "View Pro Plan" : "Upgrade to Pro"}</Link>
      </Button>

      {isPaid ? (
        <Button type="button" variant="outline" onClick={handleClick} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Manage Subscription
        </Button>
      ) : null}
    </div>
  );
}
