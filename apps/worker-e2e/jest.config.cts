module.exports = {
  displayName: 'worker-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  // Scenarios wait up to 10s for the worker to log and exit.
  testTimeout: 30_000,
  testMatch: ['<rootDir>/src/**/*.steps.ts', '<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/worker-e2e',
};
