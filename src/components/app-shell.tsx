"use client";

import { useState } from "react";
import { m } from "motion/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Dashboard from "@/components/dashboard";
import DealsTable from "@/components/deals-table";
import Reminders, { type Reminder } from "@/components/reminders";
import UpiSettings from "@/components/upi-settings";
import TaxReport from "@/components/tax-report";
import AutoFollowups from "@/components/auto-followups";
import ManagerBar from "@/components/manager-bar";
import ManagerTeam from "@/components/manager-team";
import DealForm from "@/components/deal-form";
import {
  Toast,
  useToast,
  Pill,
  fadeUp,
  staggerParent,
  listItem,
} from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { LIFETIME_PRICE, PLANS, type PlanKey } from "@/lib/schemas";
import Logo from "@/components/logo";
import type { Deal } from "@/lib/db";

type Tab = "overview" | "deals" | "reminders" | "tax" | "team" | "pricing";

export default function AppShell({
  userName,
  plan: initialPlan,
}: {
  userName: string;
  plan: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const { toast, notify } = useToast();
  const qc = useQueryClient();

  const dealsQuery = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const res = await fetch("/api/deals");
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error ?? "Failed to load deals",
        );
      return res.json() as Promise<{
        deals: Deal[];
        count: number;
        plan: {
          key: string;
          label: string;
          max_active_deals: number | null;
          active_deals: number;
        };
      }>;
    },
  });

  const remindersQuery = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const res = await fetch("/api/reminders");
      if (!res.ok) throw new Error("Failed to load follow-ups");
      return res.json() as Promise<{
        reminders: Reminder[];
        count: number;
        urgent: number;
      }>;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["metrics"] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  };

  const seed = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error ??
            "Could not load samples",
        );
      return res.json();
    },
    onSuccess: (j) => {
      notify(`Loaded ${j.created} sample deals`);
      refresh();
    },
    onError: (e: Error) => notify(e.message, "err"),
  });

  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const exportCsv = () => {
    window.location.href = "/api/export";
  };

  if (dealsQuery.isLoading) {
    return (
      <div className="shell">
        <ShellHeader
          userName={userName}
          plan={initialPlan}
          onNew={() => setFormOpen(true)}
          onLogout={() => logout.mutate()}
        />
        <div className="empty">Loading your deals…</div>
      </div>
    );
  }

  const deals = dealsQuery.data?.deals ?? [];
  const plan = dealsQuery.data?.plan;
  const reminders = remindersQuery.data?.reminders ?? [];
  const urgent = remindersQuery.data?.urgent ?? 0;
  const atLimit =
    plan?.max_active_deals !== null &&
    plan !== undefined &&
    plan.active_deals >= plan.max_active_deals;

  const openNew = () => {
    if (atLimit) {
      notify(
        `Free plan covers ${plan?.max_active_deals} active deals — upgrade to add more`,
        "err",
      );
      setTab("pricing");
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const changed = (msg: string, tone: "ok" | "err" = "ok") => {
    notify(msg, tone);
    if (tone === "ok") refresh();
  };

  return (
    <div className="shell">
      <ShellHeader
        onNew={openNew}
        onLogout={() => logout.mutate()}
        userName={userName}
        plan={plan?.key ?? initialPlan}
        activeDeals={plan?.active_deals}
        maxActive={plan?.max_active_deals}
      />

      <ManagerBar notify={notify} />

      <m.nav
        className="tabs"
        variants={staggerParent}
        initial="initial"
        animate="animate"
      >
        {(
          [
            ["overview", "Overview"],
            ["deals", `Deals${deals.length ? ` · ${deals.length}` : ""}`],
            ["reminders", "Follow-ups"],
            ["tax", "Tax report"],
            ["team", "Team"],
            ["pricing", "Pricing"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <m.button
            key={key}
            className={`tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
            variants={listItem}
            whileTap={{ scale: 0.96 }}
          >
            {tab === key && (
              <m.span
                className="tab-ink"
                layoutId="tab-ink"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            {label}
            {key === "reminders" && reminders.length > 0 && (
              <span className="badge">{reminders.length}</span>
            )}
          </m.button>
        ))}
        <div className="tabs-right">
          <button className="btn sm ghost" onClick={exportCsv}>
            Export CSV
          </button>
          <button
            className="btn sm ghost"
            onClick={() => {
              window.location.href = "/api/export?format=zoho";
            }}
            title="Invoice-shaped CSV that imports into Zoho Invoice"
          >
            Zoho CSV
          </button>
        </div>
      </m.nav>

      {plan?.key === "free" && (
        <m.div className="notice plan-notice" {...fadeUp}>
          <div>
            <strong>Free plan</strong> —{" "}
            {plan.max_active_deals !== null &&
            plan.active_deals > plan.max_active_deals
              ? `${plan.active_deals} active deals, but the free limit is ${plan.max_active_deals}. Upgrade to keep tracking them all.`
              : `${plan.active_deals} of ${plan.max_active_deals} active deals used.`}
          </div>
          <button className="btn sm primary" onClick={() => setTab("pricing")}>
            Upgrade — 2 months free on yearly
          </button>
        </m.div>
      )}

      <m.main
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {tab === "overview" && (
          <Dashboard
            deals={deals}
            onNew={openNew}
            onSeed={() => seed.mutate()}
            onChanged={changed}
          />
        )}
        {tab === "deals" && (
          <DealsTable
            deals={deals}
            onNew={openNew}
            onEdit={(d) => {
              setEditing(d);
              setFormOpen(true);
            }}
            onChanged={changed}
            isLoading={dealsQuery.isLoading}
          />
        )}
        {tab === "reminders" && (
          <>
            <UpiSettings notify={notify} />
            <AutoFollowups notify={notify} />
            {remindersQuery.isLoading ? (
              <div className="empty">Loading follow-ups…</div>
            ) : (
              <Reminders reminders={reminders} urgent={urgent} notify={notify} />
            )}
          </>
        )}
        {tab === "team" && <ManagerTeam notify={notify} />}
        {tab === "tax" && (
          <TaxReport deals={deals} planKey={plan?.key ?? "free"} onUpgrade={() => setTab("pricing")} />
        )}
        {tab === "pricing" && <Pricing current={plan?.key ?? "free"} notify={notify} />}
      </m.main>

      <DealForm
        open={formOpen}
        deal={editing}
        onClose={() => setFormOpen(false)}
        onDone={(msg, tone) => {
          setFormOpen(false);
          changed(msg, tone);
        }}
      />

      <Toast toast={toast} />
    </div>
  );
}


function ShellHeader({
  userName,
  onNew,
  onLogout,
  plan,
  activeDeals,
  maxActive,
}: {
  userName: string;
  onNew: () => void;
  onLogout: () => void;
  plan: string;
  activeDeals?: number;
  maxActive?: number | null;
}) {
  return (
    <m.header className="topbar" {...fadeUp}>
      <div className="brand">
        <Logo size={34} />
        <div>
          <div className="brand-name">DealFlow</div>
          <div className="brand-sub">
            Brand deals, invoices &amp; follow-ups — one place
          </div>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="usage-chip">{userName}</span>
        {maxActive !== null && maxActive !== undefined && (
          <span className="usage-chip">
            {activeDeals}/{maxActive} active
          </span>
        )}
        <Pill tone={plan === "free" ? "grey" : "purple"}>
          {plan === "free" ? "Free plan" : `${plan} plan`}
        </Pill>
        <button className="btn primary" onClick={onNew}>
          + Log a deal
        </button>
        <button className="btn ghost sm" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </m.header>
  );
}


type Billing = "yearly" | "quarterly" | "monthly";

const BILLING_META: Record<
  Billing,
  { suffix: string; months: number; label: string }
> = {
  yearly: { suffix: "/yr", months: 12, label: "Yearly" },
  quarterly: { suffix: "/3 mo", months: 3, label: "Quarterly" },
  monthly: { suffix: "/mo", months: 1, label: "Monthly" },
};

type Tier = {
  key: string;
  name: string;
  note: string;
  popular?: boolean;
  features: string[];
  coming?: string;
};

const TIERS: Tier[] = [
  {
    key: "free",
    name: "Free",
    note: "Try it properly",
    features: [
      "3 active deals",
      "Deadline + invoice tracking",
      "Follow-up messages",
      "CSV export",
    ],
  },
  {
    key: "creator",
    name: "Creator",
    note: "most creators",
    popular: true,
    features: [
      "Unlimited deals",
      "Full follow-up ladder — polite, firm, MSME demand notice with Section 15 interest",
      "Send on WhatsApp in one tap",
      "Invoice ageing + GST/TDS split",
      "UPI payment links",
      "CSV export for your CA + Zoho-ready invoice export",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    note: "power users & managers",
    features: [
      "Everything in Creator",
      "CA-ready TDS + GST reports (quarterly, FY-wise)",
      "Team mode — manage multiple creators from one login",
      "Priority support — replies within 24 hours",
      "Early access to new features + roadmap votes",
    ],
    coming: "Coming soon on Pro: brand-wise revenue reports, auto monthly tax summary.",
  },
];

function planPrice(
  key: string,
  billing: Billing,
  currency: "INR" | "USD",
): number {
  const p = PLANS[key as PlanKey];
  if (!p) return 0;
  if (currency === "INR") {
    return billing === "yearly"
      ? p.yearly_inr
      : billing === "quarterly"
        ? p.quarterly_inr
        : p.price_inr;
  }
  return billing === "yearly"
    ? p.yearly_usd
    : billing === "quarterly"
      ? p.quarterly_usd
      : p.price_usd;
}

type LicenseStatus = {
  licensed: boolean;
  verified?: boolean;
  buyerEmail?: string;
  reason?: string;
};

function LicenseRedeem({
  notify,
}: {
  notify: (msg: string, tone?: "ok" | "err") => void;
}) {
  const [key, setKey] = useState("");
  const statusQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: async (): Promise<LicenseStatus> => {
      const res = await fetch("/api/license/status");
      if (!res.ok) throw new Error("Could not check license");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  const redeem = useMutation({
    mutationFn: async (licenseKey: string) => {
      const res = await fetch("/api/license/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: licenseKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not redeem key");
      return j;
    },
    onSuccess: () => {
      notify("Pro unlocked — welcome aboard", "ok");
      window.location.reload();
    },
    onError: (e) => notify((e as Error).message, "err"),
  });
  const status = statusQuery.data;
  return (
    <m.div className="card" variants={listItem}>
      <h3 className="card-title">Bought DealFlow on Payhip?</h3>
      {status?.licensed ? (
        <p className="card-sub">
          Pro is active on this account
          {status.buyerEmail ? ` (${status.buyerEmail})` : ""}. Your Payhip
          receipt has the key if you ever need it again.
        </p>
      ) : (
        <>
          <p className="card-sub">
            Paste the license key from your Payhip receipt to unlock Pro,
            forever.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="field" style={{ flex: "1 1 220px", marginBottom: 0 }}>
              <label>License key</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                spellCheck={false}
                style={{ textTransform: "uppercase" }}
              />
            </label>
            <button
              className="btn primary"
              style={{ alignSelf: "flex-end" }}
              disabled={redeem.isPending || key.trim().length < 8}
              onClick={() => redeem.mutate(key)}
            >
              {redeem.isPending ? "Checking…" : "Redeem key"}
            </button>
          </div>
        </>
      )}
    </m.div>
  );
}

function Pricing({
  current,
  notify,
}: {
  current: string;
  notify: (msg: string, tone?: "ok" | "err") => void;
}) {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [billing, setBilling] = useState<Billing>("yearly");
  const checkout = useMutation({
    mutationFn: async ({
      tier,
      billing: override,
    }: {
      tier: string;
      billing?: Billing | "lifetime";
    }) => {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: tier, billing: override ?? billing, currency }),
      });
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error ??
            "Could not start checkout",
        );
      return res.json();
    },
    onSuccess: (j) => {
      if (j.configured && j.url) window.location.href = j.url;
      else notify(j.warning ?? "Payments are not configured yet", "err");
    },
  });

  const lifetimeLabel =
    currency === "INR" ? formatMoney(LIFETIME_PRICE.INR) : `$${LIFETIME_PRICE.USD}`;

  const sym = currency === "INR" ? "₹" : "$";

  return (
    <m.div variants={staggerParent} initial="initial" animate="animate">
      <m.div className="notice ok" variants={listItem}>
        <strong>Yearly is one payment, not a subscription trap.</strong> One UPI
        or card payment covers 12 months — no auto-debit mandate (those fail for
        half of all Indian users at setup), no surprise renewal. When your plan
        is about to end we email you a renewal link; nothing is ever charged
        without you clicking.
        <div
          style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <button
            className={`btn sm ${currency === "INR" ? "primary" : ""}`}
            onClick={() => setCurrency("INR")}
          >
            🇮🇳 Pay in ₹ (UPI / cards)
          </button>
          <button
            className={`btn sm ${currency === "USD" ? "primary" : ""}`}
            onClick={() => setCurrency("USD")}
          >
            🌍 Pay in $ (cards)
          </button>
        </div>
      </m.div>

      <m.div className="tabs" style={{ marginBottom: 16 }} variants={listItem}>
        {(Object.keys(BILLING_META) as Billing[]).map((b) => (
          <button
            key={b}
            className={`tab ${billing === b ? "active" : ""}`}
            onClick={() => setBilling(b)}
          >
            {billing === b && (
              <m.span
                className="tab-ink"
                layoutId="billing-ink"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            {BILLING_META[b].label}
            {b === "yearly" && <span className="tab-count">save most</span>}
          </button>
        ))}
      </m.div>

      <div className="pricing-grid">
        {TIERS.map((t) => {
          const isCurrent = t.key === current;
          const price = planPrice(t.key, billing, currency);
          const monthly = planPrice(t.key, "monthly", currency);
          const months = BILLING_META[billing].months;
          const savePct =
            price > 0 && monthly > 0
              ? Math.round((1 - price / (monthly * months)) * 100)
              : 0;
          const effective =
            price > 0 && months > 1 ? Math.round(price / months) : 0;
          return (
            <m.div
              className={`card pricing-card ${t.popular ? "popular" : ""}`}
              key={t.key}
              variants={listItem}
              whileHover={{
                y: -4,
                transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
              }}
            >
              <div className="pricing-head">
                <h3 className="card-title">{t.name}</h3>
                {t.popular && <Pill tone="purple">Most popular</Pill>}
              </div>
              <div className="card-sub">{t.note}</div>
              <div className="pricing-amount">
                {sym}
                {price.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}
                <span className="per">{BILLING_META[billing].suffix}</span>
              </div>
              {t.key !== "free" ? (
                <div className="t-muted dim" style={{ marginBottom: 16 }}>
                  {months > 1
                    ? `≈ ${sym}${effective}/mo · saves ${savePct}% vs monthly`
                    : `or ${sym}${planPrice(t.key, "yearly", currency).toLocaleString(currency === "INR" ? "en-IN" : "en-US")}/yr and save`}
                </div>
              ) : (
                <div className="t-muted dim" style={{ marginBottom: 16 }}>
                  forever
                </div>
              )}
              <ul className="pricing-features">
                {t.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {t.coming && (
                <div className="t-muted dim" style={{ marginBottom: 16, fontSize: 13 }}>
                  {t.coming}
                </div>
              )}
              <button
                className={`btn ${t.popular ? "primary" : ""} btn-block`}
                disabled={isCurrent || t.key === "free" || checkout.isPending}
                onClick={() => checkout.mutate({ tier: t.key })}
              >
                {isCurrent
                  ? "Current plan"
                  : t.key === "free"
                    ? "Included"
                    : checkout.isPending
                      ? "Opening…"
                      : `Pay ${sym}${price.toLocaleString(currency === "INR" ? "en-IN" : "en-US")} once`}
              </button>
            </m.div>
          );
        })}
      </div>

      <m.div className="card" variants={listItem}>
        <h3 className="card-title">Lifetime deal — launch only</h3>
        <p className="card-sub">
          <strong>{lifetimeLabel} one-time.</strong> Pro, forever — no renewals,
          no expiry. Only 50 spots, then it&apos;s gone for good.
        </p>
        <button
          className="btn primary btn-block"
          disabled={checkout.isPending}
          onClick={() => checkout.mutate({ tier: "pro", billing: "lifetime" })}
        >
          {checkout.isPending ? "Opening…" : `Pay ${lifetimeLabel} once — Pro forever`}
        </button>
        {checkout.isError && (
          <div className="notice" style={{ marginTop: 14 }}>
            {(checkout.error as Error).message}
          </div>
        )}
      </m.div>

      <LicenseRedeem notify={notify} />
    </m.div>
  );
}
