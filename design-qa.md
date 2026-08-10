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
