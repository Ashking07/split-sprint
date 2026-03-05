# Plan: Receipt Parsing Reliability & Splitwise Participant Filtering

## Issue 1: Receipt Parsing — Quantities Inflated (~80% reliable)

### Problem
The LLM often extracts **higher quantities** than what's actually on the receipt (e.g. "2" when it should be "1"). This leads to incorrect totals and user frustration.

### Root Cause
- No explicit instruction to be conservative with quantities
- Vision model may double-count repeated lines or misread "×2" vs "×1"
- No post-parse validation against receipt total

### Proposed Plan

#### A. Prompt Improvements (Low effort, high impact)
1. **Add explicit quantity rules** to `RECEIPT_SYSTEM_PROMPT`:
   - "When in doubt, use qty=1. Only use qty>1 when the receipt explicitly shows a count (e.g. '3 @ $0.99', '2× Coffee', or a quantity column)."
   - "Repeated item lines: If the receipt shows the same item multiple times with the same price, sum the lines into one item with qty = number of lines. Do NOT inflate qty from layout or formatting."
2. **Add a sanity check rule**: "If the receipt TOTAL would exceed the sum of (qty × unitPrice) for items, re-check quantities—you may have over-counted."

#### B. Post-Parse Validation (Medium effort)
1. **Total reconciliation** in `normalizeParsedOutput`:
   - If `computedSubtotal` exceeds `totalCents - taxCents - tipCents` by more than a threshold, flag items with low confidence or high qty for review.
2. **Quantity cap heuristic**: For items where `qty * unitPriceCents` is a large share of the total, consider capping qty if it would make the subtotal exceed the receipt total.
3. **Confidence-based qty clamp**: If `confidence < 0.8` and `qty > 1`, consider forcing `qty = 1` (user can correct in Review).

#### C. Model Upgrade (Optional)
- Use `gpt-4o` instead of `gpt-4o-mini` for complex receipts (set `OPENAI_RECEIPT_MODEL=gpt-4o` in env). Better accuracy, higher cost.

#### D. UX Mitigation
- **Review screen**: Make quantity editing prominent; show "Needs review" badge for low-confidence items.
- **Total mismatch warning**: If parsed total ≠ computed total, show a clear warning and suggest re-scanning.

---

## Issue 2: Splitwise — Unselected Members Getting Small Amounts

### Problem
When creating a Splitwise expense, **all group members** appear in the expense, including those the user did **not** select for this bill. Unselected members get tiny amounts (e.g. $0.15) due to rounding, forcing manual fixes in Splitwise.

### Root Cause
In `server/routes/splitwise.js` (expenses/create), `participantIds` is set to:
- **useSplitwiseMembers**: ALL `swMembers` (every Splitwise group member)
- **else**: ALL `group.ownerId` + `group.memberIds` (every Splitsprint group member)

The **actual participants** for this bill are the users the person selected in ChooseGroup (`selectedPeople`) and/or assigned in SplitSetup (`participantsByItem`). The bill stores `participantsByItem` but we never use it to filter participants—we always use the full group.

### Proposed Plan

#### A. Derive Participants from the Bill (Core fix)
1. **Compute `participantIds` from `bill.participantsByItem`**:
   - `participantIds = union of all participantsByItem[itemId]` for each item in the bill
   - This gives the exact set of people who were selected/assigned for this bill
2. **Fallback**: If `participantsByItem` is empty (legacy bills or edge case), fall back to current behavior (full group).
3. **Include payer**: Ensure `req.userId` (payer) is always in `participantIds` even if not explicitly in participantsByItem.

#### B. Filter Splitwise Users
1. When building `usersFlat`, **only include** users whose `participantId` is in the derived `participantIds`.
2. **Exclude zero-share users**: If `amountCents === 0` for a participant (shouldn't happen with correct participantIds, but as a safeguard), do not add them to the expense.

#### C. Settlement Consistency
1. **Bills finalize** (`server/routes/bills.js`): Currently uses full group for `participantIds`. Update to derive from `participantsByItem` as well, so `settlementSnapshot` matches what we send to Splitwise.
2. This ensures the bill's stored settlement and the Splitwise expense use the same participant set.

#### D. Edge Cases
- **Equal split with selectedPeople**: When the user selects 3 of 5 group members for equal split, `participantsByItem` should have each item assigned to those 3. Verify the frontend sends this correctly when `splitMode === "equal"`.
- **Itemized**: Each item has its own assigned list; union = participants. Already supported by the derivation.

---

## Implementation Order

1. **Splitwise participant filtering** (Issue 2) — Higher user impact, clearer fix
2. **Receipt parsing prompt + validation** (Issue 1) — Improves reliability incrementally

---

## Files to Modify

| Issue | File | Changes |
|-------|------|---------|
| 2 | `server/routes/splitwise.js` | Derive `participantIds` from `bill.participantsByItem`; filter to only include those in Splitwise payload |
| 2 | `server/routes/bills.js` | Derive `participantIds` from `participantsByItem` in finalize (for consistency) |
| 1 | `server/lib/openaiReceiptParser.js` | Add quantity rules to prompt; optional validation in `normalizeParsedOutput` |
| 1 | `src/app/screens/ReceiptReview.tsx` | (Optional) Highlight quantity edits, show total mismatch warning |

---

## Success Criteria

- **Issue 1**: Fewer quantity errors; users report improved accuracy or can correct easily in Review.
- **Issue 2**: Splitwise expenses contain **only** the people the user selected; no extra members with $0.15 or similar.
