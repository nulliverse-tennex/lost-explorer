import type { DailyGameState } from "@/domain/game";
import { renderDay3 } from "@/domain/clueText";
import type { Puzzle } from "@/domain/puzzle";
import { cls } from "../cls";
import { PaperCard } from "../PaperCard";
import { TornEdge } from "../TornEdge";
import styles from "./clues.module.css";
import { flagSvgUrl } from "./flagAsset";

export function Day3FlagCloth({
  puzzle,
  status,
  delayIndex = 0,
}: {
  puzzle: Puzzle;
  status: DailyGameState["status"];
  delayIndex?: number;
}) {
  const resolved = status !== "in_progress";

  return (
    <PaperCard tilt={-0.7} tape={["top-center"]} delayIndex={delayIndex}>
      <div className={styles.artefact} data-clue="day3">
        <p className={cls("face-stamp", styles.eyebrow)}>
          Day Three &middot; Cloth, caught on a wire
        </p>

        <div className={styles.clothMount}>
          <div className={styles.cloth} aria-hidden="true">
            <TornEdge edges="both" className={styles.clothWindow}>
              {/* The real flag asset's URL embeds the country code — naming
                  the country outright on Day 3 itself. Withheld until
                  resolution, mirroring the Day 5 language gate. */}
              {resolved ? (
                <img
                  className={styles.clothFlag}
                  src={flagSvgUrl(puzzle.countryCode)}
                  alt=""
                  aria-hidden="true"
                  width={200}
                  height={150}
                  data-flag-fragment=""
                />
              ) : null}
              <span className={styles.clothWeave} aria-hidden="true" />
            </TornEdge>
          </div>
        </div>

        <p className={cls("face-journal", styles.narration)}>
          {renderDay3(puzzle)}
        </p>
      </div>
    </PaperCard>
  );
}
