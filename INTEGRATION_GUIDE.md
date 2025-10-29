# Руководство по интеграции Sber Business API SDK в ERP систему

## Архитектура SDK

SDK состоит из трех основных модулей:

1. **ApiClient** (`lib/authorization/client.js`) - базовый клиент для авторизации и HTTP-запросов
2. **H2hClient** (`lib/h2h/h2hClient.js`) - прямая интеграция (платежи, выписки, зарплатные ведомости)
3. **InstantPaymentClient** (`lib/instantpayment/instantpaymentClient.js`) - моментальные платежи

## Быстрая интеграция (5 шагов)

### Шаг 1: Установка пакета

```bash
# В директории SDK
npm pack

# В вашей ERP системе
npm install ./sber-business-api-1.0.0.tgz
```

### Шаг 2: Создание сервиса конфигурации

Создайте модуль для управления конфигурацией SDK:

```javascript
// services/sberApiConfig.js
import ApiClient from 'sber-business-api/lib/authorization/client.js';
import H2hClient from 'sber-business-api/lib/h2h/h2hClient.js';
import InstantPaymentClient from 'sber-business-api/lib/instantpayment/instantpaymentClient.js';

/**
 * Сервис для управления конфигурацией Sber API
 */
class SberApiConfigService {
    constructor(config) {
        this.config = {
            host: config.host || process.env.SBER_API_HOST,
            p12Path: config.p12Path || process.env.SBER_P12_PATH,
            p12Password: config.p12Password || process.env.SBER_P12_PASSWORD,
            caPath: config.caPath || process.env.SBER_CA_PATH,
            connectTimeout: config.connectTimeout || 60000,
            readTimeout: config.readTimeout || 60000,
            enableLogs: config.enableLogs || process.env.NODE_ENV === 'development',
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
        };

        this._validateConfig();
        this._initClients();
    }

    _validateConfig() {
        if (!this.config.host) throw new Error('SBER_API_HOST не установлен');
        if (!this.config.p12Path) throw new Error('SBER_P12_PATH не установлен');
        if (!this.config.p12Password) throw new Error('SBER_P12_PASSWORD не установлен');
    }

    _initClients() {
        this.apiClient = new ApiClient(this.config);
        this.h2hClient = new H2hClient(this.apiClient);
        this.instantPaymentClient = new InstantPaymentClient(this.apiClient);
    }

    getApiClient() {
        return this.apiClient;
    }

    getH2hClient() {
        return this.h2hClient;
    }

    getInstantPaymentClient() {
        return this.instantPaymentClient;
    }
}

export default SberApiConfigService;
```

### Шаг 3: Сервис управления токенами

Создайте сервис для управления токенами авторизации:

```javascript
// services/sberTokenService.js
import SberApiConfigService from './sberApiConfig.js';

/**
 * Сервис управления токенами доступа Sber API
 */
class SberTokenService {
    constructor(sberApiConfigService, tokenStorage) {
        this.apiClient = sberApiConfigService.getApiClient();
        this.tokenStorage = tokenStorage; // БД или Redis
    }

    /**
     * Получение токена доступа
     * @param {Object} authorizationData - Данные авторизации
     * @param {string} authorizationData.code - Код авторизации
     * @param {string} authorizationData.clientId - ID клиента
     * @param {string} authorizationData.redirectUri - URI редиректа
     * @param {string} authorizationData.clientSecret - Секрет клиента
     * @returns {Promise<string>} Токен доступа
     */
    async getAccessToken(authorizationData) {
        try {
            const result = await this.apiClient.getAccessToken({
                code: authorizationData.code,
                client_id: authorizationData.clientId,
                redirect_uri: authorizationData.redirectUri,
                client_secret: authorizationData.clientSecret,
                grant_type: 'authorization_code',
            });

            const tokenData = {
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                expiresIn: result.expires_in,
                tokenType: result.token_type,
                idToken: result.id_token,
                expiresAt: new Date(Date.now() + result.expires_in * 1000),
            };

            await this.tokenStorage.saveToken(authorizationData.clientId, tokenData);

            return tokenData.accessToken;
        } catch (error) {
            throw new Error(`Ошибка получения токена: ${error.message}`);
        }
    }

    /**
     * Обновление токена доступа
     * @param {string} clientId - ID клиента
     * @returns {Promise<string>} Новый токен доступа
     */
    async refreshAccessToken(clientId) {
        try {
            const savedToken = await this.tokenStorage.getToken(clientId);
            if (!savedToken?.refreshToken) {
                throw new Error('Refresh token не найден');
            }

            const result = await this.apiClient.getRefreshToken({
                refresh_token: savedToken.refreshToken,
                client_id: clientId,
                grant_type: 'refresh_token',
            });

            const tokenData = {
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                expiresIn: result.expires_in,
                expiresAt: new Date(Date.now() + result.expires_in * 1000),
            };

            await this.tokenStorage.updateToken(clientId, tokenData);

            return tokenData.accessToken;
        } catch (error) {
            throw new Error(`Ошибка обновления токена: ${error.message}`);
        }
    }

    /**
     * Получение валидного токена (получение нового, если истек)
     * @param {string} clientId - ID клиента
     * @returns {Promise<string>} Валидный токен доступа
     */
    async getValidAccessToken(clientId) {
        const savedToken = await this.tokenStorage.getToken(clientId);
        
        if (!savedToken) {
            throw new Error('Токен не найден. Выполните авторизацию.');
        }

        // Проверяем, не истек ли токен (с запасом 5 минут)
        const now = new Date();
        const expiresAt = new Date(savedToken.expiresAt);
        const buffer = 5 * 60 * 1000; // 5 минут

        if (expiresAt.getTime() - now.getTime() < buffer) {
            return await this.refreshAccessToken(clientId);
        }

        return savedToken.accessToken;
    }

    /**
     * Получение информации о пользователе
     * @param {string} accessToken - Токен доступа
     * @returns {Promise<Object>} Информация о пользователе
     */
    async getUserInfo(accessToken) {
        try {
            return await this.apiClient.getUserInfo(accessToken);
        } catch (error) {
            throw new Error(`Ошибка получения информации о пользователе: ${error.message}`);
        }
    }
}

export default SberTokenService;
```

### Шаг 4: Сервисы бизнес-логики

#### Сервис платежей

```javascript
// services/sberPaymentService.js
import SberApiConfigService from './sberApiConfig.js';
import SberTokenService from './sberTokenService.js';

/**
 * Сервис для работы с платежными поручениями
 */
class SberPaymentService {
    constructor(sberApiConfigService, sberTokenService) {
        this.h2hClient = sberApiConfigService.getH2hClient();
        this.tokenService = sberTokenService;
    }

    /**
     * Создание платежного поручения
     * @param {string} clientId - ID клиента
     * @param {Object} paymentData - Данные платежа
     * @returns {Promise<Object>} Результат создания платежа
     */
    async createPayment(clientId, paymentData) {
        try {
            const accessToken = await this.tokenService.getValidAccessToken(clientId);
            
            return await this.h2hClient.createPayment(accessToken, paymentData);
        } catch (error) {
            throw new Error(`Ошибка создания платежа: ${error.message}`);
        }
    }

    /**
     * Получение платежного поручения
     * @param {string} clientId - ID клиента
     * @param {string} paymentId - ID платежа
     * @returns {Promise<Object>} Данные платежа
     */
    async getPayment(clientId, paymentId) {
        try {
            const accessToken = await this.tokenService.getValidAccessToken(clientId);
            
            return await this.h2hClient.getPayment(accessToken, paymentId);
        } catch (error) {
            throw new Error(`Ошибка получения платежа: ${error.message}`);
        }
    }

    /**
     * Получение статуса платежного поручения
     * @param {string} clientId - ID клиента
     * @param {string} externalId - Внешний ID платежа
     * @returns {Promise<Object>} Статус платежа
     */
    async getPaymentState(clientId, externalId) {
        try {
            const accessToken = await this.tokenService.getValidAccessToken(clientId);
            
            return await this.h2hClient.getPaymentDocState(accessToken, externalId);
        } catch (error) {
            throw new Error(`Ошибка получения статуса платежа: ${error.message}`);
        }
    }
}

export default SberPaymentService;
```

#### Сервис выписок

```javascript
// services/sberStatementService.js
import SberApiConfigService from './sberApiConfig.js';
import SberTokenService from './sberTokenService.js';

/**
 * Сервис для работы с выписками
 */
class SberStatementService {
    constructor(sberApiConfigService, sberTokenService) {
        this.h2hClient = sberApiConfigService.getH2hClient();
        this.tokenService = sberTokenService;
    }

    /**
     * Получение сводной информации по выписке
     * @param {string} clientId - ID клиента
     * @param {string} account - Номер счета
     * @param {string} date - Дата в формате YYYY-MM-DD
     * @returns {Promise<Object>} Сводная информация
     */
    async getStatementSummary(clientId, account, date) {
        try {
            const accessToken = await this.tokenService.getValidAccessToken(clientId);
            
            return await this.h2hClient.getStatementSummary(accessToken, account, date);
        } catch (error) {
            throw new Error(`Ошибка получения сводной информации: ${error.message}`);
        }
    }

    /**
     * Получение выписки по счету
     * @param {string} clientId - ID клиента
     * @param {string} account - Номер счета
     * @param {string} date - Дата в формате YYYY-MM-DD
     * @param {number} page - Номер страницы
     * @param {string} operationType - Тип операции
     * @returns {Promise<Object>} Выписка
     */
    async getStatementTransactions(clientId, account, date, page = 1, operationType = 'curTransfer') {
        try {
            const accessToken = await this.tokenService.getValidAccessToken(clientId);
            
            return await this.h2hClient.getStatementTransactions(
                accessToken,
                account,
                date,
                page,
                operationType
            );
        } catch (error) {
            throw new Error(`Ошибка получения выписки: ${error.message}`);
        }
    }
}

export default SberStatementService;
```

### Шаг 5: Интеграция в ERP (пример)

```javascript
// controllers/paymentController.js
import SberApiConfigService from '../services/sberApiConfig.js';
import SberTokenService from '../services/sberTokenService.js';
import SberPaymentService from '../services/sberPaymentService.js';
import TokenStorage from '../services/tokenStorage.js'; // Ваша реализация хранилища

// Инициализация (один раз при старте приложения)
const sberConfig = new SberApiConfigService({
    host: process.env.SBER_API_HOST,
    p12Path: process.env.SBER_P12_PATH,
    p12Password: process.env.SBER_P12_PASSWORD,
    caPath: process.env.SBER_CA_PATH,
});

const tokenStorage = new TokenStorage(); // Ваша реализация
const tokenService = new SberTokenService(sberConfig, tokenStorage);
const paymentService = new SberPaymentService(sberConfig, tokenService);

/**
 * Контроллер для создания платежа из ERP
 */
export async function createPaymentFromErp(req, res) {
    try {
        const { clientId, paymentData } = req.body;

        // Создание платежа через Sber API
        const result = await paymentService.createPayment(clientId, paymentData);

        // Сохранение в вашу БД
        // await db.payments.save({ ...paymentData, sberExternalId: result.externalId });

        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
```

## Структура хранения токенов

Создайте таблицу в БД или используйте Redis:

```sql
CREATE TABLE sber_api_tokens (
    client_id VARCHAR(255) PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Пример реализации TokenStorage:

```javascript
// services/tokenStorage.js
class TokenStorage {
    async saveToken(clientId, tokenData) {
        // Реализация сохранения в БД/Redis
    }

    async getToken(clientId) {
        // Реализация получения из БД/Redis
    }

    async updateToken(clientId, tokenData) {
        // Реализация обновления в БД/Redis
    }
}
```

## Переменные окружения

Добавьте в `.env`:

```bash
SBER_API_HOST=https://iftfintech.testsbi.sberbank.ru:9443
SBER_P12_PATH=/path/to/certificate.p12
SBER_P12_PASSWORD=your_password
SBER_CA_PATH=/path/to/ca.pem
SBER_CLIENT_ID=your_client_id
SBER_CLIENT_SECRET=your_client_secret
SBER_REDIRECT_URI=http://your-app.ru/callback
```

## Обработка ошибок

SDK автоматически выполняет retry при сетевых ошибках. Для бизнес-ошибок создайте централизованный обработчик:

```javascript
// utils/sberErrorHandler.js
export function handleSberApiError(error) {
    if (error.response?.status === 401) {
        // Токен истек или невалиден
        return { code: 'TOKEN_EXPIRED', message: 'Требуется повторная авторизация' };
    }
    
    if (error.response?.status >= 500) {
        // Ошибка сервера Sber
        return { code: 'SERVER_ERROR', message: 'Ошибка сервера Sber API' };
    }

    return { code: 'UNKNOWN_ERROR', message: error.message };
}
```

## Тестирование

Создайте тестовый скрипт для проверки интеграции:

```javascript
// tests/sberIntegrationTest.js
import SberApiConfigService from '../services/sberApiConfig.js';
import SberTokenService from '../services/sberTokenService.js';

async function testIntegration() {
    const config = new SberApiConfigService({ /* ... */ });
    const tokenService = new SberTokenService(config, tokenStorage);
    
    // Тест получения токена
    const token = await tokenService.getAccessToken({
        code: 'test_code',
        clientId: 'test_client_id',
        // ...
    });
    
    console.log('Интеграция успешна!');
}
```

## Рекомендации

1. **Кэширование**: Кэшируйте справочники (BIC, статусы) в вашей БД
2. **Логирование**: Настройте логирование всех запросов к Sber API
3. **Мониторинг**: Отслеживайте количество ошибок и время ответа
4. **Безопасность**: Храните сертификаты и секреты в безопасном хранилище (HashiCorp Vault, AWS Secrets Manager)
5. **Асинхронная обработка**: Используйте очереди (RabbitMQ, Redis Queue) для обработки платежей

## Следующие шаги

1. Реализуйте хранилище токенов (TokenStorage)
2. Настройте переменные окружения
3. Интегрируйте сервисы в ваши контроллеры
4. Добавьте обработку ошибок
5. Настройте мониторинг и логирование
