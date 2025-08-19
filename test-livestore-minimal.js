/**
 * Minimal LiveStore test to debug initialization issues
 */

// Test LiveStore initialization with the simplest possible schema
async function testLiveStoreMinimal() {
  console.log('🔍 Testing minimal LiveStore initialization...');
  
  try {
    // 1. Import LiveStore modules
    console.log('1. Importing LiveStore modules...');
    const { makeSchema, State, createStorePromise } = await import('@livestore/livestore');
    const { makePersistedAdapter } = await import('@livestore/adapter-web');
    
    console.log('✅ Imports successful');
    console.log('- makeSchema:', typeof makeSchema);
    console.log('- State:', typeof State);
    console.log('- State object keys:', Object.keys(State));
    console.log('- State.SQLite:', State.SQLite);
    console.log('- createStorePromise:', typeof createStorePromise);
    console.log('- makePersistedAdapter:', typeof makePersistedAdapter);
    
    // 2. Create proper LiveStore schema with events and materializers
    console.log('2. Creating proper LiveStore schema...');
    
    // Step 1: Define events
    console.log('2a. Defining events...');
    const events = {
      'v1.TestCreated': State.SQLite.defineEvent({
        id: State.SQLite.text(),
        name: State.SQLite.text()
      }),
      'v1.TestUpdated': State.SQLite.defineEvent({
        id: State.SQLite.text(),
        name: State.SQLite.text()
      })
    };
    console.log('✅ Events defined:', Object.keys(events));
    
    // Step 2: Define tables
    console.log('2b. Defining tables...');
    const tables = {
      test: State.SQLite.table({
        name: 'test',
        columns: {
          id: State.SQLite.text({ primaryKey: true }),
          name: State.SQLite.text({ default: '' })
        }
      })
    };
    console.log('✅ Tables defined:', Object.keys(tables));
    
    // Step 3: Define materializers
    console.log('2c. Defining materializers...');
    const materializers = State.SQLite.materializers(events, {
      'v1.TestCreated': ({ id, name }) => tables.test.insert({ id, name }),
      'v1.TestUpdated': ({ id, name }) => tables.test.update({ name }).where({ id })
    });
    console.log('✅ Materializers defined:', materializers);
    
    // Step 4: Create state
    console.log('2d. Creating state...');
    const state = State.SQLite.makeState({ tables, materializers });
    console.log('✅ State created:', state);
    
    // Step 5: Create schema with events and state
    console.log('2e. Creating schema with makeSchema...');
    const schema = makeSchema({ events, state });
    console.log('✅ Schema created successfully:', schema);
    
    // 3. Create simple in-memory adapter first (no workers)
    console.log('3. Creating in-memory adapter (no workers)...');
    const { makeInMemoryAdapter } = await import('@livestore/adapter-web');
    const adapter = makeInMemoryAdapter();
    
    console.log('✅ Adapter created:', adapter);
    
    // 4. Create store
    console.log('4. Creating store...');
    const store = await createStorePromise({
      schema: schema,
      adapter: adapter
    });
    
    console.log('✅ Store created:', store);
    
    if (store) {
      console.log('🎉 SUCCESS: LiveStore initialized successfully!');
      
      // Test basic operations
      console.log('5. Testing basic operations...');
      
      // Insert test data
      await store.transact(async (tx) => {
        await tx.test.create({
          id: 'test-1',
          name: 'Test Item'
        });
      });
      
      // Query data
      const results = await store.test.findMany();
      console.log('✅ Query results:', results);
      
      await store.close();
      console.log('✅ Store closed successfully');
      
    } else {
      console.error('❌ FAILED: createStorePromise returned null');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testLiveStoreMinimal();