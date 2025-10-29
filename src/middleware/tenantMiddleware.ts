import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TenantContext } from '../types/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: TenantContext;
  }
}

/**
 * Middleware для извлечения информации о тенанте из заголовков
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Извлекаем tenantId из заголовка X-Tenant-Id или из поддомена
  const tenantId = request.headers['x-tenant-id'] as string || 
                   extractTenantFromHost(request.hostname);

  if (!tenantId) {
    reply.code(400).send({ 
      success: false, 
      error: 'Tenant ID is required. Provide X-Tenant-Id header or use tenant subdomain.' 
    });
    return;
  }

  request.tenant = {
    tenantId,
    clientId: request.headers['x-client-id'] as string | undefined,
  };
}

/**
 * Извлечение tenantId из поддомена (например, tenant1.erp.example.com)
 */
function extractTenantFromHost(hostname: string): string | null {
  const parts = hostname.split('.');
  // Предполагаем, что первый поддомен - это tenantId
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}
