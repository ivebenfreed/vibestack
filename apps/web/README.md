# Vibestack Web App

The web frontend for Vibestack - a modern full-stack application with real-time sync capabilities.

## Features

- Real-time data synchronization
- Modern React UI with ShadcnUI components
- TypeScript throughout
- Responsive design with dark/light mode
- Database integration with PGlite
- State management with XState

## Tech Stack

- **Framework:** React + Vite
- **UI:** [Shadcn/UI](https://ui.shadcn.com/) (TailwindCSS + RadixUI) - MIT Licensed
- **Routing:** TanStack Router
- **Database:** PGlite (PostgreSQL in WebAssembly)
- **Sync:** WebSocket-based real-time sync
- **State Management:** XState for complex state machines
- **Type Safety:** TypeScript

## UI Components Attribution

This web application is built using [Shadcn/UI](https://ui.shadcn.com/), an excellent collection of reusable components. The UI design patterns and component organization draw inspiration from Shadcn-based admin dashboard templates available in the open-source community.

- **Component Library:** Shadcn/UI (MIT License)
- **Design Patterns:** Inspired by modern admin dashboard templates
- **Styling:** Tailwind CSS with Shadcn/UI design tokens

## Development

This is part of the Vibestack monorepo. To run the web app:

```bash
# From the monorepo root
pnpm install
pnpm run dev:web
```

## Architecture

The web app features:
- Modular sync services for real-time data synchronization
- State machines for complex sync flow management
- PGlite for client-side PostgreSQL database
- Component-based UI architecture
