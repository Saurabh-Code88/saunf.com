import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { SelectionsService } from './selections.service';
import { ResolveMealSelectionDto, BulkResolveSelectionsDto } from './dto/resolve-selection.dto';

@Controller('selections')
export class SelectionsController {
  constructor(private readonly selectionsService: SelectionsService) {}

  /**
   * Get all unresolved pending selections across all dates.
   */
  @Get('pending/all')
  getAllUnresolvedPending() {
    return this.selectionsService.getAllUnresolvedPending();
  }

  /**
   * Get pending selections for a specific date (owner's confirmation list).
   */
  @Get('pending/:menuDate')
  getPendingForDate(@Param('menuDate') menuDate: string) {
    return this.selectionsService.getPendingForDate(menuDate);
  }

  /**
   * Get detailed pending review summary for a date.
   */
  @Get('review/:menuDate')
  getPendingReview(@Param('menuDate') menuDate: string) {
    return this.selectionsService.getPendingReviewForDate(menuDate);
  }

  /**
   * Get kitchen count (dish orders) for a date.
   */
  @Get('kitchen-count/:menuDate')
  getKitchenCount(@Param('menuDate') menuDate: string) {
    return this.selectionsService.getKitchenCount(menuDate);
  }

  /**
   * Get customer's selection history.
   */
  @Get('customer/:customerId/history')
  getCustomerHistory(@Param('customerId') customerId: string) {
    return this.selectionsService.getCustomerHistory(customerId);
  }

  /**
   * Get a specific selection by customer and date.
   */
  @Get('customer/:customerId/date/:menuDate')
  getByCustomerAndDate(
    @Param('customerId') customerId: string,
    @Param('menuDate') menuDate: string,
  ) {
    return this.selectionsService.getByCustomerAndDate(customerId, menuDate);
  }

  /**
   * Resolve a single meal selection (ADMIN).
   */
  @Patch(':selectionId/resolve')
  resolve(
    @Param('selectionId') selectionId: string,
    @Body() dto: ResolveMealSelectionDto,
  ) {
    return this.selectionsService.resolve({
      selectionId: dto.selectionId,
      newState: dto.state as any,
      menuItemId: dto.menuItemId,
      source: (dto.source || 'OWNER') as any,
      actorId: undefined,
      actorType: 'admin',
      reason: dto.reason,
    });
  }

  /**
   * Resolve multiple selections in bulk (ADMIN).
   */
  @Post('resolve/bulk')
  async resolveBulk(@Body() dto: BulkResolveSelectionsDto) {
    const results = [];
    for (const selection of dto.selections) {
      const result = await this.selectionsService.resolve({
        selectionId: selection.selectionId,
        newState: selection.state as any,
        menuItemId: selection.menuItemId,
        source: (selection.source || 'OWNER') as any,
        actorId: undefined,
        actorType: 'admin',
        reason: selection.reason,
      });
      results.push(result);
    }
    return results;
  }
}
