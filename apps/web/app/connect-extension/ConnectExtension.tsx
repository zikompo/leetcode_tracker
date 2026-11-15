"use client";

import { useState } from "react";
import { Button } from "@leettrack/ui/components/button";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ChromeRuntime = {
  runtime?: {
    sendMessage(id: string, message: unknown, callback: (response: unknown) => void): void;
    lastError?: { message?: string };
  };
};

export function ConnectExtension({
  extensionId,
  viewerName,
  confirmId,
}: {
  extensionId: string;
  viewerName: string;
  /** Without a configured allow-list (local development), show the id and ask first. */
  confirmId: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const connect = async () => {
    setState("sending");
    const { data } = await supabaseBrowser().auth.getSession();
    const session = data.session;
    const runtime = (window as unknown as { chrome?: ChromeRuntime }).chrome?.runtime;
    if (!session || !runtime) {
      setState("error");
      setError(
        !session
          ? "Your session expired. Reload the page to sign in again."
          : "This browser can't reach the extension. Open this page in Chrome, where LeetTrack is installed.",
      );
      return;
    }
    runtime.sendMessage(
      extensionId,
      {
        type: "leettrack-session",
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      },
      (response) => {
        const ok = (response as { ok?: boolean } | undefined)?.ok;
        if (ok) return setState("done");
        setState("error");
        setError(
          runtime.lastError?.message ??
            (response as { error?: string } | undefined)?.error ??
            "The extension didn't answer. Check that it's installed and enabled.",
        );
      },
    );
  };

  if (state === "done") {
    return (
      <p className="text-ok">
        Connected. The extension now syncs as {viewerName}; you can close this tab.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Signed in as <strong>{viewerName}</strong>. Connecting lets the extension sync your attempts
        with this account.
      </p>
      {confirmId && (
        <p className="text-xs text-muted-foreground">
          Extension id <code>{extensionId}</code>. Only continue if you opened this page from
          LeetTrack yourself.
        </p>
      )}
      <div>
        <Button onClick={() => void connect()} disabled={state === "sending"}>
          {state === "sending" ? "Connecting…" : "Connect extension"}
        </Button>
      </div>
      {state === "error" && <p className="text-bad">{error}</p>}
    </div>
  );
}
