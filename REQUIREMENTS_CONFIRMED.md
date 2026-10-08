# Saunf — Confirmed Business Requirements

**Date:** 8 October 2026  
**Status:** Confirmed with owner

## Carry-over & Billing

✅ **Carried-over meals are discounted on the next bill, not a service period extension.**

- When a customer is marked Absent, they earn 1 meal credit (to carry-over pool).
- At invoice generation, `carry_over_meals` are subtracted from `amount_due`, not added to meal count.
- Formula: `amount_due = (meals_in_plan - carryover_applied) × per_meal_price`
- Ledger entry: `CARRYOVER_APPLIED` reduces both meals and amount.

---

## Timing

✅ **Send: 12:00 PM (noon) every day (including weekends)**  
✅ **Cutoff: 6:00 PM (18:00) every day (including weekends)**

- No difference between weekdays and weekends.
- All times in Asia/Kolkata timezone.
- 1 hour before cutoff (5 PM), reminders are sent to Pending customers.

---

## Pending Day Resolution

✅ **Unresolved Pending days auto-resolve as Absent after 3 calendar days.**

- Day 1: Customer doesn't vote → Pending.
- Days 2–3: Owner can confirm manually.
- Day 4: Job auto-resolves as Absent (CARRYOVER_CREDIT entry created).
- No manual intervention needed after 3 days.

---

## Holiday Handling

✅ **If the restaurant is closed on a day, the meal doesn't count.**

- Owner marks closure dates in the system.
- No daily menu is sent on holiday dates.
- No charges, no carry-over credit, no ledger entries.
- Customers see a "Closed today" notification (optional).

---

## Plans & Subscriptions

✅ **Single plan: 30 meals per month (no half-day, trial, or multi-plan variants for v1).**  
✅ **No pause/resume subscriptions. Subscriptions remain active or are manually canceled by owner.**

---

## Service Model

✅ **Dine-in only (no delivery or pickup tracking).**

- All meals are consumed on-site.
- No route optimization, no rider tracking.
- Customers don't select a delivery address; only the primary address is stored.

---

## Admin Access

✅ **Owner only (single admin user for v1; no multi-staff roles).**

- Only the owner has access to admin endpoints.
- All sensitive actions (confirm days, generate invoices, adjust ledger, mark holidays) are owner-only.
- No staff roles or permission levels.

---

## Payments

✅ **Skip Razorpay integration for now. Invoices are records; payment is collected offline (cash).**

- Invoices are generated with the amount due.
- No Razorpay payment links, webhooks, or card integration.
- Owner manually marks invoices as PAID after collecting cash.
- Future: Can integrate Razorpay after MVP launch.

---

## Summary Table

| Requirement | Decision |
|---|---|
| Carry-over model | Discount on next bill |
| Send time | 12:00 PM daily (fixed) |
| Cutoff time | 6:00 PM daily (fixed) |
| Pending auto-resolve | After 3 days → Absent |
| Holiday handling | No meal, no charge, no carry-over |
| Plans | 30 meals/month (single plan) |
| Pause subscriptions | No (only active or cancelled) |
| Service type | Dine-in only |
| Admin users | Owner only (1 user) |
| Payment gateway | Skip (manual/cash) |

---

## Next Steps

1. Update database schema to add `holidays` table and timestamp for auto-resolve tracking.
2. Create BullMQ jobs for 12 PM send, 5 PM reminder, 6 PM cutoff, 3-day auto-resolve.
3. Build WhatsApp webhook receiver to capture votes.
4. Implement owner-only middleware for admin routes.
5. Create UI for holiday management in admin panel.
6. Update billing service to apply carry-over as a discount (not meal count).
7. Wire up OTP authentication for customers.
