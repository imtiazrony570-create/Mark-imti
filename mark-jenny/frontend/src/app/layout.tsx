import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mark-Imti",
  description: "Autonomous AI Operating Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/*
          The bundler injects `__name(fn, "fn")` calls (esbuild keepNames) into
          inlined scripts such as the next-themes bootstrap, but the helper itself
          is not in scope in the browser. That threw
          "ReferenceError: __name is not defined" on every page load and aborted
          the rest of the theme script. Define it as a no-op before any of those
          scripts run.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "window.__name=window.__name||function(f){return f};",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
