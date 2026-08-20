# ArthaFlow Design System (Graphite Sage)

The internal design system of **ArthaFlow**. Engineered for a calm, disciplined personal finance environment prioritizing emotional composure, tabular precision, and high-density minimalism.

---

## 1. Core Principles

1. **High-Density Minimalism**: Information density is high and balanced by a 4px baseline grid. We avoid decorative trends (gradients, glassmorphism, glowing borders, skeuomorphic trophies) in favor of structural clarity and tonal layering.
2. **Emotional Composure**: Financial interfaces should feel permanent and trustworthy like an executive physical ledger. Red alerts are muted into warm terracotta-brown (`--expense: #c17d76`); positive balances use sage green (`--income: #76a783`).
3. **Tabular Precision**: Every currency amount and financial delta is rendered with `font-variant-numeric: tabular-nums` to ensure exact column alignment.
4. **Single Source of Truth**: Every interactive component (inputs, selects, buttons, dialogs, progress tracks) adheres to shared tokens and consistent semantic hierarchies.

---

## 2. Color Palette & Semantics

All colors in ArthaFlow are mapped to semantic CSS custom properties.

### Dark Mode (Default Canvas)

```css
:root {
  /* Foundations */
  --bg: #0d100e; /* Base canvas */
  --surface: #141916; /* Cards, list containers */
  --surface-raised: #1a201c; /* Modals, popovers, tooltips */
  --surface-hover: #1d241f; /* Interactive hover states */

  /* Structural Borders */
  --border-subtle: #202722; /* Dividers, inactive tracks */
  --border: #2a322c; /* Card & input borders */
  --border-strong: #364038; /* Active/hover borders */

  /* Typography */
  --text: #eef1ec; /* Primary text / titles */
  --text-secondary: #a4aca5; /* Supporting text / labels */
  --text-muted: #707a72; /* Metadata / captions */
  --text-faint: #515a53; /* Placeholder / disabled */

  /* Brand & Semantics */
  --brand: #91ad91; /* Sage accent / active links */
  --brand-strong: #a3bda3; /* High-emphasis sage */
  --brand-muted: #718b73; /* Charts & progress fills */
  --brand-subtle: #202b22; /* Tag backgrounds */

  /* Financial Semantics */
  --income: #76a783; /* Income / positive net */
  --expense: #c17d76; /* Expense / negative net */
  --warning: #b89a62; /* Budget warnings */
  --focus: #9ab69a; /* Keyboard focus ring */
}
```

### Light Mode (Soft Off-White Eye Comfort)

```css
[data-theme="light"] {
  --bg: #eef0ea;
  --surface: #f5f6f2;
  --surface-raised: #fafbf7;
  --surface-hover: #e8ebe5;

  --border-subtle: #dde1da;
  --border: #cdd3cb;
  --border-strong: #bec6bd;

  --text: #20251f;
  --text-secondary: #596159;
  --text-muted: #747d75;
  --text-faint: #989f98;

  --brand: #58745a;
  --brand-strong: #476149;
  --brand-muted: #718b73;
  --brand-subtle: #e5ebe4;

  --income: #4f7e5b;
  --expense: #a85c55;
  --warning: #8e743e;
  --focus: #58745a;
}
```

---

## 3. Spacing Scale (4px Baseline)

| Token        | Pixels | Usage                                       |
| :----------- | :----- | :------------------------------------------ |
| `--space-1`  | `4px`  | Fine gaps, label-to-input gap, icon offsets |
| `--space-2`  | `8px`  | Inner button padding, compact gaps          |
| `--space-3`  | `12px` | Form field bottom margin, medium gaps       |
| `--space-4`  | `16px` | Card internal padding, standard gaps        |
| `--space-5`  | `20px` | Section margins, dialog padding             |
| `--space-6`  | `24px` | Page header margins, larger containers      |
| `--space-8`  | `32px` | Major section separations                   |
| `--space-10` | `40px` | Hero section margins                        |
| `--space-12` | `48px` | Page bottom padding                         |
| `--space-16` | `64px` | Workspace boundaries                        |

---

## 4. Control Dimensions & Radius

### Control Heights

- **`--control-sm: 32px`**: Compact toolbar actions, pagination buttons, small tag buttons.
- **`--control-md: 40px`** _(Standard/Default)_: Form inputs, selects, search bars, standard primary/secondary buttons.
- **`--control-lg: 44px`**: Mobile-optimized form fields, full-width authentication controls.

### Radius Scale

- **`--radius-sm: 6px`**: Buttons, text inputs, selects, chips, chart tooltips.
- **`--radius-md: 8px`**: Cards, data list containers, grouped widgets.
- **`--radius-lg: 10px`**: Modal dialogs, popup overlays.
- **`--radius-full: 9999px`**: Status indicator dots and avatar circles only (never normal buttons).

---

## 5. Typography Hierarchy

Primary font: **Geist** (`sans-serif`).

| Level                  | Size / Weight               | Line Height | Usage                                           |
| :--------------------- | :-------------------------- | :---------- | :---------------------------------------------- |
| **Hero / Money Large** | `1.75rem – 2.25rem` / `600` | `1.2`       | Overview net balance (Tabular Nums)             |
| **Page Title (`h1`)**  | `1.15rem` / `600`           | `1.3`       | `/transaksi`, `/analisis`, `/budget`, `/tujuan` |
| **Section Title**      | `0.85rem – 0.95rem` / `600` | `1.4`       | Card & section headers                          |
| **Body (Default)**     | `0.82rem – 0.85rem` / `400` | `1.5`       | Descriptions, list item titles                  |
| **Body Strong**        | `0.82rem – 0.85rem` / `500` | `1.5`       | Category names, emphasized data                 |
| **Meta / Caption**     | `0.72rem – 0.78rem` / `400` | `1.4`       | Timestamps, secondary notes, table headers      |

---

## 6. Button Hierarchy

1. **Primary (`.btn-primary`, `.btn-submit`)**:
   - High-contrast solid fill (`background: var(--text); color: var(--bg)`).
   - Used for the singular primary action on a screen or modal (e.g. _Catat transaksi_, _Masuk_, _Simpan_).
2. **Secondary (`.btn-secondary`, `.btn-cancel`)**:
   - Subtle 1px border (`border: 1px solid var(--border); background: transparent; color: var(--text-secondary)`).
   - Hover switches background to `var(--surface-hover)` and text to `var(--text)`.
   - Used for affirmative secondary actions (_Tambah tujuan_, _Tambah dana_, _Atur budget_).
3. **Ghost (`.btn-ghost`)**:
   - Borderless (`background: transparent; color: var(--text-muted)`).
   - Used for low-emphasis utility actions (_Batal_, _Reset filter_).
4. **Destructive (`.btn-destructive`, `.goal-delete-btn`)**:
   - Terracotta accent (`border: 1px solid var(--expense); color: var(--expense)`).
   - Used solely for permanent deletion/removal actions (_Hapus target_, _Hapus transaksi_).
   - **Rule**: Normal expense records are _never_ styled as destructive buttons.

---

## 7. Form Controls & Validation

### Standard Structure

```html
<div className="field">
  <label className="field-label">Nama Tujuan</label>
  <input type="text" className="input" placeholder="Cth. Dana Darurat" />
  <span className="field-help">Target tabungan mandiri.</span>
  <span className="field-error">Nama tidak boleh kosong.</span>
</div>
```

- **Input & Select**: Height `var(--control-md)` (40px), 1px solid `var(--border)`, background `var(--surface)`.
- **Focus**: Clear 2px outline `var(--focus)` with 0px or 2px offset. No glowing shadow.
- **Error Grammar**:
  - Field-level validation: Red inline text (`.field-error` in `var(--expense)`).
  - Server / Network failures: Toast notification via `sonner`.

---

## 8. Dialog Standards

- **Overlay**: Fixed inset with solid/semi-transparent background (`rgba(0, 0, 0, 0.72)`). **No `backdrop-filter: blur()`**.
- **Surface**: `var(--surface-raised)`, 1px border `var(--border)`, radius `var(--radius-lg)`.
- **Standard Widths**:
  - Small (`.dialog-content--sm`): `360px`
  - Medium (Default `.dialog-content`): `440px` (Max width `min(var(--dialog-md), calc(100vw - 32px))`)
  - Large (`.dialog-content--lg`): `560px`
- **Actions**: Aligned right in `.dialog-footer` (Ghost _Batal_ on left, Primary/Destructive on right).

---

## 9. Empty States & Tooltips

### Empty States

- **Page Level (`.empty-state`)**: Centered layout, calm muted statement, optional secondary CTA button.
- **Inline / Section Level (`.empty-state--inline`, `.goal-inline-empty`)**: Compact single-row text with optional inline button.
- **Rule**: Never use illustrative cartoons, empty treasure chests, or emojis.

### Tooltips

- **Universal Tooltip (`.chart-tooltip`, `.tooltip`)**: Solid `var(--surface-raised)` with 1px `var(--border)`, tabular numerals, subtle dark shadow `0 4px 12px rgba(0, 0, 0, 0.35)`. No frosted glass.

---

## 10. Progress Bars

- **Track Height**: Standardized at `4px` (or `5px` in compact goal cards).
- **Track Background**: `var(--border-subtle)`.
- **Fill Radius**: `2px` – `3px`.
- **Contextual Fills**:
  - Goal In-Progress: `var(--brand)`
  - Goal Completed: `var(--income)`
  - Category / Budget Standard: `var(--brand-muted)`
  - Budget Over-limit: `var(--expense)`
- **Rule**: No continuous shimmer or gradient animations when idle.

---

## 11. Motion & Reduced Motion

- **Durations**:
  - Instant: `80ms` (color changes)
  - Fast: `140ms` (hover, button clicks)
  - Normal: `220ms` (dialog enter, tab switch)
  - Progress transition: `300ms ease-out`
- **Accessibility**: Automatically disables animations and transitions when `prefers-reduced-motion: reduce` is active.

---

## 12. Do's and Don'ts

| Do                                                                    | Don't                                                            |
| :-------------------------------------------------------------------- | :--------------------------------------------------------------- |
| Use `tabular-nums` on all money amounts and deltas                    | Mix proportional and monospaced number alignments                |
| Use 1px borders and tonal surfaces for elevation                      | Add heavy drop shadows, neon glows, or frosted blurs             |
| Keep idle dashboards still and calm                                   | Add continuous looping animations or shimmering bars             |
| Use explicit 4px baseline spacing (`--space-1` to `--space-16`)       | Introduce arbitrary margins (e.g. `13px`, `27px`)                |
| Use `.btn-primary` for the single primary CTA                         | Make every button on the screen primary                          |
| Use `var(--expense)` for financial expenses and destructive deletions | Make standard expense rows look like destructive warning buttons |
