import type { Grizzly } from 'grizzly-orm';
import { SberToken } from '../models/SberToken.js';
import { Tenant } from '../models/Tenant.js';
import { ApiClient } from './sdk/ApiClient.js';
import type { AccessTokenData, TenantId } from '../types/index.js';
import { TokenResponseSchema } from '../schemas/authorization.js';
import { Value } from '@sinclair/typebox/value';

/**
 * Сервис управления токенами с мультитенантностью
 */
export class TokenService {
  constructor(
    private readonly db: Grizzly,
    private readonly apiClientFactory: (config: any) => ApiClient
  ) {}

  /**
   * Получение токена доступа для тенанта
   */
  async getAccessToken(
    tenantId: TenantId,
    authorizationData: {
      code: string;
      clientId: string;
      redirectUri: string;
      clientSecret: string;
    }
  ): Promise<AccessTokenData> {
    const tenantRepo = this.db.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ id: tenantId });
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const apiClient = this.apiClientFactory({
      host: tenant.sberApiHost,
      p12Path: tenant.sberP12Path!,
      p12Password: tenant.sberP12Password!,
      caPath: tenant.sberCaPath,
    });

    const result = await apiClient.getAccessToken({
      code: authorizationData.code,
      client_id: authorizationData.clientId,
      redirect_uri: authorizationData.redirectUri,
      client_secret: authorizationData.clientSecret,
    });

    // Валидация через TypeBox
    if (!Value.Check(TokenResponseSchema, result)) {
      throw new Error('Invalid token response format');
    }

    const tokenData: AccessTokenData = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expires_in,
      tokenType: result.token_type,
      idToken: result.id_token,
      expiresAt: new Date(Date.now() + result.expires_in * 1000),
    };

    // Сохранение в БД
    await this.saveToken(tenantId, authorizationData.clientId, tokenData);

    return tokenData;
  }

  /**
   * Обновление токена доступа
   */
  async refreshAccessToken(tenantId: TenantId, clientId: string): Promise<AccessTokenData> {
    const savedToken = await this.db.getRepository(SberToken).findOne({
      tenantId,
      clientId,
    });

    if (!savedToken?.refreshToken) {
      throw new Error('Refresh token not found');
    }

    const tenantRepo = this.db.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ id: tenantId });
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const apiClient = this.apiClientFactory({
      host: tenant.sberApiHost,
      p12Path: tenant.sberP12Path!,
      p12Password: tenant.sberP12Password!,
      caPath: tenant.sberCaPath,
    });

    const result = await apiClient.getRefreshToken({
      refresh_token: savedToken.refreshToken,
      client_id: clientId,
      redirect_uri: tenant.sberRedirectUri || '',
      client_secret: tenant.sberClientSecret || '',
    });

    if (!Value.Check(TokenResponseSchema, result)) {
      throw new Error('Invalid token response format');
    }

    const tokenData: AccessTokenData = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expires_in,
      tokenType: result.token_type,
      idToken: result.id_token,
      expiresAt: new Date(Date.now() + result.expires_in * 1000),
    };

    await this.updateToken(tenantId, clientId, tokenData);

    return tokenData;
  }

  /**
   * Получение валидного токена (с автообновлением при необходимости)
   */
  async getValidAccessToken(tenantId: TenantId, clientId: string): Promise<string> {
    const savedToken = await this.db.getRepository(SberToken).findOne({
      tenantId,
      clientId,
    });

    if (!savedToken) {
      throw new Error('Token not found. Please perform authorization.');
    }

    // Проверяем, не истек ли токен (с запасом 5 минут)
    const now = new Date();
    const expiresAt = new Date(savedToken.expiresAt);
    const buffer = 5 * 60 * 1000; // 5 минут

    if (expiresAt.getTime() - now.getTime() < buffer) {
      await this.refreshAccessToken(tenantId, clientId);
      const refreshed = await this.db.getRepository(SberToken).findOne({
        tenantId,
        clientId,
      });
      return refreshed!.accessToken;
    }

    return savedToken.accessToken;
  }

  /**
   * Сохранение токена в БД
   */
  private async saveToken(
    tenantId: TenantId,
    clientId: string,
    tokenData: AccessTokenData
  ): Promise<void> {
    const tokenRepo = this.db.getRepository(SberToken);
    
    const existing = await tokenRepo.findOne({ tenantId, clientId });
    
    if (existing) {
      await tokenRepo.update(
        { id: existing.id },
        {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresIn: tokenData.expiresIn,
          tokenType: tokenData.tokenType,
          idToken: tokenData.idToken,
          expiresAt: tokenData.expiresAt,
          updatedAt: new Date(),
        }
      );
    } else {
      await tokenRepo.save({
        tenantId,
        clientId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresIn: tokenData.expiresIn,
        tokenType: tokenData.tokenType,
        idToken: tokenData.idToken,
        expiresAt: tokenData.expiresAt,
      });
    }
  }

  /**
   * Обновление токена в БД
   */
  private async updateToken(
    tenantId: TenantId,
    clientId: string,
    tokenData: AccessTokenData
  ): Promise<void> {
    await this.saveToken(tenantId, clientId, tokenData);
  }
}
