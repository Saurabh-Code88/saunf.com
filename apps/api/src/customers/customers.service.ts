import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { Subscription } from '../entities/subscription.entity';
import { Plan } from '../entities/plan.entity';
import { SubscriptionStatus } from '@saunf/shared';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
  ) {}

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['subscriptions', 'subscriptions.plan'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    return customer;
  }

  async findByPhone(phone: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { phone },
      relations: ['subscriptions', 'subscriptions.plan'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with phone ${phone} not found`);
    }

    return customer;
  }

  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    const normalizedPhone = dto.phone.trim();
    const existingCustomer = await this.customerRepository.findOne({
      where: { phone: normalizedPhone },
    });

    if (existingCustomer) {
      throw new BadRequestException(`Customer with phone ${normalizedPhone} already exists`);
    }

    const customer = this.customerRepository.create({
      name: dto.name.trim(),
      phone: normalizedPhone,
      address: dto.address?.trim() || null,
      isActive: true,
      waOptedIn: dto.waOptedIn ?? false,
    });

    return this.customerRepository.save(customer);
  }

  async listSubscriptions(customerId: string): Promise<Subscription[]> {
    await this.findById(customerId);

    return this.subscriptionRepository.find({
      where: { customerId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveSubscription(customerId: string): Promise<Subscription | null> {
    return this.subscriptionRepository.findOne({
      where: { customerId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });
  }

  async createSubscription(
    customerId: string,
    dto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    const customer = await this.findById(customerId);
    const plan = await this.planRepository.findOne({
      where: { id: dto.planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with id ${dto.planId} not found or inactive`);
    }

    const existingActive = await this.subscriptionRepository.findOne({
      where: { customerId, status: SubscriptionStatus.ACTIVE },
    });

    if (existingActive) {
      throw new BadRequestException(
        `Customer ${customer.id} already has an active subscription`,
      );
    }

    const subscription = this.subscriptionRepository.create({
      customerId: customer.id,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: dto.startDate || new Date().toISOString().slice(0, 10),
      endDate: dto.endDate || null,
      billingDay: dto.billingDay ?? 1,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async pauseSubscription(customerId: string, subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, customerId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found for customer ${customerId}`);
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Subscription must be ACTIVE before pausing. Current status: ${subscription.status}`,
      );
    }

    subscription.status = SubscriptionStatus.PAUSED;
    return this.subscriptionRepository.save(subscription);
  }

  async resumeSubscription(customerId: string, subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, customerId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found for customer ${customerId}`);
    }

    if (subscription.status !== SubscriptionStatus.PAUSED) {
      throw new BadRequestException(
        `Subscription must be PAUSED before resuming. Current status: ${subscription.status}`,
      );
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(customerId: string, subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, customerId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found for customer ${customerId}`);
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.endDate = subscription.endDate || new Date().toISOString().slice(0, 10);
    return this.subscriptionRepository.save(subscription);
  }
}
