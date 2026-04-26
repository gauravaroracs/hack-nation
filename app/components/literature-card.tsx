import type { LiteratureQc } from "@/lib/types";

const signalStyles: Record<string, string> = {
  not_found: "bg-emerald-50 text-emerald-800 border-emerald-200",
  similar_work_exists: "bg-amber-50 text-amber-800 border-amber-200",
  exact_match_found: "bg-rose-50 text-rose-800 border-rose-200"
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
    <section className="rounded-[30px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#fbf8f2)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.07)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-stone-400">Literature QC</div>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">Novelty signal before full plan</h2>
        </div>
        <div
          className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${signalStyles[literature.novelty_signal]}`}
        >
          {literature.novelty_signal.replaceAll("_", " ")}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f8fdff,#ffffff)] p-5">
          <div className="text-base font-medium text-stone-900">{literature.one_sentence_summary}</div>
          <p className="mt-3 text-sm leading-6 text-stone-600">{literature.reasoning}</p>
          <div className="mt-4 text-xs uppercase tracking-[0.24em] text-stone-500">
            Confidence {(literature.confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-[linear-gradient(135deg,#fffaf0,#ffffff)] p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-stone-500">Interpretation</div>
          <p className="mt-2 text-sm leading-6 text-stone-700">{literature.recommendation_for_experiment_planning}</p>
          {literature.missing_information.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Missing context: {literature.missing_information.join(" ")}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-stone-500">Top references</div>
        <div className="grid gap-3">
          {literature.top_references.slice(0, 3).map((paper) => (
            <div key={`${paper.title}-${paper.year}`} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-500">
                <span>{paper.year}</span>
                <span>{paper.venue}</span>
              </div>
              <div className="mt-2 text-base font-medium text-stone-900">{paper.title}</div>
              <p className="mt-2 text-sm leading-6 text-stone-600">{paper.relevance}</p>
              {paper.url ? (
                <a className="mt-3 inline-block text-sm font-medium text-sky-700 hover:text-sky-900" href={paper.url} target="_blank" rel="noreferrer">
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
        className="mt-6 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate runnable plan
      </button>
    </section>
  );
}
