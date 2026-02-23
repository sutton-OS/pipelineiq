"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function SettingsFeedback() {
  const searchParams = useSearchParams();
  const shownSuccessToast = useRef(false);
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    if (success === "true" && !shownSuccessToast.current) {
      toast.success("Subscription updated. Pro access is now active.");
      shownSuccessToast.current = true;
    }
  }, [success]);

  if (canceled !== "true") {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-paper-2 px-4 py-3 text-sm text-ink-2">
      Upgrade canceled.
    </div>
  );
}
