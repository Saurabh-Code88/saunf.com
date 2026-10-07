/**
 * Saunf shared types and enums
 * Used by both the API and web app to keep domain concepts in sync.
 */

// ─── Meal Selection States ───────────────────────────────────────
/** The state machine for a customer-day meal selection. */
export enum MealSelectionState {
  /** Customer has not yet voted and the day is still open. */
  PENDING = 'PENDING',
  /** Customer (or owner) marked as present with a dish choice. */
  PRESENT = 'PRESENT',
  /** Customer (or owner) marked as absent. Generates a carry-over credit. */
  ABSENT = 'ABSENT',
}

// ─── Selection Sources ───────────────────────────────────────────
/** Who or what caused a meal selection state change. */
export enum SelectionSource {
  /** Customer tapped a button in the daily WhatsApp menu message. */
  CUSTOMER_VOTE = 'CUSTOMER_VOTE',
  /** Customer replied to a follow-up "Were you present?" message. */
  CUSTOMER_FOLLOWUP = 'CUSTOMER_FOLLOWUP',
  /** Customer changed their choice via the website before cutoff. */
  CUSTOMER_WEB = 'CUSTOMER_WEB',
  /** Owner resolved a Pending day from the admin panel. */
  OWNER = 'OWNER',
  /** System-generated initial state when a daily menu is sent. */
  SYSTEM = 'SYSTEM',
}

// ─── Ledger Entry Types ──────────────────────────────────────────
/** Types of entries in the append-only meal ledger. */
export enum LedgerEntryType {
  /** Plan activated: credits N meals. */
  PLAN_CREDIT = 'PLAN_CREDIT',
  /** Meal consumed (customer was Present). Debits 1 meal. */
  MEAL_CONSUMED = 'MEAL_CONSUMED',
  /** Absent day: credits 1 meal to carry-over pool. */
  CARRYOVER_CREDIT = 'CARRYOVER_CREDIT',
  /** Carry-over applied to an invoice: debits from carry-over pool. */
  CARRYOVER_APPLIED = 'CARRYOVER_APPLIED',
  /** Reversal of a previous entry (corrections). */
  REVERSAL = 'REVERSAL',
  /** Manual adjustment by the owner with a required reason. */
  ADJUSTMENT = 'ADJUSTMENT',
}

// ─── Invoice Status ──────────────────────────────────────────────
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

// ─── Subscription Status ─────────────────────────────────────────
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

// ─── User Roles ──────────────────────────────────────────────────
export enum UserRole {
  OWNER = 'OWNER',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

// ─── WhatsApp Message Status ─────────────────────────────────────
export enum WhatsAppMessageStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

// ─── Allowed state transitions ───────────────────────────────────
/**
 * Defines which transitions are valid for the meal selection state machine.
 * Key = current state, value = array of states it can transition to.
 */
export const ALLOWED_TRANSITIONS: Record<MealSelectionState, MealSelectionState[]> = {
  [MealSelectionState.PENDING]: [MealSelectionState.PRESENT, MealSelectionState.ABSENT],
  [MealSelectionState.PRESENT]: [MealSelectionState.ABSENT, MealSelectionState.PENDING],
  [MealSelectionState.ABSENT]: [MealSelectionState.PRESENT, MealSelectionState.PENDING],
};

// ─── Business constants ──────────────────────────────────────────
export const MEALS_PER_PLAN = 30;
export const TIMEZONE = 'Asia/Kolkata';
