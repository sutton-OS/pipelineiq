import type { Metadata } from "next";
import { DM_Mono, Instrument_Serif, Syne } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "PipelineIQ | Personal Reports",
    template: "%s | PipelineIQ",
  },
  description:
    "A single-user reporting workspace for commission and team CSV views.",
  applicationName: "PipelineIQ",
  openGraph: {
    type: "website",
    siteName: "PipelineIQ",
    url: "/",
    title: "PipelineIQ | Personal Reports",
    description: "A single-user reporting workspace for commission and team CSV views.",
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
    title: "PipelineIQ | Personal Reports",
    description: "A single-user reporting workspace for commission and team CSV views.",
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
      className={`${syne.variable} ${dmMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen bg-paper font-sans antialiased text-ink dark">
        {children}
        <Toaster position="top-right" richColors theme="dark" />
      </body>
    </html>
  );
}
