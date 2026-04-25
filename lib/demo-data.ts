import type { ExperimentPlan, HypothesisQuality, LiteratureQc, Paper, ScientistFeedback } from "@/lib/types";

export const GUT_HEALTH_HYPOTHESIS =
  "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.";

export const demoHypothesisQuality: HypothesisQuality = {
  is_testable: true,
  intervention: "4-week Lactobacillus rhamnosus GG supplementation",
  measurable_outcome: "Reduction in intestinal permeability by FITC-dextran assay with tight junction protein readouts",
  success_threshold: "At least 30% lower permeability versus control",
  model_system: "C57BL/6 mice",
  mechanistic_rationale: "LGG is expected to strengthen epithelial barrier function by increasing claudin-1 and occludin expression.",
  clarifying_suggestions: [
    "Specify sex and age of mice for better reproducibility.",
    "Define FITC-dextran molecular weight and sampling timepoint.",
    "Clarify whether the comparison is against vehicle-only chow or probiotic-free gavage."
  ],
  quality_score: 92
};

export const demoPapers: Paper[] = [
  {
    title: "Probiotic Lactobacillus rhamnosus GG improves gut barrier function in murine inflammation models",
    abstract: "Murine studies suggest LGG can reduce epithelial permeability and improve tight junction integrity under inflammatory stress.",
    year: 2022,
    venue: "Gut Microbes",
    citationCount: 68,
    url: "https://www.semanticscholar.org/",
    doi: null,
    authors: ["A. Patel", "J. Nguyen", "R. Singh"]
  },
  {
    title: "FITC-dextran assays for assessing intestinal permeability in preclinical mouse studies",
    abstract: "Protocol paper comparing assay sensitivity, dextran molecular weight, and endpoint timing for mouse permeability studies.",
    year: 2021,
    venue: "Journal of Visualized Experiments",
    citationCount: 41,
    url: "https://www.semanticscholar.org/",
    doi: null,
    authors: ["L. Chen", "M. Reed"]
  },
  {
    title: "Tight junction protein modulation by probiotics in intestinal epithelial models",
    abstract: "Reviews evidence that probiotic strains influence occludin and claudin expression across epithelial systems.",
    year: 2023,
    venue: "Frontiers in Nutrition",
    citationCount: 21,
    url: "https://www.semanticscholar.org/",
    doi: null,
    authors: ["E. Wilson", "K. Ahmed"]
  }
];

export const demoLiteratureQc: LiteratureQc = {
  novelty_signal: "similar_work_exists",
  confidence: 0.79,
  one_sentence_summary:
    "Related murine probiotic permeability studies exist, but the exact LGG dose-duration-endpoint combination is not obviously duplicated in the retrieved set.",
  reasoning:
    "The retrieved literature indicates overlapping probiotic barrier-function work, yet the precise success threshold, 4-week design, and combined mechanistic readout appear differentiated rather than identical.",
  top_references: demoPapers.slice(0, 3).map((paper) => ({
    title: paper.title,
    year: paper.year ? String(paper.year) : "Unknown",
    venue: paper.venue ?? "Unknown venue",
    url: paper.url ?? "",
    relevance: "Supports assay design, expected effect direction, or mechanistic biomarkers."
  })),
  missing_information: [
    "Exact LGG dose and administration route were not specified.",
    "Mouse sex and baseline barrier challenge model are not stated."
  ],
  recommendation_for_experiment_planning:
    "Proceed with an experiment plan, but include rigorous controls and clearly define the FITC-dextran assay parameters to differentiate from adjacent prior work."
};

export const demoFeedback: ScientistFeedback[] = [
  {
    experiment_domain: "gut_health",
    experiment_type: "murine_permeability_assay",
    section: "materials",
    original_text: "FITC-dextran assay reagent",
    corrected_text: "Use 4 kDa FITC-dextran, not 40 kDa, for mouse intestinal permeability assays.",
    user_note: "Improves comparability with common murine barrier-function studies."
  }
];

export function buildDemoPlan(priorFeedback: ScientistFeedback[] = []): ExperimentPlan {
  const fitcFeedback = priorFeedback.find((item) =>
    item.corrected_text.toLowerCase().includes("4 kda fitc-dextran")
  );

  const fitcMaterialName = fitcFeedback
    ? "FITC-dextran, 4 kDa"
    : "FITC-dextran, 40 kDa";

  const fitcNote = fitcFeedback
    ? "Expert correction applied: using 4 kDa FITC-dextran."
    : null;

  return {
    experiment_title: "LGG Supplementation for Reducing Mouse Intestinal Permeability",
    hypothesis: GUT_HEALTH_HYPOTHESIS,
    novelty_positioning:
      "Adjacent literature supports probiotic barrier-function effects, but this plan differentiates on the explicit 30% threshold, 4-week schedule, and combined FITC-dextran plus tight-junction validation package.",
    experiment_domain: "gut_health",
    experiment_type: "murine_permeability_assay",
    hypothesis_quality: {
      is_testable: true,
      intervention: demoHypothesisQuality.intervention,
      measurable_outcome: demoHypothesisQuality.measurable_outcome,
      success_threshold: demoHypothesisQuality.success_threshold,
      model_system: demoHypothesisQuality.model_system
    },
    experiment_summary:
      "Run a 4-week murine supplementation study comparing LGG versus vehicle control, quantify intestinal permeability with FITC-dextran, and validate mechanism through claudin-1 and occludin expression in ileal tissue.",
    study_design: {
      groups: [
        "Vehicle-only control (n=10)",
        "LGG low-dose arm (n=10)",
        "LGG target-dose arm (n=10)"
      ],
      sample_size_recommendation:
        "Pilot with 10 mice per arm, then re-estimate for a confirmatory powered study using observed variance.",
      randomization: "Randomize animals to cages and treatment arms after baseline weight balancing.",
      blinding: "Blind assay readers and Western blot / qPCR analysts to treatment assignment."
    },
    protocol_steps: [
      {
        step_number: 1,
        title: "Animal allocation and baseline recording",
        duration: "0.5 day",
        description:
          "Acclimate 8- to 10-week-old C57BL/6 mice, record weight, stool consistency, and cage assignment before intervention.",
        critical_notes:
          "Use consistent sex and age cohort; document chow composition and housing conditions.",
        success_check: "Balanced baseline weights and no exclusion-triggering health issues.",
        feedback_applied: false,
        feedback_note: null
      },
      {
        step_number: 2,
        title: "Daily LGG supplementation",
        duration: "4 weeks",
        description:
          "Administer Lactobacillus rhamnosus GG by oral gavage once daily at the target CFU dose while control animals receive vehicle.",
        critical_notes:
          "Track viability lot-to-lot and prepare fresh suspension under cold-chain conditions.",
        success_check: "Dose logs complete and body weight remains within protocol tolerance.",
        feedback_applied: false,
        feedback_note: null
      },
      {
        step_number: 3,
        title: "Permeability challenge",
        duration: "6 hours",
        description:
          `Fast mice per protocol, administer ${fitcMaterialName} by oral gavage, and collect plasma at the predefined timepoint for fluorescence quantification.`,
        critical_notes:
          "Keep fasting duration uniform; use a standard curve prepared in matching plasma matrix.",
        success_check: "Acceptable standard curve linearity and no major outlier due to failed gavage.",
        feedback_applied: Boolean(fitcFeedback),
        feedback_note: fitcNote
      },
      {
        step_number: 4,
        title: "Tissue harvest and mechanism readout",
        duration: "1 day",
        description:
          "Collect ileal tissue, extract RNA/protein, and quantify claudin-1 and occludin by qPCR and/or Western blot.",
        critical_notes:
          "Use RNA quality thresholds and normalize protein loading with validated housekeeping markers.",
        success_check: "RNA integrity and band quality meet assay QC thresholds.",
        feedback_applied: false,
        feedback_note: null
      },
      {
        step_number: 5,
        title: "Analysis and interpretation",
        duration: "0.5 day",
        description:
          "Compare permeability and tight-junction endpoints across groups, then check whether the 30% reduction threshold is met in the target-dose arm.",
        critical_notes:
          "Pre-specify exclusion handling and multiple-comparison approach before analysis.",
        success_check: "Primary endpoint analysis complete with interpretable controls.",
        feedback_applied: false,
        feedback_note: null
      }
    ],
    materials: [
      {
        name: "Lactobacillus rhamnosus GG culture",
        supplier: "ATCC",
        catalog_number: "53103",
        quantity: "1 culture lot",
        estimated_cost_usd: 540,
        purpose: "Intervention organism",
        verification_status: "verified_reference"
      },
      {
        name: fitcMaterialName,
        supplier: "Sigma-Aldrich",
        catalog_number: fitcFeedback ? "FD4" : "46944",
        quantity: "1 vial",
        estimated_cost_usd: 185,
        purpose: "Intestinal permeability tracer",
        verification_status: "verify_before_ordering"
      },
      {
        name: "Claudin-1 antibody",
        supplier: "Thermo Fisher Scientific",
        catalog_number: "37-4900",
        quantity: "100 uL",
        estimated_cost_usd: 410,
        purpose: "Tight junction protein measurement",
        verification_status: "verify_before_ordering"
      },
      {
        name: "Occludin antibody",
        supplier: "Thermo Fisher Scientific",
        catalog_number: "33-1500",
        quantity: "100 uL",
        estimated_cost_usd: 405,
        purpose: "Tight junction protein measurement",
        verification_status: "verify_before_ordering"
      },
      {
        name: "RNeasy Mini Kit",
        supplier: "Qiagen",
        catalog_number: "74104",
        quantity: "1 kit",
        estimated_cost_usd: 390,
        purpose: "RNA extraction",
        verification_status: "verified_reference"
      },
      {
        name: "qPCR primer synthesis",
        supplier: "IDT",
        catalog_number: "custom",
        quantity: "4 primer pairs",
        estimated_cost_usd: 140,
        purpose: "Claudin-1, occludin, and housekeeping gene assays",
        verification_status: "verify_before_ordering"
      }
    ],
    equipment: [
      {
        name: "Fluorescence plate reader",
        specification: "Excitation/emission compatible with FITC detection",
        purpose: "Quantify plasma FITC-dextran signal"
      },
      {
        name: "qPCR instrument",
        specification: "96-well real-time PCR system",
        purpose: "Gene expression validation"
      },
      {
        name: "Standard gavage and animal handling setup",
        specification: "Mouse-compatible oral gavage needles and restraint workflow",
        purpose: "Daily dosing and permeability tracer administration"
      }
    ],
    controls: {
      negative_control: "Vehicle-only mice without LGG supplementation",
      positive_control: "Optional mild barrier-disruption cohort if ethically approved",
      vehicle_control: "Daily gavage with matching probiotic vehicle"
    },
    budget: {
      total_estimated_cost_usd: 3470,
      breakdown: [
        {
          category: "Biological materials",
          estimated_cost_usd: 725,
          notes: "LGG culture and FITC-dextran tracer"
        },
        {
          category: "Molecular assays",
          estimated_cost_usd: 1345,
          notes: "Antibodies, RNA extraction, primers"
        },
        {
          category: "Animal study operations",
          estimated_cost_usd: 1100,
          notes: "Mouse procurement, housing, consumables"
        },
        {
          category: "Contingency",
          estimated_cost_usd: 300,
          notes: "Repeat assay runs and minor reagent overruns"
        }
      ]
    },
    timeline: {
      total_duration: "6 weeks",
      phases: [
        {
          phase: "Procurement and protocol finalization",
          duration: "1 week",
          dependencies: ["Vendor confirmation", "Animal approval readiness"]
        },
        {
          phase: "LGG supplementation window",
          duration: "4 weeks",
          dependencies: ["Animals acclimated", "Fresh dosing workflow established"]
        },
        {
          phase: "Permeability assay and tissue collection",
          duration: "2 days",
          dependencies: ["Completed dosing period", "Tracer and collection kits on hand"]
        },
        {
          phase: "Molecular validation and analysis",
          duration: "4 days",
          dependencies: ["Tissue QC passed", "qPCR or blot workflow available"]
        }
      ]
    },
    validation_plan: {
      primary_endpoint:
        "Percent reduction in plasma FITC-dextran signal in the target-dose LGG arm versus vehicle control",
      secondary_endpoints: [
        "Claudin-1 expression change",
        "Occludin expression change",
        "Animal weight and tolerability signals"
      ],
      success_criteria:
        "Target-dose arm achieves at least 30% lower permeability versus control with directional support from tight-junction markers.",
      failure_criteria:
        "Primary endpoint reduction is below 15%, or molecular readouts conflict with the hypothesized mechanism.",
      quality_standards: [
        "MIQE-aligned qPCR reporting if qPCR is used",
        "Predefined exclusion and blinding logs",
        "Vendor and catalog verification before ordering"
      ]
    },
    risks_and_limitations: [
      "Probiotic viability may drift across batches and reduce effect consistency.",
      "Permeability assays are sensitive to fasting duration and gavage technique.",
      "Catalog numbers for some antibodies and tracer formats should be rechecked before procurement."
    ],
    alternative_approach:
      "If in vivo variance is too high for the hackathon timeline, run an epithelial monolayer permeability assay with transepithelial electrical resistance as a faster orthogonal screen.",
    confidence_score: 0.82,
    low_confidence_flags: [
      "Exact vendor catalog numbers for some reagents require procurement verification.",
      "Final sample size should be recalculated from pilot variance."
    ]
  };
}
