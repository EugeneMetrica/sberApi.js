/**
 * Типы для мультитенантности
 */
export type TenantId = string;

/**
 * Интерфейс контекста запроса с информацией о тенанте
 */
export interface TenantContext {
  tenantId: TenantId;
  clientId?: string;
}

/**
 * Конфигурация Sber API
 */
export interface SberApiConfig {
  host: string;
  p12Path: string;
  p12Password: string;
  caPath?: string;
  connectTimeout?: number;
  readTimeout?: number;
  enableLogs?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Данные авторизации
 */
export interface AuthorizationData {
  code: string;
  clientId: string;
  redirectUri: string;
  clientSecret: string;
  codeVerifier?: string;
}

/**
 * Токен доступа
 */
export interface AccessTokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  idToken?: string;
  expiresAt: Date;
}

/**
 * Тип криптопрофиля
 */
export enum CryptoprofileType {
  SMS = 'SMS',
  TOKEN = 'TOKEN',
}

/**
 * Базовый ответ API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
