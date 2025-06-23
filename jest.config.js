const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/token-api$': '<rootDir>/src/__mocks__/@lib/token-api.ts',
    '^@farcaster/frame-sdk$': '<rootDir>/src/__mocks__/@farcaster/frame-sdk.ts',
    '^@upstash/redis$': '<rootDir>/src/__mocks__/@upstash/redis.ts',
    '^clanker-sdk$': '<rootDir>/src/__mocks__/clanker-sdk.ts',
    '^@neynar/nodejs-sdk$': '<rootDir>/src/__mocks__/@neynar/nodejs-sdk.ts',
    '^viem$': '<rootDir>/src/__mocks__/viem.ts',
    '^lucide-react$': '<rootDir>/src/__mocks__/lucide-react.tsx',
    '^@radix-ui/react-slider$': '<rootDir>/src/__mocks__/@radix-ui/react-slider.tsx',
    '^@radix-ui/react-radio-group$': '<rootDir>/src/__mocks__/@radix-ui/react-radio-group.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@farcaster/frame-sdk|@upstash/redis|uncrypto|clanker-sdk|zod|viem|abitype)/)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)