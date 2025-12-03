# Protera Marketplace

## Overview

Protera Marketplace is a Next.js-based e-commerce application that allows users to browse items and administrators to manage inventory. The application features a customer-facing storefront and an admin panel for CRUD operations on marketplace items. Built with React 19, Next.js 15, and TypeScript, it uses Supabase as the backend-as-a-service for data storage and real-time database operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 15 with React 19 and TypeScript
- **Rationale**: Next.js provides server-side rendering, optimized routing, and built-in API routes, making it ideal for building performant web applications with SEO benefits
- **Pages Router**: Uses the traditional pages directory structure (not App Router) for routing
- **Styling**: Tailwind CSS 4.0 for utility-first styling, with global CSS for base styles

**Key Pages**:
- `/` (index.tsx): Customer-facing marketplace displaying items from the database
- `/admin` (admin.tsx): Administrative interface for managing inventory (create, read, update, delete operations)
- `/api/hello`: Example API route demonstrating Next.js API capabilities

**State Management**: React hooks (useState, useEffect) for local component state
- No global state management library is currently implemented
- Each page independently fetches and manages its data

**TypeScript Configuration**:
- Strict mode disabled for more lenient type checking
- Target: ES2017 for broad compatibility
- JSX preserved for Next.js compilation

### Backend Architecture

**Backend-as-a-Service**: Supabase
- **Rationale**: Supabase provides instant PostgreSQL database, authentication, and real-time subscriptions without managing infrastructure
- **Client Configuration**: Initialized in `lib/supabaseClient.js` using environment variables
- **Authentication**: Not currently implemented but Supabase infrastructure is in place
- **Database Access**: Direct client-side queries using `@supabase/supabase-js` SDK

**Database Schema**:
- **Items Table**: Core entity for marketplace products
  - `id`: Primary key (number)
  - `title`: Product name (string)
  - `price`: Product price (number)
  - `stock`: Available inventory count (number)
  - `cover_url`: Product image URL (string)
  - `created_at`: Timestamp for sorting (optional, used for ordering)

**API Design**:
- Currently minimal API implementation
- Direct Supabase client usage from frontend components
- Example API route (`/api/hello`) demonstrates Next.js API route capabilities but is not used in production features

### Data Flow

**Read Operations**:
1. Component mounts and triggers `fetchItems()` via `useEffect`
2. Supabase client queries the Items table with ordering and optional limits
3. Data is stored in component state and rendered

**Write Operations** (Admin only):
1. Admin form captures item data
2. Form submission triggers Supabase insert/update/delete operations
3. Local state is refreshed after successful mutations

### Development Configuration

**Port Configuration**: Custom port 5000 with 0.0.0.0 binding for Replit compatibility
- Allows external access in cloud development environments
- Both dev and production servers configured identically

**Environment Requirements**:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key for public access
- `REPLIT_DOMAINS`: Comma-separated allowed origins for Replit environment

### Security Considerations

**Current State**:
- No authentication implemented on admin routes (security risk)
- Anonymous Supabase key used for all operations
- Row-level security (RLS) policies should be configured in Supabase but are not enforced in code

**Recommended Improvements**:
- Implement authentication for admin panel
- Use Supabase RLS policies to restrict write operations
- Move sensitive operations to API routes with server-side authentication

## External Dependencies

### Core Services

**Supabase** (`@supabase/supabase-js` v2.86.0)
- **Purpose**: Backend-as-a-Service providing PostgreSQL database and authentication infrastructure
- **Integration**: Client initialized in `lib/supabaseClient.js` with public environment variables
- **Database**: PostgreSQL accessed via Supabase REST API
- **Features Used**: Database queries (select, insert, update, delete, ordering)
- **Features Available but Unused**: Authentication, real-time subscriptions, storage

### Frontend Framework

**Next.js** (v15.2.3)
- **Purpose**: React framework for server-side rendering and optimized web applications
- **Features Used**: Pages router, API routes, development server, static optimization

**React** (v19.0.0) and **React DOM** (v19.0.0)
- **Purpose**: UI library for building component-based interfaces
- **Features Used**: Hooks (useState, useEffect), functional components

### Styling

**Tailwind CSS** (v4.0.15)
- **Purpose**: Utility-first CSS framework
- **Integration**: Configured via Next.js, imported in `_app.tsx`
- **Usage**: Currently limited; most styles are inline CSS objects

### Development Tools

**TypeScript** (v5.8.2)
- **Purpose**: Static type checking for JavaScript
- **Configuration**: Lenient settings with strict mode disabled

**ESLint** (v9.23.0) with **eslint-config-next** (v15.2.3)
- **Purpose**: Code linting and quality enforcement
- **Configuration**: Uses Next.js recommended rules

### Environment Configuration

**Replit Platform Integration**:
- Custom domain handling for `.replit.dev` and `.repl.co` domains
- Environment variables: `REPLIT_DOMAINS` for allowed origins
- Port binding configured for cloud development environment