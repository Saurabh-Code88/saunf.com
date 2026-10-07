import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MenuItem } from '../entities/menu-item.entity';
import { DailyMenu } from '../entities/daily-menu.entity';
import { DailyMenuItem } from '../entities/daily-menu-item.entity';
import { MealSelection } from '../entities/meal-selection.entity';
import { CreateMenuItemDto, CreateDailyMenuDto } from './dto/create-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(DailyMenu)
    private readonly dailyMenuRepository: Repository<DailyMenu>,
    @InjectRepository(DailyMenuItem)
    private readonly dailyMenuItemRepository: Repository<DailyMenuItem>,
    @InjectRepository(MealSelection)
    private readonly mealSelectionRepository: Repository<MealSelection>,
  ) {}

  async findAllMenuItems(): Promise<MenuItem[]> {
    return this.menuItemRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createMenuItem(dto: CreateMenuItemDto): Promise<MenuItem> {
    const item = this.menuItemRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });

    return this.menuItemRepository.save(item);
  }

  async findDailyMenuByDate(menuDate: string): Promise<DailyMenu | null> {
    return this.dailyMenuRepository.findOne({
      where: { menuDate },
      relations: ['items', 'items.menuItem'],
    });
  }

  async listDailyMenus(): Promise<DailyMenu[]> {
    return this.dailyMenuRepository.find({
      order: { menuDate: 'DESC' },
      relations: ['items', 'items.menuItem'],
    });
  }

  async createDailyMenu(dto: CreateDailyMenuDto): Promise<DailyMenu> {
    const existing = await this.dailyMenuRepository.findOne({
      where: { menuDate: dto.menuDate },
    });

    if (existing) {
      throw new BadRequestException(`Daily menu for ${dto.menuDate} already exists`);
    }

    const menu = this.dailyMenuRepository.create({
      menuDate: dto.menuDate,
      sendTime: dto.sendTime ? new Date(dto.sendTime) : null,
      cutoffTime: dto.cutoffTime ? new Date(dto.cutoffTime) : null,
      isLocked: dto.isLocked ?? false,
    });

    const savedMenu = await this.dailyMenuRepository.save(menu);

    const menuItems = dto.items.map((item) =>
      this.dailyMenuItemRepository.create({
        dailyMenuId: savedMenu.id,
        menuItemId: item.menuItemId,
        displayOrder: item.displayOrder ?? 0,
      }),
    );

    await this.dailyMenuItemRepository.save(menuItems);

    return this.findDailyMenuByDate(dto.menuDate) as Promise<DailyMenu>;
  }

  async getKitchenCount(menuDate: string): Promise<{ menuDate: string; dishes: any[]; absentCount: number; pendingCount: number; totalCustomers: number }> {
    const selections = await this.mealSelectionRepository.find({
      where: { menuDate },
      relations: ['menuItem'],
    });

    const dishCounts = new Map<string, { name: string; count: number }>();
    let absentCount = 0;
    let pendingCount = 0;

    for (const selection of selections) {
      if (selection.state === 'PRESENT' && selection.menuItem) {
        const existing = dishCounts.get(selection.menuItemId!);
        if (existing) {
          existing.count += 1;
        } else {
          dishCounts.set(selection.menuItemId!, {
            name: selection.menuItem.name,
            count: 1,
          });
        }
      } else if (selection.state === 'ABSENT') {
        absentCount += 1;
      } else {
        pendingCount += 1;
      }
    }

    return {
      menuDate,
      dishes: Array.from(dishCounts.entries()).map(([menuItemId, data]) => ({
        menuItemId,
        name: data.name,
        count: data.count,
      })),
      absentCount,
      pendingCount,
      totalCustomers: selections.length,
    };
  }

  async createDefaultSelectionsForMenu(dailyMenuId: string, menuDate: string, customerIds: string[]): Promise<MealSelection[]> {
    if (customerIds.length === 0) {
      return [];
    }

    const selections = customerIds.map((customerId) =>
      this.mealSelectionRepository.create({
        customerId,
        dailyMenuId,
        menuDate,
        state: 'PENDING',
        source: 'SYSTEM',
      }),
    );

    await this.mealSelectionRepository
      .createQueryBuilder()
      .insert()
      .into(MealSelection)
      .values(selections)
      .orIgnore()
      .execute();

    return this.mealSelectionRepository.find({
      where: {
        customerId: In(customerIds),
        menuDate,
      },
      order: { customerId: 'ASC' },
    });
  }
}
