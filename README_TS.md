# Sber Business API ERP Integration (TypeScript)

Интеграция Sber Business API в ERP систему с поддержкой мультитенантности на TypeScript.

## Технологический стек

- **TypeScript** - типизированный JavaScript
- **Fastify** - быстрый веб-фреймворк
- **Grizzly ORM** - ORM для работы с PostgreSQL
- **TypeBox** - валидация схем через TypeScript типы
- **PostgreSQL** - мультитенантная база данных

## Особенности

- ✅ Мультитенантная архитектура
- ✅ Полная типизация TypeScript
- ✅ Валидация через TypeBox
- ✅ Автоматическое управление токенами
- ✅ Автоматическое обновление истекших токенов
- ✅ Enterprise подход с масштабированием

## Установка

```bash
npm install
```

## Настройка

1. Скопируйте `.env.example` в `.env` и настройте переменные окружения
2. Настройте подключение к PostgreSQL
3. Запустите миграцию БД:

```bash
npm run migrate
```

## Запуск

### Разработка

```bash
npm run dev
```

### Продакшн

```bash
npm run build
npm start
```

## Использование

### Создание тенанта

Создайте тенанта в БД (через SQL или админ-панель):

```sql
INSERT INTO tenants (id, name, sber_client_id, sber_client_secret, sber_p12_path, sber_p12_password, sber_api_host, is_active)
VALUES ('tenant-1', 'Company 1', 'client_id', 'client_secret', '/path/to/cert.p12', 'password', 'https://api.sberbank.ru', true);
```

### Получение токена

```bash
curl -X POST http://localhost:3000/tokens \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-1" \
  -d '{
    "authorizationData": {
      "code": "authorization_code",
      "client_id": "client_id",
      "redirect_uri": "http://your-app.ru/callback",
      "client_secret": "client_secret"
    }
  }'
```

### Создание платежа

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: tenant-1" \
  -d '{
    "paymentData": {
      "date": "2025-01-15",
      "amount": 1000.50,
      "externalId": "unique-uuid",
      "payeeAccount": "40702810538710000788",
      "payerAccount": "40702810438178296467",
      ...
    }
  }'
```

## Структура проекта

```
src/
├── config/          # Конфигурация
├── database/        # Подключение к БД и миграции
├── models/          # Grizzly ORM модели
├── schemas/         # TypeBox схемы валидации
├── services/        # Бизнес-логика
│   └── sdk/        # SDK клиенты для Sber API
├── controllers/     # Контроллеры Fastify
├── routes/          # Роуты Fastify
├── middleware/      # Middleware (tenant, auth)
├── types/           # TypeScript типы
└── index.ts         # Точка входа
```

## Мультитенантность

Система поддерживает мультитенантность через:
- Извлечение `tenantId` из заголовка `X-Tenant-Id` или поддомена
- Изоляция данных по `tenantId` в каждой таблице
- Отдельная конфигурация Sber API для каждого тенанта

## API Endpoints

### Токены
- `POST /tokens` - Получение токена доступа
- `POST /tokens/refresh` - Обновление токена

### Платежи
- `POST /payments` - Создание платежа
- `GET /payments/:paymentId` - Получение платежа
- `GET /payments/external/:externalId/state` - Статус платежа
- `GET /payments` - Список платежей

## Зависимости

Проверьте актуальные версии перед использованием:
- `fastify@^4.24.3`
- `grizzly-orm@^1.2.0`
- `@sinclair/typebox@^0.32.0`
