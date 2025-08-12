# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-09

### Added
- Initial release of kysely-neon-http
- Full compatibility with @neondatabase/serverless v1.0+
- Auto-routing: automatically uses pooler endpoints for queries, direct for DDL
- Auto-detection of local development environments
- Automatic configuration for local Neon proxy
- Full metadata extraction with numAffectedRows support
- Debug logging for development
- Comprehensive TypeScript support
- Edge runtime optimization (Cloudflare Workers, Vercel Edge, Deno)
- Smaller bundle size (~10KB vs ~16KB for original kysely-neon)

### Features
- Pure HTTP connections for stateless environments
- Intelligent endpoint routing based on query type
- Zero-configuration local development
- Full Kysely query builder compatibility
- Support for all PostgreSQL features available over HTTP

### Technical Details
- Uses `sql.query()` API for @neondatabase/serverless v1.0+
- Implements proper DatabaseConnection interface
- Extracts command and rowCount from fullResults mode
- Simulated streaming support with chunking
- Clean connection string handling for local development

### Migration
- Drop-in replacement for deprecated kysely-neon package
- Compatible with existing Kysely codebases
- No breaking changes from kysely-neon API

[1.0.0]: https://github.com/vibestack/kysely-neon-http/releases/tag/v1.0.0