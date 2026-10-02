import type { Metadata } from "next";
import { fontVariableClassName } from "@/styles/fonts";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
