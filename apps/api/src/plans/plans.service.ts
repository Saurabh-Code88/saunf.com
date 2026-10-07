import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
  ) {}

  async findAll(): Promise<Plan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { pricePaise: 'ASC' },
    });
  }

  async findById(id: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }

    return plan;
  }

  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    const plan = this.planRepository.create({
      name: dto.name.trim(),
      mealsPerMonth: dto.mealsPerMonth,
      pricePaise: dto.pricePaise,
      isActive: dto.isActive ?? true,
    });

    return this.planRepository.save(plan);
  }
}
