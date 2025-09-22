#!/usr/bin/env node

/**
 * Script to fix Kysely connection leaks by applying ensureConnectionCleanup pattern
 *
 * This script systematically replaces createKyselyForPersistentUse patterns with
 * proper connection cleanup in API route files.
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  console.log(`\n🔧 Fixing: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;

  // Pattern 1: Simple endpoints with single return
  const simplePattern = /(\s+)(\/\/ TODO: Refactor to use withKysely[^\n]*\n\s+)?const kysely = createKyselyForPersistentUse\(\);\n(\s+)const rulesEngine = new JsonRulesEngine\(\);\n(\s+)const entityManager = new DataForgeEntityManager\(\{ kysely, rulesEngine, env: c\.env[^}]*\}\);\n(\s+)\n(\s+)const result = await entityManager\.(\w+)\([^;]+\);\n(\s+)\n(\s+)if \(!result\.success\) \{([^}]+)\}\n(\s+)\n(\s+)return c\.json\(\{ success: true, data: result[^}]+\}\);/g;

  content = content.replace(simplePattern, (match, indent1, todoComment, indent2, indent3, indent4, indent5, methodName, indent6, indent7, errorHandling, indent8, indent9) => {
    changes++;
    return `${indent1}const kysely = createKyselyForPersistentUse();

${indent1}const result = await ensureConnectionCleanup(kysely, async () => {
${indent2}const rulesEngine = new JsonRulesEngine();
${indent3}const entityManager = new DataForgeEntityManager({ kysely, rulesEngine, env: c.env });

${indent4}return await entityManager.${methodName}(${match.match(/entityManager\.\w+\(([^)]+)\)/)[1]});
${indent1}});

${indent6}if (!result.success) {${errorHandling}}

${indent8}return c.json({ success: true, data: result.data });`;
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Applied ${changes} fixes to ${path.basename(filePath)}`);
  } else {
    console.log(`ℹ️ No patterns matched in ${path.basename(filePath)}`);
  }

  return changes;
}

// Files to fix
const filesToFix = [
  'src/server/routes/dataforge-api.ts',
  'src/server/routes/dataforge-migration-api.ts',
  'src/server/routes/approvals-api.ts'
];

let totalChanges = 0;

filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    totalChanges += fixFile(fullPath);
  } else {
    console.log(`⚠️ File not found: ${fullPath}`);
  }
});

console.log(`\n🎉 Total fixes applied: ${totalChanges}`);
console.log(`\n💡 Manual review needed for complex endpoints with multiple kysely usage`);