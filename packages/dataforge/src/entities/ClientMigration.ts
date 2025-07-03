import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';
import { IsString, IsArray, IsNumber, IsOptional, Matches } from 'class-validator';
import { ServerOnly, TableCategory } from '../utils/context.js';
import { BaseSystemEntity } from './BaseSystemEntity.js';

/**
 * This entity tracks migrations that need to be applied on the client side.
 * It stores the SQL queries that should be run in the client database and
 * manages schema versioning between server and clients.
 * 
 * The entity itself lives in the server database.
 * Categorized as a system table for internal state management
 */
@Entity('client_migration')
@(ServerOnly() as ClassDecorator)
@(TableCategory('system') as ClassDecorator)
export class ClientMigration extends BaseSystemEntity {
  @Column({ type: 'text', name: 'migration_name' })
  @IsString()
  migrationName!: string;

  @Column({ type: 'text', name: 'schema_version' })
  @Matches(/^\d+$/)
  @Index()
  schemaVersion!: string;  // Sequential integer version

  @Column({ type: 'text', array: true, name: 'up_queries' })
  @IsArray()
  @IsString({ each: true })
  upQueries!: string[];  // SQL commands to apply migration

  @Column({ type: 'text', array: true, name: 'down_queries' })
  @IsArray()
  @IsString({ each: true })
  downQueries!: string[];  // SQL commands to rollback migration

  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;  // Human readable description of changes

  @Column({ type: 'bigint' })
  @IsNumber()
  timestamp!: number;

  // createdAt is inherited from BaseSystemEntity
} 