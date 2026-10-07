import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get daily processing summary for a specific date.
   */
  @Get('daily/:menuDate/summary')
  getDailyProcessingSummary(@Param('menuDate') menuDate: string) {
    return this.adminService.getDailyProcessingSummary(menuDate);
  }

  /**
   * Get pending confirmation list for a date.
   */
  @Get('daily/:menuDate/pending-confirmations')
  getPendingConfirmationList(@Param('menuDate') menuDate: string) {
    return this.adminService.getPendingConfirmationList(menuDate);
  }

  /**
   * Lock a daily menu and prevent customer changes.
   */
  @Post('daily/:menuDate/lock')
  lockDailyMenu(@Param('menuDate') menuDate: string) {
    return this.adminService.lockDailyMenu(menuDate);
  }

  /**
   * Unlock a daily menu to allow customer changes.
   */
  @Post('daily/:menuDate/unlock')
  unlockDailyMenu(@Param('menuDate') menuDate: string) {
    return this.adminService.unlockDailyMenu(menuDate);
  }

  /**
   * Publish a daily menu (generate default PENDING selections for all active customers).
   */
  @Post('daily/:menuDate/publish')
  publishDailyMenu(@Param('menuDate') menuDate: string) {
    return this.adminService.publishDailyMenu(menuDate);
  }

  /**
   * Get selection audit trail for a customer (optionally filtered by date).
   */
  @Get('customer/:customerId/audit-trail')
  getCustomerSelectionAuditTrail(
    @Param('customerId') customerId: string,
    @Body('menuDate') menuDate?: string,
  ) {
    return this.adminService.getCustomerSelectionAuditTrail(
      customerId,
      menuDate,
    );
  }
}
