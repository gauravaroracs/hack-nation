"use client";

import { useState } from "react";
import { LiteratureCard } from "@/app/components/literature-card";
import { ProgressPipeline, type PipelineState } from "@/app/components/progress-pipeline";
import { ScientistReviewForm } from "@/app/components/scientist-review-form";
import { GUT_HEALTH_HYPOTHESIS } from "@/lib/demo-data";
import type { ExperimentPlan, HypothesisQuality, LiteratureQc, Paper, ScientistFeedback } from "@/lib/types";

const sampleHypotheses = [
  {
    label: "Diagnostics",
    value:
      "A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing."
  },
  {
    label: "Gut Health",
    value: GUT_HEALTH_HYPOTHESIS
  },
  {
    label: "Cell Biology",
    value:
      "Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose’s superior membrane stabilization at low temperatures."
  },
  {
    label: "Climate",
    value:
      "Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%."
  }
];

const pipelineConfig = [
  { key: "validating", label: "Validating hypothesis" },
  { key: "literature", label: "Checking literature" },
  { key: "novelty", label: "Classifying novelty" },
  { key: "feedback", label: "Applying expert feedback" },
  { key: "protocol", label: "Generating protocol" },
  { key: "estimates", label: "Estimating materials, budget, and timeline" }
] as const;

const tabs = [
  "Protocol",
  "Materials",
  "Budget",
  "Timeline",
  "Validation",
  "Risks",
  "Alternative Approach",
  "Scientist Review"
] as const;

type TabName = (typeof tabs)[number];

type ReviewState = {
  rating: "good" | "needs_correction";
  section: string;
  original_text: string;
  corrected_text: string;
  user_note: string;
};

export default function HomePage() {
  const [hypothesis, setHypothesis] = useState(GUT_HEALTH_HYPOTHESIS);
  const [progress, setProgress] = useState<Record<string, PipelineState>>(
    Object.fromEntries(pipelineConfig.map((item) => [item.key, "idle"]))
  );
  const [quality, setQuality] = useState<HypothesisQuality | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [literature, setLiterature] = useState<LiteratureQc | null>(null);
  const [feedback, setFeedback] = useState<ScientistFeedback[]>([]);
  const [plan, setPlan] = useState<ExperimentPlan | null>(null);
  const [planId, setPlanId] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("Protocol");
  const [busy, setBusy] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [review, setReview] = useState<ReviewState>({
    rating: "needs_correction",
    section: "protocol",
    original_text: "",
    corrected_text: "",
    user_note: ""
  });

  async function postJson<T>(url: string, payload: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed for ${url}`);
    }

    return (await response.json()) as T;
  }

  function updateStep(key: string, state: PipelineState) {
    setProgress((current) => ({ ...current, [key]: state }));
  }

  function resetForNewRun() {
    setError("");
    setBanner("");
    setPlan(null);
    setFeedback([]);
    setPapers([]);
    setLiterature(null);
    setQuality(null);
    setActiveTab("Protocol");
    setProgress(Object.fromEntries(pipelineConfig.map((item) => [item.key, "idle"])));
  }

  async function handleAnalyze() {
    resetForNewRun();
    setBusy(true);

    try {
      updateStep("validating", "loading");
      const qualityResult = await postJson<HypothesisQuality>("/api/validate-hypothesis", { hypothesis });
      setQuality(qualityResult);
      updateStep("validating", "done");

      if (!qualityResult.is_testable) {
        setError("The current input is not yet a strong testable hypothesis. Refine it using the suggestions below.");
        setBusy(false);
        return;
      }

      updateStep("literature", "loading");
      const paperResult = await postJson<{ papers: Paper[] }>("/api/literature-search", { hypothesis });
      setPapers(paperResult.papers);
      updateStep("literature", "done");

      updateStep("novelty", "loading");
      const literatureResult = await postJson<LiteratureQc>("/api/classify-novelty", {
        hypothesis,
        papers: paperResult.papers
      });
      setLiterature(literatureResult);
      updateStep("novelty", "done");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unexpected failure";
      setError(message);
      setProgress((current) =>
        Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value === "loading" ? "error" : value]))
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePlan() {
    if (!quality || !literature) return;

    setBusy(true);
    setError("");

    try {
      updateStep("feedback", "loading");
      const feedbackResult = await postJson<{ feedback: ScientistFeedback[] }>("/api/get-relevant-feedback", {
        hypothesis,
        experiment_domain: plan?.experiment_domain ?? inferDomain(hypothesis),
        experiment_type: plan?.experiment_type ?? inferType(hypothesis)
      });
      setFeedback(feedbackResult.feedback);
      updateStep("feedback", "done");

      updateStep("protocol", "loading");
      updateStep("estimates", "loading");
      const planResult = await postJson<ExperimentPlan>("/api/generate-plan", {
        hypothesis,
        hypothesis_quality: quality,
        literature_qc: literature,
        papers,
        prior_feedback: feedbackResult.feedback
      });
      setPlan(planResult);
      setPlanId(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`);
      updateStep("protocol", "done");
      updateStep("estimates", "done");

      const appliedFeedback = planResult.protocol_steps.find((step) => step.feedback_applied && step.feedback_note);
      if (appliedFeedback?.feedback_note) {
        setBanner(appliedFeedback.feedback_note);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unexpected failure";
      setError(message);
      updateStep("feedback", progress.feedback === "loading" ? "error" : progress.feedback);
      updateStep("protocol", "error");
      updateStep("estimates", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveFeedback() {
    if (!plan) return;

    setSavingFeedback(true);
    setError("");

    try {
      await postJson("/api/save-feedback", {
        plan_id: planId,
        hypothesis,
        experiment_domain: plan.experiment_domain,
        experiment_type: plan.experiment_type,
        section: review.section,
        original_text: review.original_text,
        corrected_text: review.corrected_text,
        user_note: review.user_note,
        rating: review.rating
      });

      const nextFeedback = [
        ...feedback,
        {
          experiment_domain: plan.experiment_domain,
          experiment_type: plan.experiment_type,
          section: review.section,
          original_text: review.original_text,
          corrected_text: review.corrected_text,
          user_note: review.user_note
        }
      ];

      setFeedback(nextFeedback);
      setBanner("Expert correction saved. Future similar plans will use this.");
      setReview({
        rating: "needs_correction",
        section: review.section,
        original_text: "",
        corrected_text: "",
        user_note: ""
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unexpected failure";
      setError(message);
    } finally {
      setSavingFeedback(false);
    }
  }

  function preloadCorrection(section: string, originalText: string) {
    setActiveTab("Scientist Review");
    setReview((current) => ({
      ...current,
      section,
      original_text: originalText
    }));
    document.getElementById("scientist-review")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-[36px] border border-white/10 bg-panel/85 p-8 shadow-glow">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sky-100">
              Fulcrum Science Challenge
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-white sm:text-6xl">LabMind</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              From scientific hypothesis to runnable experiment plan.
            </p>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
              Validates testability, scans Semantic Scholar, classifies novelty, injects scientist feedback, and produces an operationally realistic protocol package in under a minute.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <MetricCard label="Manual scoping" value="3 to 5 days" accent="text-amber-200" />
            <MetricCard label="LabMind" value="Under 1 minute" accent="text-emerald-200" />
            <MetricCard label="Pipeline" value="6 visible stages" accent="text-sky-200" />
            <MetricCard label="Feedback loop" value="Supabase memory" accent="text-white" />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-line bg-panel/90 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Input</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Enter a scientific hypothesis</h2>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={busy || !hypothesis.trim()}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate Experiment Plan
            </button>
          </div>

          <textarea
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            className="min-h-52 w-full rounded-[28px] border border-white/10 bg-slate-950/60 px-5 py-4 text-base leading-7 text-white outline-none placeholder:text-slate-500"
            placeholder="Describe the intervention, measurable outcome, threshold, model system, and expected mechanism."
          />

          <div className="mt-4 flex flex-wrap gap-3">
            {sampleHypotheses.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setHypothesis(sample.value)}
                className="rounded-full border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-slate-300 transition hover:border-sky-300/30 hover:text-white"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-line bg-panel/90 p-6">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Demo Flow</div>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-300">
            <li>1. Click the Gut Health sample hypothesis.</li>
            <li>2. Generate to validate the hypothesis and show literature QC.</li>
            <li>3. Generate the runnable plan with protocol, materials, budget, and timeline.</li>
            <li>4. Save a correction about 4 kDa FITC-dextran.</li>
            <li>5. Re-run a similar gut permeability query to show expert feedback injection.</li>
          </ol>
          <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100">
            LabMind compresses experiment scoping from days to minutes, and every expert correction improves the next plan.
          </div>
        </div>
      </section>

      <section className="mt-8">
        <ProgressPipeline
          steps={pipelineConfig.map((item) => ({
            ...item,
            state: progress[item.key]
          }))}
        />
      </section>

      {error ? (
        <section className="mt-8 rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </section>
      ) : null}

      {banner ? (
        <section className="mt-8 rounded-[28px] border border-emerald-300/20 bg-emerald-300/10 p-5 text-sm text-emerald-100">
          {banner}
        </section>
      ) : null}

      {quality ? (
        <section className="mt-8 rounded-[32px] border border-line bg-panel/90 p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Hypothesis Quality Check</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {quality.is_testable ? "Testable and planning-ready" : "Needs refinement before planning"}
              </h2>
            </div>
            <div className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
              Quality score {quality.quality_score}/100
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoCard label="Intervention" value={quality.intervention || "Missing"} />
            <InfoCard label="Measurable outcome" value={quality.measurable_outcome || "Missing"} />
            <InfoCard label="Success threshold" value={quality.success_threshold || "Missing"} />
            <InfoCard label="Model system" value={quality.model_system || "Missing"} />
            <InfoCard label="Mechanistic rationale" value={quality.mechanistic_rationale || "Missing"} />
            <InfoCard
              label="Suggestions"
              value={quality.clarifying_suggestions.length > 0 ? quality.clarifying_suggestions.join(" ") : "No changes suggested."}
            />
          </div>
        </section>
      ) : null}

      {literature ? (
        <section className="mt-8">
          <LiteratureCard literature={literature} onGeneratePlan={handleGeneratePlan} disabled={busy} />
        </section>
      ) : null}

      {plan ? (
        <section className="mt-8 rounded-[36px] border border-white/10 bg-panel/90 p-6 shadow-glow">
          <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Experiment Plan</div>
              <h2 className="mt-2 text-3xl font-semibold text-white">{plan.experiment_title}</h2>
              <p className="mt-3 text-base leading-7 text-slate-300">{plan.experiment_summary}</p>
              <p className="mt-4 text-sm leading-6 text-slate-400">{plan.novelty_positioning}</p>
            </div>

            <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
              <MetricCard label="Budget total" value={`$${plan.budget.total_estimated_cost_usd.toLocaleString()}`} accent="text-emerald-200" />
              <MetricCard label="Timeline total" value={plan.timeline.total_duration} accent="text-sky-200" />
              <MetricCard label="Confidence score" value={`${Math.round(plan.confidence_score * 100)}%`} accent="text-white" />
              <MetricCard label="Novelty signal" value={literature?.novelty_signal.replaceAll("_", " ") ?? "n/a"} accent="text-amber-200" />
            </div>
          </div>

          {feedback.length > 0 ? (
            <div className="mt-6 rounded-[28px] border border-emerald-300/20 bg-emerald-300/10 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-emerald-100">Applied expert memory</div>
              <div className="mt-2 grid gap-3">
                {feedback.slice(0, 3).map((item, index) => (
                  <div key={`${item.section}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3 text-sm text-emerald-50">
                    <span className="font-semibold uppercase tracking-[0.2em]">{item.section}</span>: {item.corrected_text}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  activeTab === tab
                    ? "bg-white text-slate-950"
                    : "border border-white/10 bg-slate-950/40 text-slate-300 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <InfoCard
              label="Hypothesis quality summary"
              value={[
                `Intervention: ${plan.hypothesis_quality.intervention}`,
                `Outcome: ${plan.hypothesis_quality.measurable_outcome}`,
                `Threshold: ${plan.hypothesis_quality.success_threshold}`,
                `Model: ${plan.hypothesis_quality.model_system}`
              ].join(" ")}
            />
            <InfoCard
              label="Study design"
              value={[
                `Groups: ${plan.study_design.groups.join(" | ")}`,
                `Sample size: ${plan.study_design.sample_size_recommendation}`,
                `Randomization: ${plan.study_design.randomization}`,
                `Blinding: ${plan.study_design.blinding}`
              ].join(" ")}
            />
          </div>

          <div className="mt-6">
            {activeTab === "Protocol" ? (
              <div className="grid gap-4">
                {plan.protocol_steps.map((step) => (
                  <div key={step.step_number} className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Step {step.step_number}</div>
                        <h3 className="mt-2 text-xl font-semibold text-white">{step.title}</h3>
                      </div>
                      <div className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300">{step.duration}</div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-slate-300">{step.description}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <InfoCard label="Critical notes" value={step.critical_notes} />
                      <InfoCard label="Success check" value={step.success_check} />
                    </div>
                    {step.feedback_applied && step.feedback_note ? (
                      <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                        {step.feedback_note}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => preloadCorrection("protocol", `${step.title}: ${step.description}`)}
                      className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:border-sky-300/30 hover:text-sky-200"
                    >
                      Suggest correction
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === "Materials" ? (
              <div className="grid gap-4">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="pb-3 pr-4">Name</th>
                          <th className="pb-3 pr-4">Supplier</th>
                          <th className="pb-3 pr-4">Catalog number</th>
                          <th className="pb-3 pr-4">Quantity</th>
                          <th className="pb-3 pr-4">Estimated cost</th>
                          <th className="pb-3 pr-4">Purpose</th>
                          <th className="pb-3">Verification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.materials.map((material) => (
                          <tr key={`${material.name}-${material.catalog_number}`} className="border-t border-white/10">
                            <td className="py-3 pr-4 text-white">{material.name}</td>
                            <td className="py-3 pr-4 text-slate-300">{material.supplier}</td>
                            <td className="py-3 pr-4 text-slate-300">{material.catalog_number}</td>
                            <td className="py-3 pr-4 text-slate-300">{material.quantity}</td>
                            <td className="py-3 pr-4 text-slate-300">${material.estimated_cost_usd}</td>
                            <td className="py-3 pr-4 text-slate-300">{material.purpose}</td>
                            <td className="py-3 text-slate-300">{material.verification_status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-sm text-slate-400">Catalog numbers should be verified before ordering.</p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                  <div className="mb-4 text-xs uppercase tracking-[0.24em] text-slate-500">Equipment</div>
                  <div className="grid gap-3">
                    {plan.equipment.map((item) => (
                      <div key={item.name} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                        <div className="text-base font-medium text-white">{item.name}</div>
                        <div className="mt-2 text-sm text-slate-300">{item.specification}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.purpose}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "Budget" ? (
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total estimated cost</div>
                  <div className="mt-3 text-4xl font-semibold text-white">${plan.budget.total_estimated_cost_usd.toLocaleString()}</div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                  <div className="grid gap-4">
                    {plan.budget.breakdown.map((item) => (
                      <div key={item.category}>
                        <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                          <span>{item.category}</span>
                          <span>${item.estimated_cost_usd}</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-900">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-sky-400 to-emerald-300"
                            style={{
                              width: `${(item.estimated_cost_usd / plan.budget.total_estimated_cost_usd) * 100}%`
                            }}
                          />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{item.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "Timeline" ? (
              <div className="grid gap-4">
                <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Total duration</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{plan.timeline.total_duration}</div>
                </div>
                {plan.timeline.phases.map((phase) => (
                  <div key={phase.phase} className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">{phase.phase}</h3>
                      <div className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300">{phase.duration}</div>
                    </div>
                    <div className="mt-3 text-sm text-slate-400">Dependencies: {phase.dependencies.join(", ")}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === "Validation" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Primary endpoint" value={plan.validation_plan.primary_endpoint} />
                <InfoCard label="Secondary endpoints" value={plan.validation_plan.secondary_endpoints.join(" | ")} />
                <InfoCard label="Success criteria" value={plan.validation_plan.success_criteria} />
                <InfoCard label="Failure criteria" value={plan.validation_plan.failure_criteria} />
                <InfoCard label="Quality standards" value={plan.validation_plan.quality_standards.join(" | ")} />
                <InfoCard
                  label="Controls"
                  value={[
                    `Negative: ${plan.controls.negative_control}`,
                    `Positive: ${plan.controls.positive_control}`,
                    `Vehicle: ${plan.controls.vehicle_control}`
                  ].join(" ")}
                />
              </div>
            ) : null}

            {activeTab === "Risks" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <InfoCard label="Risks and limitations" value={plan.risks_and_limitations.join(" ")} />
                <InfoCard label="Low-confidence flags" value={plan.low_confidence_flags.join(" ")} />
              </div>
            ) : null}

            {activeTab === "Alternative Approach" ? (
              <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5 text-sm leading-7 text-slate-300">
                {plan.alternative_approach}
              </div>
            ) : null}

            {activeTab === "Scientist Review" ? (
              <div id="scientist-review">
                <ScientistReviewForm value={review} onChange={setReview} onSubmit={handleSaveFeedback} saving={savingFeedback} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</div>
      <div className="mt-3 text-sm leading-7 text-slate-300">{value}</div>
    </div>
  );
}

function inferDomain(hypothesis: string) {
  const value = hypothesis.toLowerCase();
  if (value.includes("mouse") || value.includes("intestinal") || value.includes("microbi")) return "gut_health";
  if (value.includes("hela") || value.includes("cell")) return "cell_biology";
  if (value.includes("co2") || value.includes("cathode")) return "climate";
  if (value.includes("biosensor") || value.includes("blood")) return "diagnostics";
  return "general_science";
}

function inferType(hypothesis: string) {
  const value = hypothesis.toLowerCase();
  if (value.includes("fitc-dextran")) return "murine_permeability_assay";
  if (value.includes("cryoprotectant")) return "cell_viability_assay";
  if (value.includes("biosensor")) return "biosensor_benchmark";
  if (value.includes("bioelectrochemical")) return "bioelectrochemical_carbon_capture";
  return "exploratory_experiment";
}
