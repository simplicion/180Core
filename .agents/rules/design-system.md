# 180 Workspace & 180 Core Sovereign Design System

**Status:** Strictly Enforced  
**Applies to:** All applications (`apps/*`) and shared UI packages (`packages/ui`, `packages/*`).

---

## 1. Aesthetic Identity & Design Philosophy

The 180 Workspace and 180 Core design language embodies **Sovereign Luxury SaaS**: a fusion of obsidian dark mode, crisp porcelain light mode, micro-precision borders, translucent glassmorphism, and editorial typography.

### Dual-Mode Surface Palette
- **Obsidian True-Black Dark Mode**:
  - Base Canvas: Pure Black `#000000` (`bg-black`). **Never** use blue/navy-tinted dark backgrounds (e.g. `slate-900`, `#0f172a`).
  - Elevated Surfaces & Cards: Deep Charcoal `#101012` / `bg-zinc-950` / `bg-zinc-900/60`.
  - Nested Panels & Badges: `#161619` / `bg-zinc-900` / `bg-white/[0.03]`.
  - Borders: Crisp, hairline borders `border-white/10` or `border-zinc-800`.
- **Porcelain Clean Light Mode**:
  - Base Canvas: Clean Off-White `#f8fafc` / `bg-zinc-50`.
  - Elevated Surfaces & Cards: Pure White `#ffffff` (`bg-white`).
  - Nested Panels & Badges: Soft Zinc `#f4f4f5` / `bg-zinc-100`.
  - Borders: Subtle neutral borders `border-zinc-200/80` or `border-zinc-200`.

### Glassmorphism & Translucency
Frosted glass panels provide visual depth without cluttering the hierarchy:
- Standard Glass Panel: `.glass-panel`  
  `backdrop-blur-md bg-white/70 dark:bg-black/70 border border-zinc-200/80 dark:border-white/10`
- Interactive Glass Panel: `.glass-panel-interactive`  
  `backdrop-blur-md bg-white/80 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-300`

---

## 2. Typography & Font System

Typography is the cornerstone of the 180 visual identity. All interfaces must prioritize **effortless readability**, **balanced character geometry**, and **consistent typographic hierarchy**.

### Core Typefaces

#### 1. Primary Brand & UI Font: **`Satoshi`**
- **Classification**: Modern Geometric Neo-Grotesque Sans-Serif (by Indian Type Foundry / Fontshare).
- **Why Satoshi**: Features generous x-height, open counters, clear terminals, and balanced metrics that remain razor-sharp and readable from 10px micro-labels up to 72px display headers.
- **CDN Integration**:
  ```html
  <link rel="preconnect" href="https://api.fontshare.com" />
  <link
    href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap"
    rel="stylesheet"
  />
  ```
- **Fallback Font Stack**:
  ```css
  font-family: 'Satoshi', var(--font-sans, 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  ```

#### 2. Technical, Monospace & Numeric Font: **`Fira Code` / `JetBrains Mono`**
- **Usage**: Currency amounts, transaction hashes, session IDs, client secrets, API tokens, metrics, timestamps, and terminal code.
- **Fallback Font Stack**:
  ```css
  font-family: var(--font-mono, 'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  ```

### Rendering & Antialiasing Standards
All `body` elements across all apps must declare:
```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

---

### Typographic Hierarchy Matrix

| Element | Size / Tailwind Class | Weight | Tracking | Leading | Purpose / Example |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | `text-4xl` to `text-6xl` (36–60px) | `font-black` (900) | `tracking-tight` (-0.03em) | `leading-none` | Landing headlines, grand titles |
| **Primary Page Header (H1)** | `text-2xl` to `text-3xl` (24–30px) | `font-black` or `font-bold` | `tracking-tight` (-0.025em) | `leading-tight` | Dashboard title ("Executive Pulse") |
| **Section Header (H2)** | `text-lg` to `text-xl` (18–20px) | `font-bold` (700) | `tracking-tight` (-0.02em) | `leading-snug` | Major view section titles |
| **Card / Module Title (H3)** | `text-sm` to `text-base` (14–16px) | `font-bold` / `font-semibold` | `tracking-tight` | `leading-normal` | Widget headings ("Volume Leaderboard") |
| **KPI Big Number** | `text-2xl` to `text-3xl` (24–30px) | `font-black font-mono` | `tracking-tight` | `leading-none` | Large stat readouts (`$152.76`) |
| **Primary Body Copy** | `text-sm` (14px) | `font-normal` (400) / `font-medium` | `tracking-normal` | `leading-relaxed` (1.6) | Explanatory paragraphs, readable descriptions |
| **Secondary Body / Table Cells**| `text-xs` (12px) | `font-normal` (400) | `tracking-normal` | `leading-normal` | Standard table row data, form helper text |
| **Eyebrow / Category Badges** | `text-[10px]` to `text-[11px]` | `font-bold` or `font-semibold` | `tracking-wider` / `uppercase` | `leading-none` | Sub-labels, table column headers (`SESSION ID`) |
| **Micro Status Badges** | `text-[9px]` to `text-[10px]` | `font-bold font-mono` | `tracking-wide` | `leading-none` | Pills (`CAPTURED`, `PAID`, `ACTIVE`) |

---

### Text Contrast & Color Rules

1. **High-Emphasis Primary Text**:
   - `text-zinc-950 dark:text-white`
   - Use for: Page headings, card titles, primary values, active tab text.
2. **Medium-Emphasis Secondary Text**:
   - `text-zinc-800 dark:text-zinc-200`
   - Use for: Table primary values, form labels, emphasized descriptions.
3. **Low-Emphasis Tertiary / Body Text**:
   - `text-zinc-600 dark:text-zinc-400`
   - Use for: Paragraphs, subtitles, guidance copy. Ensures high contrast without eye strain.
4. **Muted / Metadata Text**:
   - `text-zinc-400 dark:text-zinc-500`
   - Use for: Timestamps, secondary IDs, table column headers, helper hints.
5. **Interactive Brand Link Text**:
   - `text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline`

---

## 3. Color Tokens & Semantic Accents

### Electric Brand Blue
- Base: `#2563eb` (`blue-600`)
- Hover: `#3b82f6` (`blue-500`)
- Deep: `#1d4ed8` (`blue-700`)
- Tinted Badges / Glows: `bg-blue-500/10 text-blue-500 border-blue-500/20`
- Shadow Glow: `shadow-md shadow-blue-500/20`

### Semantic Status Tokens
Every status badge or indicator must pair an icon, tinted background, border, and colored text:

* **Success / Live / Operational**:
  - Classes: `bg-emerald-500/10 text-emerald-500 border border-emerald-500/20`
  - Dot: `h-2 w-2 rounded-full bg-emerald-500`
  - Values: `CAPTURED`, `PAID`, `ACTIVE`, `VERIFIED`, `RESOLVED`
* **Warning / Pending / Escrow**:
  - Classes: `bg-amber-500/10 text-amber-500 border border-amber-500/20`
  - Dot: `h-2 w-2 rounded-full bg-amber-500`
  - Values: `PENDING`, `PENDING_REVIEW`, `PROCESSING`, `MEDIUM`
* **Destructive / Error / Reversal**:
  - Classes: `bg-rose-500/10 text-rose-500 border border-rose-500/20`
  - Dot: `h-2 w-2 rounded-full bg-rose-500`
  - Values: `FAILED`, `REJECTED`, `SUSPENDED`, `LOCKED`, `URGENT`
* **Sovereign / Escrow / Special**:
  - Classes: `bg-purple-500/10 text-purple-500 border border-purple-500/20`
  - Dot: `h-2 w-2 rounded-full bg-purple-500`
  - Values: `REFUNDED`, `ESCROW`, `SOVEREIGN_WALLET`, `LICENSE`

---

## 4. Radii, Spacing & Elevation

### Corner Radii Hierarchy
- **Pills & Micro Badges**: `rounded-full` (`rounded-full px-2.5 py-0.5`)
- **Buttons, Inputs, Dropdowns**: `rounded-xl` (`12px`)
- **Cards, Modules, Small Modals**: `rounded-2xl` (`16px`)
- **Large Panels, Main Shell Containers, Dashboards**: `rounded-3xl` (`24px`)

### Elevation & Shadows
- **Light Mode Rest**: `shadow-sm` or `shadow-md shadow-black/[0.04]`
- **Light Mode Hover**: `shadow-lg shadow-black/5`
- **Dark Mode Rest**: `shadow-none border border-white/10`
- **Dark Mode Glow**: `dark:shadow-[0_4px_24px_rgba(255,255,255,0.02)]`
- **Modals & Flyouts**: `shadow-2xl shadow-black/30 dark:shadow-[0_20px_60px_rgba(0,0,0,0.8)]`

### Spacing & Grid Rules
- Use CSS Grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`) for dashboard widgets and metric cards.
- Maintain consistent padding inside cards:
  - Small / compact cards: `p-4` or `p-5`
  - Large / primary dashboard cards: `p-6` or `p-8`
- Button touch targets: minimum height of `36px` (`min-h-[36px]` on mobile/desktop).

---

## 5. Component Patterns

### 1. KPI Stat Cards
```tsx
<div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm relative overflow-hidden group">
  <div className="text-xs text-zinc-500 flex items-center justify-between">
    <span>Platform GMV (30D)</span>
    <DollarSign className="h-4 w-4 text-blue-500" />
  </div>
  <div className="text-2xl font-black font-mono text-zinc-900 dark:text-white mt-3">
    $152.76
  </div>
  <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
    <span className="text-emerald-500 font-bold">+100%</span> volume velocity
  </div>
</div>
```

### 2. Sovereign Ledger Tables
- Table headers: `text-zinc-400 text-[11px] uppercase tracking-wider font-semibold bg-zinc-50/50 dark:bg-white/[0.02] py-3.5 px-4`.
- Rows: `hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors divide-y divide-zinc-100 dark:divide-white/5`.
- Primary identifiers: `font-mono text-xs font-semibold text-zinc-900 dark:text-white`.
- Amounts: `font-bold font-mono text-zinc-900 dark:text-white`.

### 3. Primary Buttons
```tsx
<button className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center gap-2">
  <span>Confirm Action</span>
</button>
```

### 4. Secondary / Ghost Buttons
```tsx
<button className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10 transition-colors flex items-center gap-2">
  <span>Export CSV</span>
</button>
```

---

## 6. Strict Do's & Don'ts

| Do | Don't |
| :--- | :--- |
| **DO** use `font-family: 'Satoshi'` with fallback for all text. | **DON'T** rely on generic default browser fonts. |
| **DO** use `font-mono` for all currencies, hashes, keys, and numbers. | **DON'T** render numeric data in proportional fonts with variable digit widths. |
| **DO** use `tracking-tight` on headings and `tracking-wider uppercase` on micro-labels. | **DON'T** leave heading tracking loose or untuned. |
| **DO** use pure black `#000000` / `zinc-950` in dark mode. | **DON'T** use navy or blue-tinted dark backgrounds (`slate-900`, `#0f172a`). |
| **DO** ensure every hardcoded light color has a `dark:` counterpart. | **DON'T** write light-mode-only styles that blind users in dark mode. |
| **DO** use `rounded-2xl` and `rounded-3xl` for modern, friendly surface boundaries. | **DON'T** use harsh square corners (`rounded-none` or `rounded-sm`) for cards. |
| **DO** use real data from live endpoints. | **DON'T** use mock multipliers, fake percentages, or synthetic test data. |
