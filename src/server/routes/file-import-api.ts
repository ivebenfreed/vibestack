/**
 * File Import API Routes
 * 
 * RESTful API for file-based data imports with OpenAPI documentation
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ApiEnv } from '../types/api';
import { parseFile, detectFileType } from '../services/file-import/FileParser';
import { FileStorageService } from '../services/file-import/FileStorageService';
import { withKysely } from '../lib/database-manager';
import { getUserFromRequest } from '../middleware/auth-context';
import { uuidv7 } from 'uuidv7';

const app = new OpenAPIHono<ApiEnv>();

// Schemas
const FileImportJobSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string(),
  file_name: z.string(),
  file_type: z.enum(['csv', 'tsv', 'xlsx', 'xls', 'json', 'xml']),
  file_size: z.number(),
  file_path: z.string(),
  status: z.enum(['uploaded', 'analyzing', 'mapped', 'importing', 'completed', 'failed', 'cancelled']),
  row_count: z.number().optional(),
  target_entity: z.string().optional(),
  records_processed: z.number().default(0),
  records_imported: z.number().default(0),
  records_updated: z.number().default(0),
  records_failed: z.number().default(0),
  records_skipped: z.number().default(0),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  created_by: z.string().optional()
});

const DetectedColumnSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'date', 'boolean', 'email', 'url', 'phone']),
  sample_values: z.array(z.string()),
  nullable: z.boolean(),
  unique_count: z.number().optional(),
  confidence: z.number().optional()
});

const SchemaAnalysisSchema = z.object({
  detected_columns: z.array(DetectedColumnSchema),
  sample_data: z.array(z.record(z.any())),
  row_count: z.number(),
  parsing_errors: z.array(z.string()).optional()
});

const FieldMappingSchema = z.object({
  target_field: z.string(),
  transformation: z.string().optional(),
  default_value: z.any().optional(),
  is_required: z.boolean().optional()
});

const MappingConfigurationSchema = z.object({
  target_entity: z.string(),
  column_mappings: z.record(FieldMappingSchema),
  transformation_rules: z.object({
    trim_whitespace: z.boolean().optional(),
    handle_empty_strings: z.enum(['null', 'empty', 'skip']).optional(),
    date_format: z.string().optional(),
    number_format: z.enum(['comma_decimal', 'period_decimal']).optional(),
    text_case: z.enum(['preserve', 'lower', 'upper', 'title']).optional()
  }).optional(),
  import_mode: z.enum(['create', 'update', 'upsert']).optional()
});

// Routes

// POST /api/file-import/upload - Upload file and create import job
const uploadRoute = createRoute({
  method: 'post',
  path: '/upload',
  tags: ['File Import'],
  summary: 'Upload file and create import job',
  description: 'Upload a file (CSV, JSON) and create a new import job for processing',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.instanceof(File, { message: 'File is required' }),
            org_id: z.string().uuid('Valid organization ID required')
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            job: FileImportJobSchema
          })
        }
      },
      description: 'File uploaded and import job created'
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.any().optional()
          })
        }
      },
      description: 'Bad request - invalid file or parameters'
    }
  }
});

app.openapi(uploadRoute, async (c) => {
  try {
    // Get user context
    const user = await getUserFromRequest(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Parse form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const org_id = formData.get('org_id') as string;

    if (!file) {
      return c.json({ error: 'File is required' }, 400);
    }

    if (!org_id) {
      return c.json({ error: 'Organization ID is required' }, 400);
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const supportedTypes = ['csv', 'tsv', 'json'];
    
    if (!fileExtension || !supportedTypes.includes(fileExtension)) {
      return c.json({ 
        error: 'Unsupported file type',
        details: `Supported formats: ${supportedTypes.join(', ')}`
      }, 400);
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ 
        error: 'File too large',
        details: 'Maximum file size is 10MB'
      }, 400);
    }

    // Upload file to R2 storage
    const fileBuffer = await file.arrayBuffer();
    const fileId = uuidv7();
    const storageService = new FileStorageService(c.env.FILE_STORAGE);
    
    // Determine content type from file extension
    const getContentType = (filename: string): string => {
      const ext = filename.toLowerCase().split('.').pop();
      switch (ext) {
        case 'csv': return 'text/csv';
        case 'tsv': return 'text/tab-separated-values';
        case 'json': return 'application/json';
        case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'xls': return 'application/vnd.ms-excel';
        case 'xml': return 'application/xml';
        default: return 'application/octet-stream';
      }
    };

    const storedFile = await storageService.uploadFile(
      org_id,
      fileId,
      file.name,
      fileBuffer,
      getContentType(file.name)
    );

    // Store file hash for duplicate detection
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
    const fileHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create import job using proper database pattern
    const job = await withKysely(async (db) => {
      const job_id = uuidv7();
      
      const result = await db
        .insertInto('file_imports')
        .values({
          id: job_id,
          org_id,
          file_name: file.name,
          file_type: fileExtension as any,
          file_size: file.size,
          file_path: storedFile.key,
          file_hash: fileHash,
          status: 'uploaded',
          import_mode: 'create',
          records_processed: 0,
          records_imported: 0,
          records_updated: 0,
          records_failed: 0,
          records_skipped: 0,
          created_by: user.id,
          created_at: new Date()
        })
        .returning([
          'id', 'org_id', 'file_name', 'file_type', 'file_size', 'file_path', 
          'status', 'import_mode', 'records_processed', 'records_imported',
          'records_updated', 'records_failed', 'records_skipped', 'created_at'
        ])
        .executeTakeFirstOrThrow();

      return result;
    });

    // File is now stored in R2, we can retrieve it later for analysis

    return c.json({ 
      success: true, 
      job: {
        ...job,
        created_at: job.created_at.toISOString(),
        started_at: job.started_at?.toISOString(),
        completed_at: job.completed_at?.toISOString()
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    return c.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/file-import/{job_id}/analyze - Analyze file schema
const analyzeRoute = createRoute({
  method: 'post',
  path: '/{job_id}/analyze',
  tags: ['File Import'],
  summary: 'Analyze file schema',
  description: 'Parse the uploaded file and detect column types and data structure',
  request: {
    params: z.object({
      job_id: z.string().uuid()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            analysis: SchemaAnalysisSchema
          })
        }
      },
      description: 'File analyzed successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          })
        }
      },
      description: 'Import job not found'
    }
  }
});

app.openapi(analyzeRoute, async (c) => {
  try {
    const { job_id } = c.req.valid('param');

    // Get import job and update status using proper database pattern
    const job = await withKysely(async (db) => {
      const jobResult = await db
        .selectFrom('file_imports')
        .selectAll()
        .where('id', '=', job_id)
        .executeTakeFirst();

      if (!jobResult) {
        return null;
      }

      // Parse JSON fields
      return {
        ...jobResult,
        detected_columns: jobResult.detected_columns ? JSON.parse(jobResult.detected_columns as string) : undefined,
        sample_data: jobResult.sample_data ? JSON.parse(jobResult.sample_data as string) : undefined,
        column_mappings: jobResult.column_mappings ? JSON.parse(jobResult.column_mappings as string) : undefined,
        transformation_rules: jobResult.transformation_rules ? JSON.parse(jobResult.transformation_rules as string) : undefined,
        error_details: jobResult.error_details ? JSON.parse(jobResult.error_details as string) : undefined,
        validation_errors: jobResult.validation_errors ? JSON.parse(jobResult.validation_errors as string) : undefined
      };
    });

    if (!job) {
      return c.json({ error: 'Import job not found' }, 404);
    }

    if (job.status !== 'uploaded') {
      return c.json({ error: 'Job must be in uploaded status to analyze' }, 400);
    }

    // Update status to analyzing
    await withKysely(async (db) => {
      await db
        .updateTable('file_imports')
        .set({
          status: 'analyzing',
          started_at: new Date()
        })
        .where('id', '=', job_id)
        .execute();
    });

    // Fetch file from R2 storage
    const storageService = new FileStorageService(c.env.FILE_STORAGE);
    const fileBuffer = await storageService.downloadFile(job.file_path);
    
    if (!fileBuffer) {
      return c.json({ error: 'File not found in storage' }, 404);
    }

    // Parse file using the new clean parser
    const analysis = await parseFile(job.file_type as any, fileBuffer, job.file_name);

    // Save analysis results
    await withKysely(async (db) => {
      await db
        .updateTable('file_imports')
        .set({
          status: 'analyzed',
          detected_columns: JSON.stringify(analysis.detected_columns),
          row_count: analysis.total_rows,
          sample_data: JSON.stringify(analysis.sample_data)
        })
        .where('id', '=', job_id)
        .execute();
    });

    return c.json({
      success: true,
      analysis: {
        detected_columns: analysis.detected_columns,
        sample_data: analysis.sample_data,
        row_count: analysis.total_rows,
        parsing_errors: analysis.parsing_errors
      }
    });

  } catch (error) {
    console.error('File analysis error:', error);
    return c.json({ 
      error: 'Analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// POST /api/file-import/{job_id}/mapping - Configure field mappings
const mappingRoute = createRoute({
  method: 'post',
  path: '/{job_id}/mapping',
  tags: ['File Import'],
  summary: 'Configure field mappings',
  description: 'Set up field mappings and transformation rules for the import',
  request: {
    params: z.object({
      job_id: z.string().uuid()
    }),
    body: {
      content: {
        'application/json': {
          schema: MappingConfigurationSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string()
          })
        }
      },
      description: 'Mapping configuration saved'
    }
  }
});

app.openapi(mappingRoute, async (c) => {
  try {
    const { job_id } = c.req.valid('param');
    const config = c.req.valid('json');

    // Save mapping configuration
    await withKysely(async (db) => {
      await db
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
    });

    return c.json({
      success: true,
      message: 'Mapping configuration saved successfully'
    });

  } catch (error) {
    console.error('Mapping configuration error:', error);
    return c.json({ 
      error: 'Failed to save mapping configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/file-import/{job_id} - Get import job details
const getJobRoute = createRoute({
  method: 'get',
  path: '/{job_id}',
  tags: ['File Import'],
  summary: 'Get import job details',
  request: {
    params: z.object({
      job_id: z.string().uuid()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            job: FileImportJobSchema.extend({
              detected_columns: z.array(DetectedColumnSchema).optional(),
              sample_data: z.array(z.record(z.any())).optional(),
              column_mappings: z.record(FieldMappingSchema).optional()
            })
          })
        }
      },
      description: 'Import job details'
    }
  }
});

app.openapi(getJobRoute, async (c) => {
  try {
    const { job_id } = c.req.valid('param');

    const job = await withKysely(async (db) => {
      const jobResult = await db
        .selectFrom('file_imports')
        .selectAll()
        .where('id', '=', job_id)
        .executeTakeFirst();

      if (!jobResult) {
        return null;
      }

      // Parse JSON fields
      return {
        ...jobResult,
        detected_columns: jobResult.detected_columns ? JSON.parse(jobResult.detected_columns as string) : undefined,
        sample_data: jobResult.sample_data ? JSON.parse(jobResult.sample_data as string) : undefined,
        column_mappings: jobResult.column_mappings ? JSON.parse(jobResult.column_mappings as string) : undefined,
        transformation_rules: jobResult.transformation_rules ? JSON.parse(jobResult.transformation_rules as string) : undefined,
        error_details: jobResult.error_details ? JSON.parse(jobResult.error_details as string) : undefined,
        validation_errors: jobResult.validation_errors ? JSON.parse(jobResult.validation_errors as string) : undefined
      };
    });

    if (!job) {
      return c.json({ error: 'Import job not found' }, 404);
    }

    return c.json({
      success: true,
      job: {
        ...job,
        created_at: job.created_at.toISOString(),
        started_at: job.started_at?.toISOString(),
        completed_at: job.completed_at?.toISOString()
      }
    });

  } catch (error) {
    return c.json({ error: 'Failed to get job details' }, 500);
  }
});

// GET /api/file-import - List import jobs for organization
const listJobsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['File Import'],
  summary: 'List import jobs',
  request: {
    query: z.object({
      org_id: z.string().uuid(),
      status: z.enum(['uploaded', 'analyzing', 'mapped', 'importing', 'completed', 'failed', 'cancelled']).optional(),
      limit: z.coerce.number().min(1).max(100).default(20).optional(),
      offset: z.coerce.number().min(0).default(0).optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            jobs: z.array(FileImportJobSchema),
            total: z.number(),
            pagination: z.object({
              limit: z.number(),
              offset: z.number(),
              has_more: z.boolean()
            })
          })
        }
      },
      description: 'List of import jobs'
    }
  }
});

app.openapi(listJobsRoute, async (c) => {
  try {
    const query = c.req.valid('query');

    const result = await withKysely(async (db) => {
      let queryBuilder = db
        .selectFrom('file_imports')
        .selectAll()
        .where('org_id', '=', query.org_id);

      if (query.status) {
        queryBuilder = queryBuilder.where('status', '=', query.status);
      }

      // Get total count with separate query builder
      const totalQuery = db
        .selectFrom('file_imports')
        .select(({ fn }) => [fn.count<number>('id').as('count')])
        .where('org_id', '=', query.org_id);
      
      if (query.status) {
        totalQuery.where('status', '=', query.status);
      }
      
      const totalResult = await totalQuery.executeTakeFirstOrThrow();
      const total = totalResult.count;

      // Get paginated results
      queryBuilder = queryBuilder.orderBy('created_at', 'desc');
      
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }
      if (query.offset) {
        queryBuilder = queryBuilder.offset(query.offset);
      }

      const jobs = await queryBuilder.execute();

      return {
        jobs: jobs.map(job => ({
          ...job,
          detected_columns: job.detected_columns ? JSON.parse(job.detected_columns as string) : undefined,
          sample_data: job.sample_data ? JSON.parse(job.sample_data as string) : undefined,
          column_mappings: job.column_mappings ? JSON.parse(job.column_mappings as string) : undefined,
          transformation_rules: job.transformation_rules ? JSON.parse(job.transformation_rules as string) : undefined,
          error_details: job.error_details ? JSON.parse(job.error_details as string) : undefined,
          validation_errors: job.validation_errors ? JSON.parse(job.validation_errors as string) : undefined
        })),
        total
      };
    });

    return c.json({
      success: true,
      jobs: result.jobs.map(job => ({
        ...job,
        created_at: job.created_at.toISOString(),
        started_at: job.started_at?.toISOString(),
        completed_at: job.completed_at?.toISOString()
      })),
      total: result.total,
      pagination: {
        limit: query.limit || 20,
        offset: query.offset || 0,
        has_more: (query.offset || 0) + (query.limit || 20) < result.total
      }
    });

  } catch (error) {
    return c.json({ error: 'Failed to list import jobs' }, 500);
  }
});

export default app;