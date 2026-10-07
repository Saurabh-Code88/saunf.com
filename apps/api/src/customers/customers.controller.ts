import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Get('phone/:phone')
  findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Post()
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customersService.createCustomer(dto);
  }

  @Get(':id/subscriptions')
  listSubscriptions(@Param('id') id: string) {
    return this.customersService.listSubscriptions(id);
  }

  @Post(':id/subscriptions')
  createSubscription(
    @Param('id') customerId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.customersService.createSubscription(customerId, dto);
  }

  @Patch(':id/subscriptions/:subscriptionId/pause')
  pauseSubscription(
    @Param('id') customerId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.customersService.pauseSubscription(customerId, subscriptionId);
  }

  @Patch(':id/subscriptions/:subscriptionId/resume')
  resumeSubscription(
    @Param('id') customerId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.customersService.resumeSubscription(customerId, subscriptionId);
  }

  @Patch(':id/subscriptions/:subscriptionId/cancel')
  cancelSubscription(
    @Param('id') customerId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.customersService.cancelSubscription(customerId, subscriptionId);
  }
}
