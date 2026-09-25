import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  // Server-side authentication check
  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
            GH
          </div>
          <span className="font-semibold text-white tracking-tight">
            Automation Dashboard
          </span>
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
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Piece 2 Completed
            </span>
            <span className="text-xs text-slate-400">Server-side Authenticated</span>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Welcome, {session.user.name || "Developer"}!
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            You are securely signed in via GitHub OAuth. Upcoming pieces will allow connecting your repositories, configuring event triage rules, and monitoring real-time activity.
          </p>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              &larr; Back to Homepage
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
