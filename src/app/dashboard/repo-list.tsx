"use client";

import { useState, useTransition } from "react";
import { connectRepo, enableWebhook, ConnectableRepo } from "./actions";

export interface ConnectedRepoInfo {
  id: string;
  githubRepoId: number;
  fullName: string;
  webhookId: number | null;
}

interface RepoListProps {
  repos: ConnectableRepo[];
  initialConnectedRepos: ConnectedRepoInfo[];
}

export function RepoList({ repos, initialConnectedRepos }: RepoListProps) {
  const [connectedRepos, setConnectedRepos] = useState<Record<number, ConnectedRepoInfo>>(() => {
    const map: Record<number, ConnectedRepoInfo> = {};
    for (const r of initialConnectedRepos) {
      map[r.githubRepoId] = r;
    }
    return map;
  });

  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionInProgress, setActionInProgress] = useState<{
    type: "connect" | "webhook";
    repoId: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredRepos = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = (repo: ConnectableRepo) => {
    setErrorMessage(null);
    setActionInProgress({ type: "connect", repoId: repo.id });

    startTransition(async () => {
      try {
        const result = await connectRepo(repo.id, repo.full_name);
        if (result.connectedRepo) {
          setConnectedRepos((prev) => ({
            ...prev,
            [repo.id]: {
              id: result.connectedRepo.id,
              githubRepoId: result.connectedRepo.githubRepoId,
              fullName: result.connectedRepo.fullName,
              webhookId: result.connectedRepo.webhookId,
            },
          }));
        }
      } catch (err) {
        console.error("Failed to connect repository:", err);
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to connect repository. Try again."
        );
      } finally {
        setActionInProgress(null);
      }
    });
  };

  const handleEnableWebhook = (connectedInfo: ConnectedRepoInfo) => {
    setErrorMessage(null);
    setActionInProgress({ type: "webhook", repoId: connectedInfo.githubRepoId });

    startTransition(async () => {
      try {
        const result = await enableWebhook(connectedInfo.id);
        if (result.success) {
          setConnectedRepos((prev) => ({
            ...prev,
            [connectedInfo.githubRepoId]: {
              ...connectedInfo,
              webhookId: result.webhookId ?? null,
            },
          }));
        }
      } catch (err) {
        console.error("Failed to enable webhook:", err);
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to enable webhook on GitHub. Ensure permissions are sufficient."
        );
      } finally {
        setActionInProgress(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Filter repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
          Showing {filteredRepos.length} of {repos.length} admin repos
        </div>
      </div>

      {/* Repositories List */}
      <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        {filteredRepos.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {search ? "No repositories match your search." : "No repositories found with admin permissions."}
          </div>
        ) : (
          filteredRepos.map((repo) => {
            const connectedInfo = connectedRepos[repo.id];
            const isConnected = Boolean(connectedInfo);
            const hasWebhook = Boolean(connectedInfo?.webhookId);

            const isConnecting =
              isPending &&
              actionInProgress?.type === "connect" &&
              actionInProgress.repoId === repo.id;

            const isEnablingWebhook =
              isPending &&
              actionInProgress?.type === "webhook" &&
              actionInProgress.repoId === repo.id;

            return (
              <div
                key={repo.id}
                className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      hasWebhook
                        ? "bg-emerald-400 shadow-sm shadow-emerald-500/50"
                        : isConnected
                        ? "bg-indigo-400 shadow-sm shadow-indigo-500/50"
                        : "bg-slate-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100 truncate text-sm">
                        {repo.full_name}
                      </span>
                      {repo.private ? (
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Private
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Public
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {!isConnected ? (
                    <button
                      onClick={() => handleConnect(repo)}
                      disabled={isConnecting}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
                    >
                      {isConnecting ? "Connecting..." : "Connect"}
                    </button>
                  ) : hasWebhook ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Webhook active
                      </span>
                      <button
                        onClick={() => handleEnableWebhook(connectedInfo)}
                        disabled={isEnablingWebhook}
                        title="Re-sync webhook URL & settings on GitHub"
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isEnablingWebhook ? "Syncing..." : "Re-sync"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-indigo-400 font-medium hidden sm:inline">
                        Connected
                      </span>
                      <button
                        onClick={() => handleEnableWebhook(connectedInfo)}
                        disabled={isEnablingWebhook}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 hover:border-indigo-500/60 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        {isEnablingWebhook ? "Enabling..." : "Enable Webhook"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
