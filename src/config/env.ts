/**
 * Конфигурация окружения
 */
export interface EnvConfig {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
  sberApi: {
    defaultHost: string;
    defaultP12Path: string;
    defaultCaPath?: string;
  };
}

/**
 * Загрузка конфигурации из переменных окружения
 */
export function loadConfig(): EnvConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'sber_erp',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true',
    },
    sberApi: {
      defaultHost: process.env.SBER_API_HOST || 'https://iftfintech.testsbi.sberbank.ru:9443',
      defaultP12Path: process.env.SBER_P12_PATH || '',
      defaultCaPath: process.env.SBER_CA_PATH,
    },
  };
}
