import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { useEffect, useState } from "react";
import { getCurrentUser } from "~/auth";

// --- Server Functions ---

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "Diamond AI";
  } catch {
    return "Diamond AI";
  }
});

const submitWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { email?: string };
    if (!d.email || typeof d.email !== "string" || !d.email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    return { email: d.email.trim().toLowerCase() };
  })
  .handler(async ({ data }) => {
    const WAITLIST_PATH = "/home/team/shared/waitlist.json";
    const entry = { email: data.email, timestamp: new Date().toISOString() };

    let entries: typeof entry[] = [];
    if (existsSync(WAITLIST_PATH)) {
      try {
        entries = JSON.parse(await readFile(WAITLIST_PATH, "utf8"));
      } catch {
        entries = [];
      }
    }

    if (entries.some((e) => e.email === entry.email)) {
      return { success: true, message: "You're already on the list!" };
    }

    entries.push(entry);
    await writeFile(WAITLIST_PATH, JSON.stringify(entries, null, 2));
    return { success: true, message: "You're on the list! We'll be in touch." };
  });

// --- Route ---

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

// --- Components ---

function NavBar({ businessName }: { businessName: string }) {
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2 text-xl font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-slate-950">
            &#9670;
          </span>
          {businessName}
        </a>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-300 sm:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
        </div>
        {user ? (
          <Link
            to="/app"
            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:brightness-110"
          >
            Dashboard
          </Link>
        ) : (
          <a
            href="#waitlist"
            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:brightness-110"
          >
            Get Started
          </a>
        )}
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center px-4 pt-20 text-center">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
      </div>
      <span className="relative mb-6 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-400">
        AI-Powered Sports Coaching
      </span>
      <h1 className="relative max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
        Your Personal Softball &amp; Baseball Coach,{" "}
        <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
          Powered by AI
        </span>
      </h1>
      <p className="relative mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
        Film your swing, pitch, or catch from your phone. Get instant, detailed
        technique feedback — no expensive lessons, no schedule to keep.
      </p>
      <a
        href="#waitlist"
        className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3.5 text-lg font-semibold text-white shadow-xl shadow-blue-500/30 transition-all hover:shadow-blue-500/50 hover:brightness-110"
      >
        Try It Free
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </a>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
      ),
      title: "Record",
      desc: "Set up your phone, film your swing, pitch, or catch — no fancy equipment needed.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      ),
      title: "Analyze",
      desc: "Our AI breaks down your mechanics frame by frame — stance, rotation, path, and more.",
      gradient: "from-violet-500 to-purple-500",
    },
    {
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
      title: "Improve",
      desc: "Get actionable feedback and track your progress over time with side-by-side comparisons.",
      gradient: "from-emerald-500 to-green-500",
    },
  ];

  return (
    <section id="how-it-works" className="relative bg-slate-900/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Three simple steps from recording to results.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="relative rounded-2xl border border-white/5 bg-slate-900/80 p-8 text-center backdrop-blur-sm">
              <div className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-slate-400 ring-1 ring-white/10">
                {i + 1}
              </div>
              <div className={`mt-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.gradient} bg-opacity-10 p-3 text-white`}>
                {step.icon}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Swing Analysis",
      desc: "Detailed breakdown of stance, hip rotation, bat path, and follow-through.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
      ),
    },
    {
      title: "Pitching Mechanics",
      desc: "Arm angle, stride length, release point, and balance analysis for pitchers.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
        </svg>
      ),
    },
    {
      title: "Catching & Fielding",
      desc: "Footwork, glove position, transfer speed, and throwing mechanics analysis.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      ),
    },
    {
      title: "Progress Tracking",
      desc: "Compare videos side-by-side and see your improvement over time with detailed metrics.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      title: "Instant Results",
      desc: "Feedback in under 60 seconds — not days later. Learn and adjust while it's fresh.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Anywhere, Anytime",
      desc: "No appointments, no travel — just your phone and a few swings. Practice on your schedule.",
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything You Need to Level Up
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Pro-grade analysis tools that fit in your pocket.
          </p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-white/5 bg-slate-900/60 p-6 transition-all hover:border-blue-500/30 hover:bg-slate-900/80"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400 group-hover:from-blue-500/30 group-hover:to-cyan-500/30">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      desc: "Get started with AI-powered feedback.",
      features: ["3 analyses per month", "Basic feedback", "Single sport profile"],
      cta: "Get Started Free",
      gradient: "from-slate-600 to-slate-500",
      popular: false,
    },
    {
      name: "Pro",
      price: "$12",
      period: "/mo",
      desc: "Unlock the full Diamond AI experience.",
      features: [
        "Unlimited analyses",
        "Deep breakdowns",
        "Side-by-side comparisons",
        "Progress tracking",
        "Multi-sport support",
      ],
      cta: "Start Free Trial",
      gradient: "from-blue-500 to-cyan-500",
      popular: true,
    },
    {
      name: "Team / Coach",
      price: "$39",
      period: "/mo",
      desc: "For coaches and teams managing multiple athletes.",
      features: [
        "Everything in Pro",
        "Manage up to 20 players",
        "Aggregated progress reports",
        "Team dashboard",
        "Priority support",
      ],
      cta: "Start Free Trial",
      gradient: "from-violet-500 to-purple-500",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="relative bg-slate-900/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start free. Upgrade when you're ready for more.
          </p>
        </div>
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className={`relative flex flex-col rounded-2xl border p-8 backdrop-blur-sm ${
                tier.popular
                  ? "border-blue-500/40 bg-blue-500/5 shadow-xl shadow-blue-500/10"
                  : "border-white/5 bg-slate-900/60"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1 text-xs font-semibold text-white shadow-lg">
                  Recommended
                </span>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{tier.desc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">{tier.price}</span>
                <span className="text-slate-400">{tier.period}</span>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-slate-300">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#waitlist"
                className={`block rounded-full bg-gradient-to-r ${tier.gradient} px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const result = await submitWaitlist({ data: { email } });
      setMessage(result.message);
      setStatus("success");
      setEmail("");
    } catch (err: any) {
      setMessage(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <section id="waitlist" className="py-24 sm:py-32">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <div className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 p-10 sm:p-14">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Be the First to Know
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Diamond AI is launching soon. Join the waitlist and get early access.
          </p>
          {status === "success" ? (
            <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-emerald-300">
              <p className="font-medium">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 rounded-full border border-white/10 bg-slate-900/80 px-5 py-3.5 text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:brightness-110 disabled:opacity-60"
                >
                  {status === "loading" ? "Joining..." : "Join the Waitlist"}
                </button>
              </div>
              {status === "error" && (
                <p className="mt-3 text-sm text-red-400">{message}</p>
              )}
            </form>
          )}
          <p className="mt-4 text-xs text-slate-500">
            No spam, ever. We'll only email you about the launch.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer({ businessName }: { businessName: string }) {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
        </p>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <a href="#features" className="transition-colors hover:text-slate-300">Features</a>
          <a href="#pricing" className="transition-colors hover:text-slate-300">Pricing</a>
          <a href="#waitlist" className="transition-colors hover:text-slate-300">Waitlist</a>
        </div>
        <p className="text-sm text-slate-600">
          Built with{" "}
          <a
            href="https://cto.new"
            className="underline transition-colors hover:text-slate-400"
          >
            cto.new
          </a>
        </p>
      </div>
    </footer>
  );
}

function Home() {
  const businessName = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-slate-950 text-white antialiased">
      <NavBar businessName={businessName} />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <Waitlist />
      <Footer businessName={businessName} />
    </div>
  );
}
