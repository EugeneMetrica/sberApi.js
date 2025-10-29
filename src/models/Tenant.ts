import { Entity, PrimaryKey, Property } from 'grizzly-orm';
import type { TenantId } from '../types/index.js';

/**
 * Модель тенанта (мультитенантность)
 */
@Entity('tenants')
export class Tenant {
  @PrimaryKey()
  id!: TenantId;

  @Property({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @Property({ type: 'varchar', length: 255, nullable: true })
  sberClientId?: string;

  @Property({ type: 'varchar', length: 500, nullable: true })
  sberClientSecret?: string;

  @Property({ type: 'varchar', length: 500, nullable: true })
  sberP12Path?: string;

  @Property({ type: 'varchar', length: 255, nullable: true })
  sberP12Password?: string;

  @Property({ type: 'varchar', length: 500, nullable: true })
  sberCaPath?: string;

  @Property({ type: 'varchar', length: 500, nullable: true })
  sberApiHost?: string;

  @Property({ type: 'varchar', length: 500, nullable: true })
  sberRedirectUri?: string;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'timestamp', default: 'now()' })
  createdAt!: Date;

  @Property({ type: 'timestamp', default: 'now()' })
  updatedAt!: Date;
}
