import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('phone/:phone')
  findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id/subscriptions')
  listSubscriptions(@Param('id') id: string) {
    return this.customersService.listSubscriptions(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/subscriptions')
  createSubscription(
    @Param('id') customerId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.customersService.createSubscription(customerId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/subscriptions/:subscriptionId/pause')
  pauseSubscription(
    @Param('id') customerId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.customersService.pauseSubscription(customerId, subscriptionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/subscriptions/:subscriptionId/resume')
  resumeSubscription(
    @Param('id') customerId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.customersService.resumeSubscription(customerId, subscriptionId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/subscriptions/:subscriptionId/cancel')
  cancelSubscription(
    @Param('id') customerId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.customersService.cancelSubscription(customerId, subscriptionId);
  }
}
