# PipelineIQ

## One CSV → stunning PDF reports your team will actually read

PipelineIQ turns messy sales exports into clean, executive-ready reporting in minutes.
Upload a CSV, preview your report instantly, and export a polished PDF with zero dashboard setup pain.

## Why teams choose PipelineIQ

- Instant CSV ingestion with drag-and-drop UX
- Smart parsing for rep name, revenue, quota, and status
- Live report preview before export
- Beautiful paper-and-ink PDF output for leadership updates
- Fast auth and account flows with Clerk
- Billing hooks and monetization-ready wiring with Stripe

## Product Screenshots

![PipelineIQ Dashboard Preview Placeholder](https://placehold.co/1440x900/f9f5eb/1a1a1a?text=PipelineIQ+Dashboard+Preview)
*Dashboard-style preview card and leaderboard layout*

![PipelineIQ CSV Uploader Placeholder](https://placehold.co/1440x900/ffffff/1a1a1a?text=PipelineIQ+CSV+Uploader)
*CSV upload zone, live table preview, and PDF generation CTA*

![PipelineIQ PDF Output Placeholder](https://placehold.co/1440x900/f3eee3/1a1a1a?text=PipelineIQ+PDF+Output)
*Final exported PDF in the same visual style as the app*

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + custom paper/ink design tokens
- shadcn/ui primitives and Sonner toasts
- PapaParse for CSV parsing
- jsPDF for PDF generation
- Clerk for authentication
- Stripe for billing and checkout/webhook flows

## Quickstart

1. Install dependencies:

```bash
npm install
```

2. Create local environment config:

```bash
cp .env.example .env.local
```

3. Fill in required env vars in `.env.local`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

4. Run locally:

```bash
npm run dev
```

5. Production build check:

```bash
npm run build
```

## Deploy

Deploy PipelineIQ to Vercel:

- [Deploy to Vercel](https://vercel.com/new/clone?repository-url=https://github.com/your-org/pipelineiq)

Update the repository URL above to your fork/org before sharing.
