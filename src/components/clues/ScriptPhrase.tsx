"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  loadScriptFaceVariable,
  scriptForLanguage,
  writingDirection,
} from "@/styles/scriptFonts";
import { cls } from "../cls";
import styles from "./day45.module.css";

/* The face class starts empty on both server and client, so there is nothing
   to mismatch during hydration; the Noto chunk for this one language is then
   fetched and the custom property it sets re-points the font stack. Latin and
   Cyrillic languages never trigger a fetch at all. */
export function ScriptPhrase({
  languageCode,
  className,
  children,
}: {
  languageCode: string;
  className?: string;
  children: ReactNode;
}) {
  const script = scriptForLanguage(languageCode);
  const [faceClass, setFaceClass] = useState("");

  useEffect(() => {
    if (script === null) return;

    let live = true;
    void loadScriptFaceVariable(script).then((variable) => {
      if (live) setFaceClass(variable);
    });

    return () => {
      live = false;
    };
  }, [script]);

  return (
    <q
      lang={languageCode}
      dir={writingDirection(script)}
      className={cls(styles.phrase, faceClass, className)}
      data-script-phrase={script ?? "latin"}
    >
      {children}
    </q>
  );
}
