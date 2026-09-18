import path from 'node:path'
import type { BudgetViolation, ConfigAdvice, Diagnosis, DoctorConfig, DoctorReport, StaticFinding, TestProfile } from '../types/index.js'

export class HtmlFormatter {
  constructor(private config: DoctorConfig = {}) {}

  public format(report: DoctorReport): string {
    const cwd = this.config.cwd || process.cwd()
    const timestamp = new Date(report.timestamp).toLocaleString()
    const totalSec = (report.summary.totalDuration / 1000).toFixed(2)
    const avoidableSec = (report.summary.estimatedAvoidableMs / 1000).toFixed(2)
    const hasRegressions = (report.regressions && report.regressions.length > 0) || false
    const budgetEval = report.budgetEvaluation

    // Categorized breakdown count
    const activeCategories = Object.entries(report.summary.categoryCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])

    const jsonPayload = JSON.stringify(report).replace(/</g, '\\u003c')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vitest Doctor - Diagnostic Report</title>
  <style>
    /* Self-contained Design System (100% Offline Compatible) */
    :root {
      --bg-base: #09090b;
      --bg-surface: #121215;
      --bg-card: #18181b;
      --bg-card-hover: #222226;
      --border-subtle: #27272a;
      --border-focus: #3f3f46;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --rose: #f43f5e;
      --rose-bg: rgba(244, 63, 94, 0.12);
      --rose-border: rgba(244, 63, 94, 0.3);
      --amber: #f59e0b;
      --amber-bg: rgba(245, 158, 11, 0.12);
      --amber-border: rgba(245, 158, 11, 0.3);
      --emerald: #10b981;
      --emerald-bg: rgba(16, 185, 129, 0.12);
      --emerald-border: rgba(16, 185, 129, 0.3);
      --sky: #38bdf8;
      --sky-bg: rgba(56, 189, 248, 0.12);
      --purple: #c084fc;
      --purple-bg: rgba(192, 132, 252, 0.12);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-full: 9999px;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    code, pre, .font-mono {
      font-family: var(--font-mono);
    }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-base); }
    ::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--border-focus); }

    /* Layout */
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    header {
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(18, 18, 21, 0.8);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .header-inner {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo-badge {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, #f43f5e, #f59e0b);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      box-shadow: 0 4px 12px rgba(244, 63, 94, 0.25);
    }

    main {
      padding: 1.25rem 0 3rem 0;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* KPI Grid */
    .grid-kpi {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .card:hover {
      border-color: var(--border-focus);
    }

    .kpi-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .kpi-value {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .kpi-sub {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Budget Alert Banner */
    .budget-banner {
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .budget-banner.passed {
      background: var(--emerald-bg);
      border: 1px solid var(--emerald-border);
      color: #a7f3d0;
    }

    .budget-banner.failed {
      background: var(--rose-bg);
      border: 1px solid var(--rose-border);
      color: #fecdd3;
    }

    /* Config Advisor Section */
    .advisor-section {
      background: linear-gradient(180deg, rgba(192, 132, 252, 0.08) 0%, rgba(18, 18, 21, 0.6) 100%);
      border: 1px solid rgba(192, 132, 252, 0.3);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .advice-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .advice-code {
      background: #000000;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 0.75rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #38bdf8;
      overflow-x: auto;
      white-space: pre;
    }

    /* Navigation & Tabs */
    .nav-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 1rem;
    }

    .tab-group {
      display: flex;
      gap: 0.5rem;
    }

    .tab-btn {
      padding: 0.5rem 1rem;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      font-weight: 600;
      background: transparent;
      color: var(--text-muted);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      background: var(--bg-card);
      color: var(--text-main);
    }

    .tab-btn.active {
      background: var(--bg-card);
      color: #ffffff;
      border: 1px solid var(--border-focus);
    }

    .tab-badge {
      font-size: 0.75rem;
      padding: 0.1rem 0.5rem;
      border-radius: var(--radius-full);
      background: rgba(255, 255, 255, 0.08);
    }

    /* Filter Controls */
    .filter-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
    }

    .search-input {
      padding: 0.5rem 1rem 0.5rem 2rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-size: 0.8125rem;
      outline: none;
      min-width: 240px;
    }

    .search-input:focus {
      border-color: var(--rose);
    }

    .select-input {
      padding: 0.5rem 0.75rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-main);
      font-size: 0.8125rem;
      outline: none;
      cursor: pointer;
    }

    .category-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .pill-btn {
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.75rem;
      font-weight: 500;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }

    .pill-btn.active {
      background: var(--rose);
      color: #ffffff;
      border-color: var(--rose);
    }

    /* Test Cards */
    .test-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .test-card.severity-high { border-left: 4px solid var(--rose); }
    .test-card.severity-medium { border-left: 4px solid var(--amber); }
    .test-card.severity-low { border-left: 4px solid var(--sky); }

    .test-card-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .test-title {
      font-size: 1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-rose { background: var(--rose-bg); color: var(--rose); border: 1px solid var(--rose-border); }
    .badge-amber { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
    .badge-emerald { background: var(--emerald-bg); color: var(--emerald); border: 1px solid var(--emerald-border); }
    .badge-sky { background: var(--sky-bg); color: var(--sky); }
    .badge-purple { background: var(--purple-bg); color: var(--purple); }

    .duration-box {
      font-family: var(--font-mono);
      font-size: 1.125rem;
      font-weight: 800;
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-md);
      background: var(--rose-bg);
      color: var(--rose);
      border: 1px solid var(--rose-border);
    }

    /* Waterfall Visualization */
    .waterfall-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .waterfall-row {
      display: grid;
      grid-template-columns: 240px 1fr 80px;
      align-items: center;
      gap: 1rem;
      font-size: 0.8125rem;
    }

    .waterfall-bar-track {
      height: 24px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: var(--radius-sm);
      display: flex;
      overflow: hidden;
    }

    .waterfall-segment {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6875rem;
      font-weight: 700;
      color: #ffffff;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .seg-imports { background: #0284c7; }
    .seg-setup { background: #d97706; }
    .seg-collect { background: #9333ea; }
    .seg-body { background: #059669; }
    .seg-hooks { background: #e11d48; }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.8125rem;
    }

    .data-table th {
      background: var(--bg-surface);
      color: var(--text-dim);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.6875rem;
      letter-spacing: 0.05em;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .data-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .data-table tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    /* Diagnosis block */
    .diagnosis-item {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.875rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .hidden { display: none !important; }

    @media print {
      body { background: #ffffff; color: #000000; }
      .card, .test-card, .waterfall-container { border: 1px solid #ccc; background: #fff; color: #000; }
      header, .filter-controls, .nav-bar { display: none; }
    }
  </style>
</head>
<body>

  <!-- Top Header -->
  <header>
    <div class="container header-inner">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div class="logo-badge">🩺</div>
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <strong style="font-size: 1.125rem; letter-spacing: -0.01em;">Vitest Doctor</strong>
            <span class="badge badge-sky font-mono">v${report.version}</span>
            ${report.git?.branch ? `<span class="badge badge-purple font-mono">${escapeHtml(report.git.branch)}@${escapeHtml(report.git.commitShortHash || report.git.commitHash?.slice(0, 7) || 'HEAD')}</span>` : ''}
            <span class="badge ${budgetEval ? (budgetEval.passed ? 'badge-emerald' : 'badge-rose') : 'badge-sky'} font-mono">
              ${budgetEval ? (budgetEval.passed ? 'CI PASSED' : 'CI FAILED') : 'DIAGNOSTIC'}
            </span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-dim);">Performance Diagnostics & Root-Cause Analyzer</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span style="font-size: 0.75rem; color: var(--text-dim);" class="font-mono">${timestamp}</span>
        <button onclick="downloadJsonReport()" class="pill-btn font-mono" style="background: var(--bg-card); color: var(--text-main);">
          Export JSON
        </button>
      </div>
    </div>
  </header>

  <div class="container">
    <main>

      ${budgetEval ? `
      <!-- Budget Status Banner -->
      <section class="budget-banner ${budgetEval.passed ? 'passed' : 'failed'}">
        <div style="font-size: 1.25rem; line-height: 1; margin-top: 0.125rem;">${budgetEval.passed ? '✅' : '🚨'}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <strong style="font-size: 0.875rem;">
                ${budgetEval.passed ? 'Performance Budgets Satisfied' : `Performance Budget Violations (${budgetEval.violations.length})`}
              </strong>
              ${!budgetEval.passed ? this.renderBudgetViolationBadges(budgetEval.violations) : ''}
            </div>
          </div>
          ${budgetEval.passed
            ? `<div style="font-size: 0.8125rem; margin-top: 0.25rem; opacity: 0.9;">All test execution durations, percentiles, and regression thresholds are within established targets.</div>`
            : this.renderBudgetViolationsList(budgetEval.violations)}
        </div>
      </section>
      ` : ''}

      <!-- KPI Summary Cards -->
      <section class="grid-kpi">
        <!-- Total Tests Card -->
        <div class="card">
          <div class="kpi-title">
            <span>Total Tests</span>
            <span>Suite Scope</span>
          </div>
          <div class="kpi-value">${report.summary.totalTests}</div>
          <div class="kpi-sub">
            Duration: <strong style="color: #ffffff;">${totalSec}s</strong> &nbsp;•&nbsp; p50: <strong class="font-mono">${report.stats.median.toFixed(0)}ms</strong>
          </div>
        </div>

        <!-- Suspicious Tests Card -->
        <div class="card">
          <div class="kpi-title">
            <span>Suspicious Tests</span>
            <span style="color: ${report.summary.suspiciousCount > 0 ? 'var(--amber)' : 'var(--emerald)'};">●</span>
          </div>
          <div class="kpi-value" style="color: ${report.summary.suspiciousCount > 0 ? 'var(--amber)' : 'var(--emerald)'};">
            ${report.summary.suspiciousCount}
          </div>
          <div class="kpi-sub">
            ${report.summary.suspiciousCount > 0 ? `${((report.summary.suspiciousCount / Math.max(1, report.summary.totalTests)) * 100).toFixed(1)}% of test suite flagged` : 'No anomalies detected'}
          </div>
        </div>

        <!-- Avoidable Latency Card -->
        <div class="card">
          <div class="kpi-title">
            <span>Avoidable Latency</span>
            <span style="color: var(--rose);">⚡ Speedup</span>
          </div>
          <div class="kpi-value" style="color: var(--rose);">
            ~${avoidableSec}s
          </div>
          <div class="kpi-sub">
            Estimated potential execution reduction
          </div>
        </div>

        <!-- Distribution Card -->
        <div class="card">
          <div class="kpi-title">
            <span>Distribution</span>
            <span class="font-mono">MAD: ${report.stats.mad.toFixed(0)}ms</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-top: 0.5rem;">
            <div>
              <div style="font-size: 0.625rem; color: var(--text-dim); text-transform: uppercase;">p75</div>
              <div style="font-size: 0.9375rem; font-weight: 700;" class="font-mono">${report.stats.p75.toFixed(0)}ms</div>
            </div>
            <div>
              <div style="font-size: 0.625rem; color: var(--text-dim); text-transform: uppercase;">p90</div>
              <div style="font-size: 0.9375rem; font-weight: 700;" class="font-mono">${report.stats.p90.toFixed(0)}ms</div>
            </div>
            <div>
              <div style="font-size: 0.625rem; color: var(--text-dim); text-transform: uppercase;">p95</div>
              <div style="font-size: 0.9375rem; font-weight: 700; color: var(--rose);" class="font-mono">${report.stats.p95.toFixed(0)}ms</div>
            </div>
          </div>
        </div>
      </section>

      ${report.advices && report.advices.length > 0 ? this.renderConfigAdvices(report.advices) : ''}

      ${activeCategories.length > 0 ? `
      <!-- Bottleneck Categories Filter Bar -->
      <section style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim);">
          Bottleneck Categories
        </div>
        <div class="category-pills">
          <button onclick="filterByCategory('all')" class="pill-btn active" data-category="all">
            All Bottlenecks (${report.summary.suspiciousCount})
          </button>
          ${activeCategories.map(([cat, count]) => `
            <button onclick="filterByCategory('${cat}')" class="pill-btn" data-category="${cat}">
              ${formatCategoryName(cat)} <span class="tab-badge font-mono">${count}</span>
            </button>
          `).join('')}
        </div>
      </section>
      ` : ''}

      <!-- Main Navigation & Interactive Controls -->
      <section style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="nav-bar">
          <div class="tab-group">
            <button id="tab-btn-suspicious" onclick="switchTab('suspicious')" class="tab-btn active">
              Suspicious Tests <span class="tab-badge">${report.suspiciousTests.length}</span>
            </button>
            <button id="tab-btn-waterfall" onclick="switchTab('waterfall')" class="tab-btn">
              Waterfall Timeline <span class="tab-badge">${Object.keys(report.files || {}).length} files</span>
            </button>
            ${hasRegressions ? `
            <button id="tab-btn-regressions" onclick="switchTab('regressions')" class="tab-btn">
              Regressions <span class="tab-badge" style="background: var(--rose-bg); color: var(--rose);">${report.regressions?.length || 0}</span>
            </button>
            ` : ''}
            <button id="tab-btn-all" onclick="switchTab('all')" class="tab-btn">
              All Tests <span class="tab-badge">${report.tests.length}</span>
            </button>
          </div>

          <div class="filter-controls">
            <input type="text" id="searchInput" oninput="handleSearch(this.value)" placeholder="Search tests, suites, files, causes..." class="search-input">
            <select id="sortSelect" onchange="handleSort(this.value)" class="select-input font-mono">
              <option value="duration-desc">Sort: Slowest First</option>
              <option value="duration-asc">Sort: Fastest First</option>
              <option value="name-asc">Sort: Name (A-Z)</option>
            </select>
          </div>
        </div>

        <!-- Tab 1: Suspicious Tests -->
        <div id="tab-content-suspicious">
          ${report.suspiciousTests.length === 0 ? `
            <div style="text-align: center; padding: 4rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
              <strong style="font-size: 1.125rem;">No Suspicious Tests Detected</strong>
              <p style="font-size: 0.8125rem; color: var(--text-dim); margin-top: 0.25rem;">All tests completed within expected statistical bounds without identified bottlenecks.</p>
            </div>
          ` : `
            <div id="suspiciousCardsContainer">
              ${report.suspiciousTests.map((test, idx) => this.renderTestCard(test, idx, cwd)).join('')}
            </div>
          `}
        </div>

        <!-- Tab 2: Waterfall Timeline -->
        <div id="tab-content-waterfall" class="hidden">
          <div class="waterfall-container">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
              <strong style="font-size: 0.875rem;">File Startup & Test Execution Waterfall</strong>
              <div style="display: flex; gap: 1rem; font-size: 0.75rem;">
                <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 10px; height: 10px; background: #0284c7; border-radius: 2px;"></span> Imports</span>
                <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 10px; height: 10px; background: #d97706; border-radius: 2px;"></span> Setup</span>
                <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 10px; height: 10px; background: #9333ea; border-radius: 2px;"></span> Collect</span>
                <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 10px; height: 10px; background: #059669; border-radius: 2px;"></span> Test Body</span>
                <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 10px; height: 10px; background: #e11d48; border-radius: 2px;"></span> Hooks</span>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
              ${this.renderWaterfallRows(report, cwd)}
            </div>
          </div>
        </div>

        ${hasRegressions ? `
        <!-- Tab 3: Regressions -->
        <div id="tab-content-regressions" class="hidden">
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th>File</th>
                  <th>Baseline</th>
                  <th>Current</th>
                  <th>Regression</th>
                </tr>
              </thead>
              <tbody>
                ${report.regressions?.map(reg => {
                  const relFile = path.isAbsolute(reg.file) ? path.relative(cwd, reg.file) : reg.file
                  return `
                  <tr>
                    <td><strong>${escapeHtml(reg.name)}</strong></td>
                    <td class="font-mono" style="color: var(--text-dim);">${escapeHtml(relFile)}</td>
                    <td class="font-mono">${reg.previousDuration.toFixed(0)}ms</td>
                    <td class="font-mono" style="font-weight: 700; color: #ffffff;">${reg.currentDuration.toFixed(0)}ms</td>
                    <td>
                      <span class="badge badge-rose font-mono">+${reg.percentageChange.toFixed(0)}%</span>
                    </td>
                  </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}

        <!-- Tab 4: All Tests -->
        <div id="tab-content-all" class="hidden">
          <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden;">
            <table class="data-table" id="allTestsTable">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Test Name</th>
                  <th>Suite / Context</th>
                  <th>File</th>
                  <th style="text-align: right;">Duration</th>
                </tr>
              </thead>
              <tbody>
                ${report.tests.map(test => {
                  const relFile = path.isAbsolute(test.file) ? path.relative(cwd, test.file) : test.file
                  const suiteStr = test.suitePath?.join(' > ') || '-'
                  const state = test.state || 'passed'
                  const badgeClass = state === 'passed' ? 'badge-emerald' : state === 'failed' ? 'badge-rose' : 'badge-sky'
                  return `
                  <tr class="all-test-row" data-name="${escapeHtml(test.name.toLowerCase())}" data-file="${escapeHtml(relFile.toLowerCase())}" data-suite="${escapeHtml(suiteStr.toLowerCase())}">
                    <td><span class="badge ${badgeClass}">${state}</span></td>
                    <td><strong>${escapeHtml(test.name)}</strong></td>
                    <td style="color: var(--text-muted);">${escapeHtml(suiteStr)}</td>
                    <td class="font-mono" style="color: var(--text-dim);">${escapeHtml(relFile)}</td>
                    <td class="font-mono" style="text-align: right; font-weight: 700; color: ${test.isOutlier ? 'var(--amber)' : 'var(--text-main)'};">
                      ${test.duration.toFixed(0)}ms
                    </td>
                  </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer style="border-top: 1px solid var(--border-subtle); padding-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-dim);">
        <div>Generated with 🩺 <strong>Vitest Doctor</strong> (100% Offline Compatible)</div>
        <div class="font-mono">Total suite run: ${totalSec}s</div>
      </footer>

    </main>
  </div>

  <!-- Client-side Interactivity Script -->
  <script>
    const reportData = ${jsonPayload};

    function downloadJsonReport() {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vitest-doctor-report.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('tab-btn-' + tabId);
      if (activeBtn) activeBtn.classList.add('active');

      ['suspicious', 'waterfall', 'regressions', 'all'].forEach(id => {
        const el = document.getElementById('tab-content-' + id);
        if (el) {
          if (id === tabId) el.classList.remove('hidden');
          else el.classList.add('hidden');
        }
      });
    }

    let currentCategory = 'all';
    let currentSearch = '';
    let currentSort = 'duration-desc';

    function filterByCategory(category) {
      currentCategory = category;
      document.querySelectorAll('.pill-btn').forEach(btn => {
        if (btn.getAttribute('data-category') === category) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      applyFilters();
    }

    function handleSearch(query) {
      currentSearch = query.trim().toLowerCase();
      applyFilters();
    }

    function handleSort(sortVal) {
      currentSort = sortVal;
      const container = document.getElementById('suspiciousCardsContainer');
      if (!container) return;

      const cards = Array.from(container.querySelectorAll('.test-card'));
      cards.sort((a, b) => {
        const durA = Number(a.getAttribute('data-duration') || 0);
        const durB = Number(b.getAttribute('data-duration') || 0);
        const nameA = a.getAttribute('data-name') || '';
        const nameB = b.getAttribute('data-name') || '';

        if (currentSort === 'duration-desc') return durB - durA;
        if (currentSort === 'duration-asc') return durA - durB;
        if (currentSort === 'name-asc') return nameA.localeCompare(nameB);
        return 0;
      });

      cards.forEach(card => container.appendChild(card));
    }

    function applyFilters() {
      // Filter suspicious cards
      document.querySelectorAll('.test-card').forEach(card => {
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        const file = (card.getAttribute('data-file') || '').toLowerCase();
        const causes = (card.getAttribute('data-causes') || '').split(',');

        const matchesSearch = !currentSearch || name.includes(currentSearch) || file.includes(currentSearch) || causes.some(c => c.includes(currentSearch));
        const matchesCategory = currentCategory === 'all' || causes.includes(currentCategory);

        if (matchesSearch && matchesCategory) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });

      // Filter all-tests table
      document.querySelectorAll('.all-test-row').forEach(row => {
        const name = (row.getAttribute('data-name') || '').toLowerCase();
        const file = (row.getAttribute('data-file') || '').toLowerCase();
        const suite = (row.getAttribute('data-suite') || '').toLowerCase();

        const matchesSearch = !currentSearch || name.includes(currentSearch) || file.includes(currentSearch) || suite.includes(currentSearch);
        if (matchesSearch) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    }
  </script>
</body>
</html>`
  }

  private renderWaterfallRows(report: DoctorReport, cwd: string): string {
    const files = Object.entries(report.files || {})
    if (files.length === 0) {
      return '<div style="font-size: 0.8125rem; color: var(--text-dim); text-align: center; padding: 2rem;">No file diagnostics recorded.</div>'
    }

    // Find max duration for scaling
    let maxFileMs = 1
    for (const [filePath, diag] of files) {
      const testsInFile = report.tests.filter(t => t.file === filePath)
      const testsSum = testsInFile.reduce((acc, t) => acc + t.duration, 0)
      const total = Math.max(diag.total || 0, testsSum + (diag.imports || 0) + (diag.setup || 0))
      if (total > maxFileMs) maxFileMs = total
    }

    return files.map(([filePath, diag]) => {
      const relFile = path.isAbsolute(filePath) ? path.relative(cwd, filePath) : filePath
      const testsInFile = report.tests.filter(t => t.file === filePath)
      const testBodySum = testsInFile.reduce((acc, t) => acc + Math.max(0, t.duration - (t.hooks?.beforeEach || 0) - (t.hooks?.afterEach || 0)), 0)
      const hooksSum = testsInFile.reduce((acc, t) => acc + (t.hooks?.beforeEach || 0) + (t.hooks?.afterEach || 0), 0)

      const importsMs = diag.imports || 0
      const setupMs = diag.setup || 0
      const collectMs = diag.collect || 0
      const totalFileMs = Math.max(diag.total || 0, importsMs + setupMs + collectMs + testBodySum + hooksSum)

      const pctImports = Math.max(0, (importsMs / maxFileMs) * 100)
      const pctSetup = Math.max(0, (setupMs / maxFileMs) * 100)
      const pctCollect = Math.max(0, (collectMs / maxFileMs) * 100)
      const pctHooks = Math.max(0, (hooksSum / maxFileMs) * 100)
      const pctBody = Math.max(0, (testBodySum / maxFileMs) * 100)

      return `
      <div class="waterfall-row">
        <div class="font-mono" style="truncate: true; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(relFile)}">
          ${escapeHtml(relFile)}
        </div>
        <div class="waterfall-bar-track" title="Imports: ${importsMs}ms, Setup: ${setupMs}ms, Body: ${testBodySum}ms, Hooks: ${hooksSum}ms">
          ${pctImports > 0 ? `<div class="waterfall-segment seg-imports" style="width: ${pctImports.toFixed(1)}%;">${importsMs >= 100 ? `${importsMs}ms` : ''}</div>` : ''}
          ${pctSetup > 0 ? `<div class="waterfall-segment seg-setup" style="width: ${pctSetup.toFixed(1)}%;">${setupMs >= 100 ? `${setupMs}ms` : ''}</div>` : ''}
          ${pctCollect > 0 ? `<div class="waterfall-segment seg-collect" style="width: ${pctCollect.toFixed(1)}%;"></div>` : ''}
          ${pctHooks > 0 ? `<div class="waterfall-segment seg-hooks" style="width: ${pctHooks.toFixed(1)}%;">${hooksSum >= 100 ? `${hooksSum}ms` : ''}</div>` : ''}
          ${pctBody > 0 ? `<div class="waterfall-segment seg-body" style="width: ${pctBody.toFixed(1)}%;">${testBodySum >= 100 ? `${testBodySum}ms` : ''}</div>` : ''}
        </div>
        <div class="font-mono" style="text-align: right; font-weight: 700; color: #ffffff;">
          ${totalFileMs.toFixed(0)}ms
        </div>
      </div>
      `
    }).join('')
  }

  private renderTestCard(test: TestProfile, _index: number, cwd: string): string {
    const relFile = path.isAbsolute(test.file) ? path.relative(cwd, test.file) : test.file
    const suiteStr = test.suitePath?.join(' > ') || ''
    const duration = test.duration.toFixed(0)
    const causes = test.diagnoses?.map(d => d.cause) || []
    const causesAttr = causes.join(',')

    const highestConfidence = test.diagnoses?.some(d => d.confidence === 'high')
      ? 'high'
      : test.diagnoses?.some(d => d.confidence === 'medium')
        ? 'medium'
        : 'low'

    const badgeClass = highestConfidence === 'high' ? 'badge-rose' : highestConfidence === 'medium' ? 'badge-amber' : 'badge-sky'

    return `
    <div class="test-card severity-${highestConfidence}" data-name="${escapeHtml(test.name.toLowerCase())}" data-file="${escapeHtml(relFile.toLowerCase())}" data-causes="${causesAttr}" data-duration="${test.duration}">
      <div class="test-card-header">
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge ${badgeClass}">${highestConfidence.toUpperCase()} Severity</span>
            ${suiteStr ? `<span style="font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(suiteStr)} ›</span>` : ''}
            <h3 class="test-title">${escapeHtml(test.name)}</h3>
          </div>
          <div class="font-mono" style="font-size: 0.75rem; color: var(--text-dim);">
            ${escapeHtml(relFile)}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${test.relativeMultiplier && test.relativeMultiplier > 1 ? `
            <span class="badge font-mono" style="background: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border-subtle);">
              ${test.relativeMultiplier.toFixed(1)}x median
            </span>
          ` : ''}
          <div class="duration-box">
            ${duration}ms
          </div>
        </div>
      </div>

      ${this.renderTimingBreakdown(test)}

      ${test.diagnoses && test.diagnoses.length > 0 ? `
      <div style="display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
        ${test.diagnoses.map(diag => this.renderDiagnosis(diag)).join('')}
      </div>
      ` : ''}

      ${test.signals?.staticFindings && test.signals.staticFindings.length > 0 ? `
      <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
        <div style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.5rem;">Static AST Correlations</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem;">
          ${test.signals.staticFindings.map(finding => this.renderStaticFinding(finding, cwd)).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    `
  }

  private renderTimingBreakdown(test: TestProfile): string {
    const diag = test.fileDiagnostics
    const hooks = test.hooks || {}

    const hasHooks = (hooks.beforeEach || 0) > 0 || (hooks.beforeAll || 0) > 0 || (hooks.afterEach || 0) > 0
    const hasDiag = diag && ((diag.setup || 0) > 0 || (diag.imports || 0) > 0 || (diag.collect || 0) > 0)

    if (!hasHooks && !hasDiag) return ''

    return `
    <div style="background: rgba(0, 0, 0, 0.3); border-radius: var(--radius-md); padding: 0.75rem; border: 1px solid var(--border-subtle); font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
      <div style="display: flex; justify-content: space-between; color: var(--text-dim); text-transform: uppercase; font-size: 0.6875rem; font-weight: 600;">
        <span>Execution Breakdown</span>
        <span class="font-mono">Body: ${test.duration.toFixed(0)}ms</span>
      </div>
      <div class="font-mono" style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
        ${diag?.imports ? `<span>Imports: <strong style="color: var(--sky);">${diag.imports.toFixed(0)}ms</strong></span>` : ''}
        ${diag?.setup ? `<span>Setup: <strong style="color: var(--amber);">${diag.setup.toFixed(0)}ms</strong></span>` : ''}
        ${diag?.collect ? `<span>Collect: <strong style="color: var(--purple);">${diag.collect.toFixed(0)}ms</strong></span>` : ''}
        ${hooks.beforeEach ? `<span>beforeEach: <strong style="color: var(--rose);">${hooks.beforeEach.toFixed(0)}ms</strong></span>` : ''}
        ${hooks.beforeAll ? `<span>beforeAll: <strong style="color: var(--rose);">${hooks.beforeAll.toFixed(0)}ms</strong></span>` : ''}
        ${hooks.afterEach ? `<span>afterEach: <strong style="color: var(--rose);">${hooks.afterEach.toFixed(0)}ms</strong></span>` : ''}
      </div>
    </div>
    `
  }

  private renderDiagnosis(diag: Diagnosis): string {
    const scorePct = (diag.score * 100).toFixed(0)
    return `
    <div class="diagnosis-item">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <strong style="font-size: 0.875rem;">${formatCategoryName(diag.cause)}</strong>
          <span class="badge badge-sky font-mono">${diag.cause}</span>
        </div>
        <span class="font-mono" style="font-size: 0.75rem; font-weight: 700; color: var(--rose);">${scorePct}% score</span>
      </div>

      <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8125rem; color: var(--text-muted);">
        ${diag.evidence.map(ev => `
          <li style="display: flex; align-items: flex-start; gap: 0.5rem;">
            <span style="color: var(--rose);">•</span>
            <span>${escapeHtml(ev)}</span>
          </li>
        `).join('')}
      </ul>

      ${diag.suggestion ? `
      <div style="background: rgba(255, 255, 255, 0.04); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; font-size: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.06); display: flex; align-items: flex-start; gap: 0.5rem;">
        <span>💡</span>
        <div style="color: var(--text-main);"><strong style="color: var(--amber);">Suggestion:</strong> ${escapeHtml(diag.suggestion)}</div>
      </div>
      ` : ''}
    </div>
    `
  }

  private renderStaticFinding(finding: StaticFinding, cwd: string): string {
    const relFile = path.isAbsolute(finding.file) ? path.relative(cwd, finding.file) : finding.file
    return `
    <div class="font-mono" style="background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.5rem; font-size: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="color: var(--rose); font-weight: 600;">${escapeHtml(finding.name)}</span>
        <span style="display: block; font-size: 0.6875rem; color: var(--text-dim);">${escapeHtml(relFile)}:${finding.line}</span>
      </div>
      <span class="badge badge-sky" style="font-size: 0.625rem;">${finding.type}</span>
    </div>
    `
  }

  private renderConfigAdvices(advices: ConfigAdvice[]): string {
    return `
    <section class="advisor-section">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.25rem;">💡</span>
          <strong style="font-size: 1rem; color: #ffffff;">Vitest Config Optimization Advisor</strong>
          <span class="badge badge-purple">${advices.length} Prescription${advices.length === 1 ? '' : 's'}</span>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-dim);">Automated configuration tuning</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
        ${advices.map(advice => `
          <div class="advice-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
              <strong style="font-size: 0.875rem; color: #ffffff;">${escapeHtml(advice.title)}</strong>
              <span class="badge ${advice.impact === 'high' ? 'badge-rose' : 'badge-amber'}">${advice.impact.toUpperCase()}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--emerald); font-weight: 600;">
              ⚡ Estimated speedup: ${escapeHtml(advice.estimatedSpeedup)}
            </div>
            <p style="font-size: 0.8125rem; color: var(--text-muted); line-height: 1.4;">
              ${escapeHtml(advice.reason)}
            </p>
            <div style="font-size: 0.75rem; color: var(--text-dim);">
              <strong style="color: var(--text-main);">Prescription:</strong> ${escapeHtml(advice.prescription)}
            </div>
            <pre class="advice-code font-mono">${escapeHtml(advice.configSnippet)}</pre>
          </div>
        `).join('')}
      </div>
    </section>
    `
  }

  private renderBudgetViolationBadges(violations: BudgetViolation[]): string {
    const counts: Record<string, number> = {}
    for (const v of violations) {
      counts[v.rule] = (counts[v.rule] || 0) + 1
    }

    const pills: string[] = []
    if (counts.failOnRegressionPercent || counts.maxRegressions) {
      const regCount = (counts.failOnRegressionPercent || 0) + (counts.maxRegressions || 0)
      pills.push(`<span class="badge badge-rose font-mono" style="font-size: 0.6875rem;">${regCount} regression(s)</span>`)
    }
    if (counts.maxTotalDurationMs || counts.maxSuiteDuration) {
      pills.push(`<span class="badge badge-rose font-mono" style="font-size: 0.6875rem;">Suite duration</span>`)
    }
    if (counts.maxTestDuration || counts.maxSlowTests) {
      const slowCount = (counts.maxTestDuration || 0) + (counts.maxSlowTests || 0)
      pills.push(`<span class="badge badge-rose font-mono" style="font-size: 0.6875rem;">${slowCount} slow test(s)</span>`)
    }
    if (counts.failOnP95Ms || counts.maxP95Duration) {
      pills.push(`<span class="badge badge-rose font-mono" style="font-size: 0.6875rem;">p95 breached</span>`)
    }
    if (counts.maxSuspiciousTests) {
      pills.push(`<span class="badge badge-rose font-mono" style="font-size: 0.6875rem;">${counts.maxSuspiciousTests} suspicious</span>`)
    }

    return `<div style="display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap;">${pills.join('')}</div>`
  }

  private renderBudgetViolationsList(violations: BudgetViolation[]): string {
    if (violations.length <= 2) {
      return `
        <div style="margin-top: 0.375rem; font-size: 0.8125rem; display: flex; flex-direction: column; gap: 0.25rem; opacity: 0.95;">
          ${violations.map(v => `<div>• <strong>[${escapeHtml(v.rule)}]</strong> ${escapeHtml(v.message)}</div>`).join('')}
        </div>
      `
    }

    const firstTwo = violations.slice(0, 2)
    const remaining = violations.slice(2)

    return `
      <div style="margin-top: 0.375rem; font-size: 0.8125rem; display: flex; flex-direction: column; gap: 0.25rem; opacity: 0.95;">
        ${firstTwo.map(v => `<div>• <strong>[${escapeHtml(v.rule)}]</strong> ${escapeHtml(v.message)}</div>`).join('')}
        <details class="budget-details" style="margin-top: 0.25rem;">
          <summary style="cursor: pointer; font-size: 0.75rem; font-weight: 600; color: #fca5a5; user-select: none; padding: 0.25rem 0;">
            ▾ Show all ${violations.length} violations (${remaining.length} more)
          </summary>
          <div style="margin-top: 0.375rem; max-height: 150px; overflow-y: auto; padding: 0.5rem; background: rgba(0, 0, 0, 0.35); border: 1px solid var(--rose-border); border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.75rem; line-height: 1.5; color: #fecdd3; display: flex; flex-direction: column; gap: 0.25rem;">
            ${remaining.map(v => `<div>• [${escapeHtml(v.rule)}] ${escapeHtml(v.message)}</div>`).join('')}
          </div>
        </details>
      </div>
    `
  }
}

function formatCategoryName(cause: string): string {
  return cause
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
