"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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
    label: "Metabolism",
    value:
      "Administering metformin to diet-induced obese C57BL/6 mice for 8 weeks will reduce fasting blood glucose by at least 20% compared with vehicle controls by improving hepatic insulin sensitivity."
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

const tabs = ["Protocol", "Materials", "Budget", "Timeline", "Validation", "Risks"] as const;

type TabName = (typeof tabs)[number];

type ReviewState = {
  rating: "good" | "needs_correction";
  section: string;
  original_text: string;
  corrected_text: string;
  user_note: string;
};

export default function HomePage() {
  const [hypothesis, setHypothesis] = useState("");
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

  const isAnalyzing = busy && progress.validating === "loading";
  const isGeneratingPlan = busy && (progress.protocol === "loading" || progress.estimates === "loading");
  const totalDone = pipelineConfig.filter((item) => progress[item.key] === "done").length;

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
        setError("This hypothesis still needs a sharper intervention, endpoint, threshold, or model.");
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
      setActiveTab("Protocol");
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
      setBanner("Correction saved to expert memory.");
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
    setReview((current) => ({
      ...current,
      section,
      original_text: originalText
    }));
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[36px] border border-stone-200 bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_45%,#edf7ff_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sky-700">
              Fulcrum Science Challenge
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">LabMind</h1>
            <p className="mt-3 max-w-2xl text-lg text-stone-700">A horizontal experiment workspace: validate, scan literature, score novelty, and generate a runnable plan.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>Live APIs</Badge>
              <Badge>Visible loaders</Badge>
              <Badge>Compact cards</Badge>
              <Badge>Feedback memory</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <MetricCard label="Stages" value="6" accent="text-sky-800" tone="sky" />
            <MetricCard label="Completed" value={`${totalDone}/6`} accent="text-emerald-800" tone="emerald" />
            <MetricCard label="Papers" value={String(papers.length)} accent="text-amber-800" tone="amber" />
            <MetricCard label="Plan" value={plan ? "Ready" : busy ? "Running" : "Idle"} accent="text-stone-900" tone="stone" />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#faf7f2)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-stone-400">Input rail</div>
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">Hypothesis</h2>
              </div>
              <StatusDot busy={busy} />
            </div>

            <textarea
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
              className="mt-4 min-h-64 w-full rounded-[28px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-900 outline-none"
              placeholder="Describe intervention, outcome, threshold, model, and mechanism."
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {sampleHypotheses.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setHypothesis(sample.value)}
                  className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-700 transition hover:border-sky-300 hover:text-sky-900"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={busy || !hypothesis.trim()}
                className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAnalyzing ? "Analyzing..." : "Run analysis"}
              </button>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={busy || !quality || !literature}
                className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-900 transition hover:border-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingPlan ? "Generating plan..." : "Generate plan"}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <RailHint title="Fast path" text="Run analysis first, then generate the plan once novelty is ready." />
              <RailHint title="Feedback loop" text="Save one correction on the right. Similar plans should reuse it later." />
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="rounded-[32px] border border-stone-200 bg-white/90 p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-stone-400">Pipeline</div>
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">Live workflow</h2>
              </div>
              <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs uppercase tracking-[0.2em] text-stone-600">
                {busy ? "Running" : "Ready"}
              </div>
            </div>
            <ProgressPipeline
              steps={pipelineConfig.map((item) => ({
                ...item,
                state: progress[item.key]
              }))}
            />
          </div>

          {error ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
          ) : null}

          {banner ? (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{banner}</div>
          ) : null}

          {busy ? <LoadingBoard stage={isGeneratingPlan ? "Building experiment plan" : "Running analysis"} /> : null}

          {(quality || literature || plan) ? (
            <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.56fr)]">
              <div className="space-y-6">
                {quality ? (
                  <div className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#fbf8f2)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                    <SectionHeader eyebrow="Validation" title={quality.is_testable ? "Planning-ready hypothesis" : "Needs refinement"} />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <CompactStat label="Quality" value={`${quality.quality_score}/100`} />
                      <CompactStat label="Intervention" value={quality.intervention || "Missing"} />
                      <CompactStat label="Outcome" value={quality.measurable_outcome || "Missing"} />
                      <CompactStat label="Model" value={quality.model_system || "Missing"} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {quality.clarifying_suggestions.slice(0, 4).map((suggestion) => (
                        <MiniChip key={suggestion} text={suggestion} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {literature ? (
                  <div className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#fbf8f2)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                    <SectionHeader eyebrow="Literature" title="Novelty snapshot" />
                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="rounded-[26px] border border-stone-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-stone-700">
                            {literature.novelty_signal.replaceAll("_", " ")}
                          </span>
                          <span className="text-sm font-medium text-stone-600">{Math.round(literature.confidence * 100)}%</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-stone-800">{literature.one_sentence_summary}</p>
                        <p className="mt-2 text-sm text-stone-500">{literature.recommendation_for_experiment_planning}</p>
                      </div>
                      <div className="rounded-[26px] border border-stone-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Top references</div>
                        <div className="mt-3 grid gap-2">
                          {papers.length > 0 ? (
                            papers.slice(0, 3).map((paper) => (
                              <div key={paper.title} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                                <div className="text-sm font-semibold text-stone-900">{paper.title}</div>
                                <div className="mt-1 text-xs text-stone-500">
                                  {[paper.venue, paper.year].filter(Boolean).join(" • ") || "Retrieved result"}
                                </div>
                              </div>
                            ))
                          ) : (
                            <EmptyStrip label="No papers returned for this exact query." />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {plan ? (
                  <div className="rounded-[34px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#fbf8f2)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
                    <SectionHeader eyebrow="Plan" title={plan.experiment_title} />
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <CompactStat label="Budget" value={`$${plan.budget.total_estimated_cost_usd.toLocaleString()}`} />
                      <CompactStat label="Timeline" value={plan.timeline.total_duration} />
                      <CompactStat label="Confidence" value={`${Math.round(plan.confidence_score * 100)}%`} />
                      <CompactStat label="Feedback hits" value={String(feedback.length)} />
                    </div>

                    <div className="mt-5 overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        {tabs.map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`rounded-full px-4 py-2 text-sm transition ${
                              activeTab === tab
                                ? "bg-stone-900 text-white"
                                : "border border-stone-200 bg-white text-stone-700 hover:border-sky-300 hover:text-stone-900"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-5">
                      {activeTab === "Protocol" ? (
                        <div className="overflow-x-auto pb-2">
                          <div className="flex min-w-max gap-4">
                            {plan.protocol_steps.map((step) => (
                              <div key={step.step_number} className="w-[300px] rounded-[28px] border border-stone-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-stone-700">
                                    Step {step.step_number}
                                  </span>
                                  <span className="text-xs text-stone-500">{step.duration}</span>
                                </div>
                                <h3 className="mt-3 text-lg font-semibold text-stone-900">{step.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-stone-700">{step.description}</p>
                                <div className="mt-4 space-y-2 text-sm text-stone-500">
                                  <div><strong className="text-stone-700">Notes:</strong> {step.critical_notes}</div>
                                  <div><strong className="text-stone-700">Check:</strong> {step.success_check}</div>
                                </div>
                                {step.feedback_applied && step.feedback_note ? (
                                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                    {step.feedback_note}
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => preloadCorrection("protocol", `${step.title}: ${step.description}`)}
                                  className="mt-4 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-800 transition hover:border-sky-300 hover:text-sky-800"
                                >
                                  Suggest correction
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {activeTab === "Materials" ? (
                        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                          <div className="rounded-[28px] border border-stone-200 bg-white p-4">
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-sm">
                                <thead className="text-stone-500">
                                  <tr>
                                    <th className="pb-3 pr-4">Item</th>
                                    <th className="pb-3 pr-4">Supplier</th>
                                    <th className="pb-3 pr-4">Qty</th>
                                    <th className="pb-3 pr-4">Cost</th>
                                    <th className="pb-3">Verification</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {plan.materials.map((material) => (
                                    <tr key={`${material.name}-${material.catalog_number}`} className="border-t border-stone-200 align-top">
                                      <td className="py-3 pr-4 text-stone-900">
                                        <div className="font-medium">{material.name}</div>
                                        <div className="mt-1 text-xs text-stone-500">{material.catalog_number}</div>
                                      </td>
                                      <td className="py-3 pr-4 text-stone-700">{material.supplier}</td>
                                      <td className="py-3 pr-4 text-stone-700">{material.quantity}</td>
                                      <td className="py-3 pr-4 text-stone-700">${material.estimated_cost_usd}</td>
                                      <td className="py-3 text-stone-700">{material.verification_status}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div className="rounded-[28px] border border-stone-200 bg-white p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Equipment</div>
                            <div className="mt-3 grid gap-3">
                              {plan.equipment.map((item) => (
                                <div key={item.name} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                                  <div className="text-sm font-semibold text-stone-900">{item.name}</div>
                                  <div className="mt-1 text-sm text-stone-600">{item.specification}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {activeTab === "Budget" ? (
                        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                          <div className="rounded-[28px] border border-stone-200 bg-white p-5">
                            <div className="text-xs uppercase tracking-[0.2em] text-stone-400">Total</div>
                            <div className="mt-3 text-4xl font-semibold text-stone-900">${plan.budget.total_estimated_cost_usd.toLocaleString()}</div>
                          </div>
                          <div className="rounded-[28px] border border-stone-200 bg-white p-5">
                            <div className="grid gap-4">
                              {plan.budget.breakdown.map((item) => (
                                <div key={item.category}>
                                  <div className="mb-2 flex items-center justify-between text-sm text-stone-700">
                                    <span>{item.category}</span>
                                    <span>${item.estimated_cost_usd}</span>
                                  </div>
                                  <div className="h-2.5 rounded-full bg-stone-200">
                                    <div
                                      className="h-2.5 rounded-full bg-gradient-to-r from-sky-400 to-emerald-300"
                                      style={{
                                        width: `${Math.max(6, (item.estimated_cost_usd / Math.max(plan.budget.total_estimated_cost_usd, 1)) * 100)}%`
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {activeTab === "Timeline" ? (
                        <div className="overflow-x-auto pb-2">
                          <div className="flex min-w-max gap-4">
                            {plan.timeline.phases.map((phase) => (
                              <div key={phase.phase} className="w-[260px] rounded-[28px] border border-stone-200 bg-white p-4">
                                <div className="text-xs uppercase tracking-[0.2em] text-stone-400">{phase.duration}</div>
                                <div className="mt-2 text-lg font-semibold text-stone-900">{phase.phase}</div>
                                <div className="mt-3 text-sm text-stone-500">
                                  {phase.dependencies.length > 0 ? `Depends on ${phase.dependencies.join(", ")}` : "No blocking dependency"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {activeTab === "Validation" ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <InfoCard label="Primary endpoint" value={plan.validation_plan.primary_endpoint} />
                          <InfoCard label="Success criteria" value={plan.validation_plan.success_criteria} />
                          <InfoCard label="Secondary endpoints" value={plan.validation_plan.secondary_endpoints.join(" | ")} />
                          <InfoCard label="Controls" value={`Neg: ${plan.controls.negative_control} | Pos: ${plan.controls.positive_control} | Vehicle: ${plan.controls.vehicle_control}`} />
                        </div>
                      ) : null}

                      {activeTab === "Risks" ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          <InfoCard label="Risks" value={plan.risks_and_limitations.join(" | ")} />
                          <InfoCard label="Alternative" value={plan.alternative_approach} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,#fffefb,#f6fbff)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                  <SectionHeader eyebrow="Status rail" title="At-a-glance" />
                  <div className="mt-4 grid gap-3">
                    <StatusRow label="Hypothesis" value={hypothesis.trim() ? "Loaded" : "Empty"} />
                    <StatusRow label="Validation" value={quality ? "Done" : isAnalyzing ? "Running" : "Waiting"} />
                    <StatusRow label="Novelty" value={literature ? "Done" : busy ? "Running" : "Waiting"} />
                    <StatusRow label="Plan" value={plan ? "Ready" : isGeneratingPlan ? "Running" : "Waiting"} />
                  </div>
                </div>

                <div className="rounded-[32px] border border-stone-200 bg-[linear-gradient(180deg,#ffffff,#faf7f2)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                  <SectionHeader eyebrow="Expert memory" title="Feedback hits" />
                  <div className="mt-4 grid gap-3">
                    {feedback.length > 0 ? (
                      feedback.slice(0, 4).map((item, index) => (
                        <div key={`${item.section}-${index}`} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">{item.section}</div>
                          <div className="mt-1">{item.corrected_text}</div>
                        </div>
                      ))
                    ) : (
                      <EmptyStrip label="No prior corrections matched this experiment type yet." />
                    )}
                  </div>
                </div>

                <div id="scientist-review" className="rounded-[32px] border border-stone-200 bg-white/95 p-2 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
                  <ScientistReviewForm value={review} onChange={setReview} onSubmit={handleSaveFeedback} saving={savingFeedback} />
                </div>
              </div>
            </div>
          ) : (
            <EmptyCanvas />
          )}
        </section>

        <aside className="hidden xl:block" />
      </section>
    </main>
  );
}

function StatusDot({ busy }: { busy: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs uppercase tracking-[0.2em] text-stone-600">
      <span className={`h-2.5 w-2.5 rounded-full ${busy ? "animate-pulse bg-emerald-500" : "bg-stone-300"}`} />
      {busy ? "Live" : "Idle"}
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.28em] text-stone-400">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900">{title}</h2>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  tone = "stone"
}: {
  label: string;
  value: string;
  accent: string;
  tone?: "amber" | "emerald" | "sky" | "stone";
}) {
  const toneStyles: Record<string, string> = {
    amber: "bg-[linear-gradient(135deg,#fff7e6,#ffffff)] border-amber-200",
    emerald: "bg-[linear-gradient(135deg,#eefcf4,#ffffff)] border-emerald-200",
    sky: "bg-[linear-gradient(135deg,#eef8ff,#ffffff)] border-sky-200",
    stone: "bg-[linear-gradient(135deg,#ffffff,#faf7f2)] border-stone-200"
  };

  return (
    <div className={`rounded-3xl border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${toneStyles[tone] ?? toneStyles.stone}`}>
      <div className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-stone-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <div className="text-xs uppercase tracking-[0.24em] text-stone-500">{label}</div>
      <div className="mt-3 text-sm leading-6 text-stone-700">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-sm text-stone-700">{children}</span>;
}

function MiniChip({ text }: { text: string }) {
  return <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">{text}</span>;
}

function RailHint({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-stone-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{title}</div>
      <div className="mt-2 text-sm leading-6 text-stone-700">{text}</div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-semibold text-stone-900">{value}</span>
    </div>
  );
}

function EmptyStrip({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">{label}</div>;
}

function EmptyCanvas() {
  return (
    <div className="rounded-[34px] border border-dashed border-stone-300 bg-white/70 p-8 text-center shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-xl">→</div>
      <h2 className="mt-4 text-2xl font-semibold text-stone-900">Run the pipeline</h2>
      <p className="mt-2 text-sm text-stone-600">The center workspace fills horizontally as each stage completes, instead of stacking long vertical sections.</p>
    </div>
  );
}

function LoadingBoard({ stage }: { stage: string }) {
  return (
    <div className="rounded-[34px] border border-sky-200 bg-[linear-gradient(180deg,#f8fcff,#ffffff)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-sky-500">Running</div>
          <h2 className="mt-2 text-2xl font-semibold text-stone-900">{stage}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 animate-pulse rounded-full bg-sky-400" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-sky-300 [animation-delay:150ms]" />
          <span className="h-3 w-3 animate-pulse rounded-full bg-sky-200 [animation-delay:300ms]" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-[26px] border border-sky-100 bg-white p-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-stone-200" />
            <div className="mt-4 h-6 w-4/5 animate-pulse rounded-full bg-stone-200" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-stone-100" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function inferDomain(hypothesis: string) {
  const value = hypothesis.toLowerCase();
  if (value.includes("mouse") || value.includes("intestinal") || value.includes("microbi")) return "gut_health";
  if (value.includes("hela") || value.includes("cell")) return "cell_biology";
  if (value.includes("co2") || value.includes("cathode")) return "climate";
  if (value.includes("biosensor") || value.includes("blood")) return "diagnostics";
  if (value.includes("glucose") || value.includes("insulin") || value.includes("metformin")) return "metabolism";
  return "general_science";
}

function inferType(hypothesis: string) {
  const value = hypothesis.toLowerCase();
  if (value.includes("fitc-dextran")) return "murine_permeability_assay";
  if (value.includes("cryoprotectant")) return "cell_viability_assay";
  if (value.includes("biosensor")) return "biosensor_benchmark";
  if (value.includes("bioelectrochemical")) return "bioelectrochemical_carbon_capture";
  if (value.includes("metformin") || value.includes("glucose")) return "murine_drug_study";
  return "exploratory_experiment";
}
