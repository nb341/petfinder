module.exports = {
  displayName: 'infra',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.steps.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/infrastructure/cdktn'
};
