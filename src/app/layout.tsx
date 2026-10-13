import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitQuest — Train. Play. Level Up.",
  description: "FitQuest is a gamified fitness prototype with XP, levels, challenges, badges, and AI-style workout recommendations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#080b14] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
