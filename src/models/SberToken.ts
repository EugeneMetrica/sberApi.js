import { Entity, PrimaryKey, Property, ManyToOne } from 'grizzly-orm';
import type { TenantId } from '../types/index.js';
import { Tenant } from './Tenant.js';

/**
 * Модель токена Sber API с мультитенантностью
 */
@Entity('sber_tokens')
export class SberToken {
  @PrimaryKey()
  id!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant!: Tenant;

  @Property({ type: 'varchar', length: 255 })
  tenantId!: TenantId;

  @Property({ type: 'varchar', length: 255 })
  clientId!: string;

  @Property({ type: 'text' })
  accessToken!: string;

  @Property({ type: 'text' })
  refreshToken!: string;

  @Property({ type: 'integer' })
  expiresIn!: number;

  @Property({ type: 'varchar', length: 50, default: 'Bearer' })
  tokenType!: string;

  @Property({ type: 'text', nullable: true })
  idToken?: string;

  @Property({ type: 'timestamp' })
  expiresAt!: Date;

  @Property({ type: 'timestamp', default: 'now()' })
  createdAt!: Date;

  @Property({ type: 'timestamp', default: 'now()' })
  updatedAt!: Date;
}
