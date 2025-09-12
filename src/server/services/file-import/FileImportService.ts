/**
 * File Import Service
 * 
 * Handles file-based data imports (CSV, Excel, JSON) with schema detection,
 * field mapping, and data transformation capabilities.
 */

import type { Kysely } from 'kysely';
import { withKysely } from '../../lib/database-manager';
import { uuidv7 } from 'uuidv7';

export interface FileImportJob {
  id: string;
  org_id: string;
  file_name: string;
  file_type: 'csv' | 'tsv' | 'xlsx' | 'xls' | 'json' | 'xml';
  file_size: number;
  file_path: string;
  file_hash?: string;
  status: 'uploaded' | 'analyzing' | 'mapped' | 'importing' | 'completed' | 'failed' | 'cancelled';
  detected_columns?: DetectedColumn[];
  row_count?: number;
  sample_data?: Record<string, any>[];
  target_entity?: string;
  column_mappings?: Record<string, FieldMapping>;
  transformation_rules?: TransformationRules;
  import_mode: 'create' | 'update' | 'upsert';
  records_processed: number;
  records_imported: number;
  records_updated: number;
  records_failed: number;
  records_skipped: number;
  error_details?: any;
  validation_errors?: any;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
  created_by?: string;
}

export interface DetectedColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'url' | 'phone';
  sample_values: string[];
  nullable: boolean;
  unique_count?: number;
  confidence?: number; // 0-1 confidence in type detection
}

export interface FieldMapping {
  target_field: string;
  transformation?: string;
  validation?: ValidationRule[];
  default_value?: any;
  is_required?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'unique' | 'format' | 'range' | 'custom';
  params?: any;
  message?: string;
}

export interface TransformationRules {
  trim_whitespace?: boolean;
  handle_empty_strings?: 'null' | 'empty' | 'skip';
  date_format?: string;
  number_format?: 'comma_decimal' | 'period_decimal';
  text_case?: 'preserve' | 'lower' | 'upper' | 'title';
}

export interface ImportTemplate {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  file_type: string;
  target_entity: string;
  column_mappings: Record<string, FieldMapping>;
  transformation_rules?: TransformationRules;
  import_mode: 'create' | 'update' | 'upsert';
  is_shared: boolean;
  is_public: boolean;
  usage_count: number;
  last_used_at?: Date;
  created_by: string;
  created_at: Date;
}

export class FileImportService {
  private log = console; // Using console for now

  /**
   * Create a new file import job
   */
  async createImportJob(params: {
    org_id: string;
    file_name: string;
    file_type: FileImportJob['file_type'];
    file_size: number;
    file_path: string;
    file_hash?: string;
    created_by?: string;
  }): Promise<FileImportJob> {
    const job_id = uuidv7();
    
    this.log.log('Creating file import job', {
      job_id,
      org_id: params.org_id,
      file_name: params.file_name,
      file_type: params.file_type,
      file_size: params.file_size
    });

    return await withKysely(async (db) => {
      const job = await db
        .insertInto('file_imports')
        .values({
          id: job_id,
          org_id: params.org_id,
          file_name: params.file_name,
          file_type: params.file_type,
          file_size: params.file_size,
          file_path: params.file_path,
          file_hash: params.file_hash,
          status: 'uploaded',
          import_mode: 'create',
          records_processed: 0,
          records_imported: 0,
          records_updated: 0,
          records_failed: 0,
          records_skipped: 0,
          created_by: params.created_by,
          created_at: new Date()
        })
        .returning([
          'id', 'org_id', 'file_name', 'file_type', 'file_size', 'file_path', 
          'status', 'import_mode', 'records_processed', 'records_imported',
          'records_updated', 'records_failed', 'records_skipped', 'created_at'
        ])
        .executeTakeFirstOrThrow();

      return job as FileImportJob;
    });
  }

  /**
   * Update import job status
   */
  async updateJobStatus(
    job_id: string, 
    status: FileImportJob['status'], 
    updates?: Partial<Pick<FileImportJob, 'error_details' | 'validation_errors' | 'started_at' | 'completed_at'>>
  ): Promise<void> {
    this.log.info('Updating import job status', { job_id, status });

    await this.db
      .updateTable('file_imports')
      .set({
        status,
        ...updates,
        ...(status === 'importing' && !updates?.started_at ? { started_at: new Date() } : {}),
        ...(status === 'completed' || status === 'failed' ? { completed_at: new Date() } : {})
      })
      .where('id', '=', job_id)
      .execute();
  }

  /**
   * Save schema analysis results
   */
  async saveSchemaAnalysis(
    job_id: string,
    analysis: {
      detected_columns: DetectedColumn[];
      row_count: number;
      sample_data: Record<string, any>[];
    }
  ): Promise<void> {
    this.log.info('Saving schema analysis', {
      job_id,
      columns: analysis.detected_columns.length,
      rows: analysis.row_count
    });

    await this.db
      .updateTable('file_imports')
      .set({
        status: 'analyzed',
        detected_columns: JSON.stringify(analysis.detected_columns),
        row_count: analysis.row_count,
        sample_data: JSON.stringify(analysis.sample_data)
      })
      .where('id', '=', job_id)
      .execute();
  }

  /**
   * Save field mappings and transformation rules
   */
  async saveMappingConfiguration(
    job_id: string,
    config: {
      target_entity: string;
      column_mappings: Record<string, FieldMapping>;
      transformation_rules?: TransformationRules;
      import_mode?: 'create' | 'update' | 'upsert';
    }
  ): Promise<void> {
    this.log.info('Saving mapping configuration', {
      job_id,
      target_entity: config.target_entity,
      mappings_count: Object.keys(config.column_mappings).length
    });

    await this.db
      .updateTable('file_imports')
      .set({
        status: 'mapped',
        target_entity: config.target_entity,
        column_mappings: JSON.stringify(config.column_mappings),
        transformation_rules: config.transformation_rules ? JSON.stringify(config.transformation_rules) : null,
        import_mode: config.import_mode || 'create'
      })
      .where('id', '=', job_id)
      .execute();
  }

  /**
   * Update import progress and metrics
   */
  async updateImportProgress(
    job_id: string,
    progress: {
      records_processed: number;
      records_imported: number;
      records_updated: number;
      records_failed: number;
      records_skipped: number;
    }
  ): Promise<void> {
    await this.db
      .updateTable('file_imports')
      .set(progress)
      .where('id', '=', job_id)
      .execute();
  }

  /**
   * Log import error
   */
  async logImportError(
    job_id: string,
    error: {
      row_number?: number;
      column_name?: string;
      error_type: 'validation' | 'transformation' | 'constraint' | 'system';
      error_code?: string;
      error_message: string;
      source_value?: string;
      source_row_data?: Record<string, any>;
    }
  ): Promise<void> {
    await this.db
      .insertInto('import_errors')
      .values({
        id: uuidv7(),
        file_import_id: job_id,
        row_number: error.row_number,
        column_name: error.column_name,
        error_type: error.error_type,
        error_code: error.error_code,
        error_message: error.error_message,
        source_value: error.source_value,
        source_row_data: error.source_row_data ? JSON.stringify(error.source_row_data) : null,
        resolution_status: 'unresolved',
        created_at: new Date()
      })
      .execute();
  }

  /**
   * Get import job by ID
   */
  async getImportJob(job_id: string): Promise<FileImportJob | null> {
    const job = await this.db
      .selectFrom('file_imports')
      .selectAll()
      .where('id', '=', job_id)
      .executeTakeFirst();

    if (!job) return null;

    return {
      ...job,
      detected_columns: job.detected_columns ? JSON.parse(job.detected_columns as string) : undefined,
      sample_data: job.sample_data ? JSON.parse(job.sample_data as string) : undefined,
      column_mappings: job.column_mappings ? JSON.parse(job.column_mappings as string) : undefined,
      transformation_rules: job.transformation_rules ? JSON.parse(job.transformation_rules as string) : undefined,
      error_details: job.error_details ? JSON.parse(job.error_details as string) : undefined,
      validation_errors: job.validation_errors ? JSON.parse(job.validation_errors as string) : undefined
    } as FileImportJob;
  }

  /**
   * List import jobs for organization
   */
  async listImportJobs(
    org_id: string,
    options?: {
      status?: FileImportJob['status'];
      target_entity?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: FileImportJob[]; total: number }> {
    let query = this.db
      .selectFrom('file_imports')
      .selectAll()
      .where('org_id', '=', org_id);

    if (options?.status) {
      query = query.where('status', '=', options.status);
    }

    if (options?.target_entity) {
      query = query.where('target_entity', '=', options.target_entity);
    }

    // Get total count
    const totalQuery = query.select(({ fn }) => [fn.count<number>('id').as('count')]);
    const totalResult = await totalQuery.executeTakeFirstOrThrow();
    const total = totalResult.count;

    // Get paginated results
    query = query.orderBy('created_at', 'desc');
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const jobs = await query.execute();

    return {
      jobs: jobs.map(job => ({
        ...job,
        detected_columns: job.detected_columns ? JSON.parse(job.detected_columns as string) : undefined,
        sample_data: job.sample_data ? JSON.parse(job.sample_data as string) : undefined,
        column_mappings: job.column_mappings ? JSON.parse(job.column_mappings as string) : undefined,
        transformation_rules: job.transformation_rules ? JSON.parse(job.transformation_rules as string) : undefined,
        error_details: job.error_details ? JSON.parse(job.error_details as string) : undefined,
        validation_errors: job.validation_errors ? JSON.parse(job.validation_errors as string) : undefined
      })) as FileImportJob[],
      total
    };
  }

  /**
   * Create import template
   */
  async createImportTemplate(params: {
    org_id: string;
    name: string;
    description?: string;
    file_type: string;
    target_entity: string;
    column_mappings: Record<string, FieldMapping>;
    transformation_rules?: TransformationRules;
    import_mode?: 'create' | 'update' | 'upsert';
    is_shared?: boolean;
    created_by: string;
  }): Promise<ImportTemplate> {
    const template = await this.db
      .insertInto('import_templates')
      .values({
        id: uuidv7(),
        org_id: params.org_id,
        name: params.name,
        description: params.description,
        file_type: params.file_type,
        target_entity: params.target_entity,
        column_mappings: JSON.stringify(params.column_mappings),
        transformation_rules: params.transformation_rules ? JSON.stringify(params.transformation_rules) : null,
        import_mode: params.import_mode || 'create',
        is_shared: params.is_shared || false,
        is_public: false,
        usage_count: 0,
        created_by: params.created_by,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning([
        'id', 'org_id', 'name', 'description', 'file_type', 'target_entity',
        'column_mappings', 'transformation_rules', 'import_mode', 'is_shared',
        'is_public', 'usage_count', 'created_by', 'created_at'
      ])
      .executeTakeFirstOrThrow();

    return {
      ...template,
      column_mappings: JSON.parse(template.column_mappings as string),
      transformation_rules: template.transformation_rules ? JSON.parse(template.transformation_rules as string) : undefined,
      last_used_at: undefined
    } as ImportTemplate;
  }

  /**
   * Get import errors for a job
   */
  async getImportErrors(
    job_id: string,
    options?: {
      error_type?: string;
      resolution_status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]> {
    let query = this.db
      .selectFrom('import_errors')
      .selectAll()
      .where('file_import_id', '=', job_id);

    if (options?.error_type) {
      query = query.where('error_type', '=', options.error_type);
    }

    if (options?.resolution_status) {
      query = query.where('resolution_status', '=', options.resolution_status);
    }

    query = query.orderBy('created_at', 'desc');

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query.execute();
  }

  /**
   * Delete import job and related data
   */
  async deleteImportJob(job_id: string): Promise<void> {
    this.log.info('Deleting import job', { job_id });
    
    await this.db.transaction().execute(async (trx) => {
      // Delete related errors first (foreign key constraint)
      await trx.deleteFrom('import_errors')
        .where('file_import_id', '=', job_id)
        .execute();

      // Delete field mappings
      await trx.deleteFrom('import_field_mappings')
        .where('file_import_id', '=', job_id)
        .execute();

      // Delete the import job
      await trx.deleteFrom('file_imports')
        .where('id', '=', job_id)
        .execute();
    });
  }
}