import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ResolveMealSelectionDto {
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
  source?: 'CUSTOMER_VOTE' | 'CUSTOMER_FOLLOWUP' | 'CUSTOMER_WEB' | 'OWNER' | 'SYSTEM';
}

export class BulkResolveSelectionsDto {
  @IsDateString()
  menuDate: string;

  @Type(() => ResolveMealSelectionDto)
  selections: ResolveMealSelectionDto[];
}

export class ConfirmPendingSelectionsDto {
  @IsDateString()
  menuDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
