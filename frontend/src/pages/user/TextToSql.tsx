// frontend/src/pages/user/TextToSql.tsx
import React, { useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";

type RunResult = {
  sql: string;
  rows?: any[];
  columns?: string[];
  error?: string;
};

const TextToSql: React.FC = () => {
  const [dbHost, setDbHost] = useState("");
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [question, setQuestion] = useState("");

  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.user.textsqlRun({
        db_host: dbHost,
        db_name: dbName,
        db_user: dbUser,
        db_password: dbPassword,
        question,
      });
      setResult(res as RunResult);
    } catch (e: any) {
      setError(e.message ?? "Failed to run query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-50">
        <div>
          <h1 className="text-xl font-semibold">Text to SQL (beta)</h1>
          <p className="text-sm text-slate-400 mt-1">
            Describe what you need. We generate SQL, execute it, and show the results.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Connection + question */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-100 mb-1">Database Connection</div>
              <p className="text-xs text-slate-400 mb-3">
                Credentials stay in your browser and are only used for this request.
              </p>
              <div className="space-y-2 text-sm">
                <input
                  type="text"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Host (e.g. JBI16P1BY3\\SQLEXPRESS01)"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Database name"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="DB username"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                />
                <input
                  type="password"
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="DB password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                />
              </div>
            </div>

            <form onSubmit={handleRun} className="space-y-2">
              <div>
                <div className="text-sm font-medium text-slate-100 mb-1">Question</div>
                <textarea
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm resize-none"
                  rows={4}
                  placeholder="Example: Show total costs per Hauptkostenart for 2024, grouped by month."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={
                  loading ||
                  !dbHost.trim() ||
                  !dbName.trim() ||
                  !dbUser.trim() ||
                  !dbPassword.trim() ||
                  !question.trim()
                }
                className="w-full rounded bg-indigo-600 text-white text-sm py-2 hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Generating & running…" : "Generate SQL & Run"}
              </button>
            </form>

            {error && (
              <div className="text-xs text-red-300 bg-red-950/40 border border-red-900 rounded p-2">{error}</div>
            )}
          </div>

          {/* Result: SQL + table */}
          <div className="lg:col-span-2 space-y-4">
            {result && (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="text-sm font-medium text-slate-100 mb-2">Generated SQL</div>
                  <pre className="text-xs bg-slate-950 text-slate-50 rounded p-3 overflow-auto">{result.sql}</pre>
                </div>

                {result.error && (
                  <div className="rounded-2xl border border-red-900 bg-red-950/40 p-3 text-xs text-red-200">
                    Error while executing SQL: {result.error}
                  </div>
                )}

                {result.rows && result.rows.length > 0 && result.columns && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="text-sm font-medium text-slate-100 mb-2">
                      Query Result ({result.rows.length} row{result.rows.length === 1 ? "" : "s"})
                    </div>
                    <div className="overflow-auto max-h-[500px] border border-slate-800 rounded">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-800">
                          <tr>
                            {result.columns.map((c) => (
                              <th
                                key={c}
                                className="px-2 py-1 text-left font-semibold text-slate-200 border-b border-slate-700"
                              >
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((row, idx) => (
                            <tr key={idx} className="odd:bg-slate-900 even:bg-slate-950">
                              {result.columns!.map((c) => (
                                <td key={c} className="px-2 py-1 border-b border-slate-800">
                                  {String(row[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TextToSql;
