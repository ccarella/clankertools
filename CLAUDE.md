# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15.3.3 application using the App Router pattern, intended for building tools related to Clanker (a token creation platform). The project uses TypeScript, Tailwind CSS v4, and is configured with shadcn/ui components.

## Essential Commands

```bash
# Development
npm run dev        # Start development server with Turbopack (http://localhost:3000)

# Production
npm run build      # Build for production
npm run start      # Start production server

# Code Quality
npm run lint       # Run ESLint
```

## Architecture & Key Technologies

### Tech Stack
- **Framework**: Next.js 15.3.3 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui (New York style)
- **Key Dependencies**: 
  - `clanker-sdk` - SDK for Clanker token platform integration
  - `@upstash/redis` - Serverless Redis client
  - `lucide-react` - Icon library

### Project Structure
- `src/app/` - Next.js App Router pages and layouts
- `src/lib/` - Utility functions and shared code
- `src/components/` - React components (will contain shadcn/ui components)
- Path alias: `@/*` maps to `./src/*`

### Important Configuration
- **TypeScript**: Configured with strict mode in `tsconfig.json`
- **Tailwind**: v4 with PostCSS, configuration in `tailwind.config.js`
- **shadcn/ui**: Configured in `components.json` with:
  - Style: new-york
  - CSS variables enabled
  - Component location: `@/components/ui`
  - Icons: lucide-react

### Development Notes
- The project uses Turbopack for faster development builds
- Environment variables are stored in `.env.local`
- No testing framework is currently configured
- No type checking command exists separately (TypeScript errors appear during build)

## When Adding Features

1. **Components**: Use shadcn/ui CLI to add components: `npx shadcn@latest add [component-name]`
2. **Styling**: Use Tailwind classes and CSS variables defined in `src/app/globals.css`
3. **Utilities**: Add shared functions to `src/lib/utils.ts`
4. **Clanker Integration**: Use the `clanker-sdk` for token-related functionality
5. **Caching/State**: Consider using `@upstash/redis` for serverless persistence