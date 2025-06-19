# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working autonomously on this repository. You are an autonomous, test-driven development agent who uses GitHub Issues as your todo list.

## Project Overview

ClankerTools is a mobile-first Next.js 15.3.3 application that enables easy token creation on the Clanker platform through Farcaster integration. The app prioritizes simplicity, allowing users to launch tokens with minimal configuration in under 60 seconds.

## Your Development Workflow

1. **Check GitHub Issues** first for tasks and priorities
2. **Write tests BEFORE implementation** - We have 92% test coverage, maintain it!
3. **Run tests frequently** - Use `npm test` to verify your changes
4. **Lint before committing** - Run `npm run lint` to catch issues early
5. **Mobile-first development** - Test all features on mobile viewport sizes

## Essential Commands

```bash
# Development
npm run dev        # Start dev server with Turbopack (http://localhost:3000)
npm test          # Run Jest tests
npm test:watch    # Run tests in watch mode
npm run lint      # Run ESLint + TypeScript type checking

# Production
npm run build     # Build for production
npm run start     # Start production server

# Component Management
npx shadcn@latest add [component-name]  # Add new UI components
```

## Current Architecture

### Tech Stack
- **Framework**: Next.js 15.3.3 with App Router
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS v4 + shadcn/ui (New York style)
- **Testing**: Jest + React Testing Library (92% coverage)
- **Authentication**: Farcaster Frame SDK
- **Blockchain**: Clanker SDK for token deployment
- **Storage**: Upstash Redis (serverless)
- **Deployment**: Vercel

### Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (authenticated)/    # Protected routes
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── providers/         # React context providers
│   ├── token/            # Token-related components
│   └── wallet/           # Wallet connection components
├── lib/                   # Utilities and constants
└── __mocks__/            # Test mocks for external deps
```

### Key Features Implemented
- ✅ Simple Launch (one-tap token creation)
- ✅ Advanced Launch ("The Works" multi-step)
- ✅ Farcaster authentication
- ✅ Cast context support (launch from within casts)
- ✅ Wallet connection for creator rewards
- ✅ Token detail pages with metrics
- ✅ Mobile-responsive design
- ✅ Haptic feedback on mobile

### API Routes
- `POST /api/deploy/simple` - Deploy token with minimal config
- `POST /api/deploy/advanced` - Deploy with advanced options
- `POST /api/connectWallet` - Store wallet for creator rewards
- `GET /api/connectWallet?fid={fid}` - Retrieve stored wallet
- `GET /api/token/[address]` - Fetch token metrics
- `GET /api/frame/token/[address]` - Farcaster frame metadata

## Development Guidelines

### Test-Driven Development
1. **Write tests first** for new features
2. **Test file naming**: `__tests__/[feature].test.tsx`
3. **Mock external dependencies** - See `src/__mocks__/`
4. **Test mobile interactions** - Use mobile viewport in tests
5. **Maintain >90% coverage** - Check with `npm test -- --coverage`

### Code Style Rules
- **NO COMMENTS** unless absolutely necessary for complex logic
- **Prefer editing over creating** - Modify existing files when possible
- **Mobile-first CSS** - Start with mobile styles, enhance for desktop
- **Use existing patterns** - Check similar components before implementing
- **Type everything** - No `any` types, leverage TypeScript fully

### Component Development
```typescript
// Always check if component exists first
npx shadcn@latest add button

// Follow existing patterns in components/
// Mobile-first with proper touch targets (44px min)
// Use Tailwind classes, avoid inline styles
// Leverage existing providers (Farcaster, Haptic)
```

### State Management
- **Form State**: React Hook Form
- **Server State**: Direct API calls (consider React Query)
- **Auth State**: Farcaster Context Provider
- **Wallet State**: Stored in Upstash Redis

### Security Best Practices
- **Input validation** with Zod schemas
- **Sanitize file uploads** (5MB max, image types only)
- **No secrets in code** - Use environment variables
- **CORS headers** on all API routes
- **Rate limiting** per Farcaster ID (FID)

## Current MVP Requirements

### Still Needed for Launch
- [ ] Production deployment configuration
- [ ] Clanker production API keys
- [ ] Better wallet connection error handling
- [ ] iOS safe area handling
- [ ] Terms of Service page
- [ ] Privacy Policy page

### Post-MVP Features (Don't implement yet)
- Fair Launch mechanism
- Team/Project launch templates  
- Memecoin-specific features
- Token discovery/trending page
- Creator analytics dashboard

## Environment Variables

```bash
# Required for development
NEXT_PUBLIC_URL=http://localhost:3000
FARCASTER_APP_CLIENT_ID=
CLANKER_API_KEY=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
IPFS_GATEWAY_URL=

# Network configuration
NEXT_PUBLIC_NETWORK=base-sepolia  # or 'base' for mainnet
```

## Common Tasks

### Adding a New Page
1. Create route in `app/` directory
2. Add navigation in `BottomNavigation.tsx`
3. Write tests in `__tests__/` subdirectory
4. Ensure mobile responsiveness
5. Add to sitemap if public

### Implementing Token Features
1. Check `clanker-sdk` documentation
2. Use existing token components in `components/token/`
3. Store metadata in Redis if needed
4. Add proper error handling
5. Test on both Base and Base Sepolia

### Debugging Tips
- Check browser console for frame context issues
- Verify environment variables are set
- Test wallet connection on mobile devices
- Use Redux DevTools for state debugging
- Check Vercel logs for API errors

## Remember
- You're building for mobile-first Farcaster users
- Simplicity > Features
- Test everything, especially on mobile
- Check GitHub Issues for priorities
- Maintain the 92% test coverage