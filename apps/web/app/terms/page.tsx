import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "PipelineIQ Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="font-serif text-4xl text-ink">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-2">Last updated: February 27, 2026</p>

      <section className="mt-8 space-y-3 text-sm leading-6 text-ink-2">
        <p>
          These Terms govern your use of PipelineIQ. By using the service, you agree to these
          Terms.
        </p>
        <p>
          You are responsible for the data you upload and for complying with laws applicable to your
          use of customer and employee data.
        </p>
        <p>
          We may update the service and these Terms from time to time. Continued use after updates
          means you accept the revised Terms.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6 text-ink-2">
        <h2 className="font-serif text-2xl text-ink">Data and Privacy</h2>
        <p>
          You can request a data export or account deletion from your authenticated account via our
          privacy endpoints.
        </p>
        <p>
          See our <Link href="/privacy" className="underline hover:text-ink">Privacy Policy</Link>{" "}
          for details on personal data processing.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-6 text-ink-2">
        <h2 className="font-serif text-2xl text-ink">Contact</h2>
        <p>Questions about these Terms can be directed to support through your account settings.</p>
      </section>
    </main>
  );
}
