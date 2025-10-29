import type { FastifyInstance } from 'fastify';
import { PaymentController } from '../controllers/PaymentController.js';
import { PaymentRequestSchema } from '../schemas/payment.js';
import { Value } from '@sinclair/typebox/value';

/**
 * Регистрация роутов для платежей
 */
export async function registerPaymentRoutes(
  fastify: FastifyInstance,
  paymentController: PaymentController
): Promise<void> {
  // Создание платежа
  fastify.post('/payments', {
    schema: {
      body: {
        type: 'object',
        properties: {
          paymentData: { type: 'object' },
        },
        required: ['paymentData'],
      },
    },
    preValidation: async (request, reply) => {
      const { paymentData } = request.body as any;
      if (!Value.Check(PaymentRequestSchema, paymentData)) {
        reply.code(400).send({
          success: false,
          error: 'Invalid payment data format',
          details: [...Value.Errors(PaymentRequestSchema, paymentData)],
        });
      }
    },
  }, async (request, reply) => {
    await paymentController.createPayment(request, reply);
  });

  // Получение платежа
  fastify.get('/payments/:paymentId', async (request, reply) => {
    await paymentController.getPayment(request, reply);
  });

  // Получение статуса платежа
  fastify.get('/payments/external/:externalId/state', async (request, reply) => {
    await paymentController.getPaymentState(request, reply);
  });

  // Список платежей
  fastify.get('/payments', async (request, reply) => {
    await paymentController.getPayments(request, reply);
  });
}
