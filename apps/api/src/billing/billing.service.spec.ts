import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@saunf/shared';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;
  let invoiceRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let selectionRepo: { count: jest.Mock };
  let subscriptionRepo: { findOne: jest.Mock };
  let ledgerService: {
    getBalance: jest.Mock;
    applyCarryover: jest.Mock;
  };

  const subscription = {
    id: 'sub-001',
    customerId: 'cust-001',
    plan: {
      mealsPerMonth: 30,
      pricePaise: 299900,
    },
    customer: {
      id: 'cust-001',
      name: 'Asha',
    },
  };

  beforeEach(() => {
    invoiceRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((invoice) =>
        Promise.resolve({
          id: invoice.id || 'inv-001',
          ...invoice,
        }),
      ),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    selectionRepo = {
      count: jest.fn(),
    };

    subscriptionRepo = {
      findOne: jest.fn(),
    };

    ledgerService = {
      getBalance: jest.fn(),
      applyCarryover: jest.fn(() => Promise.resolve({ id: 'ledger-001' })),
    };

    service = new BillingService(
      invoiceRepo as any,
      selectionRepo as any,
      subscriptionRepo as any,
      ledgerService as any,
    );
  });

  describe('generateInvoice', () => {
    it('blocks invoice generation when pending days exist without override', async () => {
      subscriptionRepo.findOne.mockResolvedValue(subscription);
      selectionRepo.count.mockResolvedValue(2);

      await expect(
        service.generateInvoice({
          subscriptionId: 'sub-001',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-30',
          generatedBy: 'admin-001',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(invoiceRepo.save).not.toHaveBeenCalled();
      expect(ledgerService.applyCarryover).not.toHaveBeenCalled();
    });

    it('applies carry-over meals and uses rounded per-meal paise', async () => {
      subscriptionRepo.findOne.mockResolvedValue(subscription);
      selectionRepo.count.mockResolvedValue(0);
      ledgerService.getBalance.mockResolvedValue({
        customerId: 'cust-001',
        totalMealBalance: 12,
        carryoverBalance: 5,
        mealsRemaining: 7,
      });

      const summary = await service.generateInvoice({
        subscriptionId: 'sub-001',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-30',
        generatedBy: 'admin-001',
      });

      expect(summary).toEqual({
        invoiceId: 'inv-001',
        customerId: 'cust-001',
        mealsInPlan: 30,
        carryoverApplied: 5,
        mealsCharged: 25,
        perMealPaise: 9997,
        amountDuePaise: 249925,
        pendingDaysCount: 0,
        status: InvoiceStatus.PENDING_PAYMENT,
      });

      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          carryoverApplied: 5,
          mealsCharged: 25,
          perMealPaise: 9997,
          amountDuePaise: 249925,
          status: InvoiceStatus.PENDING_PAYMENT,
        }),
      );
      expect(ledgerService.applyCarryover).toHaveBeenCalledWith(
        'cust-001',
        'sub-001',
        'inv-001',
        5,
        49985,
      );
    });

    it('allows an explicit override and records the pending-day count', async () => {
      subscriptionRepo.findOne.mockResolvedValue(subscription);
      selectionRepo.count.mockResolvedValue(2);
      ledgerService.getBalance.mockResolvedValue({
        customerId: 'cust-001',
        totalMealBalance: 0,
        carryoverBalance: 0,
        mealsRemaining: 0,
      });

      const summary = await service.generateInvoice({
        subscriptionId: 'sub-001',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-30',
        generatedBy: 'admin-001',
        overrideReason: 'Owner approved month-end billing.',
      });

      expect(summary.pendingDaysCount).toBe(2);
      expect(invoiceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingDaysCount: 2,
          overrideReason: 'Owner approved month-end billing.',
        }),
      );
    });

    it('marks a fully covered invoice as paid when carry-over covers the plan', async () => {
      subscriptionRepo.findOne.mockResolvedValue(subscription);
      selectionRepo.count.mockResolvedValue(0);
      ledgerService.getBalance.mockResolvedValue({
        customerId: 'cust-001',
        totalMealBalance: 35,
        carryoverBalance: 35,
        mealsRemaining: 0,
      });

      const summary = await service.generateInvoice({
        subscriptionId: 'sub-001',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-30',
        generatedBy: 'admin-001',
      });

      expect(summary.amountDuePaise).toBe(0);
      expect(summary.carryoverApplied).toBe(30);
      expect(summary.status).toBe(InvoiceStatus.PAID);
    });
  });

  describe('markPaid', () => {
    it('marks an invoice as paid with the Razorpay payment id', async () => {
      const invoice = {
        id: 'inv-001',
        status: InvoiceStatus.PENDING_PAYMENT,
        razorpayPaymentId: null,
        paidAt: null,
      };
      invoiceRepo.findOne.mockResolvedValue(invoice);
      invoiceRepo.save.mockImplementation((updated) => Promise.resolve(updated));

      const result = await service.markPaid('inv-001', 'pay-001');

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(result.razorpayPaymentId).toBe('pay-001');
      expect(result.paidAt).toBeInstanceOf(Date);
      expect(invoiceRepo.save).toHaveBeenCalledWith(invoice);
    });

    it('throws when marking an unknown invoice as paid', async () => {
      invoiceRepo.findOne.mockResolvedValue(null);

      await expect(service.markPaid('missing', 'pay-001')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
