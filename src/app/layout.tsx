import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { ClientLayout } from "./client-layout";

// NexVision brand typography — Roboto (per brand book)
export const metadata: Metadata = {
  title: "NexHRMS — Human Resource Management System",
  description: "Modern, high-performance SaaS HRMS application built with Next.js",
  appleWebApp: {
    title: "NexHRMS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ClientLayout>{children}</ClientLayout>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
