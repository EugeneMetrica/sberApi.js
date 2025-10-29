import AdmZip from 'adm-zip';
import type { ApiClient } from './ApiClient.js';

/**
 * Клиент для прямой интеграции H2H
 */
export class H2hClient {
  constructor(private readonly apiClient: ApiClient) {
    if (!apiClient) {
      throw new TypeError('Expected an instance of ApiClient');
    }
  }

  async getDictionary(accessToken: string, name: string): Promise<{ name: string; content: string }> {
    const response = await this.apiClient.sendRequest<{ archive: string; name: string }>(
      '/fintech/api/v1/dicts',
      { name },
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );

    if (!response || !response.archive) {
      throw new Error(`Некорректный ответ от сервера: ${JSON.stringify(response)}`);
    }

    const unzippedContent = this._decodeAndUnzip(response.archive);

    return {
      name: response.name,
      content: unzippedContent,
    };
  }

  async getClientInfo(accessToken: string): Promise<any> {
    return this.apiClient.sendRequest(
      '/fintech/api/v1/client-info',
      null,
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );
  }

  async getCrypto(accessToken: string): Promise<any> {
    return this.apiClient.sendRequest(
      '/fintech/api/v1/crypto',
      null,
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );
  }

  async createPayment(accessToken: string, paymentReq: any): Promise<any> {
    return this.apiClient.sendRequest(
      '/fintech/api/v1/payments',
      paymentReq,
      { Authorization: `Bearer ${accessToken}` },
      'POST'
    );
  }

  async getPayment(accessToken: string, externalId: string): Promise<any> {
    return this.apiClient.sendRequest(
      `/fintech/api/v1/payments/${externalId}`,
      null,
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );
  }

  async getPaymentDocState(accessToken: string, externalId: string): Promise<any> {
    return this.apiClient.sendRequest(
      `/fintech/api/v1/payments/${externalId}/state`,
      null,
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );
  }

  async getStatementSummary(accessToken: string, accountNumber: string, statementDate: string): Promise<any> {
    return this.apiClient.sendRequest(
      '/fintech/api/v2/statement/summary',
      { accountNumber, statementDate },
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );
  }

  async getStatementTransactions(
    accessToken: string,
    accountNumber: string,
    statementDate: string,
    page: number = 1,
    curFormat: string = 'curTransfer'
  ): Promise<any> {
    return this.apiClient.sendRequest(
      '/fintech/api/v2/statement/transactions',
      { accountNumber, statementDate, page, curFormat },
      { Authorization: `Bearer ${accessToken}` },
      'GET'
    );
  }

  async createPayroll(accessToken: string, payrollReq: any): Promise<any> {
    return this.apiClient.sendRequest(
      '/fintech/api/v1/payrolls',
      payrollReq,
      { Authorization: `Bearer ${accessToken}` },
      'POST'
    );
  }

  private _decodeAndUnzip(base64EncodedZip: string): string {
    try {
      const decodedBuffer = Buffer.from(base64EncodedZip, 'base64');
      const zip = new AdmZip(decodedBuffer);
      const entries = zip.getEntries();

      let content = '';

      for (const entry of entries) {
        if (!entry.isDirectory) {
          const fileData = entry.getData().toString('utf8');
          content += fileData;
        }
      }

      return content;
    } catch (error: any) {
      throw new Error(`Произошла ошибка при декодировании архива: ${error.message}`);
    }
  }
}
