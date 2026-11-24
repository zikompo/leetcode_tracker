import { useEffect, useState } from "react";
import { hasNeetcodeAccess, removeNeetcodeAccess, requestNeetcodeAccess } from "@/lib/neetcode";

/**
 * Opt in to NeetCode. Turning it on asks Chrome for access to neetcode.io (Chrome shows its own
 * prompt); the background then adds the log panel to NeetCode's problem pages.
 */
export function NeetcodeSettings() {
  const [on, setOn] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void hasNeetcodeAccess().then(setOn);
  }, []);

  const toggle = async (want: boolean) => {
    setMessage(null);
    try {
      if (want) {
        const granted = await requestNeetcodeAccess();
        setOn(granted);
        setMessage(
          granted
            ? {
                ok: true,
                text: "On. Reload any NeetCode tabs you have open; attempts there count toward the same problems as on LeetCode.",
              }
            : { ok: false, text: "Chrome didn't give access to neetcode.io, so it's still off." },
        );
      } else {
        await removeNeetcodeAccess();
        setOn(false);
        setMessage({ ok: true, text: "Off. LeetTrack no longer runs on neetcode.io." });
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <section className="card" aria-labelledby="neetcode-heading">
      <h2 id="neetcode-heading">NeetCode</h2>
      <p className="muted small">
        Log attempts on neetcode.io too. Problems from NeetCode's lists count as the same LeetCode
        problem, so reviews and progress stay in one place.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={on ?? false}
          disabled={on === null}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Track problems I solve on neetcode.io
      </label>
      {message && (
        <p className={message.ok ? "ok small" : "bad small"} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
