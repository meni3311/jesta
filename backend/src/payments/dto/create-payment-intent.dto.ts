import { IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  /** Which coin package the employer is buying. */
  @IsUUID()
  packageId!: string;
}
