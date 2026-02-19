"use client";

import Link from "next/link";
import { ReportUploader } from "@/components/ReportUploader";

const sampleReportDoc = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --ink: #0f0f0f;
        --ink-2: #3a3a3a;
        --ink-3: #888888;
        --paper: #f7f5f0;
        --paper-2: #eceae4;
        --border: #d8d5ce;
        --accent: #c8491a;
        --green: #1a6e3c;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
      }

      .shell {
        margin: 0;
        padding: 24px;
      }

      .hero {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
        background: white;
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-top: 14px;
      }

      .kpi {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px;
        background: var(--paper);
      }

      .kpi p {
        margin: 0;
      }

      .label {
        font-size: 11px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--ink-3);
      }

      .value {
        margin-top: 6px !important;
        font-size: 22px;
        color: var(--ink);
      }

      table {
        margin-top: 16px;
        width: 100%;
        border-collapse: collapse;
        background: white;
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
      }

      th,
      td {
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid var(--border);
        font-size: 12px;
      }

      th {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--ink-3);
        background: var(--paper-2);
      }

      tr:last-child td {
        border-bottom: none;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--green);
        background: #e2f0e8;
      }

      .accent {
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <div class="label">April Performance Snapshot</div>
        <div class="kpi-grid">
          <div class="kpi">
            <p class="label">Team Revenue</p>
            <p class="value">$214,800</p>
          </div>
          <div class="kpi">
            <p class="label">Goal Attainment</p>
            <p class="value">92%</p>
          </div>
          <div class="kpi">
            <p class="label">Avg Deal Size</p>
            <p class="value">$14,200</p>
          </div>
          <div class="kpi">
            <p class="label">Avg Days to Close</p>
            <p class="value">31d</p>
          </div>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th>Rep</th>
            <th>Revenue</th>
            <th>Quota</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Alex Rivera</td>
            <td class="accent">$62,100</td>
            <td>104%</td>
            <td><span class="pill">On Track</span></td>
          </tr>
          <tr>
            <td>Jordan Kim</td>
            <td class="accent">$55,900</td>
            <td>97%</td>
            <td><span class="pill">On Track</span></td>
          </tr>
          <tr>
            <td>Sam Patel</td>
            <td class="accent">$48,300</td>
            <td>88%</td>
            <td><span class="pill">At Risk</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-border/80 bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-2xl font-serif leading-none text-ink">
            PipelineIQ
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-ink transition-opacity duration-150 hover:opacity-90"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
          <div className="max-w-4xl">
            <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Your team&apos;s numbers, finally worth looking at.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-2 sm:text-xl">
              Upload a CSV. Get a beautiful performance report your whole team
              will actually read — and a PDF you can send up the chain in
              seconds.
            </p>

            <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/sign-up"
                className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
              >
                Get Started Free
              </Link>
              <a
                href="#sample-report"
                className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-white/70 px-5 text-sm font-medium text-ink transition-opacity duration-150 hover:opacity-90"
              >
                See a Sample Report
              </a>
            </div>

            <p className="mt-4 text-sm text-ink-3">
              Free forever for up to 3 reports. No credit card required.
            </p>
          </div>
        </section>

        <section className="border-y border-border/80 bg-paper-2/55">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
              Tableau is powerful. It&apos;s also a nightmare.
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                "Takes hours to set up for every new report",
                "Looks like it was designed in 2008",
                "Your sales manager just wants to know who's winning",
              ].map((point) => (
                <div
                  key={point}
                  className="rounded-2xl border border-border bg-paper px-5 py-5 text-base text-ink"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="sample-report" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
            Demo Preview
          </h2>

          <p className="mt-4 max-w-3xl text-lg text-ink-2">
            This is the existing dashboard style your CSV uploads are turned into.
          </p>

          <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-paper shadow-[0_20px_50px_rgba(15,15,15,0.09)]">
            <iframe
              title="Sample PipelineIQ report preview"
              srcDoc={sampleReportDoc}
              className="h-[440px] w-full border-0 md:h-[500px]"
            />
          </div>

          <div className="mt-10">
            <ReportUploader />
          </div>
        </section>

        <section className="border-y border-border/80 bg-paper-2/45">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
            <h2 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
              How it works
            </h2>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-paper p-5">
                <p className="text-xs uppercase tracking-[0.08em] text-ink-3">1. Upload your CSV</p>
                <p className="mt-2 text-sm text-ink-2">
                  Export from your CRM or paste from a spreadsheet
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-paper p-5">
                <p className="text-xs uppercase tracking-[0.08em] text-ink-3">2. Map your columns</p>
                <p className="mt-2 text-sm text-ink-2">
                  Tell us which column is revenue, quota, and rep name
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-paper p-5">
                <p className="text-xs uppercase tracking-[0.08em] text-ink-3">3. Share your report</p>
                <p className="mt-2 text-sm text-ink-2">
                  View in-browser or download a PDF to send to leadership
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">Pricing</h2>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-border bg-paper p-6">
              <p className="text-xs uppercase tracking-[0.08em] text-ink-3">Free</p>
              <p className="mt-3 font-serif text-4xl text-ink">$0/mo</p>
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                <li>3 reports</li>
                <li>PDF export</li>
                <li>CSV upload</li>
                <li>1 team</li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-ink transition-opacity duration-150 hover:opacity-90"
              >
                Get Started Free
              </Link>
            </article>

            <article className="rounded-3xl border border-accent bg-ink p-6 text-white shadow-[0_20px_40px_rgba(15,15,15,0.2)]">
              <p className="text-xs uppercase tracking-[0.08em] text-white/65">Pro</p>
              <p className="mt-3 font-serif text-4xl text-white">$29/mo</p>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li>Unlimited reports</li>
                <li>Multiple teams</li>
                <li>Priority support</li>
                <li>White-label PDF</li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
              >
                Upgrade to Pro
              </Link>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-ink-2">PipelineIQ © 2025</div>

          <div className="flex items-center gap-5 text-sm text-ink-2">
            <a
              href="#"
              className="transition-opacity duration-150 hover:opacity-90"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="transition-opacity duration-150 hover:opacity-90"
            >
              Terms of Service
            </a>
          </div>
        </div>

        <p className="mx-auto w-full max-w-6xl px-5 pb-8 text-sm text-ink-3 sm:px-8">
          Built for sales managers who have better things to do than fight with
          spreadsheets.
        </p>
      </footer>
    </div>
  );
}
