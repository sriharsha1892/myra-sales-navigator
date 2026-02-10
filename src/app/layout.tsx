import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { SessionExpiryOverlay } from "@/components/navigator/SessionExpiryOverlay";
import { ToastContainer } from "@/components/navigator/feedback/ToastContainer";
import { MobileViewportGuard } from "@/components/navigator/MobileViewportGuard";
import { SentryUserSync } from "@/components/SentryUserSync";
import "./globals.css";

const satoshi = localFont({
  src: [
    { path: "../../public/fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "myRA Sales Navigator",
  description: "Sales intelligence and prospecting tool for myRA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("nav_theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);else document.documentElement.setAttribute("data-theme","dark")}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()` }} />
      </head>
      <body
        className={`${satoshi.variable} ${geistMono.variable} antialiased bg-surface-0`}
      >
        <QueryProvider>
          <AuthProvider>
            <SentryUserSync />
            {children}
            <SessionExpiryOverlay />
            <ToastContainer />
            <MobileViewportGuard />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
