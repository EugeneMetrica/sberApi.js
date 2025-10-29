import type { FastifyInstance } from 'fastify';
import { TokenController } from '../controllers/TokenController.js';
import { AuthorizationRequestSchema } from '../schemas/authorization.js';
import { Value } from '@sinclair/typebox/value';

/**
 * Регистрация роутов для токенов
 */
export async function registerTokenRoutes(
  fastify: FastifyInstance,
  tokenController: TokenController
): Promise<void> {
  // Получение токена
  fastify.post('/tokens', {
    schema: {
      body: {
        type: 'object',
        properties: {
          authorizationData: { type: 'object' },
        },
        required: ['authorizationData'],
      },
    },
    preValidation: async (request, reply) => {
      const { authorizationData } = request.body as any;
      if (!Value.Check(AuthorizationRequestSchema, authorizationData)) {
        reply.code(400).send({
          success: false,
          error: 'Invalid authorization data format',
          details: [...Value.Errors(AuthorizationRequestSchema, authorizationData)],
        });
      }
    },
  }, async (request, reply) => {
    await tokenController.getAccessToken(request, reply);
  });

  // Обновление токена
  fastify.post('/tokens/refresh', {
    schema: {
      body: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
        },
        required: ['clientId'],
      },
    },
  }, async (request, reply) => {
    await tokenController.refreshToken(request, reply);
  });
}
