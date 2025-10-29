import type { Grizzly } from 'grizzly-orm';
import { Payment } from '../models/Payment.js';
import { Tenant } from '../models/Tenant.js';
import { H2hClient } from './sdk/H2hClient.js';
import { ApiClient } from './sdk/ApiClient.js';
import { TokenService } from './TokenService.js';
import type { TenantId } from '../types/index.js';
import { PaymentRequestSchema } from '../schemas/payment.js';
import { Value } from '@sinclair/typebox/value';
import type { Static } from '@sinclair/typebox';

/**
 * Сервис для работы с платежами с мультитенантностью
 */
export class PaymentService {
  constructor(
    private readonly db: Grizzly,
    private readonly tokenService: TokenService,
    private readonly apiClientFactory: (config: any) => ApiClient
  ) {}

  /**
   * Создание платежного поручения
   */
  async createPayment(
    tenantId: TenantId,
    paymentData: Static<typeof PaymentRequestSchema>
  ): Promise<{ payment: Payment; sberResponse: any }> {
    // Валидация через TypeBox
    if (!Value.Check(PaymentRequestSchema, paymentData)) {
      throw new Error('Invalid payment request format');
    }

    const tenantRepo = this.db.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ id: tenantId });
    if (!tenant || !tenant.sberClientId) {
      throw new Error(`Tenant ${tenantId} or clientId not found`);
    }

    const accessToken = await this.tokenService.getValidAccessToken(
      tenantId,
      tenant.sberClientId
    );

    const apiClient = this.apiClientFactory({
      host: tenant.sberApiHost,
      p12Path: tenant.sberP12Path!,
      p12Password: tenant.sberP12Password!,
      caPath: tenant.sberCaPath,
    });

    const h2hClient = new H2hClient(apiClient);
    const sberResponse = await h2hClient.createPayment(accessToken, paymentData);

    // Сохранение в БД
    const payment = await this.db.getRepository(Payment).save({
      tenantId,
      externalId: paymentData.externalId,
      status: 'CREATED',
      amount: paymentData.amount,
      currencyCode: 'RUB',
      payeeName: paymentData.payeeName,
      payeeAccount: paymentData.payeeAccount,
      payerAccount: paymentData.payerAccount,
      purpose: paymentData.purpose,
      sberResponse: sberResponse,
    });

    return { payment, sberResponse };
  }

  /**
   * Получение платежного поручения
   */
  async getPayment(tenantId: TenantId, paymentId: string): Promise<Payment> {
    const payment = await this.db.getRepository(Payment).findOne({
      id: paymentId,
      tenantId,
    });

    if (!payment) {
      throw new Error(`Payment ${paymentId} not found for tenant ${tenantId}`);
    }

    return payment;
  }

  /**
   * Получение статуса платежа из Sber API
   */
  async getPaymentState(tenantId: TenantId, externalId: string): Promise<any> {
    const tenantRepo = this.db.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ id: tenantId });
    if (!tenant || !tenant.sberClientId) {
      throw new Error(`Tenant ${tenantId} or clientId not found`);
    }

    const accessToken = await this.tokenService.getValidAccessToken(
      tenantId,
      tenant.sberClientId
    );

    const apiClient = this.apiClientFactory({
      host: tenant.sberApiHost,
      p12Path: tenant.sberP12Path!,
      p12Password: tenant.sberP12Password!,
      caPath: tenant.sberCaPath,
    });

    const h2hClient = new H2hClient(apiClient);
    const state = await h2hClient.getPaymentDocState(accessToken, externalId);

    // Обновление статуса в БД
    const payment = await this.db.getRepository(Payment).findOne({
      tenantId,
      externalId,
    });

    if (payment) {
      await this.db.getRepository(Payment).update(
        { id: payment.id },
        {
          status: state.status || payment.status,
          sberResponse: state,
          updatedAt: new Date(),
        }
      );
    }

    return state;
  }

  /**
   * Получение списка платежей тенанта
   */
  async getPayments(tenantId: TenantId, limit: number = 50, offset: number = 0): Promise<Payment[]> {
    return this.db.getRepository(Payment).find({
      tenantId,
    }, {
      limit,
      offset,
      orderBy: { createdAt: 'DESC' },
    });
  }
}
