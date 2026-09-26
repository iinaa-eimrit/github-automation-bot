import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getConnectableRepos } from "./actions";
import { RepoList } from "./repo-list";

export default async function DashboardPage() {
  const session = await auth();

  // Server-side authentication check
  if (!session?.user) {
    redirect("/");
  }

  // Find user in database
  let dbUser = null;
  if (session.user.githubId) {
    dbUser = await db.user.findUnique({
      where: { githubId: session.user.githubId },
      include: {
        connectedRepos: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  const connectedRepos = dbUser?.connectedRepos || [];
  const activeWebhooksCount = connectedRepos.filter((r) => r.webhookId !== null).length;

  let connectableRepos: Array<{ id: number; full_name: string; private: boolean }> = [];
  let fetchError: string | null = null;

  try {
    connectableRepos = await getConnectableRepos();
  } catch (error) {
    console.error("Failed to load connectable repos:", error);
    fetchError =
      error instanceof Error
        ? error.message
        : "Failed to load repositories from GitHub. Please try signing out and signing back in.";
  }

  const initialConnectedRepos = connectedRepos.map((r) => ({
    id: r.id,
    githubRepoId: r.githubRepoId,
    fullName: r.fullName,
    webhookId: r.webhookId,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
            GH
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-white tracking-tight leading-none">
              Automation Bot
            </span>
            <span className="text-[11px] text-slate-400 mt-1">Repository Management</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name || "User Avatar"}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              />
            )}
            <span className="text-sm font-medium text-slate-200">
              {session.user.name || session.user.email}
            </span>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        {/* Milestone Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Piece 4 Active
            </span>
            <span className="text-xs text-slate-400">Webhook Endpoint &amp; Signature Verification</span>
          </div>
          <Link
            href="/"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Connected Repositories
            </span>
            <span className="text-2xl font-bold text-white">{connectedRepos.length}</span>
            <span className="text-xs text-slate-500">Persisted in Neon PostgreSQL</span>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Active Webhooks
            </span>
            <span className="text-2xl font-bold text-emerald-400">{activeWebhooksCount}</span>
            <span className="text-xs text-slate-500">Listening for GitHub events</span>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Database Status
            </span>
            <span className="text-2xl font-bold text-indigo-400">Online</span>
            <span className="text-xs text-slate-500">Prisma schema synchronized</span>
          </div>
        </div>

        {/* Error Banner if GitHub Fetch Failed */}
        {fetchError && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            {fetchError}
          </div>
        )}

        {/* Repositories Section */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col gap-6">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              GitHub Repositories &amp; Webhooks
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Connect repositories and enable automated webhooks. When enabled, GitHub will dispatch <code className="text-indigo-300">issues</code> and <code className="text-indigo-300">pull_request</code> events directly to our verified webhook endpoint.
            </p>
          </div>

          <RepoList
            repos={connectableRepos}
            initialConnectedRepos={initialConnectedRepos}
          />
        </div>
      </main>
    </div>
  );
}
