import { formatPopulation, populationDescription } from "@/domain/clueText";
import type { Puzzle } from "@/domain/puzzle";
import { cls } from "../cls";
import { PaperCard } from "../PaperCard";
import styles from "./clues.module.css";
import { horizonMotif } from "./horizons/motifs";

export function Day1Horizon({
  puzzle,
  delayIndex = 0,
}: {
  puzzle: Puzzle;
  delayIndex?: number;
}) {
  const { landscape, metroPopulationMillions } = puzzle.day1;
  const motif = horizonMotif(landscape);
  const figure = formatPopulation(metroPopulationMillions);
  const band = populationDescription(metroPopulationMillions);

  return (
    <PaperCard
      tilt={-1.1}
      tape={["top-left", "bottom-right"]}
      delayIndex={delayIndex}
    >
      <div className={styles.artefact} data-clue="day1">
        <p className={cls("face-stamp", styles.eyebrow)}>
          Day One &middot; Surroundings
        </p>

        <p className={cls("face-journal", styles.narration)}>
          I&rsquo;ve had a look around. {motif.observation}
        </p>

        <div className={styles.horizonSplit}>
          {/* The sketch carries no information the sentence above does not, so
              the whole frame leaves the a11y tree. A <figure>/<figcaption> here
              would hand its caption to the figure as an accessible name. */}
          <div className={styles.sketchFrame} aria-hidden="true">
            <svg
              className={styles.sketch}
              viewBox="0 0 240 96"
              focusable="false"
              data-horizon-motif={landscape}
            >
              <g className={styles.sketchStrokes} data-decorative-filter="">
                {motif.sketch}
              </g>
            </svg>
            <span className={cls("face-stamp", styles.sketchCaption)}>
              sketched from the ridge
            </span>
          </div>

          <p className={cls("face-journal", styles.population)}>
            This feels like a {band} city &mdash; around{" "}
            <strong className={cls("face-display", styles.populationFigure)}>
              {figure}
            </strong>{" "}
            live here.
          </p>
        </div>
      </div>
    </PaperCard>
  );
}
