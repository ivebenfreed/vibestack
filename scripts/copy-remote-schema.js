const { Client } = require('pg');

async function main() {
  const remoteUrl = process.env.REMOTE_DATABASE_URL || 
    'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
  const localUrl = 'postgres://postgres:postgres@localhost:5432/vibestack_dev';

  const remoteClient = new Client({ connectionString: remoteUrl });
  const localClient = new Client({ connectionString: localUrl });

  try {
    console.log('🔗 Connecting to databases...');
    await remoteClient.connect();
    await localClient.connect();

    // Get all table definitions from remote
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const { rows: tables } = await remoteClient.query(tablesQuery);
    console.log(`📋 Found ${tables.length} tables in remote database`);

    // For each table, get its DDL and create it locally
    for (const { table_name } of tables) {
      console.log(`\n📦 Processing table: ${table_name}`);
      
      // Get columns
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      const { rows: columns } = await remoteClient.query(columnsQuery, [table_name]);
      
      // Build CREATE TABLE statement
      let createTableSQL = `CREATE TABLE IF NOT EXISTS ${table_name} (\n`;
      const columnDefs = [];
      
      for (const col of columns) {
        let colDef = `  ${col.column_name} `;
        
        // Handle data types
        if (col.data_type === 'character varying') {
          colDef += col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
        } else if (col.data_type === 'USER-DEFINED') {
          colDef += col.udt_name;
        } else if (col.data_type === 'ARRAY') {
          colDef += 'TEXT[]';
        } else {
          colDef += col.data_type.toUpperCase();
        }
        
        // Add NOT NULL if needed
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        // Add default if exists
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        
        columnDefs.push(colDef);
      }
      
      createTableSQL += columnDefs.join(',\n') + '\n);';
      
      // Create the table
      try {
        await localClient.query(createTableSQL);
        console.log(`  ✅ Created table ${table_name}`);
      } catch (err) {
        console.error(`  ❌ Failed to create ${table_name}: ${err.message}`);
      }
      
      // Get and create indexes
      const indexesQuery = `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1 AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';
      `;
      
      const { rows: indexes } = await remoteClient.query(indexesQuery, [table_name]);
      
      for (const idx of indexes) {
        try {
          await localClient.query(idx.indexdef.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS'));
          console.log(`  ✅ Created index ${idx.indexname}`);
        } catch (err) {
          // Ignore if index exists
        }
      }
      
      // Get and create primary key
      const pkQuery = `
        SELECT conname, pg_get_constraintdef(oid) as condef
        FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'p';
      `;
      
      try {
        const { rows: pks } = await remoteClient.query(pkQuery, [table_name]);
        if (pks.length > 0) {
          const pkDef = pks[0].condef;
          const alterSQL = `ALTER TABLE ${table_name} ADD CONSTRAINT ${pks[0].conname} ${pkDef}`;
          try {
            await localClient.query(alterSQL);
            console.log(`  ✅ Added primary key ${pks[0].conname}`);
          } catch (err) {
            // Ignore if constraint exists
          }
        }
      } catch (err) {
        // Table might not exist in catalog
      }
    }

    // Create foreign keys in a second pass
    console.log('\n🔗 Creating foreign key constraints...');
    const fkQuery = `
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public';
    `;
    
    const { rows: fks } = await remoteClient.query(fkQuery);
    
    for (const fk of fks) {
      const alterSQL = `
        ALTER TABLE ${fk.table_name} 
        ADD CONSTRAINT ${fk.constraint_name} 
        FOREIGN KEY (${fk.column_name}) 
        REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})
        ON DELETE CASCADE;
      `;
      
      try {
        await localClient.query(alterSQL);
        console.log(`  ✅ Created foreign key ${fk.constraint_name}`);
      } catch (err) {
        // Ignore if constraint exists
      }
    }

    console.log('\n✨ Schema copy completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await remoteClient.end();
    await localClient.end();
  }
}

main().catch(console.error);