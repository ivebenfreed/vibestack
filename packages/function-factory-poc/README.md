# Function Factory POC

A proof-of-concept implementation of the Function Factory - a pure runtime entity system that generates and executes business logic dynamically using Cloudflare Workers and KV storage.

## 🎯 Concept

Instead of static entity files, this POC demonstrates:

1. **Hardcoded Primitives**: Base entity archetypes (Project, Task, File, Discussion)
2. **Function Factory**: Generates business logic functions and stores them in KV
3. **Table Factory**: Creates org-specific database schemas with JSON columns
4. **Pure Runtime**: Everything executes at runtime, no builds required

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the worker
npm run dev

# In another terminal, run the test
node test-poc.js
```

The worker runs on `http://localhost:8788` (different port to avoid conflicts).

## 🧪 What the Test Demonstrates

The test script demonstrates the complete Function Factory flow:

1. **Deploy Entity**: Creates a `SoftwareProject` entity with custom fields and business logic
2. **Function Generation**: Automatically generates validation, save, and query functions
3. **Custom Logic**: Tests custom validation rules (Acme GitHub repos, no PHP)
4. **Runtime Execution**: All functions execute from KV storage
5. **Data Structure**: Shows how core fields separate from custom fields

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ENTITY_FUNCTIONS│    │ ENTITY_SCHEMAS  │    │ ENTITY_CONFIG   │
│                 │    │                 │    │                 │
│ fn:org:entity:op│    │ schema:org:ent  │    │ table:org:ent   │
│ (JavaScript)    │    │ (JSON)          │    │ (table name)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Available Endpoints

- `GET /health` - Health check
- `GET /primitives` - List available base primitives
- `POST /factory/deploy` - Deploy new entity
- `POST /entity/:orgId/:entityName/:operation` - Execute entity function
- `GET /schema/:orgId/:entityName` - Get entity schema
- `GET /org/:orgId/entities` - List org entities
- `GET /debug/functions` - Debug: list all stored functions

## 🎮 Example Usage

### Deploy a SoftwareProject Entity

```bash
curl -X POST http://localhost:8788/factory/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SoftwareProject",
    "orgId": "acme-corp",
    "basePrimitive": "Project",
    "customFields": {
      "repositoryUrl": { "type": "url", "required": true },
      "techStack": { "type": "array" }
    },
    "businessLogic": {
      "validate": "function validate(data) { return { valid: true }; } return validate(data);"
    }
  }'
```

### Execute Validation

```bash
curl -X POST http://localhost:8788/entity/acme-corp/SoftwareProject/validate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "repositoryUrl": "https://github.com/acme/project"
  }'
```

## 🔑 Key Features Demonstrated

- ✅ **Pure Runtime**: No builds, no static code
- ✅ **Dynamic Functions**: Business logic stored and executed from KV
- ✅ **Custom Validation**: Org-specific rules enforced at runtime
- ✅ **Base Primitives**: Reusable entity archetypes
- ✅ **JSON Columns**: Zero-downtime field additions
- ✅ **Org Isolation**: Complete multi-tenancy

## 🚧 Next Steps

This POC proves the core concept. For production:

1. Add database integration (currently mocked)
2. Implement proper sandboxing for function execution
3. Add AI code generation capabilities
4. Build visual entity builder UI
5. Add real-time sync with LiveStore

## 💡 Why This is Revolutionary

Traditional approach:
```typescript
// Static entity file - requires rebuild to change
@Entity()
class SoftwareProject {
  validate() { /* hardcoded logic */ }
}
```

Function Factory approach:
```typescript
// Runtime function stored in KV - change instantly
await kv.put('fn:acme:SoftwareProject:validate', customLogic);
// Function is live globally in <100ms
```

This enables true business programmability where organizations can modify their business logic through UI and have it deploy instantly worldwide! 🌍