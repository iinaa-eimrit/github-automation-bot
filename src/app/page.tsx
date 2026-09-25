import { auth, signIn, signOut } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-radial from-slate-900 via-slate-950 to-black text-slate-100">
      <div className="w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl flex flex-col items-center text-center">
        {/* Logo / Icon */}
        <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg
            className="w-9 h-9 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          GitHub Automation Bot
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          Event-driven automation connecting GitHub repository events to automated actions and Slack alerts.
        </p>

        {!session?.user ? (
          <div className="w-full flex flex-col gap-4">
            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: "/" });
              }}
              className="w-full"
            >
              <button
                type="submit"
                id="sign-in-button"
                className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Sign in with GitHub</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || "User Avatar"}
                  className="w-20 h-20 rounded-full border-2 border-indigo-500 shadow-md object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-indigo-500 flex items-center justify-center text-xl font-bold text-indigo-300">
                  {session.user.name ? session.user.name[0].toUpperCase() : "U"}
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-semibold text-white">
                  {session.user.name || "GitHub User"}
                </p>
                {session.user.email && (
                  <p className="text-xs text-slate-400">{session.user.email}</p>
                )}
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Authenticated
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3">
              <Link
                href="/dashboard"
                id="dashboard-link"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-md"
              >
                Go to Dashboard &rarr;
              </Link>

              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
                className="w-full"
              >
                <button
                  type="submit"
                  id="sign-out-button"
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors border border-slate-700"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
