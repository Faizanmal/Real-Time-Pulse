import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsUrl } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Plan to subscribe to', enum: ['PRO', 'AGENCY'] })
  @IsEnum(['PRO', 'AGENCY'])
  plan: 'PRO' | 'AGENCY';

  @ApiProperty({ description: 'URL to redirect after successful payment' })
  @IsUrl()
  successUrl: string;

  @ApiProperty({ description: 'URL to redirect if payment is canceled' })
  @IsUrl()
  cancelUrl: string;
}

export class CreatePortalSessionDto {
  @ApiProperty({ description: 'URL to return to after portal session' })
  @IsUrl()
  returnUrl: string;
}

export class ChangePlanDto {
  @ApiProperty({ description: 'New plan', enum: ['PRO', 'AGENCY'] })
  @IsEnum(['PRO', 'AGENCY'])
  plan: 'PRO' | 'AGENCY';
}
