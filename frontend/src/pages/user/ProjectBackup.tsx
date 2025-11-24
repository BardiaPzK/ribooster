// frontend/src/pages/user/ProjectBackup.tsx
import React, { useEffect, useState } from "react";
import Layout from "../../components/Layout";

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
};

const ProjectBackup: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedProjectName, setSelectedProjectName] = useState<string>("");

  const [includeEstimates, setIncludeEstimates] = useState(true);
  const [includeLineitems, setIncludeLineitems] = useState(true);
  const [includeResources, setIncludeResources] = useState(true);
  const [includeActivities, setIncludeActivities] = useState(true);

  const [job, setJob] = useState<BackupJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setProjectsError(null);
    try {
      const res = await fetch("/api/user/projects");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          text || `Failed to load projects (status ${res.status})`
        );
      }
      const items: Project[] = await res.json();
      setProjects(items);
      if (items.length > 0 && !selectedProjectId) {
        setSelectedProjectId(items[0].id);
        setSelectedProjectName(items[0].name);
      }
    } catch (e: any) {
      console.error(e);
      setProjectsError(
        e.message ??
          "Failed to load projects. (This can also be caused by RIB environment access schedule.)"
      );
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const startBackup = async () => {
    if (!selectedProjectId || !selectedProjectName) return;
    setStarting(true);
    setJobError(null);
    try {
      const res = await fetch("/api/user/projects/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProjectId,
          project_name: selectedProjectName,
          include_estimates: includeEstimates,
          include_lineitems: includeLineitems,
          include_resources: includeResources,
          include_activities: includeActivities,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Backup failed (status ${res.status})`);
      }
      const job: BackupJob = await res.json();
      setJob(job);
    } catch (e: any) {
      console.error(e);
      setJobError(e.message ?? "Failed to start backup");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Project Backup
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Select a RIB project and create a structured backup (projects,
            estimates, line items, resources, activities).
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Project list */}
          <div className="lg:col-span-1 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">
                Projects
              </span>
              <button
                className="text-xs text-blue-600 hover:underline"
                onClick={loadProjects}
                disabled={loadingProjects}
              >
                {loadingProjects ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {projectsError && (
              <div className="px-4 py-3 text-xs text-red-600 bg-red-50 border-b border-red-100">
                {projectsError}
              </div>
            )}
            <div className="flex-1 overflow-auto">
              {loadingProjects && (
                <div className="p-4 text-xs text-slate-500">Loading…</div>
              )}
              {!loadingProjects && projects.length === 0 && !projectsError && (
                <div className="p-4 text-xs text-slate-500">
                  No projects returned from RIB. This can also happen when the
                  RIB environment is not accessible.
                </div>
              )}
              <ul className="divide-y divide-slate-200">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className={`px-4 py-2 text-sm cursor-pointer ${
                      selectedProjectId === p.id
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setSelectedProjectName(p.name);
                    }}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      ID: {p.id}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Options + actions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900 mb-2">
                Backup Options
              </div>
              <p className="text-xs text-slate-500 mb-3">
                You can choose which components to include in the backup. In
                later versions this can create a ZIP file with JSON / CSV
                exports for each module.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeEstimates}
                    onChange={(e) => setIncludeEstimates(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Include estimates (EST)</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeLineitems}
                    onChange={(e) => setIncludeLineitems(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Include line items</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeResources}
                    onChange={(e) => setIncludeResources(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Include resources</span>
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeActivities}
                    onChange={(e) => setIncludeActivities(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Include activities / schedule</span>
                </label>
              </div>

              <button
                onClick={startBackup}
                disabled={starting || !selectedProjectId}
                className="mt-4 rounded-md bg-blue-600 text-white text-sm px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
              >
                {starting ? "Starting backup…" : "Start Backup"}
              </button>
              {jobError && (
                <div className="mt-2 text-xs text-red-600">{jobError}</div>
              )}
            </div>

            {/* Job result */}
            {job && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      Last Backup Job
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Project: {job.project_name} (ID: {job.project_id})
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                    Status: {job.status}
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Created:{" "}
                  {new Date(job.created_at * 1000).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                  {" · "}
                  Updated:{" "}
                  {new Date(job.updated_at * 1000).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>

                {job.log && job.log.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <div className="text-xs font-semibold text-slate-700 mb-1">
                      Log
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1">
                      {job.log.map((line, idx) => (
                        <li key={idx}>• {line}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectBackup;
