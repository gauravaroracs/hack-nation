export type HypothesisQuality = {
  is_testable: boolean;
  intervention: string;
  measurable_outcome: string;
  success_threshold: string;
  model_system: string;
  mechanistic_rationale: string;
  clarifying_suggestions: string[];
  quality_score: number;
};

export type Paper = {
  title: string;
  abstract: string | null;
  year: number | null;
  venue: string | null;
  citationCount: number | null;
  url: string | null;
  doi: string | null;
  authors: string[];
};

export type NoveltySignal = "not_found" | "similar_work_exists" | "exact_match_found";

export type LiteratureQc = {
  novelty_signal: NoveltySignal;
  confidence: number;
  one_sentence_summary: string;
  reasoning: string;
  top_references: Array<{
    title: string;
    year: string;
    venue: string;
    url: string;
    relevance: string;
  }>;
  missing_information: string[];
  recommendation_for_experiment_planning: string;
};

export type ScientistFeedback = {
  experiment_domain: string;
  experiment_type: string;
  section: string;
  original_text: string;
  corrected_text: string;
  user_note: string;
};

export type ExperimentPlan = {
  experiment_title: string;
  hypothesis: string;
  novelty_positioning: string;
  experiment_domain: string;
  experiment_type: string;
  hypothesis_quality: {
    is_testable: boolean;
    intervention: string;
    measurable_outcome: string;
    success_threshold: string;
    model_system: string;
  };
  experiment_summary: string;
  study_design: {
    groups: string[];
    sample_size_recommendation: string;
    randomization: string;
    blinding: string;
  };
  protocol_steps: Array<{
    step_number: number;
    title: string;
    duration: string;
    description: string;
    critical_notes: string;
    success_check: string;
    feedback_applied: boolean;
    feedback_note: string | null;
  }>;
  materials: Array<{
    name: string;
    supplier: string;
    catalog_number: string;
    quantity: string;
    estimated_cost_usd: number;
    purpose: string;
    verification_status: "verified_reference" | "verify_before_ordering";
  }>;
  equipment: Array<{
    name: string;
    specification: string;
    purpose: string;
  }>;
  controls: {
    negative_control: string;
    positive_control: string;
    vehicle_control: string;
  };
  budget: {
    total_estimated_cost_usd: number;
    breakdown: Array<{
      category: string;
      estimated_cost_usd: number;
      notes: string;
    }>;
  };
  timeline: {
    total_duration: string;
    phases: Array<{
      phase: string;
      duration: string;
      dependencies: string[];
    }>;
  };
  validation_plan: {
    primary_endpoint: string;
    secondary_endpoints: string[];
    success_criteria: string;
    failure_criteria: string;
    quality_standards: string[];
  };
  risks_and_limitations: string[];
  alternative_approach: string;
  confidence_score: number;
  low_confidence_flags: string[];
};
