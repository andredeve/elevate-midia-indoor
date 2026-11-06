# UI Redesign Implementation Plan

## Goal Description
Create a modern, premium admin UI for **midia‑indoor‑admin** inspired by top‑tier admin panels (Linear, Vercel, Stripe). Replace the previous utilitarian styling with a design system that features:
- Dark‑mode background with neon accent
- Refined typography (Inter font)
- Glass‑morphism style cards (`glass-panel` → `card`)
- Smooth micro‑animations for interactions
- Consistent spacing, radius, shadows, and motion tokens
- Updated components (Sidebar, Topbar, Pages, Modals, Forms, Tables, Terminal cards) to use the new CSS classes.

## User Review Required
> [!IMPORTANT]
> This redesign will **change class names and markup** across many files (`Layout.tsx`, `Terminals.tsx`, `Login.tsx`, any other page components). It will break existing custom CSS selectors and may require updates to any external stylesheets or tests.
> Please confirm you are comfortable with a sweeping UI overhaul before we proceed.

## Open Questions
- Do you want to keep the current dark color palette or explore a lighter variant?
- Should we retain the existing **glass‑panel** class for backward compatibility (alias to `card`), or drop it entirely?
- Any branding colors besides the neon `#c8ff00` that must be incorporated?

## Proposed Changes
---
### Layout & Global Styles
- **[MODIFY] src/components/Layout.tsx** – Update class names (`sidebar`, `topbar`, `main-content`, etc.) to match new design tokens. Replace `glass-panel` with `card`. Add `nav-section-label` for grouped navigation.
- **[MODIFY] src/pages/Login.tsx** – Switch to `auth-container`/`auth-card` with new typography, button classes (`btn-primary`), and loading indicator.
- **[MODIFY] src/pages/Terminals.tsx** – Refactor terminal cards to use `.terminal-card`, `.terminal-actions`, `.badge` components. Apply new badge colors for status.
- **[NEW] src/components/StatCard.tsx** – Reusable component for dashboard stats using `.stat-card` styles.
- **[NEW] src/components/Modal.tsx** – Centralised modal component using `.modal-overlay` and `.modal` classes.
- **[NEW] src/components/ToggleSwitch.tsx** – Custom toggle using `.toggle-track` and `.toggle-thumb`.
- **[DELETE] Any leftover `glass-panel` CSS usage** – Convert to `.card`.

### Specific Pages
- **Dashboard.tsx** – Replace old metric cards with `<StatCard>` components, adjust grid to `.stat-grid`.
- **MediaLibrary.tsx**, **Playlists.tsx** – Update tables to use `.data-table` and new button styles.
- **Terminals.tsx** – Use new terminal card markup, badge components, and toggle rows for options.

### Global Tokens
- **[MODIFY] src/index.css** – Already added a full design system with CSS variables and component classes.
- **[NEW] src/components/ThemeProvider.tsx** – Optional wrapper to inject the `Inter` font link and set `data-theme="dark"` on `<html>`.

## Verification Plan
### Automated Tests
- Run `npm run test` (if test suite exists) to ensure no compile errors after JSX updates.
- Execute `npm run build` to verify bundling succeeds.

### Manual Verification
- Launch the admin app (`npm run dev`).
- Verify the sidebar navigation, topbar user chip, and page content render with new styles.
- Check all modals (Add/Edit Terminal) open and close with expected animations.
- Confirm responsive behavior on mobile (sidebar collapses, toggle menu works).
- Validate forms (login, terminal creation) function correctly.
- Ensure colour contrast meets WCAG AA.

---
*Implementation will be incremental; after each component update we will run the build to catch regressions.*
