import Fastify from 'fastify';
import { createDatabaseConnection } from './database/connection.js';
import { tenantMiddleware } from './middleware/tenantMiddleware.js';
import { TokenService } from './services/TokenService.js';
import { PaymentService } from './services/PaymentService.js';
import { TokenController } from './controllers/TokenController.js';
import { PaymentController } from './controllers/PaymentController.js';
import { registerTokenRoutes } from './routes/tokens.js';
import { registerPaymentRoutes } from './routes/payments.js';
import { ApiClient } from './services/sdk/ApiClient.js';
import { loadConfig } from './config/env.js';
import type { SberApiConfig } from './types/index.js';

/**
 * Главный файл приложения
 */
async function main(): Promise<void> {
  const config = loadConfig();
  
  // Инициализация БД
  const db = createDatabaseConnection();

  // Фабрика для создания ApiClient (для мультитенантности)
  const apiClientFactory = (apiConfig: SberApiConfig): ApiClient => {
    return new ApiClient(apiConfig);
  };

  // Инициализация сервисов
  const tokenService = new TokenService(db, apiClientFactory);
  const paymentService = new PaymentService(db, tokenService, apiClientFactory);

  // Инициализация контроллеров
  const tokenController = new TokenController(tokenService);
  const paymentController = new PaymentController(paymentService);

  // Создание Fastify приложения
  const fastify = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    },
  });

  // Регистрация middleware
  await fastify.register(async (fastify) => {
    fastify.addHook('onRequest', tenantMiddleware);
  });

  // Регистрация роутов
  await fastify.register(async () => {
    await registerTokenRoutes(fastify, tokenController);
    await registerPaymentRoutes(fastify, paymentController);
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Запуск сервера
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Server listening on port ${config.port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
