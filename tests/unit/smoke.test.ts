import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('工程冒烟', () => {
  it('package.json 元信息正确', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'))
    expect(pkg.name).toBe('bethel-live')
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.main).toBe('./out/main/index.js')
  })
})
