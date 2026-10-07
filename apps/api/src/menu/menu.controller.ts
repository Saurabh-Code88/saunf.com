import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, CreateDailyMenuDto } from './dto/create-menu-item.dto';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('items')
  getMenuItems() {
    return this.menuService.findAllMenuItems();
  }

  @Post('items')
  createMenuItem(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createMenuItem(dto);
  }

  @Get('daily')
  listDailyMenus() {
    return this.menuService.listDailyMenus();
  }

  @Get('daily/:menuDate')
  getDailyMenu(@Param('menuDate') menuDate: string) {
    return this.menuService.findDailyMenuByDate(menuDate);
  }

  @Post('daily')
  createDailyMenu(@Body() dto: CreateDailyMenuDto) {
    return this.menuService.createDailyMenu(dto);
  }

  @Get('daily/:menuDate/kitchen-count')
  getKitchenCount(@Param('menuDate') menuDate: string) {
    return this.menuService.getKitchenCount(menuDate);
  }
}
