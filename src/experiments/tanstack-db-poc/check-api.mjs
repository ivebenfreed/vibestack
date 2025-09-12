import * as db from '@tanstack/db';
import * as reactDb from '@tanstack/react-db';

console.log('=== @tanstack/db exports ===');
console.log(Object.keys(db).sort());

console.log('\n=== @tanstack/react-db exports ===');
console.log(Object.keys(reactDb).sort());

// Check if collection has specific methods
if (db.createCollection) {
  const testCollection = db.createCollection({
    id: 'test',
    getKey: (item) => item.id,
    sync: { sync: () => {} }
  });
  
  console.log('\n=== Collection instance methods ===');
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(testCollection)).sort());
  
  console.log('\n=== Collection instance properties ===');
  console.log(Object.keys(testCollection).sort());
}