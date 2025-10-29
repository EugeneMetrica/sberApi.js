import { Grizzly } from 'grizzly-orm';
import type { PoolConfig } from 'pg';
import { loadConfig } from '../config/env.js';

/**
 * Создание подключения к базе данных через Grizzly ORM
 */
export function createDatabaseConnection(): Grizzly {
  const config = loadConfig();
  const { database } = config;

  const poolConfig: PoolConfig = {
    host: database.host,
    port: database.port,
    database: database.database,
    user: database.username,
    password: database.password,
    ssl: database.ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  return new Grizzly(poolConfig);
}
