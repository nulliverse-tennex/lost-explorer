import { Noto_Sans_Devanagari } from "next/font/google";

export const face = Noto_Sans_Devanagari({
  weight: "400",
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-script",
  preload: false,
  adjustFontFallback: false,
});
