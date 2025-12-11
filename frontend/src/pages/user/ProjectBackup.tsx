// frontend/src/pages/user/ProjectBackup.tsx
import React, { useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";

type Project = {
  id: string;
  name: string;
};

type BackupJob = {
  job_id: string;
  org_id: string;
  company_id: string;
  user_id: string;
  project_id: string;
  project_name: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  created_at: number;
  updated_at: number;
  log: string[];
  options: Record<string, any>;
  progress?: number;
};

const ProjectBackup: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");

  const [includeEstimates, setIncludeEstimates] = useState(true);
  const [includeLineitems, setIncludeLineitems] = useState(true);
  const [includeResources, setIncludeResources] = useState(true);
  const [includeActivities, setIncludeActivities] = useState(true);

  const [job, setJob] = useState<BackupJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setProjectsError(null);
    try {
      const items = await api.projects.list();
      setProjects(items as Project[]);
      if (items.length > 0 && !selectedProjectId) {
        setSelectedProjectId(items[0].id);
        setSelectedProjectName(items[0].name);
      }
    } catch (e: any) {
      setProjectsError(e.message ?? "Failed to load projects.");
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      setPolling(false);
      return;
    }
    setPolling(true);
    const handle = setInterval(async () => {
      try {
        const fresh = (await api.projects.getBackup(job.job_id)) as BackupJob;
        setJob(fresh);
      } catch (e: any) {
        setJobError(e.message ?? "Failed to refresh job status");
      }
    }, 1400);
    return () => {
      clearInterval(handle);
      setPolling(false);
    };
  }, [job?.job_id, job?.status]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [job?.log]);

  const jobInProgress = !!job && job.status !== "completed" && job.status !== "failed";
  const progress = Math.max(
    0,
    Math.min(
      100,
      job?.progress ??
        (typeof job?.options?.progress === "number" ? (job?.options?.progress as number) : 0)
    )
  );
  const lastLog =
    job?.log && job.log.length > 0
      ? job.log[job.log.length - 1].replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "")
      : null;

  const startBackup = async () => {
    if (!selectedProjectId || !selectedProjectName) return;
    setStarting(true);
    setJobError(null);
    try {
      const jobResp = await api.projects.startBackup({
        project_id: selectedProjectId,
        project_name: selectedProjectName,
        include_estimates: includeEstimates,
        include_lineitems: includeLineitems,
        include_resources: includeResources,
        include_activities: includeActivities,
      });
      setJob(jobResp as BackupJob);
    } catch (e: any) {
      setJobError(e.message ?? "Failed to start backup");
    } finally {
      setStarting(false);
    }
  };

  const downloadBackup = async () => {
    if (!job || job.status !== "completed") return;
    setDownloading(true);
    setJobError(null);
    try {
      const blob = await api.projects.downloadBackup(job.job_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${(job.project_name || job.project_id).replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setJobError(e.message ?? "Failed to download backup");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 text-slate-50 bg-slate-950 min-h-screen">
        <div>
          <h1 className="text-xl font-semibold">Project Backup</h1>
          <p className="text-sm text-slate-400 mt-1">
            Load projects from your RIB server, configure backup scope, and run a job with live progress.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Project list */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-sm font-medium">
              <span>Projects</span>
              <button
                onClick={loadProjects}
                className="text-xs text-indigo-300 hover:text-indigo-200"
                disabled={loadingProjects}
              >
                {loadingProjects ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="flex-1 overflow-auto max-h-[60vh] lg:max-h-[70vh]">
              {loadingProjects && <div className="p-4 text-xs text-slate-400">Loading...</div>}
              {!loadingProjects && projectsError && (
                <div className="p-4 text-xs text-red-300 bg-red-950/40 border-b border-red-900">
                  {projectsError}
                </div>
              )}
              {!loadingProjects && projects.length === 0 && !projectsError && (
                <div className="p-4 text-xs text-slate-400">No projects returned from RIB.</div>
              )}
              <ul className="divide-y divide-slate-800">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className={`px-4 py-2 text-sm cursor-pointer ${
                      selectedProjectId === p.id
                        ? "bg-indigo-600/20 text-indigo-100"
                        : "hover:bg-slate-800"
                    }`}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setSelectedProjectName(p.name);
                    }}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-400 truncate">ID: {p.id}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Options + actions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="text-sm font-medium text-slate-100 mb-2">Backup Options</div>
              <p className="text-xs text-slate-400 mb-3">
                Choose which modules to include. The job will log each step and show live progress.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeEstimates}
                    onChange={(e) => setIncludeEstimates(e.target.checked)}
                  />
                  <span>Include estimates (EST)</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeLineitems}
                    onChange={(e) => setIncludeLineitems(e.target.checked)}
                  />
                  <span>Include line items</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeResources}
                    onChange={(e) => setIncludeResources(e.target.checked)}
                  />
                  <span>Include resources</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeActivities}
                    onChange={(e) => setIncludeActivities(e.target.checked)}
                  />
                  <span>Include activities / schedule</span>
                </label>
              </div>

              <button
                onClick={startBackup}
                disabled={starting || !selectedProjectId || jobInProgress}
                className="mt-4 rounded-lg bg-indigo-600 text-white text-sm px-4 py-2 hover:bg-indigo-500 disabled:opacity-60"
              >
                {starting
                  ? "Starting backup..."
                  : jobInProgress
                  ? "Backup running..."
                  : "Start Backup"}
              </button>
              {jobError && <div className="mt-2 text-xs text-red-300">{jobError}</div>}
            </div>

            {/* Job result */}
            {job && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-100">Last Backup Job</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Project: {job.project_name} (ID: {job.project_id})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200 capitalize">
                      Status: {job.status}
                      {polling && jobInProgress && <span className="ml-1 text-amber-300">...</span>}
                    </div>
                    {job.status === "completed" && (
                      <button
                        onClick={downloadBackup}
                        disabled={downloading}
                        className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
                      >
                        {downloading ? "Preparing..." : "Download ZIP"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Created {new Date(job.created_at * 1000).toLocaleString()} | Updated{" "}
                  {new Date(job.updated_at * 1000).toLocaleString()}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Progress</span>
                    <span className="font-semibold text-indigo-200">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-blue-400 to-cyan-400 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {lastLog && (
                    <div className="text-[12px] text-slate-300">
                      Current step: <span className="text-indigo-200">{lastLog}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="text-slate-300 flex items-center justify-between">
                    <span>Job log</span>
                    {jobInProgress && <span className="text-amber-300">Updating...</span>}
                  </div>
                  <div
                    ref={logsRef}
                    className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-2 text-slate-200 max-h-64 overflow-auto space-y-2"
                  >
                    {job.log && job.log.length > 0 ? (
                      job.log.map((line, idx) => (
                        <div key={idx} className="text-[12px]">
                          {line}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500">No logs yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectBackup;
