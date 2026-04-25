const stepDescriptions: Record<string, string> = {
  validating: "Checks whether the input is a testable scientific hypothesis.",
  literature: "Queries Semantic Scholar for adjacent evidence and references.",
  novelty: "Labels novelty as exact match, similar work, or not found.",
  feedback: "Injects relevant prior scientist corrections before planning.",
  protocol: "Builds a runnable protocol with controls and validation.",
  estimates: "Calculates materials, suppliers, timeline, and budget."
};

export type PipelineState = "idle" | "loading" | "done" | "error";

export function ProgressPipeline({
  steps
}: {
  steps: Array<{ key: string; label: string; state: PipelineState }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const stateStyles =
          step.state === "done"
            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
            : step.state === "loading"
              ? "border-sky-400/40 bg-sky-400/10 text-sky-50"
              : step.state === "error"
                ? "border-rose-400/40 bg-rose-400/10 text-rose-100"
                : "border-line bg-panel/80 text-slate-300";

        return (
          <div key={step.key} className={`rounded-3xl border p-4 shadow-glow ${stateStyles}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Stage {index + 1}</span>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em]">
                {step.state}
              </span>
            </div>
            <div className="text-sm font-semibold">{step.label}</div>
            <p className="mt-2 text-sm text-slate-400">{stepDescriptions[step.key]}</p>
          </div>
        );
      })}
    </div>
  );
}
