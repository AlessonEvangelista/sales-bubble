import { PaymentModule } from '../payment/payment.module';
import { paymentRepository } from '../payment/payment.repository';

export const bubbleModule = [PaymentModule, paymentRepository];
