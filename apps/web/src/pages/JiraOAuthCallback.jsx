import { useEffect } from "react";

const LS_KEY = "jira_oauth_connected";

export default function JiraOAuthCallback({ onDone }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");

    if (connected === "true") {
      localStorage.setItem(LS_KEY, "true");
    }

    const timeout = window.setTimeout(() => {
      window.history.replaceState({}, "", "/");
      onDone?.();
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [onDone]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full bg-surface border border-outline rounded-xl p-8 text-center shadow-card">
        <div className="w-14 h-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>
        <h1 className="text-2xl font-headline font-bold text-on-surface mb-2">Jira Connected</h1>
        <p className="text-sm text-on-surface-variant">
          Returning to ProductOS so you can choose a project and export approved stories.
        </p>
      </div>
    </main>
  );
}
