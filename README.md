# PipelineIQ

> **Beautiful sales reports from one CSV**

PipelineIQ turns raw sales exports into polished, paper-style PDF reports in minutes.
Upload once, share instantly, and stop losing time in dashboard tooling.

## Features

- CSV upload flow designed for non-technical teams
- Auto-generated, print-ready PDF sales reports
- Paper-and-ink visual language for clean executive summaries
- Individual report detail pages and historical report management
- Authenticated workspace access with Clerk
- Stripe-powered billing hooks for paid plans

## Screenshots

![PipelineIQ Dashboard Placeholder](https://placehold.co/1200x720/F7F5F0/0F0F0F?text=PipelineIQ+Dashboard+Screenshot)
*Dashboard overview with KPI cards and trend breakdowns*

![PipelineIQ Report Placeholder](https://placehold.co/1200x720/ECEAE4/0F0F0F?text=Generated+Sales+Report+Screenshot)
*Generated report preview with paper-style formatting*

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS 4 with custom paper/ink design tokens
- Supabase for data persistence
- Clerk for authentication
- Stripe for billing and plan management
- jsPDF for PDF generation

## Quickstart

1. Install dependencies:
```bash
npm install
```

2. Copy the environment template:
```bash
cp .env.example .env.local
```

3. Fill in your API keys and app URLs in `.env.local`.

4. Start the app:
```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Environment Variables

Use `.env.example` as the source of truth for required keys.

## Live Demo

Live demo is coming soon.
For now, run locally and use your own CSV export to test the full flow end-to-end.
