// frontend/src/pages/UserDashboard.tsx
import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api, MeResponse, UserContext, TicketListItem, HelpdeskConversation, ProjectOut } from "../lib/api";

type Props = {
  me: MeResponse;
};

const UserDashboard: React.FC<Props> = ({ me }) => {
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [projects, setProjects] = useState<ProjectOut[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState("normal");
  const [ticketText, setTicketText] = useState("");
  const [helpdeskConvs, setHelpdeskConvs] = useState<HelpdeskConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [helpdeskText, setHelpdeskText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(true);

  const loadAll = async () => {
    try {
      const [ctxRes, ticketsRes] = await Promise.all([api.userContext(), api.user.listTickets()]);
      setCtx(ctxRes);
      setTickets(ticketsRes);
      setLoadingCtx(false);

      if (ctxRes.org.features["projects.backup"]) {
        api.projects
          .list()
          .then(setProjects)
          .catch(() => {});
      }

      if (ctxRes.org.features["ai.helpdesk"]) {
        api.helpdesk
          .listConversations()
          .then((c) => {
            setHelpdeskConvs(c);
            if (c[0]) setActiveConvId(c[0].conversation_id);
          })
          .catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load context");
      setLoadingCtx(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const t = await api.user.createTicket(ticketSubject, ticketPriority, ticketText);
      setTicketSubject("");
      setTicketPriority("normal");
      setTicketText("");
      setTickets((prev) => [{ ...t, subject: t.subject }, ...prev]);
    } catch (e: any) {
      setError(e?.message || "Failed to create ticket");
    }
  };

  const sendHelpdesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpdeskText.trim()) return;
    try {
      const conv = await api.helpdesk.chat(activeConvId, helpdeskText.trim());
      setHelpdeskText("");
      setActiveConvId(conv.conversation_id);
      setHelpdeskConvs((prev) => {
        const others = prev.filter((c) => c.conversation_id !== conv.conversation_id);
        return [conv, ...others];
      });
    } catch (e: any) {
      setError(e?.message || "Helpdesk error");
    }
  };

  const startBackup = async () => {
    if (!selectedProject || !ctx) return;
    const proj = projects.find((p) => p.id === selectedProject);
    if (!proj) return;
    try {
      await api.projects.startBackup({
        project_id: proj.id,
        project_name: proj.name,
        include_estimates: true,
        include_lineitems: true,
        include_resources: true,
        include_activities: true,
      });
      alert("Backup job created (placeholder completed).");
    } catch (e: any) {
      setError(e?.message || "Backup error");
    }
  };

  if (loadingCtx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        Loading…
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-red-400">
        {error || "Context not available"}
      </div>
    );
  }

  const hasBackup = ctx.org.features["projects.backup"];
  const hasHelpdesk = ctx.org.features["ai.helpdesk"];

  return (
    <Layout title="User Dashboard">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">
              Welcome back
            </div>
            <div className="text-xl font-semibold text-slate-100">
              {me.display_name}{" "}
              <span className="text-xs text-slate-500">({me.username})</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Org: {ctx.org.name} • Company: {ctx.company.code}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">
              Services
            </div>
            <ul className="space-y-1 text-sm text-slate-300">
              <li>
                <span className="inline-flex w-2 h-2 rounded-full mr-2 bg-emerald-500" />
                Tickets
              </li>
              <li>
                <span
                  className={`inline-flex w-2 h-2 rounded-full mr-2 ${
                    hasBackup ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                />
                Project backup
              </li>
              <li>
                <span
                  className={`inline-flex w-2 h-2 rounded-full mr-2 ${
                    hasHelpdesk ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                />
                RIB Helpdesk AI
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">
              License
            </div>
            <div className="text-sm text-slate-200">
              Plan: {ctx.org.license.plan.toUpperCase()}
            </div>
            <div className="text-sm text-slate-200">
              Status:{" "}
              <span className={ctx.org.license.active ? "text-emerald-400" : "text-red-400"}>
                {ctx.org.license.active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">
              Company
            </div>
            <div className="text-sm text-slate-200">{ctx.company.base_url}</div>
            <div className="text-xs text-slate-500 mt-1">
              RIB company: {ctx.company.rib_company_code}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Tickets */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Tickets</div>
            </div>
            <form onSubmit={submitTicket} className="space-y-2 text-sm">
              <input
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Subject"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                required
              />
              <div className="flex gap-2">
                <select
                  className="w-32 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <textarea
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  placeholder="Describe your issue…"
                  value={ticketText}
                  onChange={(e) => setTicketText(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5"
                >
                  Create ticket
                </button>
              </div>
            </form>
            <div className="border-t border-slate-800 pt-2 max-h-64 overflow-auto text-xs">
              {tickets.length === 0 && (
                <div className="text-slate-500">No tickets yet.</div>
              )}
              <ul className="space-y-1">
                {tickets.map((t) => (
                  <li
                    key={t.ticket_id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-2 py-1"
                  >
                    <div>
                      <div className="font-medium text-slate-100">{t.subject}</div>
                      <div className="text-[10px] text-slate-500">
                        {t.priority.toUpperCase()} • {t.status}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      #{t.ticket_id.slice(0, 6)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Project backup */}
          {hasBackup && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Project backup</div>
              </div>
              <div className="text-xs text-slate-400">
                Choose a project from your RIB server and start a backup job
                (placeholder).
              </div>
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
                <button
                  onClick={startBackup}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5 disabled:opacity-50"
                  disabled={!selectedProject}
                >
                  Start backup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Helpdesk */}
        {hasHelpdesk && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">RIB Helpdesk AI</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-1 border-r border-slate-800 pr-2 space-y-1 max-h-64 overflow-auto">
                {helpdeskConvs.length === 0 && (
                  <div className="text-slate-500">No conversations yet.</div>
                )}
                {helpdeskConvs.map((c) => (
                  <button
                    key={c.conversation_id}
                    onClick={() => setActiveConvId(c.conversation_id)}
                    className={`w-full text-left rounded-lg px-2 py-1 ${
                      activeConvId === c.conversation_id
                        ? "bg-slate-800 text-slate-100"
                        : "bg-slate-950/60 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div>Conversation #{c.conversation_id.slice(0, 6)}</div>
                    <div className="text-[10px] text-slate-500">
                      {c.messages.length} messages
                    </div>
                  </button>
                ))}
              </div>
              <div className="md:col-span-3 flex flex-col max-h-64">
                <div className="flex-1 overflow-auto border border-slate-800 rounded-lg p-2 bg-slate-950/60 space-y-1">
                  {activeConvId ? (
                    helpdeskConvs
                      .find((c) => c.conversation_id === activeConvId)
                      ?.messages.map((m) => (
                        <div
                          key={m.message_id}
                          className={`px-2 py-1 rounded-md max-w-[80%] ${
                            m.sender === "user"
                              ? "ml-auto bg-indigo-600/70 text-right"
                              : "mr-auto bg-slate-800/80"
                          }`}
                        >
                          <div className="text-[10px] text-slate-300 mb-0.5">
                            {m.sender === "user" ? "You" : "AI"}
                          </div>
                          <div className="text-xs">{m.text}</div>
                        </div>
                      ))
                  ) : (
                    <div className="text-slate-500 text-xs">
                      Start a new conversation by sending a message.
                    </div>
                  )}
                </div>
                <form onSubmit={sendHelpdesk} className="mt-2 flex gap-2">
                  <input
                    className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ask a question about RIB 4.0…"
                    value={helpdeskText}
                    onChange={(e) => setHelpdeskText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserDashboard;
