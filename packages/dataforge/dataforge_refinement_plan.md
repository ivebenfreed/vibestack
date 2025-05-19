# Plan: Review & Refinement of `packages/dataforge`

This document outlines a comprehensive plan to review, refine, and prepare the `@repo/dataforge` package for public release as part of a full-stack starter application.

**Date:** May 18, 2025

## Phase 1: Information Gathering & Initial Analysis (Completed)

**Summary of Findings:**

1.  **Entity Generation (`generate-entities.ts`)**:
    *   Sophisticated script generating plain classes and `EntitySchema` objects for server/client contexts.
    *   Relies on TypeORM metadata and custom decorators (`@ServerOnly`, `@EnumTypeName`, `@TableCategory`).
    *   Handles inheritance from base entities.
    *   Dynamically imports enums.
    *   Includes `getTableHierarchy` for dependency analysis.
2.  **Datasources (`server.ts`, `client.ts`)**:
    *   `server.ts`: Uses PostgreSQL, loads entities directly from `src/entities/*.ts` (original decorator-based files) for CLI operations.
    *   `client.ts`: Uses PGlite, loads entities from generated `src/generated/client-entities.ts` (EntitySchema objects).
    *   This difference in entity loading between server and client datasources for TypeORM CLI (migrations) is a key point to ensure consistency.
    *   Both correctly use `synchronize: false`.
3.  **Trigger Template (`client-id-trigger.template.ts`)**:
    *   Provides a PL/pgSQL function and applies it to tables listed in `SERVER_DOMAIN_TABLES` (from generated code).
    *   Current application process is manual (copy, rename, run) and ripe for automation.
4.  **Entity Definition (`User.ts`)**:
    *   Well-structured, uses TypeORM, `class-validator`, and custom decorators.
    *   Demonstrates context-specific fields (`@ServerOnly`) and robust enum handling (`@EnumTypeName`).
5.  **Migration Example (`1747308551160-AddSuperAdminToUser.ts`)**:
    *   Shows handwritten SQL for complex changes (enum modification).
    *   Highlights a potential issue with migration atomicity (bundling unrelated `jwks` change).

## Phase 2: Detailed Review & Planning (Action Plan)

The following sections detail the planned activities for refining the `dataforge` package. Each can be broken down into a more specific task.

### I. Code Audit & Cleanup (Completed)

*   **Objective**: Identify and remove unused/redundant code to reduce maintenance overhead and improve clarity.
*   **Tasks**:
    1.  **Analyze Entity Usage**:
        *   For each entity in `packages/dataforge/src/entities/`:
            *   Search across the *entire monorepo* for its usage (instantiation, type references, query targets).
            *   Flag entities with no clear usage outside of `dataforge` itself.
    2.  **Analyze Script & Utility Usage**:
        *   For each script in `packages/dataforge/src/scripts/` and utility in `packages/dataforge/src/utils/`:
            *   Check if they are called by `package.json` scripts.
            *   Search for their usage within `dataforge` and potentially other packages.
            *   Flag unused or highly specific scripts/utilities that could be deprecated or consolidated.
    3.  **Review `console.log/warn/error`**:
        *   Examine `generate-entities.ts` and other key files for debug logging that should be removed or made conditional for production builds.
*   **Deliverable**: A list of files/code sections recommended for removal or further investigation, with justifications.

### II. Build Process Optimization (`tsup` & `generate-entities.ts`)

*   **Objective**: Ensure the build is efficient, produces correct and minimal outputs, and that type definitions are robust.
*   **Tasks**:
    1.  **Analyze `generate-entities.ts`**:
        *   **Type Resolution (`resolveColumnType`)**: Investigate robustness. Are there many warnings about unresolved types? Could type mappings be improved?
        *   **`getTableHierarchy` Usage**: Clarify how its output is used. If not actively used in generation, consider if it's still needed.
        *   **Efficiency**: Profile if build times are a concern. Look for optimizations.
        *   **Error Handling**: Ensure warnings/errors are clear and actionable.
    2.  **Analyze `tsup.config.cts`**:
        *   Review `entry` points, `external` dependencies, and `noExternal` settings.
        *   Assess `treeshake: false`. Could enabling it reduce bundle sizes?
    3.  **Type Definitions (`.d.ts`)**:
        *   Verify accuracy and alignment with `exports` in `package.json`.
        *   Ensure types for plain classes and `EntitySchema` are correctly exported.
    4.  **Consistency Check**:
        *   Discuss if the server datasource (for CLI migration generation) should also use the generated `server-entities.ts` to ensure consistency with runtime, making `generate-entities` a prerequisite for all TypeORM CLI operations.
*   **Deliverable**: Recommendations for optimizing the build script, `tsup` configuration, and improving type definition strategy. Proposal on aligning datasource entity sources for CLI tools.

### III. Migration Process Refinement

*   **Objective**: Create a robust, clear, and potentially more automated migration workflow for both server (PostgreSQL) and client (PGlite).
*   **Tasks**:
    1.  **Review Generation Commands**:
        *   Examine TypeORM CLI commands in `package.json`.
        *   Test generating migrations for typical schema changes for both server and client.
        *   Assess the quality of auto-generated migrations.
    2.  **Handwritten vs. Auto-generated**:
        *   Determine common scenarios requiring handwritten SQL.
        *   Develop guidelines or helper scripts for creating complex handwritten migrations.
    3.  **Atomicity & Naming**:
        *   Review existing migrations for adherence to atomicity.
        *   Establish clear naming conventions.
    4.  **PGlite Migrations**:
        *   Specifically test the migration process for PGlite.
        *   Review `migration:upload-client` script and its role.
    5.  **Documentation**:
        *   Update `README.md` with detailed instructions for migrations.
*   **Deliverable**: Suggestions for improving migration tooling, guidelines for handwritten migrations, and updated documentation.

### IV. Documentation Enhancement (`README.md`)

*   **Objective**: Make the `README.md` exceptionally clear, comprehensive, and welcoming.
*   **Tasks**:
    1.  **Full Content Review**: Verify accuracy of all sections.
    2.  **Clarity and Completeness**:
        *   **Quick Start**: Ensure it's minimal and effective.
        *   **Development Guide**: Expand on creating schemas, context, and categories.
        *   **Commands**: Verify all commands and descriptions.
        *   **CRDT Support & Triggers**: Integrate improvements from "Trigger Mechanism Review."
        *   **Dual-Database**: Explain PostgreSQL/PGlite setup clearly.
    3.  **New Sections (Consider Adding)**: Prerequisites, Configuration, Troubleshooting.
    4.  **Tone and Structure**: Ensure logical flow and welcoming tone. Use diagrams if helpful.
*   **Deliverable**: A revised `README.md` content or a set of specific, actionable changes.

### V. Trigger Mechanism Review & Automation (`client_id` trigger)

*   **Objective**: Automate or significantly simplify the application and management of the `client_id` trigger.
*   **Tasks**:
    1.  **Analyze Current Process**: Understand reliance on `client-id-trigger.template.ts` and `SERVER_DOMAIN_TABLES`.
    2.  **Brainstorm Automation Strategies**:
        *   **Option A (Custom Script)**: E.g., `pnpm run migration:generate:triggers` to generate a new migration file applying triggers to current domain tables.
        *   **Option B (Post-Migration Hook/Script)**: Check for new domain tables after `migration:run:server` and apply trigger if missing.
    3.  **Chosen Strategy Implementation (Plan for Code Mode)**: Design the chosen method.
    4.  **Documentation**: Update to reflect the new process.
*   **Deliverable**: A detailed proposal for automating `client_id` trigger management, including script design if applicable, and updated documentation steps.

### VI. General Improvements & Suggestions

*   **Objective**: Catch-all for other enhancements.
*   **Tasks**:
    1.  **Dependencies (`package.json`)**: Review for outdated or unused packages.
    2.  **TypeScript Configuration (`tsconfig.json`)**: Quick review for best practices.
    3.  **Test Suite (`src/tests/`)**: Assess current test coverage (entity generation, migrations, trigger behavior, context filtering). Suggest areas for new tests.
    4.  **Error Handling & Logging**: Review critical paths for robust error handling and informative logging.
    5.  **Developer Experience**: Identify and address any minor complexities in the workflow.
*   **Deliverable**: A list of miscellaneous suggestions for dependency management, testing, and overall DX.

## Workflow Diagram

```mermaid
graph TD
    A[Start: DataForge Review] --> B(Phase 1: Initial Analysis - COMPLETE);
    B --> C{Present Detailed Plan};
    C --> D{User Approval of Plan?};

    D -- Yes --> E[Phase 2: Detailed Execution (Iterative)];
    E --> F[I. Code Audit & Cleanup];
    F --> F1[Analyze Entity Usage (Monorepo Search)];
    F --> F2[Analyze Script/Util Usage];
    F --> F3[Review Logging];

    E --> G[II. Build Process Optimization];
    G --> G1[Analyze generate-entities.ts];
    G --> G2[Analyze tsup.config.cts];
    G --> G3[Verify Type Definitions];
    G --> G4[Datasource Consistency for CLI];

    E --> H[III. Migration Process Refinement];
    H --> H1[Review Generation Commands];
    H --> H2[Handwritten vs. Auto-generated Strategy];
    H --> H3[Atomicity & Naming];
    H --> H4[PGlite Migration Testing];

    E --> I[IV. README.md Enhancement];
    I --> I1[Full Content Review & Update];
    I --> I2[Clarity, Completeness, New Sections];

    E --> J[V. Trigger Mechanism Automation];
    J --> J1[Design Automation Script/Process];

    E --> K[VI. General Improvements];
    K --> K1[Dependency Review];
    K --> K2[Test Suite Assessment];
    K --> K3[Error Handling & DX];

    subgraph Deliverables
        F ---> L[List of Code to Prune]
        G ---> M[Build & Type Def Recs]
        H ---> N[Migration Workflow Recs]
        I ---> O[Revised README Content]
        J ---> P[Trigger Automation Plan]
        K ---> Q[Misc. Improvement List]
    end

    Q --> R{Consolidated Recommendations & Final Review};
    R --> S[User Confirms Plan Completion];
    S --> T[Offer to Write Plan to MD File];
    T --> U[Switch to Implementation Mode (e.g., Code Mode)];

    D -- No --> C;