import { useState } from "react";
import { RATING_LABELS, type Complexity, type Rating } from "@leettrack/core";
import { ComplexityPicker } from "./ComplexityPicker";
import type { ProblemState } from "@/lib/types";

export interface QuickReviewInput {
  approach: string;
  complexity: Complexity;
  rating: Rating;
}

const RATINGS: Rating[] = [1, 2, 3, 4];
const RECALL: Record<Rating, string> = {
  1: "Couldn't recall it",
  2: "Recalled with effort",
  3: "Recalled it",
  4: "Instantly",
};

/**
 * Quick review (spec 5.4): recall the approach and complexity first, then compare with past
 * notes and rate yourself. For mature cards of problems already solved.
 */
export function QuickReview({
  problem,
  saving,
  onSave,
}: {
  problem: ProblemState;
  saving: boolean;
  onSave(input: QuickReviewInput): void;
}) {
  const [approach, setApproach] = useState("");
  const [complexity, setComplexity] = useState<Complexity>({});
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState<Rating>();
  const last = [...problem.attempts].reverse().find((a) => a.kind === "full");

  return (
    <form
      className="lt-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating) onSave({ approach, complexity, rating });
      }}
    >
      <p className="lt-hint">
        Read the problem, then recall how you solved it before looking at your notes.
      </p>
      <label className="lt-field">
        <span className="lt-label">Your approach, in a sentence or two</span>
        <textarea
          className="lt-input lt-textarea"
          rows={3}
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
        />
      </label>
      <div className="lt-field">
        <span className="lt-label">Expected complexity</span>
        <ComplexityPicker name="Expected" value={complexity} onChange={setComplexity} />
      </div>

      {!revealed ? (
        <button type="button" className="lt-btn" onClick={() => setRevealed(true)}>
          Reveal my notes
        </button>
      ) : (
        <>
          <div className="lt-reveal" aria-label="Your previous notes">
            {last ? (
              <>
                {last.complexityAchieved && (
                  <p>
                    <strong>Complexity:</strong> {last.complexityAchieved}
                  </p>
                )}
                {last.patternClue && (
                  <p>
                    <strong>Clue:</strong> {last.patternClue}
                  </p>
                )}
                {last.stuckNote && (
                  <p>
                    <strong>Stuck on:</strong> {last.stuckNote}
                  </p>
                )}
                {last.notes && <div className="lt-notes">{last.notes}</div>}
                {last.code && (
                  <details className="lt-details">
                    <summary>Code</summary>
                    <pre className="lt-pre">{last.code}</pre>
                  </details>
                )}
                {!last.notes && !last.complexityAchieved && !last.code && (
                  <p className="lt-hint">No notes were saved last time.</p>
                )}
              </>
            ) : (
              <p className="lt-hint">No earlier full attempt to compare with.</p>
            )}
          </div>

          <fieldset className="lt-field">
            <legend className="lt-label">How well did you recall it?</legend>
            <div className="lt-ratings" role="radiogroup" aria-label="Recall">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={rating === r}
                  className={`lt-rating lt-rating-${r}`}
                  onClick={() => setRating(r)}
                >
                  {RATING_LABELS[r]}
                  <span className="lt-suggested">{RECALL[r]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="lt-actions">
            <button type="submit" className="lt-btn lt-btn-primary" disabled={saving || !rating}>
              {saving ? "Saving…" : "Save quick review"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
