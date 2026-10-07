import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class CreateDailyMenuDto {
  @IsDateString()
  menuDate: string;

  @IsOptional()
  @IsDateString()
  sendTime?: string;

  @IsOptional()
  @IsDateString()
  cutoffTime?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isLocked?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyMenuItemInputDto)
  items: DailyMenuItemInputDto[];
}

export class DailyMenuItemInputDto {
  @IsUUID()
  menuItemId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;
}

export class ResolveMenuSelectionDto {
  @IsUUID()
  selectionId: string;

  @IsString()
  state: 'PENDING' | 'PRESENT' | 'ABSENT';

  @IsOptional()
  @IsUUID()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  source?: 'CUSTOMER_VOTE' | 'CUSTOMER_WEB' | 'OWNER' | 'SYSTEM';
}
