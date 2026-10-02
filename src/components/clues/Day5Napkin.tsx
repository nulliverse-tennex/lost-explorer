import type { DailyGameState } from "@/domain/game";
import type { Puzzle } from "@/domain/puzzle";
import { cls } from "../cls";
import { PaperCard } from "../PaperCard";
import { RubberStamp } from "../RubberStamp";
import styles from "./clues.module.css";
import day45 from "./day45.module.css";
import { ScriptPhrase } from "./ScriptPhrase";

export function Day5Napkin({
  puzzle,
  status,
  delayIndex = 0,
}: {
  puzzle: Puzzle;
  status: DailyGameState["status"];
  delayIndex?: number;
}) {
  const { language, languageCode, helpPhrase, helpPhraseTranslation } =
    puzzle.day5;
  const resolved = status !== "in_progress";

  return (
    <PaperCard
      tilt={1.1}
      tape={["top-center", "bottom-left"]}
      delayIndex={delayIndex}
    >
      <div className={styles.artefact} data-clue="day5">
        <p className={cls("face-stamp", styles.eyebrow)}>
          Day Five &middot; Someone spoke to me
        </p>

        <div className={day45.napkinMount}>
          <div className={day45.napkin} data-napkin="">
            <span className={day45.stain} aria-hidden="true" />

            <p className={cls("face-journal", day45.overheard)}>
              Someone finally noticed I was lost. They looked at me and said:
            </p>

            <p className={day45.phraseLine}>
              <ScriptPhrase languageCode={languageCode}>
                {helpPhrase}
              </ScriptPhrase>
            </p>

            <p className={cls("face-stamp", day45.language)}>{language}</p>

            {/* Rendered only once the day is over. Hiding it with CSS would
                leave the answer's strongest tell one devtools glance away. */}
            {resolved ? (
              <p
                className={cls("face-stamp", day45.translation)}
                data-phrase-translation=""
              >
                {helpPhraseTranslation}
              </p>
            ) : null}

            <p className={day45.finalLine}>
              <RubberStamp
                variant="day"
                rotate={2.4}
                className={day45.finalStamp}
              >
                Final guess
              </RubberStamp>
            </p>
          </div>
        </div>
      </div>
    </PaperCard>
  );
}
