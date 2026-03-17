## Summary
<!-- What does this PR do? Link the related issue if applicable. -->

## Affected Pages/Components
<!-- List specific pages and components this change touches (e.g., "FunctionsPage.tsx", "InsightsConfigSidebar.tsx") -->

-

## Visual Changes
<!-- If styling changed, describe what and why. Include before/after screenshots if possible. -->
<!-- If no visual changes, write "None" -->

## Checklist

- [ ] Changes scoped to specific component/page files (no `globals.css` or `tailwind.config.js` modifications)
- [ ] No new inline `style={{ }}` for theme colors (use Tailwind classes mapped to CSS variables)
- [ ] `npm run build` passes with zero errors
- [ ] UI components imported from `@/components/ui/*` (no parallel implementations)
- [ ] Consulted `DESIGN_SYSTEM.md` for correct color tokens (if styling was changed)
