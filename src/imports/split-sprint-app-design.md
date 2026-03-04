Design a mobile app (iOS-first) called “SplitSprint” that gamifies the boring task of adding bills to Splitwise. Keep the UI extremely simple, fast, and forgiving (minimal taps, clear defaults, big buttons). The core flow is:

Product goal

Turn “add bill to Splitwise” into a 2-minute playful flow: capture receipt → confirm items → choose who pays what → send to Splitwise. Use micro-rewards (XP, streaks, confetti) but never let gamification slow the task down.

Key user story (MVP)

User chooses Import Receipt:

Option A: Take receipt photo

Option B: Paste / Forward online receipt (email/text/URL)

App extracts line items and totals:

Highlight any uncertain fields with a “Needs review” tag.

User confirms:

Items + quantities + price

Tax + tip (tip is optional; default to “No tip” with a quick toggle)

User selects group/people and splits:

Default: equal split

Quick edits per item (tap an item → select participants)

Tap Create in Splitwise (API handoff) and show success.

IA / Screens to design (low-friction)

Create a clean design system + these screens:

Welcome / Home

Primary CTA: “Add a bill”

Secondary: “History”

Tiny gamification module: streak + XP bar

Import Receipt

Two large cards: “Camera Receipt” and “Online Receipt”

Microcopy: “Usually done in under 2 minutes”

Camera Capture

Camera UI with edge-detection frame

“Retake” and “Use Photo”

After capture: lightweight “Processing…” state with playful message

Parsed Receipt Review

Card list of extracted line items

Uncertain rows highlighted with a subtle warning icon and “Tap to fix”

Sticky bottom bar: Subtotal, Tax, Tip, Total

Tip control: quick presets (0%, 10%, 15%, 20%) + “Custom”

Primary CTA: “Next: Split”

Choose Group / People

Search + recent groups

Suggested participants based on last bills

CTA: “Continue”

Split Setup

Default “Split equally” toggle ON

Option: “Split by items”

Item detail bottom sheet: tap item → pick who shares it (chips/avatars)

Confirmation

Summary: total, who owes what

Splitwise destination (group + currency)

Primary CTA: “Create in Splitwise”

Success / Reward

Confirmation: “Added to Splitwise”

Micro reward: confetti + “+25 XP”

“Keep streak alive: add 1 more this week” (optional)

Secondary CTA: “View in Splitwise” and “Done”

History

Simple list of past bills with status “Sent / Draft”

“Duplicate” action for similar receipts

Visual style

Minimal, modern, friendly.

Soft neutrals + 1 accent color used for CTAs and rewards.

Big touch targets, lots of whitespace, rounded cards.

Use playful but subtle illustrations/icons (receipt, camera, sparkles).

Typography: clean sans (e.g., Inter).

Motion guidance: quick transitions, confetti only on success.

UX principles (must follow)

Two-tap defaults: auto-select last used group + equal split.

Progress clarity: 4-step progress indicator (Import → Review → Split → Send).

Error tolerance: OCR uncertainties are flagged, not blocking.

Speed: keep screens scannable; use sticky CTA bars.

Gamification is optional: never blocks core actions.

Components / Design system (create in Figma)

Buttons (primary/secondary/ghost), receipt item rows, avatar chips, bottom sheet, sticky totals bar, progress stepper, XP bar, streak badge, “Needs review” tag.

Deliverables

Produce a complete mobile UI with the above screens, consistent components, and a simple clickable prototype flow from Home → Success.