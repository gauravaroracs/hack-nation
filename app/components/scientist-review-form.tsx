type ReviewFormState = {
  rating: "good" | "needs_correction";
  section: string;
  original_text: string;
  corrected_text: string;
  user_note: string;
};

export function ScientistReviewForm({
  value,
  onChange,
  onSubmit,
  saving
}: {
  value: ReviewFormState;
  onChange: (next: ReviewFormState) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-line bg-panel/90 p-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Scientist Review</div>
        <h3 className="mt-2 text-xl font-semibold text-white">Capture corrections that improve the next plan</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Rating</span>
          <select
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white"
            value={value.rating}
            onChange={(event) => onChange({ ...value, rating: event.target.value as ReviewFormState["rating"] })}
          >
            <option value="good">good</option>
            <option value="needs_correction">needs correction</option>
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-slate-300">Section</span>
          <select
            className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white"
            value={value.section}
            onChange={(event) => onChange({ ...value, section: event.target.value })}
          >
            <option value="protocol">protocol</option>
            <option value="material">material</option>
            <option value="budget">budget</option>
            <option value="timeline">timeline</option>
            <option value="validation">validation</option>
            <option value="risk">risk</option>
          </select>
        </label>
      </div>

      <label className="mt-4 grid gap-2">
        <span className="text-sm text-slate-300">Original text</span>
        <textarea
          className="min-h-28 rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
          value={value.original_text}
          onChange={(event) => onChange({ ...value, original_text: event.target.value })}
          placeholder="Paste the protocol step, material line item, or claim you want to correct."
        />
      </label>

      <label className="mt-4 grid gap-2">
        <span className="text-sm text-slate-300">Correction text</span>
        <textarea
          className="min-h-28 rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
          value={value.corrected_text}
          onChange={(event) => onChange({ ...value, corrected_text: event.target.value })}
          placeholder="Example: Use 4 kDa FITC-dextran, not 40 kDa, for mouse intestinal permeability assays."
        />
      </label>

      <label className="mt-4 grid gap-2">
        <span className="text-sm text-slate-300">Scientist note</span>
        <textarea
          className="min-h-24 rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none"
          value={value.user_note}
          onChange={(event) => onChange({ ...value, user_note: event.target.value })}
          placeholder="Why should this be applied to future similar plans?"
        />
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={saving || !value.corrected_text.trim()}
        className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save correction
      </button>
    </div>
  );
}
