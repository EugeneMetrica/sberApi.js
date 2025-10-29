import { createDatabaseConnection } from './connection.js';
import { Tenant } from '../models/Tenant.js';
import { SberToken } from '../models/SberToken.js';
import { Payment } from '../models/Payment.js';

/**
 * Миграция базы данных
 * Создает таблицы для всех моделей
 */
async function migrate(): Promise<void> {
  const db = createDatabaseConnection();

  try {
    console.log('Creating tables...');
    
    await db.createTable(Tenant);
    await db.createTable(SberToken);
    await db.createTable(Payment);

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.close();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
