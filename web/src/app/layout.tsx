import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";

export const metadata: Metadata = {
  title: "Career Map",
  description:
    "A constellation of work — explore careers by the skills they share.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable}`}>
      <body
        style={{
          background: "#0a0908",
          color: "rgba(232, 226, 217, 0.85)",
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
