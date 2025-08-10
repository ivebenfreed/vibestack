import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';
import { extractContextFromComment } from '../utils/entity-context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

interface EntityServiceInfo {
  entityName: string;
  tableName: string;
  properties: string[];
  relations: RelationInfo[];
  hasDomainFields: boolean;
}

interface RelationInfo {
  name: string;
  type: 'ManyToOne' | 'OneToMany' | 'ManyToMany' | 'OneToOne';
  targetEntity: string;
  targetTable: string;
}

async function extractServiceInfo(): Promise<EntityServiceInfo[]> {
  const orm = await MikroORM.init(mikroOrmConfig);
  const metadata = orm.getMetadata();
  const services: EntityServiceInfo[] = [];

  const allMetadata = Object.values(metadata.getAll());

  for (const meta of allMetadata as any[]) {
    // Skip abstract base classes
    if (meta.abstract) {
      continue;
    }
    
    // Skip server-only entities (Dexie services are client-side only)
    const entityContext = extractContextFromComment(meta.comment);
    if (entityContext === 'server-only') {
      console.log(`⏭️  Skipping server-only entity: ${meta.className}`);
      continue;
    }

    const serviceInfo: EntityServiceInfo = {
      entityName: meta.className,
      tableName: meta.tableName,
      properties: [],
      relations: [],
      hasDomainFields: false,
    };

    // Check if extends BaseDomainEntity
    if (meta.extends?.includes('BaseDomainEntity')) {
      serviceInfo.hasDomainFields = true;
    }

    // Extract properties
    for (const prop of Object.values(meta.properties) as any[]) {
      if (!prop.reference) {
        serviceInfo.properties.push(prop.name);
      } else if (prop.reference) {
        // Find target entity metadata
        const targetMeta = allMetadata.find((m: any) => m.className === prop.type);
        serviceInfo.relations.push({
          name: prop.name,
          type: mapReferenceToRelationType(prop.reference),
          targetEntity: prop.type,
          targetTable: targetMeta?.tableName || prop.type.toLowerCase(),
        });
      }
    }

    services.push(serviceInfo);
  }

  await orm.close();
  return services;
}

function mapReferenceToRelationType(reference: string): 'ManyToOne' | 'OneToMany' | 'ManyToMany' | 'OneToOne' {
  switch (reference) {
    case 'm:1': return 'ManyToOne';
    case '1:m': return 'OneToMany';
    case 'm:n': return 'ManyToMany';
    case '1:1': return 'OneToOne';
    default: return 'ManyToOne';
  }
}

function generateServiceFile(service: EntityServiceInfo): string {
  const lowerName = service.entityName.charAt(0).toLowerCase() + service.entityName.slice(1);
  
  // Convert snake_case entity names to PascalCase for class names
  const className = service.entityName.split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('') + 'DexieService';
  
  // Generate consistent service instance name
  const serviceName = className.charAt(0).toLowerCase() + className.slice(1, -7); // Remove 'Service' and lowercase first char
  
  let output = `// Generated Dexie domain service for ${service.entityName}
import { db } from '../dexie-schema.js';
import type { ${service.entityName} } from '../client-entities.js';

export interface ${service.entityName}UpdateInput {
  ${service.properties
    .filter(p => !['id', 'createdAt', 'updatedAt'].includes(p))
    .map(p => `${p}?: any;`)
    .join('\n  ')}
}

export class ${className} {
  async create(data: Partial<${service.entityName}>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: ${service.entityName} = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,`;

  if (service.hasDomainFields) {
    output += `
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),`;
  }

  output += `
    } as ${service.entityName};
    
    await db.${service.tableName}.add(record);
    return id;
  }

  async findById(id: string): Promise<${service.entityName} | undefined> {
    return await db.${service.tableName}.get(id);
  }

  async findAll(): Promise<${service.entityName}[]> {
    return await db.${service.tableName}${service.hasDomainFields ? `.where('deleted').equals(0)` : ''}.toArray();
  }

  async update(id: string, updates: ${service.entityName}UpdateInput): Promise<void> {
    await db.${service.tableName}.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {`;

  if (service.hasDomainFields) {
    output += `
    // Soft delete for domain entities
    await db.${service.tableName}.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });`;
  } else {
    output += `
    await db.${service.tableName}.delete(id);`;
  }

  output += `
  }

  async deleteAll(): Promise<void> {
    await db.${service.tableName}.clear();
  }
`;

  // Add relationship methods
  for (const rel of service.relations) {
    if (rel.type === 'OneToMany') {
      output += `
  async get${rel.name.charAt(0).toUpperCase() + rel.name.slice(1)}(${lowerName}Id: string): Promise<any[]> {
    return await db.${rel.targetTable}
      .where('${lowerName}Id')
      .equals(${lowerName}Id)
      .toArray();
  }
`;
    } else if (rel.type === 'ManyToOne') {
      output += `
  async get${rel.name.charAt(0).toUpperCase() + rel.name.slice(1)}(${lowerName}: ${service.entityName}): Promise<any | undefined> {
    if (!${lowerName}.${rel.name}Id) return undefined;
    return await db.${rel.targetTable}.get(${lowerName}.${rel.name}Id);
  }
`;
    }
  }

  output += `}

export const ${serviceName}Service = new ${className}();
`;

  return output;
}

function generateIndexFile(services: EntityServiceInfo[]): string {
  let output = `// Generated Dexie domain services index
`;

  for (const service of services) {
    // Use the actual filename we generated
    const fileName = `${service.entityName.toLowerCase()}-dexie-service`;
    output += `export * from './${fileName}.js';\n`;
  }

  return output;
}

async function main() {
  try {
    console.log('🔍 Extracting service info from MikroORM entities...');
    const services = await extractServiceInfo();
    
    console.log(`📦 Generating ${services.length} Dexie domain services`);
    
    const servicesDir = path.join(PACKAGE_ROOT, 'src/generated/dexie-domain');
    await fs.mkdir(servicesDir, { recursive: true });
    
    // Generate individual service files
    for (const service of services) {
      const fileName = `${service.entityName.toLowerCase()}-dexie-service.ts`;
      const filePath = path.join(servicesDir, fileName);
      const content = generateServiceFile(service);
      await fs.writeFile(filePath, content);
      console.log(`  ✓ Generated ${fileName}`);
    }
    
    // Generate index file
    const indexPath = path.join(servicesDir, 'index.ts');
    const indexContent = generateIndexFile(services);
    await fs.writeFile(indexPath, indexContent);
    
    console.log('✅ Generated Dexie domain services');
    
  } catch (error) {
    console.error('❌ Error generating Dexie domain services:', error);
    process.exit(1);
  }
}

main();