import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SelectionsService } from './selections.service';
import { ResolveMealSelectionDto, BulkResolveSelectionsDto } from './dto/resolve-selection.dto';

@Controller('selections')
export class SelectionsController {
  constructor(private readonly selectionsService: SelectionsService) {}

  /**
   * Get all unresolved pending selections across all dates.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('pending/all')
  getAllUnresolvedPending() {
    return this.selectionsService.getAllUnresolvedPending();
  }

  /**
   * Get pending selections for a specific date (owner's confirmation list).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('pending/:menuDate')
  getPendingForDate(@Param('menuDate') menuDate: string) {
    return this.selectionsService.getPendingForDate(menuDate);
  }

  /**
   * Get detailed pending review summary for a date.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
  @Get('review/:menuDate')
  getPendingReview(@Param('menuDate') menuDate: string) {
    return this.selectionsService.getPendingReviewForDate(menuDate);
  }

  /**
   * Get kitchen count (dish orders) for a date.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
  @Get('kitchen-count/:menuDate')
  getKitchenCount(@Param('menuDate') menuDate: string) {
    return this.selectionsService.getKitchenCount(menuDate);
  }

  /**
   * Get customer's selection history.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
  @Get('customer/:customerId/history')
  getCustomerHistory(@Param('customerId') customerId: string) {
    return this.selectionsService.getCustomerHistory(customerId);
  }

  /**
   * Get a specific selection by customer and date.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
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
