import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { SessionExpiryOverlay } from "@/components/SessionExpiryOverlay";
import { ToastContainer } from "@/components/feedback/ToastContainer";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
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
      <body
        className={`${instrumentSerif.variable} ${plusJakartaSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            {children}
            <SessionExpiryOverlay />
            <ToastContainer />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
