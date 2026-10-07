import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  billingDay?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
