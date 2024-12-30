export default async function () {
    return {
      testEnvironment: 'node',
      roots: ['<rootDir>/'],
      testMatch: ['**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      testPathIgnorePatterns: [
        'cdk.out'
      ],
      watchPathIgnorePatterns: [
        '<rootDir>/.+\.js$',
        '<rootDir>/.+\.d.ts$'
      ]
    }
  };
  