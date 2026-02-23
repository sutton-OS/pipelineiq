"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyPhoneButtonProps = {
  phone: string;
  className?: string;
};

const RESET_DELAY_MS = 1800;

export function CopyPhoneButton({ phone, className }: CopyPhoneButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setStatus("idle"), RESET_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }, [phone]);

  const label = status === "copied" ? "Copied" : status === "error" ? "Copy failed" : "Copy phone";

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={handleCopy}>
      {label}
    </Button>
  );
}
