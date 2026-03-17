# Lessons Learned

Bugs, gotchas, and insights from things that went wrong (or almost did).

---

## 2026-03-11 Tailwind v4 CSS import order breaks component rendering

**Problem**: All dialog boxes (and potentially other shadcn/Radix components) appeared transparent/unreadable after a Tailwind upgrade.
**Root cause**: Tailwind v4 changed how CSS layers work. `globals.css` (which defines `:root` CSS custom properties like `--background`, `--foreground`) was being imported *after* component styles in the app entry point. Components couldn't resolve the CSS variables at render time.
**Fix**: Ensure `globals.css` is imported as the very first stylesheet in `main.tsx`, before any component imports.
**Takeaway**: When upgrading Tailwind, always verify CSS import order. CSS custom property definitions must load before any component that references them.

## 2026-03 CI: Python 3.12 wheel build failure for pandas

**Problem**: CI pipeline failed because pandas couldn't build from source on Python 3.12.
**Root cause**: The pinned pandas version didn't have pre-built wheels for Python 3.12.
**Fix**: Upgraded pandas to a version with 3.12 wheel support.
**Takeaway**: When bumping Python versions in CI, check that all pinned dependencies have compatible wheels.

## General: In-memory sessions are lost on restart

**Impact**: Any backend restart (deploy, crash) loses all uploaded CSV sessions. Users need to re-upload.
**Mitigation**: This is a known trade-off for simplicity. For critical experiments, analysts should save their reports to Supabase before the session expires.
**Future**: Consider session persistence (Redis or disk-backed store) if this becomes a frequent pain point.

---

<!-- Add new lessons as they emerge -->
