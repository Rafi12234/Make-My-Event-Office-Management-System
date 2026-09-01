# Accounts Section — Full End-to-End Testing Checklist

One continuous run. State carries forward from step to step — **do not reset
anything until the very last step.** Keep the Employee Panel and Admin Panel
open side by side (two tabs/browsers) and refresh the Admin tab after every
employee action.

## Before you start
- [ ] Confirm a clean baseline: run `node scripts/resetAccountsModuleData.js` (type `YES`) once, if not already done.
- [ ] Have 2 employees ready — call them **A** and **B** in this checklist (substitute real names).
- [ ] Have 2 existing active vendors — call them **X** and **Y**.
- [ ] Have 3 candidate events for the "Event Based Cost" picker:
  - **E1** — confirmed + finalized, booked-from-MME, event date **today or later** (this is the only one that should ever appear in the picker).
  - **E2** — confirmed + finalized, booked-from-MME, event date in the **past**.
  - **E3** — confirmed + finalized, but flagged **"already booked" with another company**.

## ⚠️ Two known UI facts to be aware of while testing
- [ ] `HistoryList.jsx` (Employee panel's **Activity** card, all 3 tabs) renders **no corrected/voided badge at all**. When Admin edits or voids one of an employee's entries, the row will look completely unchanged in the Employee's Activity list — only the wallet balance number and the entry's presence/amount silently reflect it. Don't go looking for a "corrected" or "voided" tag there; it doesn't exist yet.
- [ ] On **Vendor Profile** (Employee panel), the **"Record a Payment to This Vendor"** button only renders when that vendor's balance is negative (something is owed). If the balance is ৳0 or positive, there is no Pay-Vendor button anywhere on that page.

---

## Phase 1 — Money Received (happy path + validation)
Employee panel page: **Wallet & Expenses** (`/accounts`) → **Quick Actions** → **Money In** tile → **Log Money Received** page.

- [ ] **1.1** A: Money Received ৳20,000, today's date.
  - Employee: back on **Wallet & Expenses**, black **"Current Balance"** hero card = **৳20,000**; **Received** tile = ৳20,000; Activity card → **Money In** tab shows the new row.
  - Admin: **Overview** → StatCard **"Given to employees"** = ৳20,000; StatCard **"Employee wallet balance"** = ৳20,000. **Money In** page → table row: Employee=A, Amount=20,000, Source badge=**Employee**, Status badge=**Active**.
- [ ] **1.2** A: Money Received ৳0 → form blocks/shows "Enter a valid amount greater than 0." No values change anywhere.
- [ ] **1.3** A: Money Received −500 → same rejection, no change.
- [ ] **1.4** A: Money Received ৳500, blank date → "Received date is required." No change.
- [ ] **1.5** A: Money Received ৳100, note = 300 characters → saves; open the row in Admin **Money In** page, confirm the **Note** column is truncated to 255 characters, not rejected. Current Balance card now **৳20,100**.

## Phase 2 — Log a Cost: Event Based Cost (validation + booking filter)
Employee panel: **Quick Actions** → **Log a Cost** tile → **Log a New Cost** page → **"Event Based Cost"** tile.

- [ ] **2.1** Open the event picker: confirm **only E1** is listed. E2 (past date) and E3 (already booked elsewhere) must NOT appear.
- [ ] **2.2** Try submitting with no event chosen → "Select which confirmed event this cost belongs to." No change.
- [ ] **2.3** Pick E1, leave an item's "What was this for?" blank → inline error, item highlighted, no change.
- [ ] **2.4** Quantity = 0 on an item → same inline validation, no change.
- [ ] **2.5** Per-qty amount negative → same, no change.
- [ ] **2.6** Submit E1, no vendor, ৳3,000 (qty 1 × 3,000).
  - Employee: Current Balance = **৳17,100**. Activity → **Expenses** tab shows new "Event based cost" row (violet icon), labeled with E1's client name.
  - Admin: **Events** page → **"Costs by event"** table → new row for E1: Recorded cost=3,000, Actually paid=3,000.

## Phase 3 — Vendor rules: event-scoped debt regression + isolation
- [ ] **3.1** A: Event Cost → E1 + Vendor X, payment status **"To Pay"**, ৳5,000.
  - Employee: Current Balance unchanged (still ৳17,100 — To Pay never deducts). Activity → **Vendors** tab shows a new pending (amber "To Pay" pill) row; this item does **not** appear in the **Expenses** tab at all.
  - Admin: **Events** page E1 row → Still to pay=5,000. **Overview** → StatCard **"Still payable to vendors"**=5,000. **Vendors** page → Vendor X's **Payable** column=5,000.
- [ ] **3.2** Item with a vendor picked but no payment status chosen → "needs a payment status (To Pay or Paid)." No change.
- [ ] **3.3** Force an inactive/invalid vendor id via the API directly → 422 "invalid or inactive vendor." No change.
- [ ] **3.4** A: Event Cost → E1 + Vendor X, **"Paid"**, ৳3,000 (partial settle of 3.1).
  - Employee: Current Balance = **৳14,100**. This item now shows in BOTH the **Expenses** tab and the **Vendors** tab (green "Paid" pill).
  - Admin: **Events** page E1 row → Recorded cost=6,000, Actually paid=6,000, Still to pay=**2,000**. **Overview** StatCard "Paid to vendors"=3,000, "Still payable to vendors"=2,000. Vendor X profile → **"Still to pay"** StatCard=2,000.
- [ ] **3.5 — ★ CORE REGRESSION CHECK ★** A: Regular Cost (no event) + Vendor X, **"Paid"**, ৳4,000 — deliberately unrelated to E1.
  - Employee: Current Balance = **৳10,100**.
  - Admin: Vendor X profile → **"Total paid"** StatCard rises to 7,000, but **"Still to pay" StatCard MUST stay exactly ৳2,000** — must not drop toward 0. **Overview** "Still payable to vendors" must also stay exactly ৳2,000.
- [ ] **3.6** A: Regular Cost + Vendor Y, **"To Pay"**, ৳6,000.
  - Employee: Current Balance unchanged (৳10,100). Shows only in **Vendors** tab.
  - Admin: Vendor Y profile "Still to pay"=6,000. Overview "Still payable to vendors"=2,000+6,000=**8,000**. Vendors page table lists both X and Y under "Payable".
- [ ] **3.7** A: On Vendor Y's profile, click **"Pay Vendor"** amount ৳0 → "Enter a valid amount greater than 0." No change.
- [ ] **3.8 — ★ KNOWN LIMITATION CHECK ★** A: Vendor Y profile → **"Record a Payment to This Vendor"** → Amount paid ৳6,000 → **"Confirm Payment"**.
  - Employee: Current Balance = **৳4,100**.
  - Admin: Vendor Y profile → **"Total paid"**=12,000, but **"Still to pay" MUST REMAIN ৳6,000** (quick-pay never links back to the specific To Pay item from 3.6). Overview "Still payable to vendors" stays **৳8,000** (2,000 X + 6,000 Y — Y must not show 0).
- [ ] **3.9** A: Money Received ৳5,000 (top-up). Current Balance = **৳9,100**.

## Phase 4 — Vendor CRUD (Admin) + live cross-portal sync
Admin panel: **Vendors** page.

- [ ] **4.1** Admin creates a new vendor **Z** ("Balloon Decor Co") → appears in the **"All vendors"** table, Balance/Payable = 0.
- [ ] **4.2** Admin creates ANOTHER vendor named exactly "Balloon Decor Co" → "A vendor with this name already exists." No second row created.
- [ ] **4.3** Admin edits Vendor Z's category/contact/notes → saves, no balance impact.
- [ ] **4.4** Employee A refreshes the Log a Cost page's Vendor dropdown / Vendor Directory page → **Vendor Z appears immediately** in the list.

## Phase 5 — Mixed single submission (3 different item types in one form)
- [ ] **5.1** A: ONE Regular Cost submission with 3 rows: Item1 no-vendor ৳500; Item2 Vendor X "Paid" ৳1,000; Item3 Vendor Z "To Pay" ৳2,000.
  - Employee: deduction = 500+1,000 (Item3 excluded) = 1,500 → Current Balance = **৳7,600**. Activity → **Expenses** tab: one row with 3 items when expanded. **Vendors** tab: Item2 and Item3 both appear.
  - Admin: Vendor X's "Still to pay" stays at 2,000 (this new paid item is its own isolated group, doesn't touch E1's group). Vendor Z profile "Still to pay"=2,000 (new). Overview "Still payable to vendors"=2,000+6,000+2,000=**10,000**. Employees page → row A's **"Still payable"** column=10,000.

## Phase 6 — Receipts & file validation
- [ ] **6.1** A: Regular Cost ৳1,000 with a valid <8MB JPG receipt attached.
  - Employee: Current Balance = **৳6,600**. Receipt thumbnail preview shows in the item's **Receipt** column before submit.
  - Admin: **Expenses** page → expand this row → item's **Receipt** column shows a **"View"** link; click it, confirm the image opens.
- [ ] **6.2** A: attempt to attach a >8MB file as a receipt → upload rejected with an error message (not a silent hang). No change.
- [ ] **6.3** A: attempt to attach a non-image file (e.g. renamed `.pdf`/`.exe`) → "Only JPG, PNG, GIF, or WEBP images are allowed." No change.

## Phase 7 — Second employee: proportional debt split
- [ ] **7.1** B: Money Received ৳10,000. Employee B's Current Balance=**৳10,000**. Admin **Employees** page → row B appears with Total money in=10,000.
- [ ] **7.2** B: Event Cost → E1 + Vendor X, **"To Pay"**, ৳10,000.
  - Employee B: Current Balance unchanged=10,000.
  - Admin: **Employees** page — row A's **"Still payable"** column jumps from 2,000(X-share)+6,000(Y)+2,000(Z)=10,000 to **4,000(X-share)+6,000+2,000=12,000** (A's number changes even though A did nothing this step, purely from B's action on the shared Vendor X + E1 group). Row B's "Still payable"=8,000. Vendor X profile "Still to pay"=**12,000**.
- [ ] **7.3** B: Event Cost → E1 + Vendor X, **"Paid"**, ৳6,000 (partial settle of the shared group).
  - Employee B: Current Balance=**৳4,000**.
  - Admin: Vendor X "Still to pay"=**6,000**. Employees page row A "Still payable"=2,000+6,000+2,000=**10,000**; row B=**4,000**.

## Phase 8 — Admin Money In: edit/void + error paths + filters
Admin panel: **Employees** page → **"Add Money"** button (opens Modal **"Add money to employee wallet"**), then **Money In** page for edit/void.

- [ ] **8.1** Admin → Add Money → Employee A, ৳2,000 → Employee A's Current Balance becomes **৳8,600** on next refresh, tagged Source=**Admin** in the Money In table.
- [ ] **8.2** Admin → Money In page → click the **"Edit record"** icon on that row → Modal **"Correct Money In record"** → change ৳2,000→৳3,000, reason "Correcting the top-up" → Save.
  - Employee A: Current Balance = **৳9,600**.
  - Admin: row's Amount now shows 3,000.
- [ ] **8.3** Try the same edit with a blank/2-character reason → "A reason for this correction is required." No change.
- [ ] **8.4** Admin → click **"Void record"** icon on that same row → confirm dialog **"Void this Money In entry?"** → reason "Employee left, reversing" → confirm.
  - Employee A: Current Balance = **৳6,600**.
  - Admin: row's Status badge flips to **Void**.
- [ ] **8.5** Try voiding that SAME row again → "This record is already voided." No change.
- [ ] **8.6** Try editing that SAME now-voided row → "This record is voided and can no longer be edited." No change.
- [ ] **8.7** On the Money In page, test every filter: Employee dropdown, Source (**"Employee & Admin"/"Employee entered"/Admin**), Status, date range, note search, sort — confirm each narrows the table correctly and the totals StatCard excludes the voided entry.

## Phase 9 — Admin Expenses: filters, preview, vendor-swap, status-swap, error paths
Admin panel: **Expenses** page → expand a row → **Expense detail** page.

- [ ] **9.1** Open A's Phase-5 mixed expense (3 items) → Expense detail page → edit Item2's vendor X→Y and Item3's status To Pay→Paid → click preview → Modal **"Confirm financial correction"** shows old/new totals and wallet/vendor impact — **do not confirm yet** — reload the page and confirm nothing changed.
- [ ] **9.2** Now actually commit that same edit, reason "Corrected vendor + settled Z's bill".
  - Employee A: Current Balance = **৳4,600** (Item3 now counts toward wallet deduction, −2,000).
  - Admin: Vendor Z profile **"Still to pay"** drops from 2,000 to **0**. Vendor X and Vendor Y's "Still to pay" are UNCHANGED (the swapped item's net contribution was already 0 before and after — only their gross "Total paid"/"Total bills" history differ). Overview "Still payable to vendors" = 6,000(X)+6,000(Y)+0(Z) = **12,000**. Employees page: A's "Still payable"=2,000+6,000+0=**8,000**; B unaffected=4,000.
- [ ] **9.3** Send an item id in the edit payload that doesn't belong to this expense (via API) → "Unknown expense item {id}." No change.
- [ ] **9.4** Admin → void A's Phase-6 receipt expense (৳1,000, no vendor), reason "Duplicate submission" → confirm dialog **"Void this expense?"**.
  - Employee A: Current Balance = **৳5,600**.
  - Admin: StatusBadge on that row flips to **Void**.
- [ ] **9.5** Try voiding/editing that same now-voided expense again → both rejected (409). No change.
- [ ] **9.6** On the Expenses page, test every filter combo: Employee, **Event based/Regular**, Vendor, **Paid/To Pay**, Purpose search, Event search, **Receipt available/Missing receipt**, **Cost happened date/Submitted date** + range, min/max amount, sort, **Active only/Void only**, **Employee wallet/Company-Admin direct** → confirm each narrows correctly, and changing page keeps the filters applied (doesn't reset them).

## Phase 10 — Overview date-range mode + negative wallet
- [ ] **10.1** On **Overview**, click a date preset that excludes today (e.g. "Last week"), confirm the filtered StatCards change, then click **"All time"** again and confirm everything reverts exactly to Phase 9's ending totals.
- [ ] **10.2** A: log one more Regular Cost, no vendor, ৳8,000 (bigger than the remaining ৳5,600).
  - Employee A: Current Balance = **−৳2,400** (red text on the hero card, "Overspent — settle up with your boss" message).
  - Admin: **Overview** → **"Negative wallets"** card lists A with −2,400, StatCard "Negative wallets" count ≥1.

## Phase 11 — CSV export + vendor status lifecycle
- [ ] **11.1** Admin **Employees** page → **Export** button → open the CSV → confirm columns: Employee, Email, Current Wallet, Total Money In, Still Payable, Paid to Vendors, Expenses — and A's row shows −2,400.
- [ ] **11.2** Admin **Vendors** page → deactivate Vendor Y (reason "No longer used") → its row shows a gray **"Inactive"** badge next to the name; full history/balance stays visible.
- [ ] **11.3** Employee A/B's Vendor dropdown (Log a Cost) and Vendor Directory page → Vendor Y disappears from both; Y still appears correctly in A's historical **Vendors** tab entries.
- [ ] **11.4** A: try "Record a Payment" against the now-deactivated Y (via direct link/API) → "Vendor not found." No change.
- [ ] **11.5** Admin reactivates Y → reappears in the employee's dropdown/directory immediately.

## Phase 12 — Admin direct vendor cost/payment (company-only isolation)
Admin panel: Vendor X's profile page.

- [ ] **12.1** Admin: direct vendor cost for X, **"To Pay"**, ৳2,000, reason "Office ordered directly" — no employee involved.
  - Admin: Vendor X profile "Still to pay" = 6,000+2,000 = **৳8,000**. Overview "Still payable to vendors" = 8,000+6,000+0 = **14,000**.
  - Confirm neither Employee A's nor B's "Still payable" figure changes at all, and this entry never appears on either employee's Accounts pages.
- [ ] **12.2** Admin: direct vendor payment for X, ৳2,000, reason "Settling the direct order" — a brand-new isolated entry.
  - Admin: Vendor X profile **"Still to pay" REMAINS ৳8,000** (does not settle 12.1's item — regular/non-event items never net against each other, even two admin-direct ones; this is by design, not a bug).
- [ ] **12.3** Admin: direct vendor cost, amount ৳0 → rejected. No change.

## Phase 13 — Security / access-control boundaries
- [ ] **13.1** Using an Employee browser session, call `GET /api/admin/accounts/overview` directly → rejected (401/redirect), no admin data returned.
- [ ] **13.2** Using an Admin browser session, call `GET /api/accounts/summary` directly → confirm the dual-session design holds, no cross-privilege leak.
- [ ] **13.3** Tamper one character of the session cookie value → rejected cleanly, redirected to login, no server crash.
- [ ] **13.4** Deactivate Employee A's account (Admin → Employee Management) while A's browser tab is still open, then have A try any Accounts action → "Your account is no longer available." (not a raw error).

## Phase 14 — UI regression check
- [ ] **14.1** Open any Admin modal (Add Money, expense edit correction, void confirm) → confirm the dark backdrop covers the FULL screen (not just the content column) and the pop-in animation plays smoothly.

## Phase 15 — Final consistency pass
- [ ] **15.1** Admin **Audit & Corrections** page → **"Employee wallet reconciliation"** section: A and B both show `matches` (Stored = Calculated). **"Vendor balance reconciliation"** section: X, Y, Z all show `matches`.
  > Note: the reconciliation "calculated" figure for vendors uses the OLD global-per-vendor running total, which can legitimately differ from the newer per-event "Still to pay" shown on Vendor Profile pages — that's expected, not a bug.
- [ ] **15.2** Audit & Corrections → **"Correction history"** section lists every admin action from Phases 4, 8, 9, 11, 12 with the exact reason text you entered.
- [ ] **15.3** Overview → **"Company activity feed"** shows the entire chain, newest first.

## Phase 16 — Reset everything (only now)
- [ ] **16.1** Run `node scripts/resetAccountsModuleData.js` in the backend folder, type `YES`.
- [ ] **16.2** Confirm both employees' wallets and Vendor X/Y balances are back to ৳0, and all expenses/money-in/audit log rows are gone.
- [ ] **16.3** Remember: this script does **not** reset vendor `isActive` status — if you deactivated/reactivated Y or created Z during this run, manually clean those up in Admin → Vendors before your next test pass.
