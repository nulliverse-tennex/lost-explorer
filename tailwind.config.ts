import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--paper)",
          high: "var(--paper-high)",
          shade: "var(--paper-shade)",
          deep: "var(--paper-deep)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        stamp: "var(--stamp-red)",
        brass: "var(--brass)",
        "map-teal": "var(--map-teal)",
        rule: {
          DEFAULT: "var(--rule)",
          strong: "var(--rule-strong)",
          ruled: "var(--rule-ruled-line)",
        },
        tape: {
          DEFAULT: "var(--tape)",
          edge: "var(--tape-edge)",
        },
      },
      fontFamily: {
        display: "var(--font-display)",
        stamp: "var(--font-stamp)",
        journal: "var(--font-journal)",
        ui: "var(--font-ui)",
      },
      fontSize: {
        "step--2": "var(--step--2)",
        "step--1": "var(--step--1)",
        "step-0": "var(--step-0)",
        "step-1": "var(--step-1)",
        "step-2": "var(--step-2)",
        "step-3": "var(--step-3)",
        "step-4": "var(--step-4)",
        "step-5": "var(--step-5)",
        "step-6": "var(--step-6)",
        journal: "var(--text-journal)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        7: "var(--space-7)",
        8: "var(--space-8)",
        9: "var(--space-9)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        tape: "var(--radius-tape)",
      },
      boxShadow: {
        lift: "var(--shadow-lift)",
        press: "var(--shadow-press)",
      },
      transitionTimingFunction: {
        paper: "var(--ease-paper)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      backgroundImage: {
        paper: "var(--texture-paper)",
      },
    },
  },
  plugins: [],
};

export default config;
