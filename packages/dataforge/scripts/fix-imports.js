#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixImports() {
  const distDir = path.join(__dirname, '../dist');
  
  // Files to fix
  const files = [
    'client-entities.js',
    'server-entities.js',
    'comment-operations.js',
    'project-operations.js',
    'statusdefinition-operations.js',
    'statusset-operations.js',
    'tag-operations.js',
    'tagset-operations.js',
    'task-operations.js',
    'user-operations.js',
    'crud-operations.js',
    'dexie-schema.js'
  ];
  
  for (const file of files) {
    const filePath = path.join(distDir, file);
    try {
      let content = await fs.readFile(filePath, 'utf8');
      // Replace ../entities/ with ./entities/ in imports
      content = content.replace(/from ["']\.\.\/entities\//g, 'from "./entities/');
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`Fixed imports in ${file}`);
    } catch (e) {
      // File might not exist, that's ok
      if (e.code !== 'ENOENT') {
        console.error(`Error processing ${file}:`, e);
      }
    }
  }
}

fixImports().catch(console.error);