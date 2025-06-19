# Clanker Tools

![Test Coverage](https://img.shields.io/badge/coverage-92.1%25-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)
![License](https://img.shields.io/badge/license-MIT-green)

A Next.js application for building tools related to Clanker token creation platform, featuring Farcaster authentication and a modern, minimalist design.

## Features

- 🔐 **Farcaster Authentication** - Secure sign-in with Farcaster
- 📱 **Responsive Design** - Optimized for desktop and mobile
- ⚡ **High Performance** - < 3s load time, optimized bundles
- 🧪 **Comprehensive Testing** - 92% test coverage
- 🔒 **Security First** - No vulnerabilities, secure token handling
- 🎨 **Modern UI** - Built with shadcn/ui components

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Farcaster account (for authentication)

### Installation

```bash
# Clone the repository
git clone https://github.com/ccarella/clankertools.git
cd clankertools

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Development

### Available Scripts

```bash
# Development with Turbopack
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Lint code
npm run lint

# Type check
npx tsc --noEmit

# E2E tests (after installing Playwright)
npm run test:e2e:install
npx playwright test
```

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── providers/        # Context providers
│   └── ui/               # shadcn/ui components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions
├── types/                 # TypeScript type definitions
└── utils/                 # Helper functions
```

## Testing

### Test Coverage

| Type | Coverage |
|------|----------|
| Lines | 92% |
| Statements | 91.4% |
| Functions | 85% |
| Branches | 82.35% |

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage

# E2E tests
npx playwright test
```

## Performance

- **Average Page Size**: ~101 kB First Load JS
- **Load Time**: < 3 seconds on 3G
- **Lighthouse Score**: Optimized for Core Web Vitals

## Security

- ✅ 0 npm vulnerabilities
- ✅ Environment variables properly secured
- ✅ XSS protection via React
- ✅ No exposed authentication tokens

## Tech Stack

- **Framework**: [Next.js 15.3.3](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: [Farcaster Frame SDK](https://docs.farcaster.xyz/)
- **Testing**: [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/)
- **E2E Testing**: [Playwright](https://playwright.dev/)

## Quality Standards

- **Code Quality**: ESLint with Next.js configuration
- **Type Safety**: TypeScript strict mode enabled
- **Test Coverage**: Minimum 80% coverage requirement
- **Performance**: < 3 second load time requirement
- **Accessibility**: WCAG 2.1 AA compliance

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit your changes (`git commit -m 'feat: add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Documentation

- [Quality Review Report](./QUALITY_REVIEW.md) - Comprehensive code review
- [Claude AI Instructions](./CLAUDE.md) - AI assistant guidelines
- [API Documentation](./docs/api.md) - Coming soon

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Authentication via [Farcaster](https://www.farcaster.xyz/)