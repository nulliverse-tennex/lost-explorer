import { Noto_Sans_Georgian } from "next/font/google";

export const face = Noto_Sans_Georgian({
  weight: "400",
  subsets: ["georgian"],
  display: "swap",
  variable: "--font-script",
  preload: false,
  adjustFontFallback: false,
});
