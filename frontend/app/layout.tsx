import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Provider from "@/providers/WagmiProviders";
import "./globals.css";
import ClientProviders from "./ClientProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Decimoon",
  description:
    "Create invoices. Get paid in USDm. Built natively for MiniPay users across Africa — no bank account, no fake alerts, just instant on-chain payments.",
  other: {
    "talentapp:project_verification":
      "13bec2d071537dd2683bccf570107c17aaeb1344b8d3027ced25c0435405301258b19502245fb4aeba79643ab8933c1dc934bda2c12d117cfb4676cd635ed2c7",

    "fc:miniapp": "true",
    "fc:frame": "vNext",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Provider>
          <ClientProviders>{children}</ClientProviders>
        </Provider>
      </body>
    </html>
  );
}
