import { useState, useEffect } from "react";
import { getConnectors, disconnectMural } from "../api/connectors";
import {
  clearJiraConnectionCache,
  disconnectJira,
  getJiraAuthorization,
  writeJiraConnectionCache,
} from "../api/jira";

// ─── Static connector catalogue ───────────────────────────────────────────────
// Defines display properties for every connector the UI knows about.
// The API response overlays live connection state on top of these.
const CONNECTOR_CATALOGUE = [
  {
    provider:  "mural",
    label:     "Mural",
    category:  "discovery",
    icon:      "brush",
    iconColor: "#FF6A3D",
    iconBg:    "bg-orange-50",
    iconBorder:"border-orange-100",
    available: true,
    description: "Import workshop boards and extract customer insights.",
  },
  {
    provider:  "miro",
    label:     "Miro",
    category:  "discovery",
    icon:      "dashboard_customize",
    iconColor: "#F8C40E",
    iconBg:    "bg-yellow-50",
    iconBorder:"border-yellow-100",
    available: false,
    description: "Connect Miro boards for collaborative workshop analysis.",
  },
  {
    provider:  "figjam",
    label:     "FigJam",
    category:  "discovery",
    icon:      "hub",
    iconColor: "#8B5CF6",
    iconBg:    "bg-purple-50",
    iconBorder:"border-purple-100",
    available: false,
    description: "Import FigJam whiteboards and sticky notes.",
  },
  {
    provider:  "notion",
    label:     "Notion",
    category:  "discovery",
    icon:      "auto_stories",
    iconColor: "#374151",
    iconBg:    "bg-slate-100",
    iconBorder:"border-slate-200",
    available: false,
    description: "Pull in Notion pages and research documents.",
  },
  {
    provider:  "jira",
    label:     "Jira",
    category:  "delivery",
    icon:      "cloud_upload",
    iconColor: "#0052CC",
    iconBg:    "bg-blue-50",
    iconBorder:"border-blue-100",
    available: true,
    description: "Export stories and epics directly into your Jira project.",
  },
];

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── ConnectorCard ─────────────────────────────────────────────────────────────
function ConnectorCard({ def, live, onConnect, onDisconnect, actionPending }) {
  const connected    = live?.connected ?? false;
  const displayName  = live?.display_name ?? live?.username ?? null;
  const lastSynced   = relativeTime(live?.last_synced_at);
  const syncResource = live?.last_synced_resource_name ?? null;

  return (
    <div className={[
      "bg-surface rounded-xl border shadow-card p-5 flex flex-col gap-4 transition-all",
      connected ? "border-outline" : "border-outline",
      !def.available && "opacity-60",
    ].join(" ")}>

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg border ${def.iconBg} ${def.iconBorder} flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: def.iconColor }}>
              {def.icon}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-headline font-bold text-on-surface">{def.label}</span>
              {!def.available && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline">
                  Soon
                </span>
              )}
              {def.available && connected && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Connected
                </span>
              )}
              {def.available && !connected && (
                <span className="text-[10px] font-semibold text-on-surface-variant">Not connected</span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5 capitalize">{def.category}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-[12px] text-on-surface-variant leading-relaxed">{def.description}</p>

      {/* Connected account info */}
      {connected && (
        <div className="bg-surface-container rounded-lg px-3 py-2.5 space-y-1">
          {displayName && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant">person</span>
              <span className="text-[12px] text-on-surface font-semibold">{displayName}</span>
            </div>
          )}
          {live?.username && live.username !== displayName && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant">alternate_email</span>
              <span className="text-[12px] text-on-surface-variant">{live.username}</span>
            </div>
          )}
          {live?.base_url && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant">link</span>
              <span className="text-[12px] text-on-surface-variant truncate">{live.base_url}</span>
            </div>
          )}
          {(lastSynced || syncResource) && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="material-symbols-outlined text-[13px] text-on-surface-variant">sync</span>
              <span className="text-[11px] text-on-surface-variant">
                {syncResource ? `"${syncResource}"` : "Last sync"}{lastSynced ? ` · ${lastSynced}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action */}
      {def.available && (
        <div className="mt-auto">
          {connected ? (
            <button
              onClick={() => onDisconnect(def.provider)}
              disabled={actionPending === def.provider}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {actionPending === def.provider
                ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-[14px]">link_off</span>}
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => onConnect(def.provider)}
              disabled={actionPending === def.provider}
              className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dim transition-all disabled:opacity-50"
            >
              {actionPending === def.provider
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-[16px]">add_link</span>}
              Connect
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Connectors({ onNavigate }) {
  const [connectors, setConnectors]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [actionPending, setActionPending] = useState(null); // provider string while action in-flight

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { connectors: list } = await getConnectors();
      setConnectors(list ?? []);
      const jira = (list ?? []).find(c => c.provider === "jira");
      if (jira?.connected) {
        writeJiraConnectionCache({
          connected: true,
          jiraInfo: {
            connected: true,
            base_url: jira.base_url ?? "",
            display_name: jira.display_name ?? "",
          },
        });
      } else {
        clearJiraConnectionCache();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function liveData(provider) {
    return connectors.find(c => c.provider === provider) ?? null;
  }

  async function handleConnect(provider) {
    setActionPending(provider);
    try {
      if (provider === "mural") {
        localStorage.setItem("oauth_mural_origin", "connectors");
        const { getMuralConnectUrl } = await import("../api/mural");
        const res = await getMuralConnectUrl();
        window.location.href = res.authorization_url;
      } else if (provider === "jira") {
        localStorage.setItem("oauth_jira_origin", "connectors");
        const res = await getJiraAuthorization();
        window.location.href = res.authorization_url;
      }
    } catch (e) {
      localStorage.removeItem("oauth_mural_origin");
      localStorage.removeItem("oauth_jira_origin");
      setError(`Failed to start ${provider} connection: ${e.message}`);
      setActionPending(null);
    }
  }

  async function handleDisconnect(provider) {
    setActionPending(provider);
    try {
      if (provider === "mural") {
        await disconnectMural();
        localStorage.removeItem("mural_oauth_state");
      } else if (provider === "jira") {
        await disconnectJira();
        localStorage.removeItem("jira_oauth_connected");
        clearJiraConnectionCache();
      }
      await load();
    } catch (e) {
      setError(`Failed to disconnect ${provider}: ${e.message}`);
    } finally {
      setActionPending(null);
    }
  }

  const discoveryDefs  = CONNECTOR_CATALOGUE.filter(c => c.category === "discovery");
  const deliveryDefs   = CONNECTOR_CATALOGUE.filter(c => c.category === "delivery");

  return (
    <div className="px-10 py-10 max-w-5xl">

      {/* ── Page header ── */}
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface mb-2">
          Connectors
        </h2>
        <p className="text-on-surface-variant text-sm max-w-xl leading-relaxed">
          Manage your discovery and delivery integrations. Connect data sources to import workshop evidence and delivery tools to export stories.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={load} className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONNECTOR_CATALOGUE.map(def => (
            <div key={def.provider} className="bg-surface border border-outline rounded-xl p-5 h-52 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-surface-container" />
                <div className="space-y-1.5">
                  <div className="h-4 w-20 bg-surface-container rounded" />
                  <div className="h-3 w-14 bg-surface-container rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-surface-container rounded mb-2" />
              <div className="h-3 w-3/4 bg-surface-container rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Discovery */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">search</span>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Discovery</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
              {discoveryDefs.map(def => (
                <ConnectorCard
                  key={def.provider}
                  def={def}
                  live={liveData(def.provider)}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  actionPending={actionPending}
                />
              ))}
            </div>
          </section>

          {/* Delivery */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">rocket_launch</span>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Delivery</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
              {deliveryDefs.map(def => (
                <ConnectorCard
                  key={def.provider}
                  def={def}
                  live={liveData(def.provider)}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  actionPending={actionPending}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
