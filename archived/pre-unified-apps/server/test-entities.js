// Quick test to see if importing server entities causes issues
console.log('Starting entity import test...');

(async () => {
  try {
    console.log('1. Importing server entities...');
    const entities = await import('./src/lib/data-source.js');
    console.log('✅ Server entities imported successfully');
    
    console.log('2. Testing entity object structure...');
    const dataSource = entities.getDataSource;
    console.log('✅ getDataSource function available');
    
    console.log('3. All tests passed!');
  } catch (error) {
    console.error('❌ Error during entity import test:', error);
    console.error('Stack:', error.stack);
  }
})();