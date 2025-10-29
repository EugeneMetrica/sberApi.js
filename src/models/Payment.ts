import { Entity, PrimaryKey, Property, ManyToOne } from 'grizzly-orm';
import { Tenant } from './Tenant.js';
import type { TenantId } from '../types/index.js';

/**
 * Модель платежного поручения
 */
@Entity('payments')
export class Payment {
  @PrimaryKey()
  id!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant!: Tenant;

  @Property({ type: 'varchar', length: 255 })
  tenantId!: TenantId;

  @Property({ type: 'varchar', length: 255, unique: true })
  externalId!: string;

  @Property({ type: 'varchar', length: 50 })
  status!: string;

  @Property({ type: 'decimal', precision: 18, scale: 2 })
  amount!: number;

  @Property({ type: 'varchar', length: 3, default: 'RUB' })
  currencyCode!: string;

  @Property({ type: 'varchar', length: 500, nullable: true })
  payeeName?: string;

  @Property({ type: 'varchar', length: 100, nullable: true })
  payeeAccount?: string;

  @Property({ type: 'varchar', length: 100, nullable: true })
  payerAccount?: string;

  @Property({ type: 'text', nullable: true })
  purpose?: string;

  @Property({ type: 'jsonb', nullable: true })
  sberResponse?: Record<string, unknown>;

  @Property({ type: 'timestamp', default: 'now()' })
  createdAt!: Date;

  @Property({ type: 'timestamp', default: 'now()' })
  updatedAt!: Date;
}
