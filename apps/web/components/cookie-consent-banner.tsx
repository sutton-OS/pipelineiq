"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const COOKIE_NAME = "pipelineiq_cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const OPEN_SETTINGS_EVENT = "pipelineiq:open-cookie-settings";

type ConsentState = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;

  const encoded = `${encodeURIComponent(name)}=`;
  const values = document.cookie.split(";");
  for (const entry of values) {
    const trimmed = entry.trim();
    if (!trimmed.startsWith(encoded)) continue;
    return decodeURIComponent(trimmed.slice(encoded.length));
  }

  return null;
}

function writeConsentCookie(state: ConsentState): void {
  if (typeof document === "undefined") return;

  const payload = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${COOKIE_NAME}=${payload}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    const existing = getCookieValue(COOKIE_NAME);
    if (!existing) {
      setVisible(true);
    }

    const openSettings = () => {
      setVisible(true);
      setCustomize(true);
    };

    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);

  const baseState = useMemo(
    () => ({
      version: 1,
      necessary: true as const,
      marketing: false,
      updatedAt: new Date().toISOString(),
    }),
    [],
  );

  function save(analytics: boolean): void {
    writeConsentCookie({ ...baseState, analytics, updatedAt: new Date().toISOString() });
    setVisible(false);
    setCustomize(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(720px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-border bg-paper-2/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm text-ink">
        We use essential cookies to run PipelineIQ. Optional analytics cookies are off by default and
        only enabled with your consent.
      </p>
      <p className="mt-2 text-xs text-ink-2">
        See our <Link href="/privacy" className="underline hover:text-ink">Privacy Policy</Link>{" "}
        and <Link href="/terms" className="underline hover:text-ink">Terms of Service</Link>.
      </p>

      {customize ? (
        <div className="mt-4 rounded-lg border border-border/80 bg-paper-3/80 p-3 text-sm text-ink">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Essential Cookies</p>
              <p className="text-xs text-ink-2">Required for sign-in, security, and core features.</p>
            </div>
            <span className="rounded-full border border-border px-2 py-1 text-xs text-ink-2">Always on</span>
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Analytics Cookies</p>
              <p className="text-xs text-ink-2">Help us understand performance and improve product UX.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={analyticsEnabled}
              onClick={() => setAnalyticsEnabled((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-xs ${analyticsEnabled ? "border-green-500 text-green-400" : "border-border text-ink-2"}`}
            >
              {analyticsEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-ink-2 hover:text-ink"
          onClick={() => save(false)}
        >
          Reject Optional
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-ink-2 hover:text-ink"
          onClick={() => setCustomize((prev) => !prev)}
        >
          {customize ? "Hide Settings" : "Customize"}
        </button>
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          onClick={() => save(customize ? analyticsEnabled : true)}
        >
          {customize ? "Save Preferences" : "Accept All"}
        </button>
      </div>
    </div>
  );
}

export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
