const stepDescriptions: Record<string, string> = {
  validating: "Testability",
  literature: "Paper search",
  novelty: "Novelty label",
  feedback: "Expert memory",
  protocol: "Protocol draft",
  estimates: "Budget and timing"
};

export type PipelineState = "idle" | "loading" | "done" | "error";

export function ProgressPipeline({
  steps
}: {
  steps: Array<{ key: string; label: string; state: PipelineState }>;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
      {steps.map((step, index) => {
        const stateStyles =
          step.state === "done"
            ? "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,white)] text-emerald-900"
            : step.state === "loading"
              ? "border-sky-200 bg-[linear-gradient(135deg,#eff6ff,white)] text-sky-900"
              : step.state === "error"
                ? "border-rose-200 bg-[linear-gradient(135deg,#fff1f2,white)] text-rose-900"
                : "border-stone-200 bg-[linear-gradient(135deg,#ffffff,#faf7f2)] text-stone-700";

        return (
          <div
            key={step.key}
            className={`w-[220px] rounded-3xl border p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${stateStyles}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.24em] text-stone-400">Stage {index + 1}</span>
              <span className="rounded-full border border-current/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em]">
                {step.state}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-current/10 bg-white/70 text-sm ${
                  step.state === "loading" ? "animate-pulse" : ""
                }`}
              >
                {step.state === "done" ? "✓" : step.state === "error" ? "!" : index + 1}
              </span>
              <div>
                <div className="text-sm font-semibold">{step.label}</div>
                <p className="mt-1 text-xs opacity-70">{stepDescriptions[step.key]}</p>
              </div>
            </div>
            {step.state === "loading" ? (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-400" />
              </div>
            ) : null}
          </div>
        );
      })}
      </div>
    </div>
  );
}
