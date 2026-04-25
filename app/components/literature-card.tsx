import type { LiteratureQc } from "@/lib/types";

const signalStyles: Record<string, string> = {
  not_found: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30",
  similar_work_exists: "bg-amber-400/15 text-amber-100 border-amber-400/30",
  exact_match_found: "bg-rose-400/15 text-rose-100 border-rose-400/30"
};

export function LiteratureCard({
  literature,
  onGeneratePlan,
  disabled
}: {
  literature: LiteratureQc;
  onGeneratePlan: () => void;
  disabled: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-panel/90 p-6 shadow-glow">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Literature QC</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Fast novelty signal before protocol generation</h2>
        </div>
        <div
          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${signalStyles[literature.novelty_signal]}`}
        >
          {literature.novelty_signal.replaceAll("_", " ")}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <div className="text-sm text-slate-300">{literature.one_sentence_summary}</div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{literature.reasoning}</p>
          <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
            Confidence {(literature.confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Interpretation</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{literature.recommendation_for_experiment_planning}</p>
          {literature.missing_information.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-3 text-sm text-amber-100">
              Missing context: {literature.missing_information.join(" ")}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">Top references</div>
        <div className="grid gap-3">
          {literature.top_references.slice(0, 3).map((paper) => (
            <div key={`${paper.title}-${paper.year}`} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>{paper.year}</span>
                <span>{paper.venue}</span>
              </div>
              <div className="mt-2 text-base font-medium text-white">{paper.title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{paper.relevance}</p>
              {paper.url ? (
                <a className="mt-3 inline-block text-sm text-sky-300 hover:text-sky-200" href={paper.url} target="_blank" rel="noreferrer">
                  Open reference
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onGeneratePlan}
        disabled={disabled}
        className="mt-6 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate runnable plan
      </button>
    </section>
  );
}
