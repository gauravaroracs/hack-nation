import type { ExperimentPlan, HypothesisQuality, LiteratureQc, NoveltySignal, Paper, ScientistFeedback } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mapNoveltySignal(value: unknown): NoveltySignal {
  const normalized = asString(value).toLowerCase().replace(/\s+/g, "_");

  if (normalized === "exact_match_found" || normalized === "exact_match") {
    return "exact_match_found";
  }

  if (
    normalized === "similar_work_exists" ||
    normalized === "similar_work" ||
    normalized === "adjacent_work_exists"
  ) {
    return "similar_work_exists";
  }

  if (normalized === "not_found" || normalized === "no_close_match" || normalized === "no_match_found") {
    return "not_found";
  }

  return "similar_work_exists";
}

function mapConfidence(value: unknown): number {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "high") return 0.85;
    if (normalized === "medium") return 0.6;
    if (normalized === "low") return 0.35;
  }

  const numeric = asNumber(value, 0.5);
  return numeric > 1 ? clamp(numeric / 100, 0, 1) : clamp(numeric, 0, 1);
}

function normalizeCatalogNumber(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean).join(", ");
  }

  return asString(value, "verify_before_ordering");
}

function inferExperimentDomain(hypothesis: string) {
  const value = hypothesis.toLowerCase();
  if (value.includes("mouse") || value.includes("intestinal") || value.includes("microbi")) return "gut_health";
  if (value.includes("hela") || value.includes("cell")) return "cell_biology";
  if (value.includes("co2") || value.includes("cathode")) return "climate";
  if (value.includes("biosensor") || value.includes("blood")) return "diagnostics";
  if (value.includes("glucose") || value.includes("insulin") || value.includes("metformin")) return "metabolism";
  return "general_science";
}

function inferExperimentType(hypothesis: string) {
  const value = hypothesis.toLowerCase();
  if (value.includes("fitc-dextran")) return "murine_permeability_assay";
  if (value.includes("cryoprotectant")) return "cell_viability_assay";
  if (value.includes("biosensor")) return "biosensor_benchmark";
  if (value.includes("bioelectrochemical")) return "bioelectrochemical_carbon_capture";
  if (value.includes("metformin") || value.includes("glucose")) return "murine_drug_study";
  return "exploratory_experiment";
}

export function normalizeHypothesisQuality(raw: unknown): HypothesisQuality {
  const data = asRecord(raw);

  if (!data) {
    throw new Error("OpenAI returned an invalid hypothesis-quality payload.");
  }

  return {
    is_testable: Boolean(data.is_testable),
    intervention: asString(data.intervention),
    measurable_outcome: asString(data.measurable_outcome),
    success_threshold: asString(data.success_threshold),
    model_system: asString(data.model_system),
    mechanistic_rationale: asString(data.mechanistic_rationale),
    clarifying_suggestions: asStringArray(data.clarifying_suggestions),
    quality_score: clamp(Math.round(asNumber(data.quality_score, 0)), 0, 100)
  };
}

export function normalizeLiteratureQc(raw: unknown): LiteratureQc {
  const data = asRecord(raw);

  if (!data) {
    throw new Error("OpenAI returned an invalid literature-QC payload.");
  }

  const topReferences = Array.isArray(data.top_references) ? data.top_references : [];

  return {
    novelty_signal: mapNoveltySignal(data.novelty_signal),
    confidence: mapConfidence(data.confidence),
    one_sentence_summary: asString(data.one_sentence_summary),
    reasoning: asString(data.reasoning),
    top_references: topReferences
      .map((item) => {
        const record = asRecord(item);
        if (!record) return null;

        return {
          title: asString(record.title, "Untitled reference"),
          year: asString(record.year, "Unknown"),
          venue: asString(record.venue, "Unknown venue"),
          url: asString(record.url),
          relevance: asString(record.relevance)
        };
      })
      .filter((item): item is LiteratureQc["top_references"][number] => Boolean(item)),
    missing_information: asStringArray(data.missing_information),
    recommendation_for_experiment_planning: asString(data.recommendation_for_experiment_planning)
  };
}

export function normalizePlanInput({
  raw,
  hypothesis,
  hypothesisQuality,
  literatureQc,
  priorFeedback
}: {
  raw: unknown;
  hypothesis: string;
  hypothesisQuality: HypothesisQuality;
  literatureQc: LiteratureQc;
  priorFeedback: ScientistFeedback[];
}): ExperimentPlan {
  const container = asRecord(raw);

  if (!container) {
    throw new Error("OpenAI returned an invalid experiment-plan payload.");
  }

  const data = asRecord(container.experiment_plan) ?? container;
  const experimentalDesign = asRecord(data.experimental_design);
  const groupAllocation = asRecord(experimentalDesign?.group_allocation);
  const intervention = asRecord(experimentalDesign?.intervention);
  const validationAndControls = asRecord(data.validation_and_controls);
  const studyDesign = asRecord(data.study_design);
  const planTimeline = asRecord(data.timeline);
  const validationPlan = asRecord(data.validation_plan);
  const risks = asRecord(data.risks_and_mitigation);

  const groups = asStringArray(studyDesign?.groups);
  const fallbackGroups = asStringArray(groupAllocation?.groups);
  const nPerGroup = asString(groupAllocation?.n_per_group);
  const normalizedGroups =
    groups.length > 0
      ? groups
      : fallbackGroups.map((group) => (nPerGroup ? `${group} (n=${nPerGroup})` : group));

  const protocolSteps = Array.isArray(data.protocol_steps)
    ? data.protocol_steps
        .map((item, index) => {
          const record = asRecord(item);
          if (!record) return null;

          return {
            step_number: clamp(Math.round(asNumber(record.step_number, index + 1)), 1, 999),
            title: asString(record.title, `Step ${index + 1}`),
            duration: asString(record.duration, "TBD"),
            description: asString(record.description),
            critical_notes: asString(record.critical_notes),
            success_check: asString(record.success_check),
            feedback_applied: Boolean(record.feedback_applied),
            feedback_note: asString(record.feedback_note) || null
          };
        })
        .filter((item): item is ExperimentPlan["protocol_steps"][number] => Boolean(item))
    : [];

  const derivedProtocolSteps =
    protocolSteps.length > 0
      ? protocolSteps
      : [
          {
            step_number: 1,
            title: "Prepare study cohort and baseline measurements",
            duration: "1 day",
            description:
              asString(data.objective) ||
              `Prepare the model system and collect baseline measurements for: ${hypothesis}`,
            critical_notes: "Confirm inclusion criteria, baseline comparability, and assay readiness before intervention.",
            success_check: "Animals or samples are assigned, baseline readouts are recorded, and exclusion criteria are documented.",
            feedback_applied: false,
            feedback_note: null
          },
          {
            step_number: 2,
            title: "Run intervention and collect scheduled readouts",
            duration: asString(intervention?.treatment_duration, "TBD"),
            description: [
              asString(intervention?.compound) && `Intervention: ${asString(intervention?.compound)}`,
              asString(intervention?.dosage) && `Dose: ${asString(intervention?.dosage)}`,
              asString(intervention?.administration_route) && `Route: ${asString(intervention?.administration_route)}`,
              asString(planTimeline?.week_12_to_20)
            ]
              .filter(Boolean)
              .join(". "),
            critical_notes: "Standardize handling, dosing schedule, and sample collection windows across groups.",
            success_check: "Intervention logs are complete and intermediate endpoint measurements pass QC.",
            feedback_applied: false,
            feedback_note: null
          },
          {
            step_number: 3,
            title: "Analyze endpoints and interpret outcome",
            duration: "1 to 2 days",
            description: [
              `Primary endpoint: ${asString(validationPlan?.primary_endpoint, asStringArray(experimentalDesign?.endpoints)[0])}`,
              `Success criteria: ${asString(validationPlan?.success_criteria, hypothesisQuality.success_threshold)}`
            ].join(". "),
            critical_notes: "Define analysis methods before unblinding and track any protocol deviations.",
            success_check: "Primary and secondary endpoints are analyzed with controls and QC criteria documented.",
            feedback_applied: false,
            feedback_note: null
          }
        ];

  const materials = Array.isArray(data.materials)
    ? data.materials
        .map((item) => {
          const record = asRecord(item);
          if (!record) return null;

          const catalogNumber = normalizeCatalogNumber(record.catalog_number);

          return {
            name: asString(record.name || record.item, "Unnamed material"),
            supplier: asString(record.supplier, "Verify supplier"),
            catalog_number: catalogNumber || "verify_before_ordering",
            quantity: asString(record.quantity, "TBD"),
            estimated_cost_usd: clamp(Math.round(asNumber(record.estimated_cost_usd ?? record.unit_cost_usd, 0)), 0, 1_000_000),
            purpose: asString(record.purpose, "Required for experiment execution"),
            verification_status:
              catalogNumber.toLowerCase().includes("verify") ? "verify_before_ordering" : "verified_reference"
          };
        })
        .filter((item): item is ExperimentPlan["materials"][number] => Boolean(item))
    : [];

  const equipment = Array.isArray(data.equipment)
    ? data.equipment
        .map((item) => {
          const record = asRecord(item);
          if (!record) return null;

          return {
            name: asString(record.name, "Unnamed equipment"),
            specification: asString(record.specification),
            purpose: asString(record.purpose)
          };
        })
        .filter((item): item is ExperimentPlan["equipment"][number] => Boolean(item))
    : [];

  const fallbackEquipment =
    equipment.length > 0
      ? equipment
      : materials
          .filter((item) => /meter|assay|reader|blot|microscope|analyz/i.test(item.name))
          .map((item) => ({
            name: item.name,
            specification: "Verify exact instrument specification before execution.",
            purpose: item.purpose
          }));

  const timelinePhases = Array.isArray(planTimeline?.phases)
    ? planTimeline.phases
        .map((item) => {
          const record = asRecord(item);
          if (!record) return null;

          return {
            phase: asString(record.phase, "Unnamed phase"),
            duration: asString(record.duration, "TBD"),
            dependencies: asStringArray(record.dependencies)
          };
        })
        .filter((item): item is ExperimentPlan["timeline"]["phases"][number] => Boolean(item))
    : Object.entries(planTimeline ?? {})
        .filter(([key]) => key !== "total_duration")
        .map(([key, value]) => ({
          phase: key.replaceAll("_", " "),
          duration: asString(value, "TBD"),
          dependencies: []
        }));

  const riskEntries = risks
    ? Object.entries(risks)
        .filter(([key, value]) => (key.startsWith("risk_") || key.startsWith("mitigation_")) && typeof value !== "undefined")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => asString(value))
        .filter(Boolean)
    : [];

  const controlList = asStringArray(validationAndControls?.controls);

  return {
    experiment_title: asString(data.experiment_title, "Runnable experiment plan draft"),
    hypothesis,
    novelty_positioning: asString(data.novelty_positioning, literatureQc.one_sentence_summary),
    experiment_domain: asString(data.experiment_domain, inferExperimentDomain(hypothesis)),
    experiment_type: asString(data.experiment_type, inferExperimentType(hypothesis)),
    hypothesis_quality: {
      is_testable: hypothesisQuality.is_testable,
      intervention: hypothesisQuality.intervention,
      measurable_outcome: hypothesisQuality.measurable_outcome,
      success_threshold: hypothesisQuality.success_threshold,
      model_system: hypothesisQuality.model_system
    },
    experiment_summary: asString(data.experiment_summary, asString(data.objective)),
    study_design: {
      groups: normalizedGroups,
      sample_size_recommendation: asString(
        studyDesign?.sample_size_recommendation,
        nPerGroup ? `Initial plan uses n=${nPerGroup} per group; confirm with a formal power analysis.` : "Confirm sample size with a formal power analysis."
      ),
      randomization: asString(studyDesign?.randomization, "Randomize assignment before intervention and document allocation."),
      blinding: asString(studyDesign?.blinding, "Blind endpoint analysis where feasible.")
    },
    protocol_steps: derivedProtocolSteps,
    materials,
    equipment: fallbackEquipment,
    controls: {
      negative_control: asString(data.controls && asRecord(data.controls)?.negative_control, controlList[0] ?? "Untreated or baseline comparison control."),
      positive_control: asString(data.controls && asRecord(data.controls)?.positive_control, controlList[1] ?? "Use a known effective comparator if available."),
      vehicle_control: asString(data.controls && asRecord(data.controls)?.vehicle_control, controlList[2] ?? "Vehicle-only control matched to the intervention route.")
    },
    budget: {
      total_estimated_cost_usd: clamp(
        Math.round(asNumber(asRecord(data.budget)?.total_estimated_cost_usd ?? data.budget_estimate_usd, 0)),
        0,
        10_000_000
      ),
      breakdown: Array.isArray(asRecord(data.budget)?.breakdown)
        ? (asRecord(data.budget)?.breakdown as unknown[])
            .map((item) => {
              const record = asRecord(item);
              if (!record) return null;

              return {
                category: asString(record.category, "Miscellaneous"),
                estimated_cost_usd: clamp(Math.round(asNumber(record.estimated_cost_usd, 0)), 0, 10_000_000),
                notes: asString(record.notes)
              };
            })
            .filter((item): item is ExperimentPlan["budget"]["breakdown"][number] => Boolean(item))
        : [
            {
              category: "Materials and reagents",
              estimated_cost_usd: materials.reduce((sum, item) => sum + item.estimated_cost_usd, 0),
              notes: "Derived from listed materials."
            }
          ]
    },
    timeline: {
      total_duration: asString(planTimeline?.total_duration, asString(intervention?.treatment_duration, "TBD")),
      phases: timelinePhases
    },
    validation_plan: {
      primary_endpoint: asString(
        validationPlan?.primary_endpoint,
        asStringArray(experimentalDesign?.endpoints)[0] || hypothesisQuality.measurable_outcome
      ),
      secondary_endpoints: asStringArray(
        validationPlan?.secondary_endpoints ?? asStringArray(experimentalDesign?.endpoints).slice(1)
      ),
      success_criteria: asString(validationPlan?.success_criteria, hypothesisQuality.success_threshold),
      failure_criteria: asString(
        validationPlan?.failure_criteria,
        "Primary endpoint does not meet the predefined threshold or controls fail QC."
      ),
      quality_standards: asStringArray(
        validationPlan?.quality_standards ?? validationAndControls?.validation_methods
      )
    },
    risks_and_limitations: riskEntries.length > 0 ? riskEntries : asStringArray(data.risks_and_limitations),
    alternative_approach: asString(
      data.alternative_approach,
      "If the primary design is infeasible, reduce scope to a pilot study with a simplified endpoint package."
    ),
    confidence_score: mapConfidence(data.confidence_score || literatureQc.confidence),
    low_confidence_flags: asStringArray(data.low_confidence_flags).concat(
      priorFeedback.length === 0 ? ["No prior expert feedback matched this experiment type."] : []
    )
  };
}

export function normalizePapers(raw: unknown): Paper[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;

      return {
        title: asString(record.title, "Untitled paper"),
        abstract: asString(record.abstract) || null,
        year: Math.round(asNumber(record.year, 0)) || null,
        venue: asString(record.venue) || null,
        citationCount: Math.round(asNumber(record.citationCount, 0)) || null,
        url: asString(record.url) || null,
        doi: asString(record.doi) || null,
        authors: asStringArray(record.authors)
      };
    })
    .filter((item): item is Paper => Boolean(item));
}
