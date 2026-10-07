import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyMenu } from '../entities/daily-menu.entity';
import { MealSelection } from '../entities/meal-selection.entity';
import { Subscription } from '../entities/subscription.entity';
import { Customer } from '../entities/customer.entity';
import { SelectionsService } from '../selections/selections.service';
import { SubscriptionStatus } from '@saunf/shared';

export interface DailyProcessingSummary {
  menuDate: string;
  totalCustomers: number;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  kitchenCount: { [key: string]: number };
  status: 'completed' | 'pending' | 'partially_resolved';
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(DailyMenu)
    private readonly dailyMenuRepository: Repository<DailyMenu>,
    @InjectRepository(MealSelection)
    private readonly mealSelectionRepository: Repository<MealSelection>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly selectionsService: SelectionsService,
  ) {}

  /**
   * Get summary of today's processing status.
   */
  async getDailyProcessingSummary(
    menuDate: string,
  ): Promise<DailyProcessingSummary> {
    const selections = await this.mealSelectionRepository.find({
      where: { menuDate },
      relations: ['menuItem'],
    });

    if (selections.length === 0) {
      throw new NotFoundException(
        `No selections found for date ${menuDate}`,
      );
    }

    const kitchenCountMap = new Map<string, number>();
    let presentCount = 0;
    let absentCount = 0;
    let pendingCount = 0;

    for (const selection of selections) {
      if (selection.state === 'PRESENT' && selection.menuItem) {
        presentCount++;
        const current = kitchenCountMap.get(selection.menuItem.name) || 0;
        kitchenCountMap.set(selection.menuItem.name, current + 1);
      } else if (selection.state === 'ABSENT') {
        absentCount++;
      } else if (selection.state === 'PENDING') {
        pendingCount++;
      }
    }

    let status: 'completed' | 'pending' | 'partially_resolved';
    if (pendingCount === 0) {
      status = 'completed';
    } else if (pendingCount === selections.length) {
      status = 'pending';
    } else {
      status = 'partially_resolved';
    }

    return {
      menuDate,
      totalCustomers: selections.length,
      presentCount,
      absentCount,
      pendingCount,
      kitchenCount: Object.fromEntries(kitchenCountMap),
      status,
    };
  }

  /**
   * Lock a daily menu and prevent further customer changes.
   */
  async lockDailyMenu(menuDate: string): Promise<DailyMenu> {
    const menu = await this.dailyMenuRepository.findOne({
      where: { menuDate },
    });

    if (!menu) {
      throw new NotFoundException(`Daily menu for ${menuDate} not found`);
    }

    if (menu.isLocked) {
      throw new BadRequestException(
        `Daily menu for ${menuDate} is already locked`,
      );
    }

    menu.isLocked = true;
    return this.dailyMenuRepository.save(menu);
  }

  /**
   * Unlock a daily menu to allow customer changes again.
   */
  async unlockDailyMenu(menuDate: string): Promise<DailyMenu> {
    const menu = await this.dailyMenuRepository.findOne({
      where: { menuDate },
    });

    if (!menu) {
      throw new NotFoundException(`Daily menu for ${menuDate} not found`);
    }

    if (!menu.isLocked) {
      throw new BadRequestException(
        `Daily menu for ${menuDate} is not locked`,
      );
    }

    menu.isLocked = false;
    return this.dailyMenuRepository.save(menu);
  }

  /**
   * Get the pending confirmation list for a date with customer details.
   */
  async getPendingConfirmationList(
    menuDate: string,
  ): Promise<{
    menuDate: string;
    totalPending: number;
    pending: Array<{
      selectionId: string;
      customerId: string;
      customerName: string;
      customerPhone: string;
      activeSubscription: boolean;
      createdAt: Date;
    }>;
  }> {
    const pendingSelections = await this.selectionsService.getPendingForDate(
      menuDate,
    );

    const pending = await Promise.all(
      pendingSelections.map(async (selection) => {
        const subscription = await this.subscriptionRepository.findOne({
          where: {
            customerId: selection.customerId,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        return {
          selectionId: selection.id,
          customerId: selection.customerId,
          customerName: selection.customer?.name || 'Unknown',
          customerPhone: selection.customer?.phone || 'N/A',
          activeSubscription: !!subscription,
          createdAt: selection.createdAt,
        };
      }),
    );

    return {
      menuDate,
      totalPending: pending.length,
      pending,
    };
  }

  /**
   * Generate default selections for all active customers for a given daily menu.
   * This is called when the daily menu is published/sent to customers.
   */
  async publishDailyMenu(menuDate: string): Promise<MealSelection[]> {
    const menu = await this.dailyMenuRepository.findOne({
      where: { menuDate },
    });

    if (!menu) {
      throw new NotFoundException(`Daily menu for ${menuDate} not found`);
    }

    // Get all active customers with active subscriptions
    const subscriptions = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['customer'],
    });

    const customerIds = subscriptions.map((sub) => sub.customerId);

    if (customerIds.length === 0) {
      return [];
    }

    // Create default PENDING selections
    return this.selectionsService.createPendingForAllCustomers(
      menu.id,
      menuDate,
      customerIds,
    );
  }

  /**
   * Get manual adjustment history for a customer.
   */
  async getCustomerSelectionAuditTrail(customerId: string, menuDate?: string) {
    const query = this.mealSelectionRepository
      .createQueryBuilder('sel')
      .leftJoinAndSelect('sel.customer', 'customer')
      .where('sel.customer_id = :customerId', { customerId });

    if (menuDate) {
      query.andWhere('sel.menu_date = :menuDate', { menuDate });
    }

    return query.orderBy('sel.created_at', 'DESC').getMany();
  }
}
