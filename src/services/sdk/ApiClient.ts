import fs from 'fs';
import https from 'https';
import forge from 'node-forge';
import axios, { AxiosInstance, AxiosError } from 'axios';
import querystring from 'querystring';
import crypto from 'crypto';
import type { SberApiConfig } from '../../types/index.js';

const DEFAULT_TIMEOUT = 60 * 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const ALLOWED_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

interface HttpClientConfig {
  connectTimeout: number;
  readTimeout: number;
  p12Path: string;
  p12Password: string;
  caPath?: string;
  enableLogs: boolean;
  maxRetries: number;
  retryDelay: number;
}

interface RequestHeaders {
  [key: string]: string;
}

/**
 * Базовый клиент для работы с Sber API
 */
export class ApiClient {
  private readonly host: string;
  private readonly config: HttpClientConfig;
  private readonly httpClient: AxiosInstance;

  constructor(config: SberApiConfig) {
    this._validateConfig(config);
    this.host = config.host;
    
    this.config = {
      connectTimeout: config.connectTimeout ?? DEFAULT_TIMEOUT,
      readTimeout: config.readTimeout ?? DEFAULT_TIMEOUT,
      p12Path: config.p12Path,
      p12Password: config.p12Password,
      caPath: config.caPath,
      enableLogs: config.enableLogs ?? false,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
    };

    this.httpClient = this.createHttpClient();
  }

  private _validateConfig(config: SberApiConfig): void {
    if (!config.host) throw new Error('Host is required');
    if (!config.p12Path) throw new Error('Path to p12 certificate is required');
  }

  private createHttpClient(): AxiosInstance {
    const sslOptions = this._createSslOptions();
    const client = axios.create({
      baseURL: this.host,
      httpsAgent: new https.Agent(sslOptions),
      timeout: this.config.connectTimeout,
    });

    if (this.config.enableLogs) {
      client.interceptors.request.use(
        (config) => {
          this._logRequest(config);
          return config;
        },
        (error) => Promise.reject(error)
      );

      client.interceptors.response.use(
        (response) => {
          this._logResponse(response);
          return response;
        },
        (error) => Promise.reject(error)
      );
    }

    return client;
  }

  private _logRequest(config: any): void {
    const maskedHeaders = this._maskHeaders(config.headers || {});
    console.log(`Outgoing Request: ${config.method?.toUpperCase()} ${config.url}`);
    console.log('Headers:', maskedHeaders);
    if (config.data) {
      console.log('Request Body:', config.data);
    }
  }

  private _logResponse(response: any): void {
    console.log(`Response: ${response.status}`);
    const maskedHeaders = this._maskHeaders(response.headers || {});
    console.log('Headers:', maskedHeaders);
    if (response.data) {
      console.log('Response Body:', response.data);
    }
  }

  private _maskHeaders(headers: RequestHeaders): RequestHeaders {
    const masked = { ...headers };
    if (masked.authorization) masked.authorization = '[REDACTED]';
    if (masked.Authorization) masked.Authorization = '[REDACTED]';
    return masked;
  }

  private _createSslOptions(): https.AgentOptions {
    const p12 = this._loadP12Certificate();
    const trustStore = this._loadTrustStore();

    return {
      key: this._getPrivateKey(p12),
      cert: this._getCertificate(p12),
      ca: trustStore,
      passphrase: this.config.p12Password,
      rejectUnauthorized: true,
    };
  }

  private _loadP12Certificate(): forge.pkcs12.Pkcs12Pfx {
    const p12Buffer = fs.readFileSync(this.config.p12Path);
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'), false);
    return forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.config.p12Password);
  }

  private _loadTrustStore(): string[] {
    const certs: string[] = [];
    if (this.config.caPath) {
      const caData = fs.readFileSync(this.config.caPath, 'utf8');
      const caCerts = this._parsePemCertificates(caData);
      certs.push(...caCerts.map((cert) => forge.pki.certificateToPem(cert)));
    }
    return certs;
  }

  private _parsePemCertificates(pemData: string): forge.pki.Certificate[] {
    const regex = /-----BEGIN CERTIFICATE-----[^-----]+-----END CERTIFICATE-----/g;
    const matches = pemData.match(regex) || [];
    return matches.map((match) => forge.pki.certificateFromPem(match));
  }

  private _getPrivateKey(p12: forge.pkcs12.Pkcs12Pfx): string {
    const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const bag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
    if (!bag) throw new Error('Private key not found in PKCS12');
    return forge.pki.privateKeyToPem(bag.key as forge.pki.rsa.PrivateKey);
  }

  private _getCertificate(p12: forge.pkcs12.Pkcs12Pfx): string {
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const bag = bags[forge.pki.oids.certBag]?.[0];
    if (!bag) throw new Error('Certificate not found in PKCS12');
    return forge.pki.certificateToPem(bag.cert as forge.pki.Certificate);
  }

  private _shouldRetry(error: any, retryCount: number): boolean {
    if (retryCount >= this.config.maxRetries) return false;

    if (!error.response && error.code && [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED',
      'ENOTFOUND',
      'EPIPE',
    ].includes(error.code)) {
      return true;
    }

    if (error.response && error.response.status >= 500) {
      return true;
    }

    if (error.code === 'ECONNABORTED' && !error.response) {
      return true;
    }

    return false;
  }

  private async _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async sendRequest<T = any>(
    endpoint: string,
    data: any,
    headers: RequestHeaders = {},
    method: string = 'POST'
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        const url = this._buildUrl(endpoint, data, method);
        const body = this._serializeBody(data, headers);
        const requestHeaders = this._buildHeaders(headers, body);

        const config = {
          timeout: this.config.readTimeout,
          headers: requestHeaders,
        };

        let response;
        if (method.toUpperCase() === 'GET') {
          response = await this.httpClient.get(url, config);
        } else if (method.toUpperCase() === 'POST') {
          response = await this.httpClient.post(url, body, config);
        } else if (method.toUpperCase() === 'PUT') {
          response = await this.httpClient.put(url, body, config);
        } else {
          throw new Error(`Unsupported HTTP method: ${method}`);
        }

        if (this.config.enableLogs) {
          console.log(`Request succeeded on attempt ${attempt}: ${method} ${endpoint}`);
        }

        return response.data;
      } catch (error: any) {
        lastError = error;

        if (this._shouldRetry(error, attempt - 1)) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          if (this.config.enableLogs) {
            console.warn(`🔁 Retry ${attempt}/${this.config.maxRetries} after ${delay}ms. Error: ${error.message}`);
          }
          await this._delay(delay);
          continue;
        } else {
          break;
        }
      }
    }

    if (lastError.code === 'ECONNABORTED') {
      throw new Error('Request timed out after retries');
    }
    if (lastError.response) {
      throw new Error(
        `Request failed after retries: ${lastError.response.status} - ${JSON.stringify(lastError.response.data)}`
      );
    }
    throw new Error(`Network error after retries: ${lastError.message}`);
  }

  private _buildUrl(endpoint: string, data: any, method: string): string {
    if (method.toUpperCase() !== 'GET') return endpoint;
    const queryString = new URLSearchParams(data).toString();
    return queryString ? `${endpoint}?${queryString}` : endpoint;
  }

  private _serializeBody(data: any, headers: RequestHeaders): string | undefined {
    if (data == null) {
      return undefined;
    }
    
    const contentType = Object.keys(headers)
      .find((key) => key.toLowerCase() === 'content-type');

    if (contentType && headers[contentType] === 'application/json') {
      return JSON.stringify(data);
    }
    if (contentType && headers[contentType] === 'application/x-www-form-urlencoded') {
      return querystring.stringify(data);
    }
    if (typeof data === 'string' || Buffer.isBuffer(data)) {
      return data as string;
    }
    return JSON.stringify(data);
  }

  private _buildHeaders(headers: RequestHeaders, body: string | undefined): RequestHeaders {
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
    const requestHeaders = { ...headers };

    if (!hasContentType) {
      if (typeof body === 'string' && body.startsWith('{')) {
        requestHeaders['Content-Type'] = 'application/json';
      } else {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }

    requestHeaders['User-Agent'] = 'SberApiSDK_NodeJs_TypeScript';

    return requestHeaders;
  }

  async getAccessToken(authorizationReq: any): Promise<any> {
    authorizationReq.grant_type = 'authorization_code';
    return this.sendRequest(
      '/ic/sso/api/oauth/token',
      authorizationReq,
      { 'Content-Type': 'application/x-www-form-urlencoded' }
    );
  }

  async getRefreshToken(refreshTokenReq: any): Promise<any> {
    refreshTokenReq.grant_type = 'refresh_token';
    return this.sendRequest(
      '/ic/sso/api/oauth/token',
      refreshTokenReq,
      { 'Content-Type': 'application/x-www-form-urlencoded' }
    );
  }

  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const encodedResponse = await this.sendRequest(
        '/ic/sso/api/v2/oauth/user-info',
        null,
        { Authorization: `Bearer ${accessToken}` },
        'GET'
      );

      const payload = this._splitJwt(encodedResponse)[1];
      const decodedPayload = this._decodeBase64Url(payload);

      return {
        userInfoBodyResponse: JSON.parse(decodedPayload),
        jwt: encodedResponse,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user info: ${error.message}`);
    }
  }

  private _splitJwt(jwt: string): string[] {
    const blocks = jwt.split('.');
    if (blocks.length !== 3) {
      throw new Error('Invalid format. Expected three parts separated by dots.');
    }
    return blocks;
  }

  private _decodeBase64Url(base64UrlEncodedString: string): string {
    let base64 = base64UrlEncodedString.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padLength);
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
}
