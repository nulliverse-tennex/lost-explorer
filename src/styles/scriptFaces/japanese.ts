import { Noto_Sans_JP } from "next/font/google";

/* Google publishes no named `japanese` subset for Noto Sans JP — the CJK
   glyphs arrive as ~120 unicode-range slices that `next/font` keeps verbatim,
   so `latin` is the only name the loader will accept here. The kana and kanji
   faces are still in the generated CSS and still load on demand. */
export const face = Noto_Sans_JP({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-script",
  preload: false,
  adjustFontFallback: false,
});
