import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { useEffect, useState } from "react";
import { getCurrentUser } from "~/auth";
import { sql } from "~/db";
import { STRIPE_PAYMENT_LINKS } from "~/lib/subscription";

// --- Server Functions ---

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "SwingSense";
  } catch {
    return "SwingSense";
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
    const db = sql();
    const existing = await db`
      SELECT id FROM waitlist WHERE email = ${data.email}
    `;
    if (existing.length > 0) {
      return { success: true, message: "You're already on the list!" };
    }
    await db`
      INSERT INTO waitlist (email) VALUES (${data.email})
    `;
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
          <img src="/logo.png" alt="SwingSense" className="nav-logo" />
          {businessName}
        </a>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-300 sm:flex">
          <a href="#features" className="transition-colors hover:text-amber-300">Features</a>
          <a href="#pricing" className="transition-colors hover:text-amber-300">Pricing</a>
        </div>
        {user ? (
          <Link
            to="/app"
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:brightness-110"
          >
            Dashboard
          </Link>
        ) : (
          <a
            href="#waitlist"
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:brightness-110"
          >
            Get Started
          </a>
        )}
      </div>
    </nav>
  );
}

function BatterSVG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 300" fill="currentColor" opacity="0.07">
      {/* Batter silhouette — simplified human form in batting stance */}
      <ellipse cx="100" cy="18" rx="15" ry="18" />
      {/* Body */}
      <path d="M100 36 L100 130" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      {/* Left arm (back) */}
      <path d="M100 55 L70 90 L55 120" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right arm (front, holding bat area) */}
      <path d="M100 55 L130 80 L145 100" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Bat */}
      <line x1="145" y1="100" x2="120" y2="160" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      {/* Left leg */}
      <path d="M100 130 L80 200 L75 220" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right leg */}
      <path d="M100 130 L120 200 L125 220" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center px-4 pt-20 text-center overflow-hidden">
      {/* Diamond pattern overlay */}
      <div className="pointer-events-none absolute inset-0 bg-diamond-pattern"></div>
      {/* Field lines overlay */}
      <div className="pointer-events-none absolute inset-0 bg-field-lines opacity-40"></div>

      {/* Stadium light glows from top corners */}
      <div className="pointer-events-none absolute top-0 -left-20 h-80 w-80 glow-amber"></div>
      <div className="pointer-events-none absolute top-0 -right-20 h-80 w-80 glow-amber"></div>

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Batter silhouette — desktop right, mobile centered */}
      <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 lg:block">
        <BatterSVG className="h-[500px] w-[300px] text-amber-400" />
      </div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 lg:hidden">
        <BatterSVG className="h-[300px] w-[180px] text-amber-400" />
      </div>

      <span className="relative mb-6 inline-block rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-sm font-medium text-white">
        AI-Powered Sports Coaching
      </span>
      <h1 className="relative max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
        Your Personal Softball &amp; Baseball Coach,{" "}
        <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
          Powered by AI
        </span>
      </h1>
      <p className="relative mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
        Film your swing, pitch, or catch from your phone. Get instant, detailed
        technique feedback — no expensive lessons, no schedule to keep.
      </p>
      <div className="relative mt-6 flex items-center gap-4 text-xs text-slate-500 sm:text-sm">
        <span>★ Private beta</span>
        <span className="text-slate-700">·</span>
        <span>⚡ Under 60s</span>
        <span className="text-slate-700">·</span>
        <span>🔒 Secure &amp; private</span>
      </div>
      <a
        href="#waitlist"
        className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-lg font-semibold text-white shadow-xl shadow-amber-500/30 transition-all hover:shadow-amber-500/50 hover:brightness-110"
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
      icon: "🎥",
      title: "Record",
      desc: "Set up your phone, film your swing, pitch, or catch — no fancy equipment needed.",
    },
    {
      icon: "🧠",
      title: "Analyze",
      desc: "Our AI breaks down your mechanics frame by frame — stance, rotation, path, and more.",
    },
    {
      icon: "📈",
      title: "Improve",
      desc: "Get actionable feedback and track your progress over time with side-by-side comparisons.",
    },
  ];

  return (
    <section id="how-it-works" className="relative bg-slate-900/50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            🏟️ How It Works
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Three simple steps from recording to results.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-2xl border border-white/5 bg-slate-900/80 p-8 text-center backdrop-blur-sm transition-all hover:border-amber-500/30"
            >
              <div className="absolute -top-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-slate-400 ring-1 ring-white/10">
                {i + 1}
              </div>
              <div className="mt-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-3xl">
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
      title: "🏏 Swing Analysis",
      desc: "Detailed breakdown of stance, hip rotation, bat path, and follow-through.",
    },
    {
      title: "🔥 Pitching Mechanics",
      desc: "Arm angle, stride length, release point, and balance analysis for pitchers.",
    },
    {
      title: "🧤 Catching & Fielding",
      desc: "Footwork, glove position, transfer speed, and throwing mechanics analysis.",
    },
    {
      title: "📊 Progress Tracking",
      desc: "Compare videos side-by-side and see your improvement over time with detailed metrics.",
    },
    {
      title: "⚡ Instant Results",
      desc: "Feedback in under 60 seconds — not days later. Learn and adjust while it's fresh.",
    },
    {
      title: "📍 Anywhere Anytime",
      desc: "No appointments, no travel — just your phone and a few swings. Practice on your schedule.",
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
              className="group rounded-2xl border border-white/5 bg-slate-900/60 p-6 transition-all hover:border-amber-500/30 hover:bg-slate-900/80"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-2xl">
                {f.title.split(" ")[0]}
              </div>
              <h3 className="text-lg font-semibold text-white">{f.title.replace(/^[^\s]+\s/, "")}</h3>
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
      href: "#waitlist",
      gradient: "from-slate-600 to-slate-500",
      popular: false,
    },
    {
      name: "Pro",
      price: "$12",
      period: "/mo",
      desc: "Unlock the full SwingSense experience.",
      features: [
        "Unlimited analyses",
        "Deep breakdowns",
        "Side-by-side comparisons",
        "Progress tracking",
        "Multi-sport support",
      ],
      cta: "Start Free Trial",
      href: STRIPE_PAYMENT_LINKS.pro_monthly,
      annualHref: STRIPE_PAYMENT_LINKS.pro_annual,
      gradient: "from-amber-500 to-orange-500",
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
      href: STRIPE_PAYMENT_LINKS.team,
      gradient: "from-amber-500 to-orange-500",
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="relative bg-slate-900/50 py-24 sm:py-32">
      {/* Diamond pattern overlay on pricing section */}
      <div className="pointer-events-none absolute inset-0 bg-diamond-pattern"></div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            🏆 Simple, Transparent Pricing
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
                  ? "border-amber-500/40 bg-amber-500/5 shadow-xl shadow-amber-500/10"
                  : "border-white/5 bg-slate-900/60"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-xs font-semibold text-white shadow-lg">
                  ⚾ Recommended
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
                href={tier.href}
                target={tier.href.startsWith("http") ? "_blank" : undefined}
                rel={tier.href.startsWith("http") ? "noopener" : undefined}
                className={`block rounded-full bg-gradient-to-r ${tier.gradient} px-6 py-3 text-center text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110`}
              >
                {tier.cta}
              </a>
              {tier.annualHref && (
                <a
                  href={tier.annualHref}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 block text-center text-xs text-slate-400 underline underline-offset-2 transition-colors hover:text-amber-300"
                >
                  or save with annual — $99/yr
                </a>
              )}
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
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          📬 Be the First to Know
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          SwingSense is launching soon. Join the waitlist and get early access.
        </p>
        <div className="mt-8 rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-10 sm:p-14">
          {status === "success" ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-emerald-300">
              <p className="font-medium">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 rounded-full border border-white/10 bg-slate-900/80 px-5 py-3.5 text-white placeholder-slate-500 outline-none transition-all focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-7 py-3.5 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:brightness-110 disabled:opacity-60"
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
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-6 w-6 rounded object-contain opacity-70" />
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
        </div>
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
