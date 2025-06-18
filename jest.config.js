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
    '^@farcaster/frame-sdk$': '<rootDir>/src/__mocks__/@farcaster/frame-sdk.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@farcaster/frame-sdk|@upstash/redis|uncrypto|clanker-sdk|zod|viem|abitype)/)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)