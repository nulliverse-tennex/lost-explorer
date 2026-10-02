import type { Metadata } from "next";
import { fontVariableClassName } from "@/styles/fonts";
import "./globals.css";
import "@/styles/journal.css";

export const metadata: Metadata = {
  title: "The Lost Explorer",
  description: "A daily geography deduction game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariableClassName}>
      <body className="journal-desk">{children}</body>
    </html>
  );
}
