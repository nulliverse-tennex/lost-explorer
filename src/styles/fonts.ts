import { Caveat, Inter, Rye, Special_Elite } from "next/font/google";

export const displayFace = Rye({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-display",
  fallback: ["Bookman Old Style", "Georgia", "serif"],
});

export const stampFace = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-stamp",
  fallback: ["Courier New", "ui-monospace", "monospace"],
});

// Caveat covers Latin, Latin-Ext and Cyrillic only. Georgian, Japanese,
// Arabic and Devanagari render as tofu — Task 19 code-splits Noto per
// clue language for those.
export const journalFace = Caveat({
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
  variable: "--font-journal",
  fallback: ["Segoe Script", "Bradley Hand", "cursive"],
});

export const uiFace = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-ui",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

export const fontVariableClassName = [
  displayFace.variable,
  stampFace.variable,
  journalFace.variable,
  uiFace.variable,
].join(" ");
