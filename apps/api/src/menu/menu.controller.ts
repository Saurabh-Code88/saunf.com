import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, CreateDailyMenuDto } from './dto/create-menu-item.dto';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('items')
  getMenuItems() {
    return this.menuService.findAllMenuItems();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('items')
  createMenuItem(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createMenuItem(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
  @Get('daily')
  listDailyMenus() {
    return this.menuService.listDailyMenus();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
  @Get('daily/:menuDate')
  getDailyMenu(@Param('menuDate') menuDate: string) {
    return this.menuService.findDailyMenuByDate(menuDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('daily')
  createDailyMenu(@Body() dto: CreateDailyMenuDto) {
    return this.menuService.createDailyMenu(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'chef')
  @Get('daily/:menuDate/kitchen-count')
  getKitchenCount(@Param('menuDate') menuDate: string) {
    return this.menuService.getKitchenCount(menuDate);
  }
}
