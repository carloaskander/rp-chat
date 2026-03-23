import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthModalGate } from "@/components/auth/auth-modal-gate";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ApiProfilesProvider } from "@/components/settings/api-profiles-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RP Chat MVP",
  description: "Roleplay chat MVP with Supabase-backed auth and persistence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-zinc-950 text-zinc-100 antialiased`}
      >
        <AuthProvider>
          <ApiProfilesProvider>
            <AuthModalGate>{children}</AuthModalGate>
          </ApiProfilesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
