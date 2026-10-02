import { Fragment } from "react";
import { Info, TriangleAlert, OctagonAlert } from "lucide-react";
import { PageBody, PageHeader, Panel } from "@/components/ui/layout";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/data";
import { sectionsFor, type Audience, type ManualBlock } from "@/lib/manual/content";

/**
 * The manual, rendered from the portal's own components so it reads as part of
 * the product rather than a document pasted into it.
 *
 * Content is filtered by audience before it reaches this component — see
 * lib/manual/content.ts for why that matters.
 */

/** Minimal `**bold**` support, so the content stays plain data. */
function withEmphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const noteTone = {
  info: {
    wrap: "border-tone-info-br bg-tone-info-bg",
    text: "text-tone-info-fg",
    Icon: Info,
  },
  warning: {
    wrap: "border-tone-warning-br bg-tone-warning-bg",
    text: "text-tone-warning-fg",
    Icon: TriangleAlert,
  },
  danger: {
    wrap: "border-tone-danger-br bg-tone-danger-bg",
    text: "text-tone-danger-fg",
    Icon: OctagonAlert,
  },
} as const;

function Block({ block }: { block: ManualBlock }) {
  const heading = block.heading ? (
    <h3 className="mt-6 mb-2 text-sm font-semibold tracking-[0.06em] text-slate-800 uppercase first:mt-0">
      {block.heading}
    </h3>
  ) : null;

  switch (block.kind) {
    case "prose":
      return (
        <div>
          {heading}
          {block.body?.map((p, i) => (
            <p
              key={i}
              className="mt-3 max-w-[68ch] leading-relaxed text-slate-700 first:mt-0"
            >
              {withEmphasis(p)}
            </p>
          ))}
        </div>
      );

    case "list":
      return (
        <div>
          {heading}
          <ul className="mt-3 max-w-[68ch] space-y-2.5 first:mt-0">
            {block.body?.map((item, i) => (
              <li key={i} className="flex gap-3 leading-relaxed text-slate-700">
                <span
                  className="mt-2.5 size-1.5 shrink-0 rounded-full bg-steel-400"
                  aria-hidden="true"
                />
                <span>{withEmphasis(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "steps":
      return (
        <div>
          {heading}
          {/* Numbered because these are genuinely sequential — each step
              depends on the one before it. */}
          <ol className="mt-3 max-w-[68ch] space-y-3 first:mt-0">
            {block.body?.map((step, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="ref mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ice-100 text-xs font-medium text-steel-600">
                  {i + 1}
                </span>
                <span className="leading-relaxed text-slate-700">
                  {withEmphasis(step)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "note": {
      const tone = noteTone[block.tone ?? "info"];
      return (
        <div
          className={`flex max-w-[68ch] gap-3 rounded-sm border p-4 ${tone.wrap}`}
        >
          <tone.Icon
            className={`mt-0.5 size-4 shrink-0 ${tone.text}`}
            aria-hidden="true"
          />
          <div className={`space-y-2 text-sm leading-relaxed ${tone.text}`}>
            {block.body?.map((p, i) => (
              <p key={i}>{withEmphasis(p)}</p>
            ))}
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div>
          {heading}
          <div className="mt-3 overflow-hidden rounded-sm border border-slate-200 first:mt-0">
            <Table>
              <THead>
                {block.columns?.map((c) => (
                  <TH key={c}>{c}</TH>
                ))}
              </THead>
              <TBody>
                {block.rows?.map((row, i) => (
                  <TR key={i}>
                    {row.map((cell, j) => (
                      <TD
                        key={j}
                        className={
                          j === 0 ? "font-medium whitespace-normal text-slate-900" : ""
                        }
                      >
                        {withEmphasis(cell)}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      );

    case "flow":
      return (
        <ol className="flex flex-wrap gap-1.5">
          {block.steps?.map((step, i) => (
            <li
              key={step}
              className="ref flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap text-slate-600"
            >
              <span className="font-medium text-steel-600">{i + 1}</span>
              <span className="text-slate-800">{step}</span>
            </li>
          ))}
        </ol>
      );

    default:
      return null;
  }
}

export function ManualView({
  audience,
  workspaceLabel,
}: {
  audience: Audience;
  workspaceLabel: string;
}) {
  const sections = sectionsFor(audience);

  return (
    <>
      <PageHeader
        title="User manual"
        description={`How the Speedmax process works and how to use the ${workspaceLabel}. Written for your role — sections covering other workspaces are not shown.`}
      />

      <PageBody>
        <div className="grid gap-8 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12">
          {/* Contents. Sticky on desktop; a long reference needs a way back. */}
          <nav aria-label="Manual contents" className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
              Contents
            </h2>
            <ol className="space-y-0.5 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block border-l-2 border-slate-200 py-1.5 pl-3 text-slate-600 transition-colors hover:border-steel-400 hover:text-navy-900"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-8">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-6">
                <Panel
                  title={section.title}
                  description={section.summary}
                >
                  <div className="space-y-5">
                    {section.blocks.map((block, i) => (
                      <Block key={i} block={block} />
                    ))}
                  </div>
                </Panel>
              </section>
            ))}

            <p className="max-w-[68ch] text-sm text-slate-500">
              Records, routes and figures in this system are sample data for
              validation, not real shipments.
            </p>
          </div>
        </div>
      </PageBody>
    </>
  );
}
