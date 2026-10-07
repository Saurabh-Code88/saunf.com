import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  mealsPerMonth: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  pricePaise: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
