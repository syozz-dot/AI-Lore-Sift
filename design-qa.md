# Mobile Story Detail QA

## Visual references

- Homepage baseline: `/private/tmp/ann-mobile-home.png`
- Story overflow baseline: `/private/tmp/ann-mobile-story.png`
- Primary route: `/stories/inkling-small-51202629cf`
- Primary viewport: `390 x 844`

## Acceptance checklist

- [x] The document has no page-level horizontal scroll at 360 px, 390 px, or 430 px.
- [x] The story title, deck, metadata, and original-source link wrap within the viewport.
- [x] Story facts and body copy remain readable without clipping.
- [x] Images, video, embeds, code blocks, and tables cannot widen the page.
- [x] Wide code blocks and tables scroll inside their own container when necessary.
- [ ] The mobile navigation still opens, closes, and leaves the story content usable.
- [ ] Homepage mobile layout remains unchanged apart from safe text wrapping.

## Result

Status: production story layout verified at 360 x 800, 390 x 844, and 430 x 932. In all three viewports, document and body `clientWidth` equal `scrollWidth`; the story header, deck, signal bar, reading layout, and reading card remain inside the viewport. Navigation interaction and homepage visual regression remain manual checks.

---

# Private Settings Screenshot QA

## Evidence

- Source visual truth:
  - `/private/var/folders/g3/xqn3hc0j41dfmdkr1_zkhyxw0000gn/T/codex-clipboard-CNIaEC.png` (`1764 x 1778`)
  - `/private/var/folders/g3/xqn3hc0j41dfmdkr1_zkhyxw0000gn/T/codex-clipboard-ujngm5.png` (`1594 x 1836`)
  - `/private/var/folders/g3/xqn3hc0j41dfmdkr1_zkhyxw0000gn/T/codex-clipboard-em7YDe.png` (`1682 x 1270`)
- Route: `/settings`
- State: dark theme; empty five-field profile; three confirmed memories; persistence not guaranteed.
- Implementation screenshot: unavailable because no Browser surface was connected in this session.
- Browser-rendered viewport, CSS size, density normalization, console check, and interaction evidence: unavailable for the same reason.
- HTTP evidence: the production build serves `/settings` with `200 OK` and renders the revised title and product-facing description.

## Full-view comparison

Blocked. The three source crops were opened and reviewed, but a browser-rendered implementation screenshot could not be captured, so the source and implementation could not be placed into the required same-state visual comparison.

## Focused-region comparison

Blocked for the same reason. The intended focused regions are the single-column profile card, compact memory rows, and the 2 x 2 backup-card grid.

## Findings

- [P2] Visual fidelity is not yet browser-verified.
  - Location: `/settings` at desktop and mobile widths.
  - Evidence: source screenshots are available; implementation capture is not.
  - Impact: typography, card height, responsive wrapping, and dark-theme contrast may still have visible drift.
  - Fix: capture the rendered page in the same dark-theme states, compare side by side, and correct any P1/P2 mismatch.

## Required fidelity surfaces

- Fonts and typography: implementation retains the project serif/Manrope/monospace system and screenshot hierarchy; browser comparison pending.
- Spacing and layout rhythm: code now follows the source's vertical document flow, single-column profile card, compact memory list, and 2 x 2 backup grid; visual measurement pending.
- Colors and visual tokens: existing canvas, elevated surface, line, ink, and accent tokens are reused; browser contrast check pending.
- Image quality and asset fidelity: the source contains no raster imagery; visible icons use the existing Phosphor icon library.
- Copy and content: the process-oriented introduction was replaced with durable product copy about reading preferences, personal memory, and local backup.

## Comparison history

- Pass 1: source screenshots opened; implementation build and HTTP render passed; browser capture unavailable, so no visual fixes can be claimed from a direct comparison.

## Implementation checklist

- [x] Preserve local-only storage, explicit profile save, memory withdrawal, encrypted export, and inspected restore behavior.
- [x] Recompose the page into the reference's three-section editorial layout.
- [x] Replace process language with general product-facing copy.
- [ ] Capture desktop dark, desktop light, and narrow mobile states in a connected Browser surface.
- [ ] Test save, add/withdraw memory, persistence request, export validation, and import inspection in Browser.

final result: blocked
