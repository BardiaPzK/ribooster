// frontend/src/pages/admin/AdminTickets.tsx
import React, { useEffect, useState } from "react";
import { api, Ticket } from "../../lib/api";

const AdminTickets: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<string>("open");
  const [priority, setPriority] = useState<string>("normal");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.admin
      .listTickets()
      .then((data) => setTickets(data))
      .catch((e: any) => setError(e?.message || "Failed to load tickets"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const current = tickets.find((t) => t.ticket_id === selectedId) || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    try {
      const payload: any = {};
      if (reply.trim()) payload.text = reply.trim();
      if (status) payload.status = status;
      if (priority) payload.priority = priority;
      const updated = await api.admin.replyTicket(current.ticket_id, payload);
      setReply("");
      setTickets((prev) =>
        prev.map((t) => (t.ticket_id === updated.ticket_id ? updated : t))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to update ticket");
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-lg font-semibold text-slate-100">Tickets</div>
      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="md:col-span-1 border border-slate-800 rounded-2xl bg-slate-900/70 max-h-72 overflow-auto">
          {loading ? (
            <div className="p-3 text-slate-500">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="p-3 text-slate-500">No tickets.</div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {tickets.map((t) => (
                <li
                  key={t.ticket_id}
                  className={`px-3 py-2 cursor-pointer ${
                    t.ticket_id === selectedId
                      ? "bg-slate-800 text-slate-100"
                      : "hover:bg-slate-800/60"
                  }`}
                  onClick={() => {
                    setSelectedId(t.ticket_id);
                    setStatus(t.status);
                    setPriority(t.priority);
                  }}
                >
                  <div className="font-medium">{t.subject}</div>
                  <div className="text-[10px] text-slate-400">
                    {t.priority.toUpperCase()} • {t.status}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Org: {t.org_name || t.org_id} • Company: {t.company_code || t.company_id} • User:{" "}
                    {t.username || t.user_id}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md:col-span-2 border border-slate-800 rounded-2xl bg-slate-900/70 p-3 flex flex-col">
          {current ? (
            <>
              <div className="mb-2">
                <div className="font-medium text-slate-100">
                  {current.subject}
                </div>
                <div className="text-[10px] text-slate-500">
                  Ticket #{current.ticket_id} • Org: {current.org_name || current.org_id} • Company:{" "}
                  {current.company_code || current.company_id} • User: {current.username || current.user_id}
                </div>
              </div>
              <div className="flex-1 overflow-auto border border-slate-800 rounded-lg p-2 bg-slate-950/60 space-y-1 mb-2">
                {current.messages.map((m) => (
                  <div
                    key={m.message_id}
                    className={`px-2 py-1 rounded-md max-w-[80%] ${
                      m.sender === "user"
                        ? "mr-auto bg-slate-800/80"
                        : "ml-auto bg-indigo-600/70 text-right"
                    }`}
                  >
                    <div className="text-[10px] text-slate-300 mb-0.5">
                      {m.sender === "user" ? "User" : "Admin"}
                    </div>
                    <div>{m.text}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-2">
                <div className="flex gap-2">
                  <select
                    className="w-28 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-indigo-500"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="done">done</option>
                  </select>
                  <select
                    className="w-28 rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-indigo-500"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="low">low</option>
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                  </select>
                </div>
                <textarea
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={2}
                  placeholder="Reply to user..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-3 py-1.5"
                  >
                    Send reply
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="text-slate-500 text-xs">
              Select a ticket from the list.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTickets;
