export interface LegalSection {
  readonly heading: string;
  readonly paragraphs?: readonly string[];
  readonly bullets?: readonly string[];
}

/**
 * Shared shell for the privacy notice and terms pages — same structure, same
 * measure, same heading rhythm, so the two read as one document family.
 */
export function LegalPage({
  title,
  intro,
  updated,
  sections,
  footnote,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: readonly LegalSection[];
  footnote?: string;
}) {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 leading-relaxed text-steel-200">{intro}</p>
          <p className="mt-5 text-sm text-steel-400">Last updated {updated}</p>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold text-slate-900">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((p) => (
                  <p key={p} className="mt-3 leading-relaxed text-slate-700">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-4 space-y-2.5">
                    {section.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex gap-3 leading-relaxed text-slate-700"
                      >
                        <span
                          className="mt-2.5 size-1.5 shrink-0 rounded-full bg-steel-400"
                          aria-hidden="true"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {footnote && (
            <p className="mt-12 rounded-sm bg-ice-50 p-4 text-sm text-slate-500">
              {footnote}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
