# Architecture Summary

This document provides a high-level overview of the technical architecture of the Vibestack application.

## Overall Architecture

*   **Monorepo:** The project is a monorepo using `pnpm` workspaces and `turbo`. This allows for a single repository to manage all the different parts of the application.
*   **Serverless Backend:** The backend is a serverless application running on Cloudflare Workers. This provides a scalable and cost-effective solution for the backend infrastructure.
*   **Single-Page Application (SPA):** The frontend is a single-page application built with React and Vite. This provides a modern and responsive user experience.
*   **Local-First:** The application is designed with a "local-first" architecture, using IndexedDB for local data storage and WebSockets for real-time synchronization. This allows the application to be used offline and reduces latency.

## Backend (`apps/server`)

*   **Framework:** [Hono](https://hono.dev/), a lightweight web framework for serverless environments.
*   **Language:** TypeScript.
*   **Platform:** [Cloudflare Workers](https://workers.cloudflare.com/).
*   **Database:** PostgreSQL, accessed via [Kysely](https://kysely.dev/), a type-safe SQL query builder.
*   **Authentication:** Custom authentication using `better-auth`, with support for multiple organizations.
*   **Real-time:** WebSockets are used for real-time communication with the frontend, handled by [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects/) (`SyncDO`).
*   **Stateful Components:** Cloudflare Durable Objects are used for stateful operations, such as managing user sessions, organization data, and real-time synchronization.
*   **Entity Management:** A custom "DataForge" system is used for managing business entities.

## Frontend (`apps/web`)

*   **Framework:** [React](https://react.dev/).
*   **Language:** TypeScript.
*   **Build Tool:** [Vite](https://vitejs.dev/).
*   **Routing:** [TanStack Router](https://tanstack.com/router/).
*   **State Management:** [Legend State](https://legendapp.com/open-source/state/), a reactive state management library.
*   **Local Storage:** IndexedDB, managed with [Dexie.js](https://dexie.org/).
*   **State Machines:** [XState](https://xstate.js.org/) is used for managing complex state transitions, such as the application initialization and authentication flow.
*   **Styling:** A custom themeing solution with a `ThemeProvider` and `FontProvider`.

## Data Flow

The data flow in the application is designed to be real-time and resilient. Here's a breakdown of how data flows between the frontend and backend:

1.  **Initial Data Load:** When the user first loads the application, the frontend fetches the initial data from the backend via a REST API. This data is then stored in the local IndexedDB database.
2.  **Real-time Updates:** The frontend establishes a WebSocket connection to the backend's `SyncDO` (Durable Object). The `SyncDO` is responsible for managing real-time data synchronization for a specific client.
3.  **Client-side Changes:** When the user makes a change in the application, the change is first saved to the local IndexedDB database. Then, the change is sent to the `SyncDO` via the WebSocket connection.
4.  **Server-side Processing:** The `SyncDO` receives the change and processes it. This may involve updating the main PostgreSQL database and notifying other clients of the change.
5.  **Broadcast to Clients:** The `SyncDO` broadcasts the change to all connected clients (except the one that initiated the change). The clients then update their local IndexedDB databases and the UI is updated reactively.

This data flow ensures that the application is always up-to-date and that changes are propagated to all clients in real-time.

## Authentication Flow

Authentication is handled by the `better-auth` library, which is a custom authentication solution. Here's how the authentication flow works:

1.  **Login:** The user enters their credentials on the login page. The frontend sends a request to the backend's `/api/auth/login` endpoint.
2.  **Session Creation:** The backend verifies the user's credentials and creates a new session. The session information is stored in the `session` table in the database.
3.  **Session Token:** The backend sends a session token back to the frontend. The session token is stored in an HTTP-only cookie.
4.  **Authenticated Requests:** For all subsequent requests, the frontend sends the session token in the `Cookie` header. The backend uses the session token to identify the user and authorize the request.
5.  **Multi-organization Support:** The `better-auth` library supports multiple organizations. The user's active organization is stored in the `session` table.

## State Management

The frontend uses Legend State for state management. Legend State is a reactive state management library that makes it easy to manage complex application state.

*   **Observables:** Legend State uses observables to represent the application state. Observables are values that can be observed for changes.
*   **Automatic Tracking:** Legend State automatically tracks dependencies between observables and components. When an observable changes, only the components that depend on that observable are re-rendered.
*   **Persistence:** Legend State is integrated with Dexie.js to persist the application state to IndexedDB. This allows the application to be used offline and to restore its state when the user returns.

## Database Schema

The database schema is defined using Kysely migrations. Here's a summary of the main tables:

*   **`user`:** Stores user information, such as name, email, and password.
*   **`session`:** Stores session information, such as the session token and the user's active organization.
*   **`account`:** Stores information about OAuth providers.
*   **`verification`:** Stores information about email verification.
*   **`organization`:** Stores information about organizations.
*   **`member`:** Stores the relationship between users and organizations.
*   **`invitation`:** Stores information about invitations to join an organization.
*   **`entity_schemas`:** Stores the JSON schema for the custom entities created by each organization.

## Deployment

The application is deployed to Cloudflare. Here's how the deployment process works:

*   **Backend:** The backend is deployed as a Cloudflare Worker. The `wrangler deploy` command is used to deploy the worker.
*   **Frontend:** The frontend is deployed as a static site to Cloudflare Pages. The `pnpm --filter vibestack-web cf:deploy` command is used to deploy the frontend.
*   **CI/CD:** The deployment process is automated using a CI/CD pipeline (not explicitly defined in the provided files, but a common practice).
