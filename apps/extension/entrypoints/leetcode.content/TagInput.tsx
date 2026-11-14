import { useMemo, useState, type KeyboardEvent } from "react";
import { tagId } from "@leettrack/core";
import { allPatterns, patternName, type PatternPrefs } from "@/lib/patterns";

interface Props {
  value: string[];
  patternPrefs: PatternPrefs;
  onChange(ids: string[]): void;
  /** Create a custom tag; resolves to its id (or null on failure). */
  onCreate(name: string): Promise<string | null>;
}

/**
 * Tag picker: type to filter, Enter to add the highlighted tag (or create a new one),
 * or click any tag from the list below.
 */
export function TagInput({ value, patternPrefs, onChange, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const options = useMemo(
    () =>
      allPatterns(patternPrefs).filter(
        (p) => !value.includes(p.id) && (!q || p.name.toLowerCase().includes(q)),
      ),
    [patternPrefs, value, q],
  );
  const exact = q
    ? allPatterns(patternPrefs).find((p) => p.name.toLowerCase() === q || p.id === tagId(q))
    : undefined;
  const canCreate = q.length > 0 && !exact && tagId(q).length > 0;

  const add = (id: string) => {
    if (!value.includes(id)) onChange([...value, id]);
    setQuery("");
  };
  const create = async () => {
    const id = await onCreate(query);
    if (id) add(id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // never submit the form from here
      if (!q) return;
      if (exact) add(exact.id);
      else if (options[0]) add(options[0].id);
      else if (canCreate) void create();
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="lt-tags">
      <div className="lt-tag-box">
        {value.map((id) => (
          <span key={id} className="lt-chip lt-chip-selected">
            {patternName(id, patternPrefs)}
            <button
              type="button"
              className="lt-chip-x"
              onClick={() => onChange(value.filter((v) => v !== id))}
              aria-label={`Remove ${patternName(id, patternPrefs)}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="lt-tag-input"
          placeholder={value.length ? "Add another…" : "Type a tag, or pick one below"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Add a pattern tag"
        />
      </div>
      <div className="lt-tag-options" role="listbox" aria-label="Pattern tags">
        {options.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={Boolean(q) && !exact && i === 0}
            className="lt-chip lt-chip-option"
            onClick={() => add(p.id)}
          >
            {p.name}
          </button>
        ))}
        {canCreate && (
          <button type="button" className="lt-chip lt-chip-create" onClick={() => void create()}>
            + Create “{query.trim()}”
          </button>
        )}
        {options.length === 0 && !canCreate && <span className="lt-hint">No more tags</span>}
      </div>
    </div>
  );
}
