import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ParcelStatus, ParcelType, Carrier } from '../../../domain/entities';

export class CreateParcelDto {
  @IsString()
  trackingNumber: string;

  @IsEnum(['ups', 'fedex', 'laposte', 'dhl', 'usps', 'colissimo', 'chronopost', 'other'])
  carrier: Carrier;

  @IsEnum(['pending', 'in_transit', 'delivered', 'returned', 'unknown'])
  @IsOptional()
  status?: ParcelStatus;

  @IsEnum(['sale', 'purchase'])
  type: ParcelType;

  @IsString()
  @IsOptional()
  sourceEmailId?: string;

  @IsEnum(['gmail', 'outlook'])
  @IsOptional()
  provider?: 'gmail' | 'outlook';

  @IsString()
  title: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class UpdateParcelDto {
  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsEnum(['ups', 'fedex', 'laposte', 'dhl', 'usps', 'colissimo', 'chronopost', 'other'])
  @IsOptional()
  carrier?: Carrier;

  @IsEnum(['pending', 'in_transit', 'delivered', 'returned', 'unknown'])
  @IsOptional()
  status?: ParcelStatus;

  @IsEnum(['sale', 'purchase'])
  @IsOptional()
  type?: ParcelType;

  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class ParcelFiltersDto {
  @IsEnum(['sale', 'purchase'])
  @IsOptional()
  type?: ParcelType;

  @IsEnum(['pending', 'in_transit', 'delivered', 'returned', 'unknown'])
  @IsOptional()
  status?: ParcelStatus;

  @IsEnum(['gmail', 'outlook'])
  @IsOptional()
  provider?: 'gmail' | 'outlook';

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(['createdAt', 'updatedAt', 'title'])
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'title';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @IsString()
  @IsOptional()
  limit?: string;

  @IsString()
  @IsOptional()
  offset?: string;
}
