"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type BillingControlsProps = {
  isPro: boolean;
};

export function BillingControls({ isPro }: BillingControlsProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    const endpoint = isPro ? "/api/portal" : "/api/checkout";
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
    <Button type="button" onClick={handleClick} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {isPro ? "Manage Subscription" : "Upgrade to Pro"}
    </Button>
  );
}
