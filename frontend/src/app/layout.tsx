import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Premium font configuration for enterprise aesthetic
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Enhanced metadata for enterprise SaaS
export const metadata: Metadata = {
  title: {
    default: "Real-Time Pulse | Enterprise Client Dashboard Platform",
    template: "%s | Real-Time Pulse",
  },
  description:
    "World-class enterprise multi-tenant B2B SaaS platform for real-time client dashboards. AI-powered insights, advanced analytics, and seamless integrations.",
  keywords: [
    "enterprise dashboard",
    "client portal",
    "real-time analytics",
    "B2B SaaS",
    "multi-tenant",
    "AI insights",
    "business intelligence",
    "data visualization",
  ],
  authors: [{ name: "Real-Time Pulse Team" }],
  creator: "Real-Time Pulse",
  publisher: "Real-Time Pulse",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://realtimepulse.io"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Real-Time Pulse | Enterprise Client Dashboard Platform",
    description:
      "World-class enterprise multi-tenant B2B SaaS platform for real-time client dashboards.",
    siteName: "Real-Time Pulse",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Real-Time Pulse Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Real-Time Pulse | Enterprise Client Dashboard Platform",
    description:
      "World-class enterprise multi-tenant B2B SaaS platform for real-time client dashboards.",
    images: ["/twitter-image.png"],
    creator: "@realtimepulse",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#6366f1" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Real-Time Pulse",
  },
  category: "business",
};

// Viewport configuration for mobile optimization
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <meta name="msapplication-TileColor" content="#6366f1" />
        <meta
          name="msapplication-config"
          content="/browserconfig.xml"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${manrope.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
