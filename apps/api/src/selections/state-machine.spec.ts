import {
  MealSelectionState,
  ALLOWED_TRANSITIONS,
} from '@saunf/shared';

/**
 * Unit tests for the meal selection state machine.
 * Tests the transition rules defined in @saunf/shared.
 *
 * Valid transitions:
 *   PENDING  → PRESENT, ABSENT
 *   PRESENT  → ABSENT, PENDING (correction)
 *   ABSENT   → PRESENT, PENDING (correction)
 *
 * All transitions are covered, including disallowed self-transitions.
 */
describe('Meal Selection State Machine', () => {
  // ── Allowed transitions ─────────────────────────────────────

  describe('allowed transitions', () => {
    it('PENDING → PRESENT should be allowed', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.PENDING],
      ).toContain(MealSelectionState.PRESENT);
    });

    it('PENDING → ABSENT should be allowed', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.PENDING],
      ).toContain(MealSelectionState.ABSENT);
    });

    it('PRESENT → ABSENT should be allowed (correction)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.PRESENT],
      ).toContain(MealSelectionState.ABSENT);
    });

    it('PRESENT → PENDING should be allowed (revert to unresolved)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.PRESENT],
      ).toContain(MealSelectionState.PENDING);
    });

    it('ABSENT → PRESENT should be allowed (correction)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.ABSENT],
      ).toContain(MealSelectionState.PRESENT);
    });

    it('ABSENT → PENDING should be allowed (revert to unresolved)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.ABSENT],
      ).toContain(MealSelectionState.PENDING);
    });
  });

  // ── Disallowed transitions (self-transitions) ────────────────

  describe('disallowed transitions', () => {
    it('PENDING → PENDING should not be allowed (no-op)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.PENDING],
      ).not.toContain(MealSelectionState.PENDING);
    });

    it('PRESENT → PRESENT should not be allowed (use dish change instead)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.PRESENT],
      ).not.toContain(MealSelectionState.PRESENT);
    });

    it('ABSENT → ABSENT should not be allowed (no-op)', () => {
      expect(
        ALLOWED_TRANSITIONS[MealSelectionState.ABSENT],
      ).not.toContain(MealSelectionState.ABSENT);
    });
  });

  // ── Transition completeness ──────────────────────────────────

  describe('completeness', () => {
    it('every state should have defined transitions', () => {
      for (const state of Object.values(MealSelectionState)) {
        expect(ALLOWED_TRANSITIONS[state]).toBeDefined();
        expect(Array.isArray(ALLOWED_TRANSITIONS[state])).toBe(true);
      }
    });

    it('each state can transition to exactly 2 other states', () => {
      for (const state of Object.values(MealSelectionState)) {
        expect(ALLOWED_TRANSITIONS[state].length).toBe(2);
      }
    });
  });
});
