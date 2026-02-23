"use client";

import { useEffect } from "react";
import { Syne } from "next/font/google";
import { ReportUploader } from "@/components/ReportUploader";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-landing-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export default function HomePage() {
  const scrollToId =
    (id: string) =>
    (event: React.MouseEvent<HTMLElement>): void => {
      event.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const target = entry.target as HTMLElement;
          target.classList.add("visible");

          target.querySelectorAll<HTMLElement>(".reveal").forEach((child, index) => {
            child.style.transitionDelay = `${index * 0.08}s`;
            child.classList.add("visible");
          });
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll<HTMLElement>(".reveal").forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <main className={`landing-root ${syne.variable}`}>
      <nav>
        <div className="nav-brand">
          Pipeline<span>IQ</span>
        </div>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#demo">Try it</a>
        </div>
        <button type="button" className="nav-cta" onClick={scrollToId("demo")}>
          Get your report →
        </button>
      </nav>

      <section className="hero">
        <div className="hero-glow"></div>
        <div className="hero-eyebrow fade-up">
          <span className="hero-eyebrow-dot"></span>
          Built for sales reps who track commissions in spreadsheets
        </div>
        <h1 className="fade-up delay-1">
          Your commissions,
          <br />
          <em>beautifully</em> reported.
        </h1>
        <p className="hero-sub fade-up delay-2">
          Drop in your sales spreadsheet and get a polished commission report in seconds. Track
          your goal, your fitness profile rate, and your earnings - all in one place.
        </p>
        <div className="hero-actions fade-up delay-3">
          <button type="button" className="btn-primary" onClick={scrollToId("demo")}>
            Try it free
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
          <button type="button" className="btn-secondary" onClick={scrollToId("how")}>
            See how it works
          </button>
        </div>
        <div className="hero-proof fade-up delay-4">
          <span>Free to use</span>
          <div className="hero-proof-divider"></div>
          <span>No account required</span>
          <div className="hero-proof-divider"></div>
          <span>Works with any CSV</span>
        </div>
      </section>

      <div className="ticker">
        <div className="ticker-track">
          <div className="ticker-item">
            Current period <span>$330 earned</span>
          </div>
          <div className="ticker-item">
            Goal progress <span>33% there</span>
          </div>
          <div className="ticker-item">
            FP attach rate <span>21.4%</span>
          </div>
          <div className="ticker-item">
            Missed commission <span>$110</span>
          </div>
          <div className="ticker-item">
            Daily target <span>$111.67 / day</span>
          </div>
          <div className="ticker-item">
            Best period <span>$1,090</span>
          </div>
          <div className="ticker-item">
            Total earned <span>$10,523</span>
          </div>
          <div className="ticker-item">
            Bonus income <span>$1,240</span>
          </div>
          <div className="ticker-item">
            Top trainer <span>Kacey (42 FPs)</span>
          </div>
          <div className="ticker-item">
            Current period <span>$330 earned</span>
          </div>
          <div className="ticker-item">
            Goal progress <span>33% there</span>
          </div>
          <div className="ticker-item">
            FP attach rate <span>21.4%</span>
          </div>
          <div className="ticker-item">
            Missed commission <span>$110</span>
          </div>
          <div className="ticker-item">
            Daily target <span>$111.67 / day</span>
          </div>
          <div className="ticker-item">
            Best period <span>$1,090</span>
          </div>
          <div className="ticker-item">
            Total earned <span>$10,523</span>
          </div>
          <div className="ticker-item">
            Bonus income <span>$1,240</span>
          </div>
          <div className="ticker-item">
            Top trainer <span>Kacey (42 FPs)</span>
          </div>
        </div>
      </div>

      <section className="problem" id="problem">
        <div className="problem-text reveal">
          <div className="section-label">The problem</div>
          <h2>
            You&apos;re flying <em>blind</em> on your own numbers.
          </h2>
          <p style={{ marginTop: 16 }}>
            Your gym tracks your sales. Your manager sees the leaderboard. But you? You&apos;re
            manually adding up a spreadsheet at the end of the month wondering where your
            commission went.
          </p>
        </div>
        <div className="problem-cards reveal">
          <div className="problem-card">
            <div className="problem-icon">📊</div>
            <div>
              <div className="problem-card-title">No visibility into your own performance</div>
              <div className="problem-card-body">
                You sell 30+ people a month but have no clean way to see your conversion rate, your
                earnings pace, or how you&apos;re tracking to goal.
              </div>
            </div>
          </div>
          <div className="problem-card">
            <div className="problem-icon">💸</div>
            <div>
              <div className="problem-card-title">Leaving commission on the table</div>
              <div className="problem-card-body">
                Every new member who doesn&apos;t get a Fitness Profile is $10 you didn&apos;t earn. Without
                tracking it, you don&apos;t even know how much you&apos;re missing.
              </div>
            </div>
          </div>
          <div className="problem-card">
            <div className="problem-icon">🗓️</div>
            <div>
              <div className="problem-card-title">No sense of urgency mid-period</div>
              <div className="problem-card-body">
                Is $330 after 9 days good or behind pace? Without knowing your daily target, you
                can&apos;t answer that question until it&apos;s too late.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="how" id="how">
        <div className="how-inner">
          <div className="section-label reveal">How it works</div>
          <h2 className="reveal">
            Three steps to <em>knowing your numbers.</em>
          </h2>
          <div className="steps">
            <div className="step reveal">
              <div className="step-num">01</div>
              <h3>Connect your spreadsheet</h3>
              <p>
                Paste your Google Sheets link or drop in a CSV. PipelineIQ reads your commission
                data however you track it.
              </p>
              <div className="step-visual">
                <div className="step-visual-row">
                  <span>google-sheets-sync.csv</span>
                  <span>✓ connected</span>
                </div>
                <div className="step-visual-row">
                  <span>503 rows detected</span>
                  <span>15 pay periods</span>
                </div>
                <div className="step-visual-bar">
                  <div className="step-visual-fill" style={{ width: "100%" }}></div>
                </div>
              </div>
            </div>
            <div className="step reveal">
              <div className="step-num">02</div>
              <h3>We parse and summarize</h3>
              <p>
                PipelineIQ groups your transactions by pay period, identifies trainers, calculates
                your FP attach rate, and finds your goal pace.
              </p>
              <div className="step-visual">
                <div className="step-visual-row">
                  <span>FP attach rate</span>
                  <span>34.7%</span>
                </div>
                <div className="step-visual-row">
                  <span>Avg commission</span>
                  <span>$22.71</span>
                </div>
                <div className="step-visual-bar">
                  <div className="step-visual-fill" style={{ width: "65%" }}></div>
                </div>
              </div>
            </div>
            <div className="step reveal">
              <div className="step-num">03</div>
              <h3>Get your report instantly</h3>
              <p>
                A beautiful, detailed commission report - with current period tracking, goal
                progress, trainer breakdown, and a full pay period history.
              </p>
              <div className="step-visual">
                <div className="step-visual-row">
                  <span>This period</span>
                  <span style={{ color: "#22c55e" }}>$330 / $1,000</span>
                </div>
                <div className="step-visual-row">
                  <span>Daily needed</span>
                  <span>$111.67</span>
                </div>
                <div className="step-visual-bar">
                  <div className="step-visual-fill" style={{ width: "33%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="features-header reveal">
          <div className="section-label">Features</div>
          <h2>
            Everything you need to
            <br />
            <em>own your performance.</em>
          </h2>
        </div>
        <div className="features-grid">
          <div className="feature-cell reveal">
            <div className="feature-icon">🎯</div>
            <h3>Goal tracking</h3>
            <p>
              Set a $1,000 per-period goal and see exactly how much you need per day to hit it.
              Never get caught off guard at period end.
            </p>
          </div>
          <div className="feature-cell reveal">
            <div className="feature-icon">💪</div>
            <h3>FP conversion rate</h3>
            <p>
              See what percentage of your new members bought a Fitness Profile - and exactly how
              much commission you missed by not closing them.
            </p>
          </div>
          <div className="feature-cell reveal">
            <div className="feature-icon">📈</div>
            <h3>Pay period trends</h3>
            <p>
              A visual line chart of every pay period so you can spot your peak months, slow
              stretches, and whether you&apos;re improving over time.
            </p>
          </div>
          <div className="feature-cell reveal">
            <div className="feature-icon">🔄</div>
            <h3>Google Sheets sync</h3>
            <p>
              Connect once and hit sync to pull the latest data from your spreadsheet. No
              exporting, no re-uploading. Just fresh numbers.
            </p>
          </div>
          <div className="feature-cell reveal">
            <div className="feature-icon">🌙</div>
            <h3>Dark mode</h3>
            <p>
              A deep, beautiful dark interface that&apos;s easy on the eyes. Toggle with one click -
              your preference is saved automatically.
            </p>
          </div>
          <div className="feature-cell reveal">
            <div className="feature-icon">📄</div>
            <h3>Export to PDF</h3>
            <p>
              Generate a polished, printable PDF of your full commission report. Share it with your
              manager or just keep it for your records.
            </p>
          </div>
        </div>
      </section>

      <div style={{ padding: "0 48px 80px", maxWidth: 1196, margin: "0 auto" }}>
        <div className="stats-bar reveal">
          <div className="stat-item">
            <div className="stat-number">
              503<span>+</span>
            </div>
            <div className="stat-label">Members tracked</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">
              $10<span>k</span>
            </div>
            <div className="stat-label">Commissions reported</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">
              34<span>%</span>
            </div>
            <div className="stat-label">Avg FP attach rate</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">15</div>
            <div className="stat-label">Pay periods analyzed</div>
          </div>
        </div>
      </div>

      <section className="proof">
        <div className="proof-inner">
          <div className="section-label" style={{ textAlign: "center" }}>
            What reps are saying
          </div>
          <h2 className="reveal">
            Built for the <em>grind.</em>
          </h2>
          <div className="proof-grid">
            <div className="proof-card reveal">
              <div className="proof-quote">
                "I finally know how close I am to my goal mid-period. Before this I had no idea
                until payday."
              </div>
              <div className="proof-author">
                <div className="proof-avatar">TW</div>
                <div>
                  <div className="proof-name">Tyler W.</div>
                  <div className="proof-role">Fitness Sales - GGIF</div>
                </div>
              </div>
            </div>
            <div className="proof-card reveal">
              <div className="proof-quote">
                "The FP tracker is a game changer. I didn&apos;t realize I was missing $110 a period
                just from people without trainers."
              </div>
              <div className="proof-author">
                <div className="proof-avatar">JR</div>
                <div>
                  <div className="proof-name">Jordan R.</div>
                  <div className="proof-role">Membership Sales - Crunch</div>
                </div>
              </div>
            </div>
            <div className="proof-card reveal">
              <div className="proof-quote">
                "I showed my manager the PDF and she was actually impressed. Looks way more
                professional than the spreadsheet."
              </div>
              <div className="proof-author">
                <div className="proof-avatar">SM</div>
                <div>
                  <div className="proof-name">Sam M.</div>
                  <div className="proof-role">Sales Rep - Planet Fitness</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="demo" id="demo">
        <div className="demo-header reveal">
          <div className="section-label">Try it now</div>
          <h2>
            Drop in your data.
            <br />
            <em>See your report.</em>
          </h2>
          <p>Free to use. No account required. Works with any gym commission spreadsheet.</p>
        </div>
        <div className="demo-box reveal">
          <div className="demo-box-topbar">
            <div className="dot dot-red"></div>
            <div className="dot dot-yellow"></div>
            <div className="dot dot-green"></div>
            <div className="demo-box-url">pipelineiq.app</div>
          </div>
          <div className="demo-content">
            <div className="demo-uploader-wrap">
              <ReportUploader />
            </div>

            <div style={{ width: "100%", marginTop: 8 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                Report preview
              </div>
              <div className="mini-report">
                <div className="mini-report-header">
                  <div className="mini-brand">
                    Pipeline<span>IQ</span>
                  </div>
                  <div className="mini-title" style={{ fontSize: 12 }}>
                    Commission Report
                  </div>
                </div>
                <div className="mini-hero">
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "rgba(255,255,255,0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 4,
                      }}
                    >
                      Total 2026 Commissions
                    </div>
                    <div className="mini-hero-amount">$10,523</div>
                    <div className="mini-hero-sub">Across 8 pay periods - 503 members</div>
                  </div>
                  <div className="mini-hero-stats">
                    <span>34.7% FP rate</span>
                    <span>$1,240 in bonuses</span>
                    <span>Kacey top trainer</span>
                  </div>
                </div>
                <div className="mini-cards">
                  <div className="mini-card">
                    <div className="mini-card-label">Members</div>
                    <div className="mini-card-value">503</div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-card-label">Premium</div>
                    <div className="mini-card-value">164</div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-card-label">FP Rate</div>
                    <div className="mini-card-value">34.7%</div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-card-label">Avg Period</div>
                    <div className="mini-card-value">$875</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="pricing-inner">
          <div className="pricing-header reveal">
            <div className="section-label">Pricing</div>
            <h2>
              Simple, <em>honest</em> pricing.
            </h2>
            <p>Free while we&apos;re getting started. Pro plan coming soon for power users.</p>
          </div>
          <div className="pricing-cards">
            <div className="pricing-card reveal">
              <div className="pricing-plan">Free</div>
              <div className="pricing-price">
                <sup>$</sup>0<sub> / forever</sub>
              </div>
              <div className="pricing-desc">
                Everything you need to understand your commissions. No credit card, no catch.
              </div>
              <ul className="pricing-features">
                <li>Unlimited CSV uploads</li>
                <li>Google Sheets sync</li>
                <li>Current period goal tracker</li>
                <li>FP conversion tracking</li>
                <li>Pay period trend chart</li>
                <li>PDF export</li>
                <li>Dark mode</li>
              </ul>
              <button
                type="button"
                className="pricing-btn pricing-btn-free"
                onClick={scrollToId("demo")}
              >
                Get started free
              </button>
            </div>
            <div className="pricing-card featured reveal">
              <div className="pricing-badge">Coming soon</div>
              <div className="pricing-plan">Pro</div>
              <div className="pricing-price">
                <sup>$</sup>19<sub> / month</sub>
              </div>
              <div className="pricing-desc">
                For serious reps who want deeper insights, team comparisons, and manager sharing.
              </div>
              <ul className="pricing-features">
                <li>Everything in Free</li>
                <li>Multi-rep team dashboards</li>
                <li>Manager sharing link</li>
                <li>Custom goal amounts</li>
                <li>Monthly performance emails</li>
                <li>Priority support</li>
                <li className="muted">Available soon</li>
              </ul>
              <button
                type="button"
                className="pricing-btn pricing-btn-pro"
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              >
                Notify me when ready
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta-glow"></div>
        <div className="section-label reveal">Get started</div>
        <h2 className="reveal">
          Stop guessing.
          <br />
          <em>Start knowing.</em>
        </h2>
        <p className="reveal">
          Drop in your spreadsheet and see your full commission report in under 30 seconds.
        </p>
        <div className="cta-actions reveal">
          <button type="button" className="btn-primary" onClick={scrollToId("demo")}>
            Try it free - no signup needed
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          Pipeline<span>IQ</span>
        </div>
        <div className="footer-note">Built for gym sales reps - Free to use - © 2026</div>
      </footer>

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        .landing-root,
        .landing-root *,
        .landing-root *::before,
        .landing-root *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .landing-root {
          --bg: #0e0f13;
          --surface: #16181f;
          --surface-2: #1e2028;
          --border: #272a33;
          --ink: #f2f3f5;
          --ink-2: #9098a8;
          --ink-3: #4a5060;
          --accent: #e05a20;
          --accent-2: #ff7a42;
          --green: #22c55e;
          --amber: #f59e0b;

          background: var(--bg);
          color: var(--ink);
          font-family: var(--font-landing-sans), sans-serif;
          font-size: 15px;
          line-height: 1.6;
          overflow-x: hidden;
          min-height: 100vh;
          position: relative;
        }

        .landing-root::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
        }

        .landing-root nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 48px;
          background: rgba(14, 15, 19, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .nav-brand {
          font-family: var(--font-serif), serif;
          font-size: 20px;
          letter-spacing: -0.3px;
        }

        .nav-brand span {
          color: var(--accent);
          font-style: italic;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .nav-links a {
          color: var(--ink-2);
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.02em;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: var(--ink);
        }

        .nav-cta {
          background: var(--accent);
          color: white;
          border: none;
          padding: 9px 20px;
          border-radius: 6px;
          font-family: var(--font-landing-sans), sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .nav-cta:hover {
          background: var(--accent-2);
        }

        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 120px 48px 80px;
          position: relative;
          overflow: hidden;
        }

        .hero-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(224, 90, 32, 0.12) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%);
          pointer-events: none;
        }

        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          border: 1px solid rgba(224, 90, 32, 0.3);
          padding: 6px 14px;
          border-radius: 99px;
          margin-bottom: 28px;
          background: rgba(224, 90, 32, 0.06);
        }

        .hero-eyebrow-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }

          50% {
            opacity: 0.3;
          }
        }

        .hero h1 {
          font-family: var(--font-serif), serif;
          font-size: clamp(52px, 8vw, 96px);
          letter-spacing: -3px;
          line-height: 0.95;
          margin-bottom: 24px;
          max-width: 900px;
        }

        .hero h1 em {
          font-style: italic;
          color: var(--accent);
        }

        .hero-sub {
          font-size: 17px;
          color: var(--ink-2);
          max-width: 500px;
          line-height: 1.7;
          margin-bottom: 44px;
          font-weight: 400;
        }

        .hero-actions {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .btn-primary {
          background: var(--accent);
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-family: var(--font-landing-sans), sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary:hover {
          background: var(--accent-2);
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: transparent;
          color: var(--ink-2);
          border: 1px solid var(--border);
          padding: 14px 28px;
          border-radius: 8px;
          font-family: var(--font-landing-sans), sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          border-color: var(--ink-3);
          color: var(--ink);
        }

        .hero-proof {
          margin-top: 60px;
          display: flex;
          align-items: center;
          gap: 24px;
          color: var(--ink-3);
          font-size: 12px;
          font-family: var(--font-mono), monospace;
        }

        .hero-proof-divider {
          width: 1px;
          height: 16px;
          background: var(--border);
        }

        .ticker {
          background: var(--surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 14px 0;
          overflow: hidden;
          position: relative;
        }

        .ticker-track {
          display: flex;
          gap: 48px;
          animation: ticker 20s linear infinite;
          white-space: nowrap;
        }

        @keyframes ticker {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        .ticker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          flex-shrink: 0;
        }

        .ticker-item span {
          color: var(--accent);
          font-weight: 500;
        }

        .landing-root section {
          position: relative;
          z-index: 1;
        }

        .section-label {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--accent);
          margin-bottom: 16px;
        }

        .problem {
          padding: 120px 48px;
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }

        .problem-text h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 20px;
        }

        .problem-text h2 em {
          font-style: italic;
          color: var(--ink-2);
        }

        .problem-text p {
          color: var(--ink-2);
          line-height: 1.8;
          font-size: 15px;
          font-weight: 400;
        }

        .problem-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .problem-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 20px 24px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: border-color 0.2s;
        }

        .problem-card:hover {
          border-color: var(--ink-3);
        }

        .problem-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--surface-2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
        }

        .problem-card-title {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .problem-card-body {
          font-size: 12px;
          color: var(--ink-2);
          line-height: 1.6;
          font-weight: 400;
        }

        .how {
          padding: 120px 48px;
          background: var(--surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .how-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        .how h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 60px;
          max-width: 600px;
        }

        .how h2 em {
          font-style: italic;
          color: var(--accent);
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
        }

        .step {
          background: var(--bg);
          padding: 40px 36px;
          position: relative;
        }

        .step:first-child {
          border-radius: 10px 0 0 10px;
        }

        .step:last-child {
          border-radius: 0 10px 10px 0;
        }

        .step-num {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--ink-3);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .step-num::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .step h3 {
          font-family: var(--font-serif), serif;
          font-size: 26px;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
          line-height: 1.2;
        }

        .step p {
          color: var(--ink-2);
          font-size: 13px;
          line-height: 1.8;
          font-weight: 400;
        }

        .step-visual {
          margin-top: 28px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 16px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--ink-3);
        }

        .step-visual-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
        }

        .step-visual-row span:last-child {
          color: var(--ink-2);
        }

        .step-visual-bar {
          height: 3px;
          background: var(--border);
          border-radius: 99px;
          margin-top: 8px;
        }

        .step-visual-fill {
          height: 100%;
          border-radius: 99px;
          background: var(--accent);
        }

        .features {
          padding: 120px 48px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .features-header {
          margin-bottom: 60px;
        }

        .features-header h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          line-height: 1.1;
        }

        .features-header h2 em {
          font-style: italic;
          color: var(--accent);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .feature-cell {
          background: var(--bg);
          padding: 36px 32px;
          transition: background 0.2s;
        }

        .feature-cell:hover {
          background: var(--surface);
        }

        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(224, 90, 32, 0.1);
          border: 1px solid rgba(224, 90, 32, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          font-size: 18px;
        }

        .feature-cell h3 {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .feature-cell p {
          font-size: 13px;
          color: var(--ink-2);
          line-height: 1.7;
          font-weight: 400;
        }

        .proof {
          padding: 120px 48px;
          background: var(--surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .proof-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        .proof h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          text-align: center;
          margin-bottom: 60px;
        }

        .proof h2 em {
          font-style: italic;
          color: var(--accent);
        }

        .proof-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .proof-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 28px;
        }

        .proof-quote {
          font-family: var(--font-serif), serif;
          font-size: 18px;
          line-height: 1.6;
          margin-bottom: 20px;
          font-style: italic;
          color: var(--ink);
        }

        .proof-author {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .proof-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--surface-2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: var(--accent);
          font-family: var(--font-mono), monospace;
          flex-shrink: 0;
        }

        .proof-name {
          font-size: 13px;
          font-weight: 600;
        }

        .proof-role {
          font-size: 11px;
          color: var(--ink-3);
          font-family: var(--font-mono), monospace;
        }

        .stats-bar {
          padding: 80px 48px;
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--border);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 0;
        }

        .stat-item {
          background: var(--bg);
          padding: 40px 36px;
        }

        .stat-number {
          font-family: var(--font-serif), serif;
          font-size: 48px;
          letter-spacing: -2px;
          line-height: 1;
          color: var(--ink);
          margin-bottom: 8px;
        }

        .stat-number span {
          color: var(--accent);
        }

        .stat-label {
          font-size: 12px;
          color: var(--ink-3);
          font-family: var(--font-mono), monospace;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .demo {
          padding: 120px 48px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .demo-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .demo-header h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 16px;
        }

        .demo-header h2 em {
          font-style: italic;
          color: var(--accent);
        }

        .demo-header p {
          color: var(--ink-2);
          font-size: 15px;
          font-weight: 400;
        }

        .demo-box {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }

        .demo-box-topbar {
          background: var(--surface-2);
          border-bottom: 1px solid var(--border);
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .dot-red {
          background: #ff5f57;
        }

        .dot-yellow {
          background: #ffbd2e;
        }

        .dot-green {
          background: #28c840;
        }

        .demo-box-url {
          margin-left: 12px;
          background: var(--bg);
          border-radius: 4px;
          padding: 4px 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--ink-3);
          flex: 1;
          max-width: 300px;
        }

        .demo-content {
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .demo-uploader-wrap {
          width: 100%;
        }

        .demo-uploader-wrap > section {
          min-height: 0 !important;
          background: transparent !important;
          color: var(--ink);
          padding: 0 !important;
        }

        .demo-uploader-wrap > section > div {
          max-width: 100% !important;
        }

        .demo-uploader-wrap > section > div > div:first-child {
          background: var(--bg) !important;
          border-color: var(--border) !important;
          box-shadow: none !important;
        }

        .demo-uploader-wrap > section > div > div:first-child p {
          color: var(--ink-2);
        }

        .demo-uploader-wrap > section > div > div:first-child [role="button"][tabindex="0"] {
          background: var(--surface-2) !important;
          border-color: var(--border) !important;
        }

        .demo-uploader-wrap
          > section
          > div
          > div:first-child
          [role="button"][tabindex="0"]:hover {
          background: var(--surface-2) !important;
          border-color: var(--accent) !important;
        }

        .demo-uploader-wrap > section > div > div:first-child [role="button"][tabindex="0"] svg,
        .demo-uploader-wrap > section > div > div:first-child [role="button"][tabindex="0"] p {
          color: rgba(255, 255, 255, 0.75) !important;
        }

        .demo-uploader-wrap > section > div > div:first-child [role="button"][tabindex="0"] span {
          background: #25282f;
          color: rgba(255, 255, 255, 0.65) !important;
        }

        .mini-report {
          width: 100%;
          background: #f7f5f0;
          border-radius: 10px;
          padding: 24px;
          color: #0f0f0f;
        }

        .mini-report-header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #0f0f0f;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }

        .mini-brand {
          font-family: var(--font-serif), serif;
          font-size: 14px;
        }

        .mini-brand span {
          color: #c8491a;
          font-style: italic;
        }

        .mini-title {
          font-family: var(--font-serif), serif;
          font-size: 14px;
          text-align: right;
        }

        .mini-hero {
          background: #0f0f0f;
          color: white;
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mini-hero-amount {
          font-family: var(--font-serif), serif;
          font-size: 32px;
          letter-spacing: -1px;
        }

        .mini-hero-sub {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 2px;
        }

        .mini-hero-stats {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          font-family: var(--font-mono), monospace;
          text-align: right;
        }

        .mini-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .mini-card {
          background: white;
          border: 1px solid #d8d5ce;
          border-radius: 6px;
          padding: 10px 12px;
        }

        .mini-card-label {
          font-size: 8px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4px;
        }

        .mini-card-value {
          font-family: var(--font-serif), serif;
          font-size: 18px;
          color: #0f0f0f;
        }

        .pricing {
          padding: 120px 48px;
          background: var(--surface);
          border-top: 1px solid var(--border);
        }

        .pricing-inner {
          max-width: 900px;
          margin: 0 auto;
        }

        .pricing-header {
          text-align: center;
          margin-bottom: 60px;
        }

        .pricing-header h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(36px, 4vw, 52px);
          letter-spacing: -1.5px;
          line-height: 1.1;
          margin-bottom: 16px;
        }

        .pricing-header h2 em {
          font-style: italic;
          color: var(--accent);
        }

        .pricing-header p {
          color: var(--ink-2);
          font-size: 15px;
          font-weight: 400;
        }

        .pricing-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .pricing-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px 36px;
          position: relative;
          transition: border-color 0.2s;
        }

        .pricing-card:hover {
          border-color: var(--ink-3);
        }

        .pricing-card.featured {
          border-color: var(--accent);
          background: linear-gradient(135deg, rgba(224, 90, 32, 0.05) 0%, var(--bg) 60%);
        }

        .pricing-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 14px;
          border-radius: 99px;
          font-family: var(--font-mono), monospace;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }

        .pricing-plan {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--ink-3);
          margin-bottom: 16px;
        }

        .pricing-price {
          font-family: var(--font-serif), serif;
          font-size: 56px;
          letter-spacing: -2px;
          line-height: 1;
          margin-bottom: 8px;
        }

        .pricing-price sup {
          font-size: 24px;
          letter-spacing: 0;
          vertical-align: super;
        }

        .pricing-price sub {
          font-family: var(--font-landing-sans), sans-serif;
          font-size: 14px;
          color: var(--ink-3);
          font-weight: 400;
          letter-spacing: 0;
        }

        .pricing-desc {
          font-size: 13px;
          color: var(--ink-2);
          margin-bottom: 28px;
          line-height: 1.6;
          font-weight: 400;
        }

        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 32px;
        }

        .pricing-features li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          color: var(--ink-2);
          font-weight: 400;
        }

        .pricing-features li::before {
          content: "✓";
          color: var(--green);
          font-size: 12px;
          font-weight: 700;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .pricing-features li.muted {
          color: var(--ink-3);
        }

        .pricing-features li.muted::before {
          content: "–";
          color: var(--ink-3);
        }

        .pricing-btn {
          width: 100%;
          padding: 14px;
          border-radius: 8px;
          font-family: var(--font-landing-sans), sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .pricing-btn-free {
          background: var(--surface-2);
          color: var(--ink);
          border: 1px solid var(--border);
        }

        .pricing-btn-free:hover {
          border-color: var(--ink-3);
        }

        .pricing-btn-pro {
          background: var(--accent);
          color: white;
        }

        .pricing-btn-pro:hover {
          background: var(--accent-2);
          transform: translateY(-1px);
        }

        .cta {
          padding: 160px 48px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .cta-glow {
          position: absolute;
          width: 800px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(224, 90, 32, 0.1) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .cta h2 {
          font-family: var(--font-serif), serif;
          font-size: clamp(44px, 6vw, 72px);
          letter-spacing: -2px;
          line-height: 1.05;
          margin-bottom: 20px;
          position: relative;
        }

        .cta h2 em {
          font-style: italic;
          color: var(--accent);
        }

        .cta p {
          color: var(--ink-2);
          font-size: 16px;
          margin-bottom: 40px;
          font-weight: 400;
          position: relative;
        }

        .cta-actions {
          display: flex;
          gap: 14px;
          justify-content: center;
          position: relative;
        }

        .landing-root footer {
          border-top: 1px solid var(--border);
          padding: 40px 48px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-brand {
          font-family: var(--font-serif), serif;
          font-size: 16px;
        }

        .footer-brand span {
          color: var(--accent);
          font-style: italic;
        }

        .footer-note {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--ink-3);
        }

        .fade-up {
          opacity: 0;
          transform: translateY(24px);
          animation: fadeUp 0.6s ease forwards;
        }

        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .delay-1 {
          animation-delay: 0.1s;
        }

        .delay-2 {
          animation-delay: 0.2s;
        }

        .delay-3 {
          animation-delay: 0.3s;
        }

        .delay-4 {
          animation-delay: 0.4s;
        }

        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }

        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 1024px) {
          .problem,
          .steps,
          .features-grid,
          .proof-grid,
          .pricing-cards {
            grid-template-columns: 1fr;
          }

          .step:first-child,
          .step:last-child {
            border-radius: 0;
          }

          .stats-bar {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .landing-root nav {
            padding: 16px 20px;
          }

          .nav-links {
            display: none;
          }

          .hero,
          .problem,
          .how,
          .features,
          .proof,
          .demo,
          .pricing,
          .cta {
            padding-left: 20px;
            padding-right: 20px;
          }

          .hero-proof {
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
          }

          .hero-proof-divider {
            display: none;
          }

          .demo-content {
            padding: 20px;
          }

          .stats-bar {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .landing-root footer {
            padding: 24px 20px;
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
      `}</style>
    </main>
  );
}
