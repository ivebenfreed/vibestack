#!/usr/bin/env tsx

import 'reflect-metadata';
console.log('Script started');

try {
    console.log('About to import MetadataFilter...');
    const { MetadataFilter } = await import('./src/utils/metadata-filter.js');
    console.log('MetadataFilter imported successfully');

    console.log('Creating new MetadataFilter instance...');
    const filter = new MetadataFilter();
    console.log('MetadataFilter instance created');

    console.log('About to call discoverEntities...');
    const entities = await filter.discoverEntities();
    console.log('discoverEntities completed with', entities.length, 'entities');

} catch (error) {
    console.error('Error occurred:', error);
    console.error('Stack trace:', error.stack);
}

console.log('Script finished');