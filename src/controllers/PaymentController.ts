import type { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/PaymentService.js';
import { PaymentRequestSchema } from '../schemas/payment.js';
import { Value } from '@sinclair/typebox/value';
import type { Static } from '@sinclair/typebox';

interface CreatePaymentBody {
  paymentData: Static<typeof PaymentRequestSchema>;
}

interface GetPaymentParams {
  paymentId: string;
}

interface GetPaymentStateParams {
  externalId: string;
}

/**
 * Контроллер для работы с платежами
 */
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Создание платежного поручения
   */
  async createPayment(
    request: FastifyRequest<{ Body: CreatePaymentBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { tenant } = request;
      const { paymentData } = request.body;

      const result = await this.paymentService.createPayment(tenant.tenantId, paymentData);

      reply.code(201).send({
        success: true,
        data: {
          payment: result.payment,
          sberResponse: result.sberResponse,
        },
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получение платежного поручения
   */
  async getPayment(
    request: FastifyRequest<{ Params: GetPaymentParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { tenant } = request;
      const { paymentId } = request.params;

      const payment = await this.paymentService.getPayment(tenant.tenantId, paymentId);

      reply.send({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      reply.code(404).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получение статуса платежа
   */
  async getPaymentState(
    request: FastifyRequest<{ Params: GetPaymentStateParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { tenant } = request;
      const { externalId } = request.params;

      const state = await this.paymentService.getPaymentState(tenant.tenantId, externalId);

      reply.send({
        success: true,
        data: state,
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Получение списка платежей
   */
  async getPayments(
    request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { tenant } = request;
      const { limit = 50, offset = 0 } = request.query;

      const payments = await this.paymentService.getPayments(
        tenant.tenantId,
        limit,
        offset
      );

      reply.send({
        success: true,
        data: payments,
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
