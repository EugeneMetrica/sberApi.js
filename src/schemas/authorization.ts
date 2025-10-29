import { Type, Static } from '@sinclair/typebox';

/**
 * Схема запроса авторизации
 */
export const AuthorizationRequestSchema = Type.Object({
  grant_type: Type.Literal('authorization_code'),
  code: Type.RegEx(/^[a-zA-Z0-9]{38}$/),
  client_id: Type.String({ minLength: 1 }),
  redirect_uri: Type.String({ format: 'uri' }),
  client_secret: Type.String({ minLength: 1 }),
  code_verifier: Type.Optional(Type.String()),
});

export type AuthorizationRequest = Static<typeof AuthorizationRequestSchema>;

/**
 * Схема запроса обновления токена
 */
export const RefreshTokenRequestSchema = Type.Object({
  grant_type: Type.Literal('refresh_token'),
  client_id: Type.String({ minLength: 1 }),
  redirect_uri: Type.String({ format: 'uri' }),
  client_secret: Type.String({ minLength: 1 }),
  refresh_token: Type.String({ minLength: 1 }),
  code_verifier: Type.Optional(Type.String()),
});

export type RefreshTokenRequest = Static<typeof RefreshTokenRequestSchema>;

/**
 * Схема ответа с токеном
 */
export const TokenResponseSchema = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  expires_in: Type.Number(),
  token_type: Type.String(),
  id_token: Type.Optional(Type.String()),
});

export type TokenResponse = Static<typeof TokenResponseSchema>;
