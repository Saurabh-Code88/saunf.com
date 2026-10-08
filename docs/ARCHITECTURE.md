# Saunf Meal Subscription App: Architecture and Roadmap

Prepared for Saurabh, 7 October 2026. Working document, confirmed with owner.

## 1. Purpose and business rules

Saunf runs a monthly thali subscription of 30 meals. Customers currently choose their daily sabji through a poll in a WhatsApp group ("Thali Family by Satvik"), and the owner counts votes and tracks attendance manually. This system replaces that with a digital platform: customers vote daily via WhatsApp or web, the system generates accurate kitchen counts, tracks absences and carry-overs, and produces billing records.

### Rules the system must enforce, as confirmed with owner:

- A plan is 30 meals per month at a fixed price. Per-meal price is plan price divided by 30.
- A customer who picks Absent gets that meal added to the next month **as a discount on the next bill** (not as an extension of the service period).
- Carried-over meals are deducted from the next invoice amount due, not added to the meal count.
- There is no automatic absent. A day counts as absent only when the customer chose Absent in the poll, or the owner confirmed absence.
- If a customer does not vote, the day stays **Pending**. The owner confirms at the end of the day, or asks the customer within the next 3 days. If unresolved after 3 days, it defaults to Absent (carry-over credit).
- Customers vote one choice per day: one of the sabji options, or Absent.
- **Send time:** 12:00 PM (noon) every day (same time weekends and weekdays).
- **Cutoff time:** 6:00 PM (18:00) every day (same time weekends and weekdays).
- **Holiday handling:** If the restaurant is closed on a day, no menu is sent and no charges apply. No carry-over is credited for closure days.
- **Dine-in only:** No delivery or pickup tracking required. All meals are consumed on-site.
- **Staff access:** Only the owner has admin access. No multi-staff roles for this version.
- **Payment integration:** Skip Razorpay for now. Invoices are generated for reference; payment is collected offline (cash) or through a separate channel.

## 2. Goals and non-goals

### Goals

- Replace the group poll with a reliable, per-customer vote that cannot be ambiguous.
- Give the kitchen an accurate count per dish before cooking.
- Keep an auditable ledger so any billing question can be answered from records.
- Make the owner's end-of-day confirmation a one-tap task.
- Let customers see meals left, carry-over, and next bill, and view invoices.

### Non-goals for version 1

- Delivery route optimisation or rider tracking.
- Multiple restaurants or franchise support.
- A native mobile app. A responsive website plus WhatsApp is enough.
- Automated defaulting of non-voters (explicitly excluded by owner rule, now with 3-day window).
- Razorpay or online payment integration. Invoices are records; payment is separate.
- Multi-staff or role-based admin. Owner only.
- Staff pause/resume of subscriptions. Owner manually manages active subscriptions.

## 3. System architecture

### 3.1 High-level view

```
Customers (WhatsApp)         Customers (browser)         Owner (browser)
      |                            |                           |
      v                            v                           v
WhatsApp Cloud API  <--webhook-->  Next.js web app  <-------->  Admin panel (same app,
      ^                            |                      owner-only routes)
      |                            v
      +------ send/receive ----->  Backend API (NestJS)
                                   |
             +---------------------+---------------------------+
             |                      |                           |
             v                      v                           v
       PostgreSQL            Job queue + scheduler          Holidays table
   (ledger, selections,    (Redis + BullMQ)         (restaurant closed days)
    invoices, audit)     menu send, cutoff, reminders,
                           monthly billing, 3-day pending
```

### 3.2 Components

| Component | Responsibility | Notes |
|---|---|---|
| Web app (Next.js) | Landing page, customer dashboard, admin panel | One codebase, owner-only routes for admin |
| Backend API (NestJS) | Business logic, ledger, billing, auth, webhooks | Stateless, horizontally scalable later |
| PostgreSQL | System of record | Money stored as integer paise; ledger is append-only |
| Redis + BullMQ | Scheduled and delayed jobs | Daily menu send @12pm, cutoff close @6pm, reminders @5pm, pending resolution job @3-day mark, monthly billing |
| WhatsApp Cloud API | One-to-one menu messages and replies | Business number, approved templates |
| Holidays table | Restaurant closure dates | If a date is marked holiday, no menu is sent, no charges, no carry-over |
| Monitoring | Error tracking, uptime, job failure alerts | Sentry plus a simple uptime check |

### 3.3 Architectural principles

1. **Ledger first.** Meals are credits in an append-only ledger. Balances are computed from entries, never overwritten. Corrections are reversal entries.
2. **Pending is a real state.** A customer-day is Pending, Present, or Absent. Only Present and Absent affect the ledger.
3. **Idempotent webhooks.** WhatsApp can deliver the same event twice. Every handler must be safe to repeat.
4. **Audit everything.** Each change to a day records who changed it, when, and why.
5. **Owner can always override.** Every automated outcome has a manual correction path in the admin panel.
6. **3-day Pending window.** If a day remains Pending after 3 calendar days, a job automatically resolves it as Absent (carry-over credit).

## 4. WhatsApp integration design

### 4.1 Why one-to-one instead of the group

The official WhatsApp Cloud API cannot post polls to, or read votes from, a WhatsApp group. One-to-one messages with quick-reply buttons provide reliable, auditable voting.

### 4.2 Daily message flow

1. Owner (optional) enters the next day's sabji options in the admin panel, or the system pre-fills from a weekly template.
2. At 12:00 PM (noon), the system sends each active customer a template message with quick-reply buttons: the menu options and Absent.
3. The customer taps a button. WhatsApp sends a webhook to the backend, which resolves the day: PRESENT with the dish, or ABSENT, source CUSTOMER_VOTE.
4. If the customer changes their mind before 6:00 PM (cutoff), the latest tap wins and the change is audited.
5. At 5:00 PM (one hour before cutoff), reminders go only to customers still Pending.
6. At 6:00 PM (cutoff) the day is closed. Customers can no longer change their vote. Non-voters remain Pending.
7. Owner confirms Pending days from the admin panel (typically after 6 PM or next morning).
8. If a day remains Pending after 3 calendar days, a scheduled job auto-resolves it as Absent.

### 4.3 Practical constraints to plan for

- Messages the business starts outside an open conversation window must use pre-approved templates. Submit the menu template and the follow-up template early, because approval takes time.
- Quick-reply buttons have a limited count per message. If a day has more options than fit, use a list message instead.
- A customer's reply opens a conversation window, which allows the owner-side follow-up ("Were you present yesterday?") to be sent without a new template in many cases.
- Customers must have opted in to receive messages. Capture and store consent when onboarding.
- Verify webhook signatures on every incoming request.

## 5. Data model

The full PostgreSQL schema is in `saunf_schema.sql`. Summary of the main tables:

| Table | Purpose |
|---|---|
| `customers` | Name, WhatsApp number, address, active flag |
| `plans` | Meals per month, price in paise |
| `subscriptions` | Customer, plan, start and end dates, billing day |
| `menu_items`, `daily_menus`, `daily_menu_items` | Dishes, and which are offered on which date, with send and cutoff times |
| `meal_selections` | One row per customer per day: state, dish, source, resolved time, note |
| `selection_audit` | Every state change with actor and reason |
| `meal_ledger` | Append-only credits and debits: plan credit, meal consumed, carry-over credit, carry-over applied, reversal |
| `invoices` | Period, per-meal price, carry-over applied (in paise discount), amount due, status, count of pending days at generation |
| `holidays` | Restaurant closure dates; no menu sent, no charges on these days |
| `admin_users` | Owner (single user for now); phone, email, password hash |
| `otp_codes` | Phone-based OTP for customer login |

## 6. Core workflows

### 6.1 Daily cycle

| Time | Event | System action |
|---|---|---|
| 12:00 PM | Menu send (on non-holiday days) | Create a Pending row for every active customer, send the WhatsApp menu |
| 5:00 PM | Reminder | Message only customers still Pending |
| 6:00 PM | Cutoff | Lock customer changes, compute kitchen count |
| After 6 PM | Kitchen view | Admin sees dish totals, absent count, and Pending count |
| Same day or next morning | Owner confirmation | Owner taps Present or Absent for each Pending customer |
| Day 4 (auto-resolve) | If still Pending | Job auto-resolves as Absent; carry-over credit is applied |

### 6.2 Resolving a Pending day

- **Owner confirms** with one tap. If Present, the owner selects the dish, defaulting to the most common one that day. The ledger records MEAL_CONSUMED for Present or CARRYOVER_CREDIT for Absent, source OWNER.
- **Customer replies** to a follow-up such as "Were you present yesterday? Yes / No". The reply resolves the day with source CUSTOMER_FOLLOWUP.
- **Auto-resolve after 3 days:** If a day remains Pending after 3 calendar days, a scheduled job resolves it as Absent (CARRYOVER_CREDIT entry is created).

### 6.3 Holiday handling

- On a day marked as a holiday (restaurant closure), no daily menu is created and no WhatsApp messages are sent.
- Customers are not charged for holiday days.
- No carry-over credit is generated for holidays; the day is skipped entirely.
- The owner can view which days are holidays on the admin calendar.

### 6.4 Monthly billing

1. Before the billing date, check for Pending days in the period. If any exist and still within 3-day window, show the owner a warning. After 3 days, they are auto-resolved.
2. Compute carry-over available from the ledger (sum of CARRYOVER_CREDIT minus CARRYOVER_APPLIED entries).
3. Amount due = `(meals_in_plan - carryover_meals) × per_meal_price`. Carry-over reduces the invoice amount, not the meal count.
4. Create the invoice, write a CARRYOVER_APPLIED ledger entry, and mark invoice as PENDING_PAYMENT.
5. Send the invoice through WhatsApp and show it on the website (no Razorpay link; owner collects payment offline).
6. Owner manually marks the invoice as PAID once cash is collected.

### 6.5 Corrections

If a past day was recorded wrongly, the owner edits it from the admin panel with a required reason. The system writes a REVERSAL ledger entry for the old outcome and a new entry for the corrected state.

## 7. Modules and API surface

### 7.1 Backend modules

- **Auth**: phone number plus OTP for customers, email and password for owner.
- **Customers and subscriptions**: onboarding, plan assignment, status tracking (no pause/cancel in v1).
- **Menu**: weekly planner, daily menu, dish catalogue, holiday dates.
- **Selections**: state machine for a customer-day, with validation of allowed transitions, 3-day auto-resolve job.
- **Ledger**: the only code path that writes ledger entries, with balance queries.
- **Billing**: invoice generation, carry-over application as a discount, invoice status tracking.
- **Messaging**: template sends, retry, delivery status, inbound webhook handling.
- **Reports**: kitchen count, pending list, collection status, monthly summary.
- **Admin**: owner-only endpoints for confirmation, holiday management, manual adjustments.

### 7.2 Illustrative endpoints

| Method and path | Purpose |
|---|---|
| `POST /webhooks/whatsapp` | Receive votes and delivery status |
| `POST /auth/otp/request` | Customer requests OTP |
| `POST /auth/otp/verify` | Customer verifies OTP and logs in |
| `GET /me/dashboard` | Meals left, carry-over, next bill, vote history |
| `PUT /me/selections/:date` | Change today's choice before 6 PM cutoff |
| `GET /admin/day/:date` | Kitchen count and customer states (owner only) |
| `POST /admin/selections/:id/resolve` | Owner marks Present or Absent, with dish (owner only) |
| `POST /admin/menus` | Create or edit a daily menu (owner only) |
| `GET /admin/holidays` | List closure dates (owner only) |
| `POST /admin/holidays` | Add or remove a closure date (owner only) |
| `POST /admin/invoices/generate` | Run billing for a period (owner only) |
| `POST /admin/ledger/adjust` | Manual adjustment with reason (owner only) |
| `PATCH /admin/invoices/:id/status` | Mark invoice as PAID or CANCELLED (owner only) |

## 8. Technology choices

| Layer | Chosen | Rationale |
|---|---|---|
| Frontend | Next.js with TypeScript, Tailwind | Fast iteration, API routes optional, SSR for SEO |
| Backend | NestJS (TypeScript) | Strong DI, validation, middleware; scales well |
| Database | PostgreSQL | ACID guarantees for ledger, rich data types (JSON, enums), proven for billing |
| Queue and scheduler | Redis with BullMQ | Simple, reliable, native support for scheduling |
| Messaging | WhatsApp Cloud API directly | Official, no SMS fallback needed (WhatsApp ubiquitous in India) |
| Hosting | Vercel for web app, VPS for API and workers | Vercel free tier for Next.js; cheap VPS for stateless API |
| Monitoring | Sentry plus uptime checks | Error tracking and uptime alerting |

## 9. Security, privacy, and compliance

- Verify signatures on WhatsApp webhooks. Reject anything unsigned.
- Rate-limit OTP requests and lock out repeated failures.
- Owner-only access: staff routes check for owner role. No multi-staff roles for v1.
- Store phone numbers and addresses only as needed. Encrypt backups and restrict database access.
- Keep records of customer consent to receive WhatsApp messages.
- India's Digital Personal Data Protection Act applies to personal data of customers.
- Never log full payment details. Owner handles cash offline.
- Daily database backups with a tested restore.

## 10. Testing strategy

- **Unit tests** for the ledger and billing math. Cover carry-over as discount, partial months, reversals, rounding in paise, and the 3-day auto-resolve.
- **State machine tests** for a customer-day: every allowed and disallowed transition, including auto-resolve.
- **Webhook tests** with duplicate and out-of-order events.
- **Time-based job tests** with a controllable clock, covering the 3-day pending window and Asia/Kolkata timezone.
- **Dry-run billing** on real historical data from the owner's records.
- **End-to-end pilot** with a small group of real customers.

## 11. Roadmap

| Phase | Focus | Approx. duration |
|---|---|---|
| 0 | Discovery and setup (DONE) | 1 week |
| 1 | Ledger, admin, and holiday management | 2–3 weeks |
| 2 | WhatsApp voting and 3-day auto-resolve | 2 weeks |
| 3 | Customer website and dashboard | 2 weeks |
| 4 | Manual invoicing (no Razorpay) | 1–2 weeks |
| 5 | Pilot and launch | 1–2 weeks |

Roughly **10–12 weeks** end to end. A reduced first release (Phases 0–2, then manual invoice export) can be live in about **5–6 weeks**.

## 12. Implementation priorities (updated)

1. **Complete OTP authentication** → Customers can log in via phone.
2. **Implement WhatsApp webhook receiver** → Votes are captured.
3. **Set up BullMQ jobs** → 12 PM menu send, 5 PM reminder, 6 PM cutoff, 3-day pending auto-resolve.
4. **Holiday management** → Owner can mark restaurant closure dates; system skips those days.
5. **Admin confirmation UI** → Owner taps to resolve Pending days.
6. **Billing without Razorpay** → Invoices are generated, carry-over applied as a discount.
7. **Customer dashboard** → Shows meals left, carry-over, next invoice, vote history.

## 13. Success measures

- Share of customers voting before 6 PM cutoff.
- Pending days per day and resolution time (target: 0 unresolved after 3 days).
- Difference between system counts and actual meals served (target: <1% variance).
- Time the owner spends on confirmation each day (target: <5 minutes).
- Billing disputes per month (target: 0).
