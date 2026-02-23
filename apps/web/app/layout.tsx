import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Mono, DM_Sans, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { requireStartupEnv } from "@/lib/env";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
});

requireStartupEnv();

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://pipelineiq.app"
  ),
  title: {
    default: "PipelineIQ | Beautiful Sales Reporting",
    template: "%s | PipelineIQ",
  },
  description:
    "One CSV → stunning PDF reports your team will actually read. Upload sales data, preview instantly, and export leadership-ready PDFs.",
  applicationName: "PipelineIQ",
  openGraph: {
    type: "website",
    siteName: "PipelineIQ",
    url: "/",
    title: "PipelineIQ | Beautiful Sales Reporting",
    description:
      "One CSV → stunning PDF reports your team will actually read. Upload sales data, preview instantly, and export leadership-ready PDFs.",
    images: [
      {
        url: "/og-placeholder.svg",
        width: 1200,
        height: 630,
        alt: "PipelineIQ report preview placeholder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PipelineIQ | Beautiful Sales Reporting",
    description:
      "One CSV → stunning PDF reports your team will actually read.",
    images: ["/og-placeholder.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ClerkProvider>
          {children}
        </ClerkProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
