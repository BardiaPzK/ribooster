// frontend/src/pages/user/UserTickets.tsx
import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";

type TicketMessage = {
  message_id: string;
  timestamp: number;
  sender: "user" | "admin" | "ai" | string;
  text: string;
};

type Ticket = {
  ticket_id: string;
  subject: string;
  priority: "low" | "normal" | "high" | "urgent" | string;
  status: "open" | "in_progress" | "done" | string;
  created_at: number;
  updated_at: number;
  messages: TicketMessage[];
};

type TicketListItem = {
  ticket_id: string;
  subject: string;
  priority: string;
  status: string;
  created_at: number;
  updated_at: number;
};

const formatTs = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

const UserTickets: React.FC = () => {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newText, setNewText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load ticket list
  const loadList = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/user/tickets");
      if (!res.ok) throw new Error(`List tickets failed: ${res.status}`);
      const items: TicketListItem[] = await res.json();
      setTickets(items);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to load tickets");
    } finally {
      setLoadingList(false);
    }
  };

  // Load ticket details
  const loadTicket = async (id: string) => {
    setLoadingTicket(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/tickets/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`Load ticket failed: ${res.status}`);
      const t: Ticket = await res.json();
      setSelectedTicket(t);
      setReplyText("");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to load ticket");
    } finally {
      setLoadingTicket(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadTicket(selectedId);
    } else {
      setSelectedTicket(null);
    }
  }, [selectedId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newText.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/user/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim(),
          priority: newPriority,
          text: newText.trim(),
        }),
      });
      if (!res.ok) throw new Error(`Create ticket failed: ${res.status}`);
      const t: Ticket = await res.json();
      setNewSubject("");
      setNewText("");
      setNewPriority("normal");
      await loadList();
      setSelectedId(t.ticket_id);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/user/tickets/${encodeURIComponent(
          selectedTicket.ticket_id
        )}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: replyText.trim() }),
        }
      );
      if (!res.ok) throw new Error(`Reply failed: ${res.status}`);
      const t: Ticket = await res.json();
      setSelectedTicket(t);
      await loadList();
      setReplyText("");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to send reply");
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]"> {/* 64px ~ header in Layout */}
        {/* Left: ticket list + new ticket */}
        <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
          <div className="p-4 border-b border-slate-200">
            <h1 className="text-lg font-semibold text-slate-900">
              Support Tickets
            </h1>
            <p className="text-xs text-slate-500">
              Create a new ticket or open an existing conversation.
            </p>
          </div>

          <div className="flex-1 overflow-auto">
            {loadingList && (
              <div className="p-3 text-xs text-slate-500">Loading…</div>
            )}
            {!loadingList && tickets.length === 0 && (
              <div className="p-3 text-xs text-slate-500">
                No tickets yet. Create your first ticket below.
              </div>
            )}
            <ul className="divide-y divide-slate-200">
              {tickets.map((t) => (
                <li
                  key={t.ticket_id}
                  className={`px-3 py-2 text-sm cursor-pointer ${
                    selectedId === t.ticket_id
                      ? "bg-white"
                      : "hover:bg-slate-100"
                  }`}
                  onClick={() => setSelectedId(t.ticket_id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {t.subject}
                    </span>
                    <span className="text-[10px] uppercase text-slate-500 ml-2">
                      {t.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {t.priority.toUpperCase()} · {formatTs(t.updated_at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* New ticket form (small, compact) */}
          <div className="border-t border-slate-200 p-3 bg-white">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              New Ticket
            </div>
            <form className="space-y-2" onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="Subject"
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <select
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                value={newPriority}
                onChange={(e) =>
                  setNewPriority(e.target.value as typeof newPriority)
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <textarea
                placeholder="Describe your issue…"
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs resize-none"
                rows={3}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded bg-blue-600 text-white text-xs py-1.5 hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create Ticket"}
              </button>
            </form>
          </div>
        </div>

        {/* Right: chat view */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedTicket ? selectedTicket.subject : "No ticket selected"}
              </div>
              {selectedTicket && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Status:{" "}
                  <span className="font-medium">{selectedTicket.status}</span>{" "}
                  · Priority:{" "}
                  <span className="font-medium">{selectedTicket.priority}</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="px-6 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
            {loadingTicket && selectedId && (
              <div className="text-xs text-slate-500">Loading ticket…</div>
            )}

            {!selectedTicket && !loadingTicket && (
              <div className="text-xs text-slate-500">
                Select a ticket on the left to view the conversation.
              </div>
            )}

            {selectedTicket &&
              selectedTicket.messages.map((m) => {
                const isUser = m.sender === "user";
                const isAdmin = m.sender === "admin";
                const isAi = m.sender === "ai";

                const label = isUser
                  ? "You"
                  : isAdmin
                  ? "Support"
                  : isAi
                  ? "AI Assistant"
                  : m.sender;

                return (
                  <div
                    key={m.message_id}
                    className={`flex ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-xs shadow-sm ${
                        isUser
                          ? "bg-blue-600 text-white"
                          : isAi
                          ? "bg-slate-900 text-slate-50"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <div className="text-[10px] opacity-80 mb-0.5">
                        {label} · {formatTs(m.timestamp)}
                      </div>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Reply box */}
          {selectedTicket && (
            <form
              className="border-t border-slate-200 px-4 py-3 flex items-end gap-2"
              onSubmit={handleReply}
            >
              <textarea
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm resize-none"
                rows={2}
                placeholder="Write a reply to support…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="rounded bg-blue-600 text-white text-sm px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UserTickets;
