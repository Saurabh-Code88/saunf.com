# Saunf Meal Subscription App: Architecture and Roadmap

Prepared for Saurabh, 7 October 2026. Working document, to be reviewed with the Saunf owner before build starts.

## 1. Purpose and business rules

Saunf runs a monthly thali subscription of 30 meals. Customers currently choose their daily sabji through a poll in a WhatsApp group ("Thali Family by Satvik"), and the owner counts votes and tracks skipped meals by hand. This app replaces the manual counting and bookkeeping while keeping WhatsApp as the place where customers actually interact.

### Rules the system must enforce, as confirmed so far:

- A plan is 30 meals per month at a fixed price. Per-meal price is plan price divided by 30.
- A customer who picks Absent gets that meal added to the next month. The next invoice is `(30 - carried_over_meals) × per_meal_price`.
- There is no automatic absent. A day counts as absent only when the customer chose Absent in the poll, or the owner confirmed absence.
- If a customer does not vote, the day stays **Pending**. The owner confirms at the end of the day, or asks the customer the next day whether they were present.
- Customers vote one choice per day: one of the sabji options, or Absent.

## 2. Goals and non-goals

### Goals

- Replace the group poll with a reliable, per-customer vote that cannot be ambiguous.
- Give the kitchen an accurate count per dish before cooking.
- Keep an auditable ledger so any billing question can be answered from records.
- Make the owner's end-of-day confirmation a one-tap task.
- Let customers see meals left, carry-over, and next bill, and pay online.

### Non-goals for version 1

- Delivery route optimisation or rider tracking.
- Multiple restaurants or franchise support.
- A native mobile app. A responsive website plus WhatsApp is enough.
- Automated defaulting of non-voters. This is excluded by the owner's rule.

## 3. System architecture

### 3.1 High-level view

```
Customers (WhatsApp)         Customers (browser)         Owner / staff (browser)
      |                            |                              |
      v                            v                              v
WhatsApp Cloud API  <--webhook-->  Next.js web app  <---------->  Admin panel (same app,
      ^                            |                         role-protected routes)
      |                            v
      +------ send/receive ----->  Backend API (NestJS)
                                   |
            +----------------------+-------------------------------+
            |                      |                               |
            v                      v                               v
      PostgreSQL            Job queue + scheduler            Razorpay
  (ledger, selections,    (Redis + BullMQ)              (payment links,
   invoices, audit)     menu send, cutoff, reminders,    webhooks)
                          monthly billing
```

### 3.2 Components

| Component | Responsibility | Notes |
|---|---|---|
| Web app (Next.js) | Landing page, customer dashboard, admin panel | One codebase, role-based routes |
| Backend API (NestJS) | Business logic, ledger, billing, auth, webhooks | Stateless, horizontally scalable later |
| PostgreSQL | System of record | Money stored as integer paise |
| Redis + BullMQ | Scheduled and delayed jobs | Daily menu send, cutoff close, reminders, monthly invoices |
| WhatsApp Cloud API | One-to-one menu messages and replies | Business number, approved templates |
| Razorpay | Payment links, UPI AutoPay, payment webhooks | Reconcile through webhooks, not client redirects |
| Object storage (optional) | Invoice PDFs, exports | Can wait until later phases |
| Monitoring | Error tracking, uptime, job failure alerts | Sentry plus a simple uptime check |

### 3.3 Architectural principles

1. **Ledger first.** Meals are credits in an append-only ledger. Balances are computed from entries, never overwritten. Corrections are reversal entries.
2. **Pending is a real state.** A customer-day is Pending, Present, or Absent. Only Present and Absent affect the ledger.
3. **Idempotent webhooks.** WhatsApp and Razorpay can deliver the same event twice. Every handler must be safe to repeat.
4. **Audit everything.** Each change to a day records who changed it, when, and why.
5. **Owner can always override.** Every automated outcome has a manual correction path in the admin panel.

## 4. WhatsApp integration design

### 4.1 Why one-to-one instead of the group

The official WhatsApp Cloud API cannot post polls to, or read votes from, a WhatsApp group. Unofficial libraries can, but they break WhatsApp's terms and risk the business number being banned, which is not acceptable for a paid service. So the design moves voting to one-to-one messages from the Saunf business number. The group can stay for announcements and community chat.

### 4.2 Daily message flow

1. Owner enters the next day's sabji options in the admin panel (or the system pre-fills from a weekly plan).
2. At the scheduled send time, the system sends each active customer a template message with quick-reply buttons: the menu options and Absent.
3. The customer taps a button. WhatsApp sends a webhook to the backend, which resolves the day: PRESENT with the dish, or ABSENT, source CUSTOMER_VOTE.
4. If the customer changes their mind before cutoff, the latest tap wins and the change is audited.
5. One hour before cutoff, reminders go only to customers still Pending.
6. At cutoff the day is closed. Customers can no longer change their vote. Non-voters remain Pending.

### 4.3 Practical constraints to plan for

- Messages the business starts outside an open conversation window must use pre-approved templates. Submit the menu template and the follow-up template early, because approval takes time.
- Quick-reply buttons have a limited count per message. If a day has more options than fit, use a list message instead.
- A customer's reply opens a conversation window, which is also what allows the owner-side follow-up ("Were you present yesterday?") to be sent without a new template in many cases. Confirm the current rules in Meta's documentation when building.
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
| `invoices` | Period, per-meal price, carry-over applied, amount due, payment status, count of pending days at generation |

Additional tables to add as the build progresses: `admin_users` (with roles), `otp_codes`, `whatsapp_messages` (outbound and inbound log with message IDs for idempotency), `payments` (Razorpay event log), and `holidays` (days with no service).

## 6. Core workflows

### 6.1 Daily cycle

| Time (suggested) | Event | System action |
|---|---|---|
| Afternoon | Menu send | Create a Pending row for every active customer, send the WhatsApp menu |
| Before cutoff | Reminder | Message only customers still Pending |
| Cutoff | Close voting | Lock customer changes, compute kitchen count |
| Before cooking | Kitchen view | Admin sees dish totals, absent count, and Pending count |
| After service | Owner confirmation | Owner taps Present or Absent for each Pending customer |
| Next morning | Follow-up | Remaining Pending days appear at the top of the admin screen, with an optional "Ask on WhatsApp" action |

### 6.2 Resolving a Pending day

- **Owner confirms** with one tap. If Present, the owner also selects the dish, defaulting to the most common one that day. The ledger records MEAL_CONSUMED for Present or CARRYOVER_CREDIT for Absent. The audit entry records source OWNER.
- **Customer replies** to a follow-up such as "Were you present yesterday? Yes / No". The reply resolves the day with source CUSTOMER_FOLLOWUP.
- **The system never resolves a Pending day on its own.** If the owner later approves a time-limit rule, it must be an explicit, documented setting.

### 6.3 Monthly billing

1. Before the billing date, check for Pending days in the period. If any exist, show the owner a warning with the count and block automatic invoice generation until they are resolved or the owner overrides with a reason.
2. Compute carry-over available from the ledger.
3. Amount due = `(meals_in_plan - carryover_applied) × per_meal_price`.
4. Create the invoice, write a CARRYOVER_APPLIED ledger entry, and create a Razorpay payment link.
5. Send the invoice and link through WhatsApp and show it on the website.
6. Mark the invoice paid only from the verified Razorpay webhook.

> **Open point:** Whether carried-over meals extend the customer's service period (30 plus skipped meals) or are purely a discount on the next bill. The ledger supports both, but the invoice and dashboard wording differ.

### 6.4 Corrections

If a past day was recorded wrongly, the owner edits it from the admin panel with a required reason. The system writes a REVERSAL ledger entry for the old outcome and a new entry for the corrected one, plus an audit row. Invoices already paid are not changed. The difference is applied to the next invoice.

## 7. Modules and API surface

### 7.1 Backend modules

- **Auth**: phone number plus OTP for customers, email and password (or OTP) with roles for staff.
- **Customers and subscriptions**: onboarding, plan assignment, pause and cancel.
- **Menu**: weekly planner, daily menu, dish catalogue.
- **Selections**: state machine for a customer-day, with validation of allowed transitions.
- **Ledger**: the only code path that writes ledger entries, with balance queries.
- **Billing**: invoice generation, carry-over application, payment link creation.
- **Messaging**: template sends, retry, delivery status, inbound webhook handling.
- **Reports**: kitchen count, pending list, collection status, monthly summary.

### 7.2 Illustrative endpoints

| Method and path | Purpose |
|---|---|
| `POST /webhooks/whatsapp` | Receive votes and delivery status |
| `POST /webhooks/razorpay` | Receive payment events |
| `GET /me/dashboard` | Meals left, carry-over, next bill, vote history |
| `PUT /me/selections/:date` | Change tomorrow's choice before cutoff |
| `GET /admin/day/:date` | Kitchen count and customer states |
| `POST /admin/selections/:id/resolve` | Owner marks Present or Absent, with dish |
| `POST /admin/menus` | Create or edit a daily menu |
| `POST /admin/invoices/generate` | Run billing for a period, with guard |
| `POST /admin/ledger/adjust` | Manual adjustment with reason |

## 8. Technology choices

| Layer | Chosen | Alternative |
|---|---|---|
| Frontend | Next.js with TypeScript, Tailwind | Any React setup |
| Backend | NestJS (TypeScript) | FastAPI (Python) |
| Database | PostgreSQL | None recommended |
| Queue and scheduler | Redis with BullMQ | Celery with Redis |
| Messaging | WhatsApp Cloud API directly | Gupshup, Interakt, or Twilio |
| Payments | Razorpay | Cashfree |
| Hosting | Vercel for web app, VPS for API and workers | Single VPS with Docker Compose |
| Monitoring | Sentry plus uptime checks | Any equivalent |

## 9. Security, privacy, and compliance

- Verify signatures on WhatsApp and Razorpay webhooks. Reject anything unsigned.
- Rate-limit OTP requests and lock out repeated failures.
- Role-based access: staff can see only what their role needs. Manual ledger adjustments are restricted to the owner role.
- Store phone numbers and addresses only as needed. Encrypt backups and restrict database access.
- Keep records of customer consent to receive WhatsApp messages.
- India's Digital Personal Data Protection Act applies to personal data of customers.
- Never log full payment details. Razorpay holds card and UPI data.
- Daily database backups with a tested restore.

## 10. Testing strategy

- **Unit tests** for the ledger and billing math. Cover carry-over, partial months, reversals, rounding in paise, and the pending-days guard.
- **State machine tests** for a customer-day: every allowed and disallowed transition.
- **Webhook tests** with duplicate and out-of-order events.
- **Time-based job tests** with a controllable clock, covering time zones (use Asia/Kolkata consistently).
- **Dry-run billing** on real historical data from the owner's records.
- **End-to-end pilot** with a small group of real customers.

## 11. Roadmap

| Phase | Focus | Approx. duration |
|---|---|---|
| 0 | Discovery and setup | 1 week |
| 1 | Ledger and admin | 2–3 weeks |
| 2 | WhatsApp voting | 2 weeks |
| 3 | Customer website | 2 weeks |
| 4 | Payments and invoicing | 2 weeks |
| 5 | Pilot and launch | 2 weeks |

Roughly 11–12 weeks end to end. A reduced first release (Phases 0–2, then a manual billing export) can be live in about 5–6 weeks.

## 12. Open questions for the owner

1. Do carried-over meals extend the service period, or are they a discount on the next bill?
2. What are the exact send and cutoff times? Does the cutoff differ on weekends?
3. Is there any time limit after which an unresolved Pending day must be settled?
4. How are holidays and closed days handled?
5. Are there other plans, such as half-day or trial meals?
6. Is the service delivery, pickup, or dine-in?
7. Who besides the owner needs admin access?
8. How do customers pay today, and should cash payments be recorded?
9. Should customers be allowed to pause the subscription in advance?

## 13. Success measures

- Share of customers voting before cutoff.
- Pending days per day and resolution time.
- Difference between system counts and actual meals served.
- Time the owner spends on counting and confirmation each day.
- Billing disputes per month and share of invoices paid on time.
