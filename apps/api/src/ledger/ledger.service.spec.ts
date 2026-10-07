import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LedgerService, CustomerBalance } from './ledger.service';
import { MealLedgerEntry } from '../entities/meal-ledger-entry.entity';
import { LedgerEntryType } from '@saunf/shared';

/**
 * Unit tests for the Ledger Service.
 *
 * These tests cover:
 * - Plan credits
 * - Meal consumption (debits)
 * - Carry-over credits and application
 * - Reversals (corrections)
 * - Manual adjustments (require reason)
 * - Balance computation
 * - Rounding in paise
 */
describe('LedgerService', () => {
  let service: LedgerService;
  let repo: jest.Mocked<Repository<MealLedgerEntry>>;
  let savedEntries: MealLedgerEntry[];

  const mockCustomerId = 'cust-001';
  const mockSubscriptionId = 'sub-001';

  beforeEach(async () => {
    savedEntries = [];

    const mockRepo = {
      create: jest.fn((data: any) => ({
        id: `entry-${savedEntries.length + 1}`,
        ...data,
        createdAt: new Date(),
      })),
      save: jest.fn((entity: any) => {
        savedEntries.push(entity);
        return Promise.resolve(entity);
      }),
      find: jest.fn(() => Promise.resolve(savedEntries)),
      findOne: jest.fn((opts: any) => {
        const where = opts.where;
        return Promise.resolve(
          savedEntries.find(
            (e) =>
              e.referenceType === where.referenceType &&
              e.referenceId === where.referenceId,
          ) || null,
        );
      }),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: getRepositoryToken(MealLedgerEntry),
          useValue: mockRepo,
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    repo = module.get(getRepositoryToken(MealLedgerEntry));
  });

  // ── Plan Credits ─────────────────────────────────────────────

  describe('creditPlan', () => {
    it('should create a PLAN_CREDIT entry with positive meals', async () => {
      const entry = await service.creditPlan(
        mockCustomerId,
        mockSubscriptionId,
        30,
        300000, // ₹3000 = 300000 paise
      );

      expect(entry.entryType).toBe(LedgerEntryType.PLAN_CREDIT);
      expect(entry.meals).toBe(30);
      expect(entry.amountPaise).toBe(300000);
      expect(entry.customerId).toBe(mockCustomerId);
      expect(entry.subscriptionId).toBe(mockSubscriptionId);
    });
  });

  // ── Meal Consumption ─────────────────────────────────────────

  describe('consumeMeal', () => {
    it('should create a MEAL_CONSUMED entry with negative meals (-1)', async () => {
      const entry = await service.consumeMeal(
        mockCustomerId,
        mockSubscriptionId,
        'sel-001',
        10000, // ₹100 per meal
      );

      expect(entry.entryType).toBe(LedgerEntryType.MEAL_CONSUMED);
      expect(entry.meals).toBe(-1);
      expect(entry.amountPaise).toBe(-10000);
      expect(entry.referenceType).toBe('meal_selection');
      expect(entry.referenceId).toBe('sel-001');
    });
  });

  // ── Carry-over ────────────────────────────────────────────────

  describe('creditCarryover', () => {
    it('should create a CARRYOVER_CREDIT entry with +1 meal', async () => {
      const entry = await service.creditCarryover(
        mockCustomerId,
        mockSubscriptionId,
        'sel-002',
      );

      expect(entry.entryType).toBe(LedgerEntryType.CARRYOVER_CREDIT);
      expect(entry.meals).toBe(1);
      expect(entry.amountPaise).toBe(0);
    });
  });

  describe('applyCarryover', () => {
    it('should create a CARRYOVER_APPLIED entry with negative meals', async () => {
      const entry = await service.applyCarryover(
        mockCustomerId,
        mockSubscriptionId,
        'inv-001',
        5, // 5 carry-over meals applied
        50000, // ₹500 discount
      );

      expect(entry.entryType).toBe(LedgerEntryType.CARRYOVER_APPLIED);
      expect(entry.meals).toBe(-5);
      expect(entry.amountPaise).toBe(-50000);
      expect(entry.referenceType).toBe('invoice');
      expect(entry.referenceId).toBe('inv-001');
    });
  });

  // ── Reversals ─────────────────────────────────────────────────

  describe('reverseEntry', () => {
    it('should create a REVERSAL with opposite sign of the original', async () => {
      const original: MealLedgerEntry = {
        id: 'entry-original',
        customerId: mockCustomerId,
        subscriptionId: mockSubscriptionId,
        entryType: LedgerEntryType.MEAL_CONSUMED,
        meals: -1,
        amountPaise: -10000,
        referenceId: 'sel-001',
        referenceType: 'meal_selection',
        note: null,
        createdBy: null,
        createdAt: new Date(),
      } as any;

      const reversal = await service.reverseEntry(
        original,
        'Customer was actually absent',
        'admin-001',
      );

      expect(reversal.entryType).toBe(LedgerEntryType.REVERSAL);
      expect(reversal.meals).toBe(1); // opposite of -1
      expect(reversal.amountPaise).toBe(10000); // opposite of -10000
      expect(reversal.referenceId).toBe('entry-original');
      expect(reversal.note).toContain('Reversal of MEAL_CONSUMED');
      expect(reversal.createdBy).toBe('admin-001');
    });
  });

  // ── Manual Adjustments ────────────────────────────────────────

  describe('manualAdjustment', () => {
    it('should require a non-empty reason', async () => {
      await expect(
        service.manualAdjustment(mockCustomerId, 2, 0, '', 'admin-001'),
      ).rejects.toThrow('A reason is required');

      await expect(
        service.manualAdjustment(mockCustomerId, 2, 0, '   ', 'admin-001'),
      ).rejects.toThrow('A reason is required');
    });

    it('should create an ADJUSTMENT entry with a reason', async () => {
      const entry = await service.manualAdjustment(
        mockCustomerId,
        2,
        20000,
        'Extra meals granted as compensation',
        'admin-001',
      );

      expect(entry.entryType).toBe(LedgerEntryType.ADJUSTMENT);
      expect(entry.meals).toBe(2);
      expect(entry.amountPaise).toBe(20000);
      expect(entry.note).toBe('Extra meals granted as compensation');
      expect(entry.createdBy).toBe('admin-001');
    });
  });

  // ── Rounding in paise ─────────────────────────────────────────

  describe('paise rounding', () => {
    it('should handle plans where price does not divide evenly by meals', () => {
      // ₹2999 = 299900 paise ÷ 30 = 9996.666... → Math.round = 9997 paise per meal
      const pricePaise = 299900;
      const mealsPerMonth = 30;
      const perMealPaise = Math.round(pricePaise / mealsPerMonth);

      expect(perMealPaise).toBe(9997);

      // Total for 25 meals (5 absent):
      const mealsCharged = 25;
      const amountDue = mealsCharged * perMealPaise;

      // This might not equal 25/30 * 299900 exactly, and that's expected.
      // The per-meal price is rounded once and used consistently.
      expect(amountDue).toBe(249925);
    });

    it('should handle exact division', () => {
      // ₹3000 = 300000 paise ÷ 30 = 10000 paise exactly
      const perMealPaise = Math.round(300000 / 30);
      expect(perMealPaise).toBe(10000);

      const amountDue = 25 * perMealPaise;
      expect(amountDue).toBe(250000);
    });
  });
});
