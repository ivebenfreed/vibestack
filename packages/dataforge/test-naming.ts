import { UnderscoreNamingStrategy } from '@mikro-orm/core';

const strategy = new UnderscoreNamingStrategy();

const testCases = [
  'Comment',
  'User', 
  'Task',
  'Project',
  'Tag',
  'Session',
  'Account'
];

console.log('Testing UnderscoreNamingStrategy:');
testCases.forEach(name => {
  const tableName = strategy.classToTableName(name);
  console.log(`${name} -> ${tableName}`);
});