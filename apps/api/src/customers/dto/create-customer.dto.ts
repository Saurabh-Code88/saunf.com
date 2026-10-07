import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^\+?[0-9\s-]{10,15}$/)
  phone: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  waOptedIn?: boolean;
}
