const pigments = [
  { token: "--paper", label: "paper", swatch: "bg-paper" },
  { token: "--ink", label: "ink", swatch: "bg-ink" },
  { token: "--stamp-red", label: "stamp", swatch: "bg-stamp" },
  { token: "--brass", label: "brass", swatch: "bg-brass" },
  { token: "--map-teal", label: "teal", swatch: "bg-map-teal" },
];

export default function Home() {
  return (
    <main className="stage mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-5 py-7">
      <p className="face-stamp text-step--1 text-ink-faint">
        Field Journal &middot; Vol. I
      </p>

      <h1 className="face-display mt-3 text-step-5 text-ink">
        The Lost
        <br />
        <span className="text-stamp">Explorer</span>
      </h1>

      <div className="ink-layer mt-4 w-fit -rotate-2 border-2 border-stamp px-3 py-1">
        <span className="face-stamp text-step-1 text-stamp">Day One</span>
      </div>

      <p className="face-journal mt-5 max-w-prose text-ink-muted">
        I have lost the name of the place. The notes remain — five days of
        them. Read carefully and you may find it before I do.
      </p>

      <dl className="mt-6 flex flex-wrap gap-4 border-t border-rule pt-5">
        {pigments.map((pigment) => (
          <div key={pigment.token} className="flex items-center gap-2">
            <span
              className={`${pigment.swatch} h-6 w-6 rounded-sm border border-rule-strong`}
              aria-hidden="true"
            />
            <div>
              <dt className="face-stamp text-step--2 text-ink">
                {pigment.label}
              </dt>
              <dd className="face-ui text-step--2 text-ink-faint">
                {pigment.token}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </main>
  );
}
