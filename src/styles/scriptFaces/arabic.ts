import { Noto_Naskh_Arabic } from "next/font/google";

/* Naskh, not Noto Sans Arabic: the naskh hand carries the stroke contrast of
   an antique manuscript; the grotesque cut reads like a road sign. */
export const face = Noto_Naskh_Arabic({
  weight: "400",
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-script",
  preload: false,
  adjustFontFallback: false,
});
