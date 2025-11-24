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

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const items = await api.user.listTickets();
      setTickets(items);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !text.trim()) return;

    try {
      setCreating(true);
      setError(null);
      const t = await api.user.createTicket(subject.trim(), priority, text.trim());
      // Reload list
      await load();
      setSubject("");
      setText("");
      setPriority("normal");
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout title="Support Tickets">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Support Tickets</h1>
          <p className="text-sm text-slate-400 mt-1">
            Report issues or request help. Our AI helpdesk can assist on top of these tickets later.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Create ticket */}
          <form
            onSubmit={handleCreate}
            className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
          >
            <div className="text-sm font-medium text-slate-50">
              New Ticket
            </div>
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

          {/* List */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-50">
                Your tickets
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="text-xs rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Reloading…" : "Reload"}
              </button>
            </div>
            {loading && (
              <div className="text-xs text-slate-400">Loading tickets…</div>
            )}
            {!loading && !tickets.length && (
              <div className="text-xs text-slate-400">
                No tickets yet. Create one on the left.
              </div>
            )}
            {!loading && tickets.length > 0 && (
              <div className="overflow-auto max-h-[480px]">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-800/60">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-300 border-b border-slate-700">
                        Subject
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-300 border-b border-slate-700">
                        Priority
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-300 border-b border-slate-700">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-300 border-b border-slate-700">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.ticket_id} className="odd:bg-slate-900 even:bg-slate-950">
                        <td className="px-3 py-2 border-b border-slate-800">
                          {t.subject}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-800">
                          {t.priority}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-800">
                          {t.status}
                        </td>
                        <td className="px-3 py-2 border-b border-slate-800">
                          {new Date(t.updated_at * 1000).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
