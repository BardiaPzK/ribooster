// frontend/src/pages/user/UserTickets.tsx
import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { api, TicketListItem, Ticket } from "../../lib/api";

const priorities = ["low", "normal", "high", "urgent"] as const;

export default function UserTickets() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [text, setText] = useState("");

  const [creating, setCreating] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  async function load(listOnly = false) {
    try {
      setLoading(true);
      setError(null);
      const items = await api.user.listTickets();
      setTickets(items);
      const hasTickets = items.length > 0;
      const keepSelected = selectedId && items.some((i) => i.ticket_id === selectedId);

      if (listOnly) {
        const idToRefresh = keepSelected ? selectedId : items[0]?.ticket_id;
        if (idToRefresh) {
          await loadTicket(idToRefresh);
        } else {
          setSelectedId(null);
          setSelectedTicket(null);
        }
        return;
      }

      const firstId = hasTickets ? items[0].ticket_id : null;
      if (firstId) {
        await loadTicket(firstId);
      } else {
        setSelectedId(null);
        setSelectedTicket(null);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  async function loadTicket(id: string) {
    try {
      setSelectedId(id);
      const full = await api.user.getTicket(id);
      setSelectedTicket(full);
      setReplyText("");
    } catch (e: any) {
      setError(e.message || "Failed to load ticket");
    }
  }

  // Background refresh for the selected ticket so new admin replies appear without manual reloads
  async function refreshSelectedTicket() {
    if (!selectedId) return;
    try {
      const [full, list] = await Promise.all([
        api.user.getTicket(selectedId),
        api.user.listTickets(),
      ]);
      setSelectedTicket(full);
      setTickets(list);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const handle = setInterval(() => {
      refreshSelectedTicket();
    }, 8000);
    return () => clearInterval(handle);
  }, [selectedId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !text.trim()) return;

    try {
      setCreating(true);
      setError(null);
      await api.user.createTicket(subject.trim(), priority, text.trim());
      setSubject("");
      setText("");
      setPriority("normal");
      await load();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    try {
      setReplying(true);
      const updated = await api.user.replyTicket(selectedId, replyText.trim());
      setSelectedTicket(updated);
      setReplyText("");
      await load(true);
    } catch (e: any) {
      setError(e.message || "Failed to send reply");
    } finally {
      setReplying(false);
    }
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-50">
        <div>
          <h1 className="text-xl font-semibold">Support Tickets</h1>
          <p className="text-sm text-slate-400 mt-1">
            Report issues or request help. Chat history stays attached to each ticket.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Create ticket */}
          <form
            onSubmit={handleCreate}
            className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
          >
            <div className="text-sm font-medium text-slate-50">New Ticket</div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Subject</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Priority</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Message</label>
              <textarea
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 resize-none"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe your issue or question…"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !subject.trim() || !text.trim()}
              className="w-full rounded-lg bg-indigo-600 text-slate-50 text-sm font-medium py-2.5 hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create ticket"}
            </button>
          </form>

          {/* List + messages */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-100">Your tickets</div>
                <button
                  onClick={() => load(true)}
                  disabled={loading}
                  className="text-xs rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? "Reloading…" : "Reload"}
                </button>
              </div>
              {loading && <div className="text-xs text-slate-400">Loading tickets…</div>}
              {!loading && !tickets.length && (
                <div className="text-xs text-slate-400">No tickets yet. Create one on the left.</div>
              )}
              {!loading && tickets.length > 0 && (
                <div className="overflow-auto max-h-[420px] rounded-xl border border-slate-800 divide-y divide-slate-800">
                  {tickets.map((t) => (
                    <div
                      key={t.ticket_id}
                      onClick={() => loadTicket(t.ticket_id)}
                      className={`px-3 py-2 cursor-pointer ${
                        selectedId === t.ticket_id ? "bg-slate-800/70" : "hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm text-slate-50">
                        <span className="font-semibold">{t.subject}</span>
                        <span className="text-[11px] text-slate-400">{t.priority}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Status: {t.status}</span>
                        <span>{new Date(t.updated_at * 1000).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex flex-col gap-3 min-h-[420px]">
              <div className="text-sm font-semibold text-slate-100">Conversation</div>
              {!selectedTicket && (
                <div className="text-xs text-slate-400">Select a ticket to view messages.</div>
              )}
              {selectedTicket && (
                <>
                  <div className="text-xs text-slate-400">
                    Subject: {selectedTicket.subject} · Priority: {selectedTicket.priority}
                  </div>
                  <div className="flex-1 overflow-auto space-y-2">
                    {selectedTicket.messages.map((m) => (
                      <div
                        key={m.message_id}
                        className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                            m.sender === "user"
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-800 text-slate-100"
                          }`}
                        >
                          <div className="text-[11px] text-slate-200/80 mb-1">
                            {new Date(m.timestamp * 1000).toLocaleString()}
                          </div>
                          <div>{m.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={sendReply} className="space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 resize-none"
                      rows={3}
                      placeholder="Reply to admin…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={replying || !replyText.trim()}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {replying ? "Sending…" : "Send reply"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
