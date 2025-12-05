// frontend/src/pages/user/Helpdesk.tsx
import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";

type HelpdeskMessage = {
  message_id: string;
  timestamp: number;
  sender: string;
  text: string;
};

type HelpdeskConversation = {
  conversation_id: string;
  updated_at: number;
  messages: HelpdeskMessage[];
};

const Helpdesk: React.FC = () => {
  const [conversations, setConversations] = useState<HelpdeskConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<HelpdeskConversation | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (keepSelection = false) => {
    try {
      setLoading(true);
      const items = await api.user.helpdesk.listConversations();
      setConversations(items as HelpdeskConversation[]);
      const first = items[0];
      if (!keepSelection && first) {
        setSelectedId(first.conversation_id);
        setSelected(first as HelpdeskConversation);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      setSending(true);
      const payload: any = { text: text.trim() };
      if (selectedId) payload.conversation_id = selectedId;
      const conv = await api.user.helpdesk.chat(payload);
      setSelected(conv as HelpdeskConversation);
      setSelectedId(conv.conversation_id);
      setText("");
      await load(true);
    } catch (e: any) {
      setError(e.message || "Helpdesk request failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-50">
        <div>
          <h1 className="text-xl font-semibold">RIB Helpdesk</h1>
          <p className="text-sm text-slate-400 mt-1">Chat with the AI helpdesk or continue an existing thread.</p>
        </div>

        {error && <div className="text-xs text-red-300 bg-red-950/40 border border-red-900 rounded px-3 py-2">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Conversations</span>
              <button
                className="text-xs text-indigo-300"
                onClick={() => load(true)}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {conversations.map((c) => (
                <div
                  key={c.conversation_id}
                  onClick={() => {
                    setSelectedId(c.conversation_id);
                    setSelected(c);
                  }}
                  className={`p-2 rounded-lg cursor-pointer border ${
                    selectedId === c.conversation_id
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 bg-slate-950 hover:bg-slate-900"
                  }`}
                >
                  <div className="text-xs text-slate-200">Conversation {c.conversation_id.slice(0, 6)}</div>
                  <div className="text-[11px] text-slate-400">
                    Updated {new Date(c.updated_at * 1000).toLocaleString()}
                  </div>
                </div>
              ))}
              {!conversations.length && <div className="text-xs text-slate-500">No conversations yet.</div>}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-3 min-h-[480px]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Chat</div>
              <button
                className="text-xs text-amber-300"
                onClick={() => {
                  setSelectedId(null);
                  setSelected(null);
                }}
              >
                New thread
              </button>
            </div>
            <div className="flex-1 overflow-auto space-y-2">
              {selected?.messages?.map((m) => (
                <div
                  key={m.message_id}
                  className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      m.sender === "user" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="text-[11px] text-slate-200/80 mb-1">
                      {new Date(m.timestamp * 1000).toLocaleString()}
                    </div>
                    <div>{m.text}</div>
                  </div>
                </div>
              ))}
              {!selected && <div className="text-xs text-slate-500">Start a new question to begin chatting.</div>}
            </div>

            <form onSubmit={send} className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 resize-none"
                rows={3}
                placeholder="Ask the helpdesk…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Helpdesk;
