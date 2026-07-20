import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCurrentUser, clearSessionCookie, getSessionCookie } from "~/auth";
import { runMigrations } from "~/db/schema";

export const Route = createFileRoute("/app")({
  loader: async () => {
    // Run migrations on first app page load
    await runMigrations();
    return null;
  },
  component: AppLayout,
});

type User = {
  id: string;
  email: string;
  created_at: string;
};

function AppLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const isAuthPage =
    pathname === "/app/login" || pathname === "/app/signup";

  useEffect(() => {
    // Check for session cookie first (fast path)
    const cookie = getSessionCookie();
    if (!cookie && !isAuthPage) {
      setLoading(false);
      navigate({ to: "/app/login" });
      return;
    }
    if (!cookie && isAuthPage) {
      setLoading(false);
      return;
    }

    getCurrentUser().then((u) => {
      if (!u && !isAuthPage) {
        navigate({ to: "/app/login" });
      } else {
        setUser(u);
      }
      setLoading(false);
    });
  }, [pathname]);

  const handleLogout = () => {
    clearSessionCookie();
    setUser(null);
    navigate({ to: "/" });
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // Auth pages get a minimal wrapper
  if (isAuthPage) {
    return (
      <div className="min-h-dvh bg-slate-950 text-white antialiased">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-white antialiased">
      {/* App Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/app"
            className="flex items-center gap-2 text-lg font-bold text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-black text-slate-950">
              &#9670;
            </span>
            Diamond AI
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/app/upload"
              className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110"
            >
              New Analysis
            </Link>
            {user && (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-slate-400 sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Dashboard content when at /app, child routes via Outlet */}
      {pathname === "/app" ? <Dashboard user={user} /> : <Outlet />}
    </div>
  );
}

function Dashboard({ user }: { user: User | null }) {
  const [stats, setStats] = useState<{
    analyzedThisMonth: number;
    avgScore: number | null;
  } | null>(null);

  useEffect(() => {
    // In a real app, fetch stats from the server
    setStats({ analyzedThisMonth: 0, avgScore: null });
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Welcome back{user ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-2 text-slate-400">
          Improve your game with AI-powered video analysis.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
          <p className="text-sm font-medium text-slate-400">
            Videos Analyzed This Month
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats?.analyzedThisMonth ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6">
          <p className="text-sm font-medium text-slate-400">Average Score</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats?.avgScore != null ? `${stats.avgScore}/100` : "—"}
          </p>
        </div>
      </div>

      {/* Recent Analyses */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Recent Analyses
        </h2>
        <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-10 text-center">
          <svg
            className="mx-auto h-12 w-12 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-slate-300">
            No analyses yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Upload your first video to get AI-powered feedback on your technique.
          </p>
          <Link
            to="/app/upload"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Upload Video
          </Link>
        </div>
      </div>
    </main>
  );
}
