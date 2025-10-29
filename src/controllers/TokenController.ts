import type { FastifyRequest, FastifyReply } from 'fastify';
import { TokenService } from '../services/TokenService.js';
import { AuthorizationRequestSchema, RefreshTokenRequestSchema } from '../schemas/authorization.js';
import { Value } from '@sinclair/typebox/value';
import type { Static } from '@sinclair/typebox';

interface AuthBody {
  authorizationData: Static<typeof AuthorizationRequestSchema>;
}

interface RefreshBody {
  clientId: string;
}

/**
 * Контроллер для работы с токенами
 */
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  /**
   * Получение токена доступа
   */
  async getAccessToken(
    request: FastifyRequest<{ Body: AuthBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { tenant } = request;
      const { authorizationData } = request.body;

      // Валидация через TypeBox
      if (!Value.Check(AuthorizationRequestSchema, authorizationData)) {
        reply.code(400).send({
          success: false,
          error: 'Invalid authorization data format',
        });
        return;
      }

      const tokenData = await this.tokenService.getAccessToken(
        tenant.tenantId,
        authorizationData
      );

      reply.send({
        success: true,
        data: {
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt,
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
   * Обновление токена доступа
   */
  async refreshToken(
    request: FastifyRequest<{ Body: RefreshBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { tenant } = request;
      const { clientId } = request.body;

      const tokenData = await this.tokenService.refreshAccessToken(
        tenant.tenantId,
        clientId
      );

      reply.send({
        success: true,
        data: {
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt,
        },
      });
    } catch (error: any) {
      reply.code(500).send({
        success: false,
        error: error.message,
      });
    }
  }
}
