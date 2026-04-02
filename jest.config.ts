import type { Config } from 'jest'
import { pathsToModuleNameMapper } from 'ts-jest'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 获取当前目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 读取tsconfig.json文件
const tsconfigPath = path.join(__dirname, 'tsconfig.json')
const tsconfigContent = readFileSync(tsconfigPath, 'utf-8')
const { compilerOptions } = JSON.parse(tsconfigContent)

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/app/**/*.{ts,tsx}', // 暂时排除App Router文件
    '!src/pages/**/*.{ts,tsx}',
    '!src/lib/**/*.ts',
    '!src/types/**/*.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['json', 'text', 'lcov', 'clover'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default config