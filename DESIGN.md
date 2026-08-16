---
name: AILore Sift
description: Distilled AI intelligence for product judgment.
colors:
  brand-pine: "#0B3D2E"
  focus-mineral-blue: "#2E4057"
  signal-green: "#1F6B4E"
  canvas: "#F2F4F2"
  surface: "#E9EDE9"
  surface-strong: "#DDE3DE"
  ink: "#161A17"
  ink-secondary: "#515B54"
  ink-tertiary: "#737D76"
  line: "#CBD2CC"
  line-strong: "#AEB8B0"
  light-ink: "#F1F5F2"
  danger: "#9A403B"
typography:
  display:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 450
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  none: "0px"
  circle: "50%"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "72px"
components:
  site-header:
    backgroundColor: "{colors.brand-pine}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.none}"
    height: "68px"
    padding: "0 24px"
  focus-panel:
    backgroundColor: "{colors.focus-mineral-blue}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.none}"
    padding: "32px"
  filter-selected:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 0"
  story-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px 0"
  story-row-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px 0"
---

# Design System: AILore Sift

## Overview

**Creative North Star: "The Editor's Signal Desk"**

AILore Sift should feel like the desk of an editor who has already removed the noise before the reader arrives. It combines the authority and pacing of an independent technology publication with the precision of a product tool: a compact daily briefing, one clearly framed focus, and a dense but calm Story queue.

The visual system is flat, two-tone, and structural. Deep pine anchors navigation and product identity; mineral blue is reserved for the single daily focus. Cool neutral surfaces, strong typography, and fine rules organize everything else. It explicitly rejects information waterfalls, academic-database density, and generic AI-summary cards without evidence.

**Key Characteristics:**

- Editorial hierarchy without marketing theatrics.
- Scan-first lists followed by clearly separated interpretation.
- Two authoritative dark colors, each with one role.
- Flat tonal layering, fine dividers, and no decorative elevation.
- Plain-language Chinese with evidence always nearby.

## Colors

The palette pairs a deep editorial pine with a restrained mineral blue, surrounded by cool neutral surfaces that keep long reading sessions clear.

### Primary

- **Deep Pine Navigation:** The permanent product anchor for the top navigation, active navigation state, and identity marks. It is never reused as a large content background.
- **Mineral Blue Focus:** The daily editorial focus plane and nowhere else. Its separation from the green header makes content priority unmistakable.
- **Signal Green:** Interactive emphasis, healthy-source states, relevance scores on light surfaces, and concise evidence labels. It remains under ten percent of any screen.

### Neutral

- **Cool Canvas:** The main reading background. It stays achromatic and must never drift into cream, sand, parchment, or warm beige.
- **Tonal Surfaces:** Two cool gray-green steps distinguish selected rows, secondary rails, loading states, and empty states without creating cards.
- **Near-Black Ink:** Headlines and primary reading text.
- **Secondary and Tertiary Ink:** Supporting summaries and metadata, darkened enough to preserve WCAG 2.2 AA contrast.
- **Structural Lines:** Fine separators for rows, columns, and section boundaries; stronger lines are reserved for major layout changes.

### Named Rules

**The Two-Color Authority Rule.** Deep pine belongs to navigation; mineral blue belongs to the daily focus. Never place the two colors in competing content panels.

**The Ten-Percent Signal Rule.** Signal green marks state and action, not decoration. If green draws the eye before the Story title, it is overused.

**The No-Warm-Paper Rule.** The canvas stays cool and nearly chroma-free. Warmth comes from editorial voice, never from a cream background.

## Typography

**Display Font:** Noto Serif SC (with Songti SC and serif fallbacks)  
**Body Font:** Manrope Variable (with PingFang SC, Microsoft YaHei, and sans-serif fallbacks)  
**Label/Mono Font:** JetBrains Mono Variable for scores, dates, and machine-like metadata only

**Character:** Editorial serif gives daily headings and Story titles authority; the humanist sans keeps explanations approachable for non-technical readers. Mono is evidence of system state, never the default reading voice.

### Hierarchy

- **Display** (600, 48px, 1.12): “今日 AI 简报” and other rare page-level editorial statements. Mobile reduces to 38–40px.
- **Headline** (600, 34px, 1.2): “今日焦点” and Story-detail headlines inside focused surfaces.
- **Title** (600, 22px, 1.35): Story titles in the feed. English paper titles may use the serif fallback, but line breaks must remain readable.
- **Body** (450, 15px, 1.7): Plain-language summaries and interpretation, capped at 65–75 characters per line.
- **Label** (650, 12px, 1.4): Navigation, filters, section labels, and explicit content boundaries.
- **Mono** (500, 11px, 1.5): Dates, times, scores, source counts, and indices.

### Named Rules

**The Editorial-Only Serif Rule.** Serif is reserved for page headings, the daily focus, and Story titles. Controls, navigation, labels, and body copy remain sans-serif.

**The Distilled Paragraph Rule.** A feed explanation should fit within three lines on desktop. Longer evidence belongs on the Story page.

## Elevation

The system uses no shadows. Depth comes from full-width tonal planes, section boundaries, selected-row fills, and fixed column rules. A surface that needs a shadow is either grouped incorrectly or carrying too much content.

### Named Rules

**The Flat-by-Default Rule.** Every surface is flat at rest. Hover and selection use color or a one-pixel line, never lift.

**The One-Pixel Structure Rule.** Dividers remain one pixel and use the structural-line tokens. Thick colored side stripes are prohibited.

## Components

### Navigation

- **Style:** A 68px full-width deep-pine identity bar with the square N mark and product name on the left, and external actions on the right.
- **Scope:** Content navigation lives in the filter row below the daily brief. Do not duplicate the same News / Papers / Products / Releases destinations in the header.
- **States:** Hover increases text contrast only; focus uses a visible two-pixel outline. No pills and no translucent glass layer.
- **Mobile:** Keep the brand and essential external action visible without shrinking tap targets.

### Daily Focus

- **Shape:** Edge-to-edge rectangular mineral-blue plane with no radius.
- **Hierarchy:** “今日焦点” is the only heading. It is followed by a concise factual explanation, then the explicit boundaries “发生了什么” and “产品启示”.
- **Score:** Relevance sits on a fixed right axis, visually separated by one structural rule.
- **Behavior:** The block links to the corresponding Story detail without inventing a separate CTA card.

### Filters

- **Style:** Text tabs on the canvas, spaced generously enough for touch. The selected filter uses ink text and a deep-pine underline.
- **Taxonomy:** Products means newly launched products from product-discovery sources; it is not a cross-type product-value lens. News, papers, and releases already use product relevance in ranking.
- **States:** Hover shifts to primary ink; focus is outlined; active never becomes a filled pill.

### Story Rows

- **Structure:** Source, type, time, Story title, distilled explanation, and score align on stable columns. Ordinary rows use the canvas; the lead row uses the tonal surface.
- **Separation:** One-pixel row rules and spacing define the group. Rows are not individual cards.
- **States:** Hover uses a subtle tonal fill. The title and directional arrow carry the click affordance.
- **Responsive:** Metadata wraps above the title; the score and evidence state move below the summary without shrinking text.

### Status and Evidence Rail

- **Style:** A cool neutral rail separated from the feed by one structural line. Healthy states use signal green; degradation uses the danger token and explicit copy.
- **Density:** Source name and last-success time remain scannable, while the “事实 / 信号 / 分析” boundary stays visible as a permanent trust cue.

### Cards / Containers

- **Corner Style:** Square (0px). Full pills are reserved for compact tags only.
- **Background:** Use the canvas and two tonal surface steps.
- **Shadow Strategy:** None.
- **Border:** One-pixel structural rules only.
- **Internal Padding:** 24–32px for major content planes; 16–24px for rows and compact modules.

## Do's and Don'ts

### Do:

- **Do** make the scan-first Story queue the largest continuous surface on the homepage.
- **Do** reserve deep pine for navigation and mineral blue for the single daily focus.
- **Do** use plain-language Chinese to translate technical material without deleting the evidence needed for judgment.
- **Do** maintain WCAG 2.2 AA contrast, keyboard focus, semantic reading order, and reduced-motion behavior.
- **Do** keep body copy at 14–16px and interpretation lines within a comfortable 65–75 character measure.
- **Do** keep facts, deterministic signals, and generated analysis visually and verbally distinct.

### Don't:

- **Don't** become an information waterfall optimized for volume.
- **Don't** imitate an academic database that assumes specialist knowledge.
- **Don't** create generic AI-summary cards without traceable evidence.
- **Don't** copy the visual style of `aihot.virxact.com`; it is a functional reference only.
- **Don't** use warm cream, sand, parchment, or beige as the canvas.
- **Don't** use gradients, glassmorphism, neon, decorative charts, wide soft shadows, or nested cards.
- **Don't** use giant hero metrics, filled filter pills, or a large marketing hero on a product reading surface.
- **Don't** let display serif typography leak into controls, navigation, or metadata.
