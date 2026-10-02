export type ScriptKey = "georgian" | "japanese" | "arabic" | "devanagari";

/* Caveat ships latin, latin-ext, cyrillic and nothing else, so every language
   absent from this map is already covered by the journal hand. The four here
   are the ones that would otherwise render as tofu boxes. */
const scriptByLanguage: Record<string, ScriptKey> = {
  ka: "georgian",
  ja: "japanese",
  ar: "arabic",
  fa: "arabic",
  ur: "arabic",
  ps: "arabic",
  ckb: "arabic",
  hi: "devanagari",
  mr: "devanagari",
  ne: "devanagari",
  sa: "devanagari",
};

const rightToLeft: ReadonlySet<ScriptKey> = new Set<ScriptKey>(["arabic"]);

export function scriptForLanguage(languageCode: string): ScriptKey | null {
  return scriptByLanguage[languageCode.toLowerCase()] ?? null;
}

export function writingDirection(script: ScriptKey | null): "rtl" | "ltr" {
  return script !== null && rightToLeft.has(script) ? "rtl" : "ltr";
}

/* One `import()` per branch, never a template literal: a dynamic specifier
   makes webpack build a context module containing every file in the folder,
   which is exactly the all-scripts-in-the-shell bundle this avoids. Each
   branch is its own async chunk, so only the clue's own script is fetched. */
export async function loadScriptFaceVariable(
  script: ScriptKey,
): Promise<string> {
  switch (script) {
    case "georgian":
      return (await import("./scriptFaces/georgian")).face.variable;
    case "japanese":
      return (await import("./scriptFaces/japanese")).face.variable;
    case "arabic":
      return (await import("./scriptFaces/arabic")).face.variable;
    case "devanagari":
      return (await import("./scriptFaces/devanagari")).face.variable;
  }
}

export const expectedFamilyByScript: Record<ScriptKey, string> = {
  georgian: "Noto Sans Georgian",
  japanese: "Noto Sans JP",
  arabic: "Noto Naskh Arabic",
  devanagari: "Noto Sans Devanagari",
};
