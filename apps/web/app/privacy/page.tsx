import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "PipelineIQ Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-2">Last updated: February 27, 2026</p>

      <section className="mt-8 space-y-3 text-sm leading-6 text-ink-2">
        <h2 className="font-serif text-2xl text-ink">What We Collect</h2>
        <p>
          We process account identifiers, uploaded business data, and operational metadata needed to
          provide PipelineIQ features.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6 text-ink-2">
        <h2 className="font-serif text-2xl text-ink">Cookie Consent</h2>
        <p>
          Essential cookies are required for core functionality. Optional analytics cookies are used
          only when you provide consent through the cookie banner.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6 text-ink-2">
        <h2 className="font-serif text-2xl text-ink">Your Rights</h2>
        <p>
          You can request a machine-readable export of your account data and request account deletion
          through authenticated API endpoints.
        </p>
        <p>
          Terms are available at <Link href="/terms" className="underline hover:text-ink">Terms of Service</Link>.
        </p>
      </section>
    </main>
  );
}
