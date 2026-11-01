#!/usr/bin/env node
/**
 * Builds the public mirror of this repository.
 *
 *   node scripts/mirror.mjs <target-dir>
 *
 * Copies only the paths listed in ALLOW into <target-dir> (which is normally a
 * clone of the public repo), after removing everything there except .git, so
 * the public tree is always exactly the allow-list and nothing else. Internal
 * material (docs/, memory/, MAINNET_LOG.md, .claude/, secrets, env files,
 * build output, dependencies) never leaves this repo. The files under mirror/
 * become the public repo's root README, LICENSE, SECURITY and CONTRIBUTING.
 *
 * Runs in GitHub Actions on every push to main (.github/workflows/mirror.yml)
 * and can be run by hand for the first publish.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] && path.resolve(process.argv[2])
if (!target) {
  console.error('usage: node scripts/mirror.mjs <target-dir>')
  process.exit(1)
}
if (path.resolve(target) === ROOT || ROOT.startsWith(target + path.sep)) {
  console.error('target must be outside this repository')
  process.exit(1)
}

/** Directories and files that go public, relative to the repo root. */
const ALLOW = ['web', 'payx/contracts', 'payx/extension', 'payx/tools', 'payx/branding', 'safe', 'scripts/mirror.mjs', 'docs/ADDRESS_BOOK.md', 'OLYMPIX_SUBMISSION.md', '.gitignore']

/** Root files of the public repo, taken from mirror/. */
const ROOT_FILES = { 'mirror/README.md': 'README.md', 'mirror/LICENSE': 'LICENSE', 'mirror/SECURITY.md': 'SECURITY.md', 'mirror/CONTRIBUTING.md': 'CONTRIBUTING.md' }

/** Never copied, wherever they appear. */
const SKIP_NAMES = new Set(['node_modules', '.next', '.data', '.vercel', 'out', 'dist', 'cache', 'artifacts', 'coverage', 'broadcast', 'secrets', '.DS_Store', 'Thumbs.db', 'tsconfig.tsbuildinfo', 'next-env.d.ts'])
const SKIP_PATTERNS = [/^\.env(\..*)?$/, /\.local$/, /\.key$/, /\.pem$/, /\.zip$/, /^oracle-key/]
const KEEP_ENV_EXAMPLE = /^\.env\.example$/

function skip(name) {
  if (KEEP_ENV_EXAMPLE.test(name)) return false
  if (SKIP_NAMES.has(name)) return true
  return SKIP_PATTERNS.some((re) => re.test(name))
}

function copyTree(src, dst) {
  const st = fs.statSync(src)
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      if (skip(entry)) continue
      copyTree(path.join(src, entry), path.join(dst, entry))
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
}

// 1. empty the target, keeping its .git
fs.mkdirSync(target, { recursive: true })
for (const entry of fs.readdirSync(target)) {
  if (entry === '.git') continue
  fs.rmSync(path.join(target, entry), { recursive: true, force: true })
}

// 2. copy the allow-list
let copied = 0
for (const rel of ALLOW) {
  const src = path.join(ROOT, rel)
  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${rel}`)
    continue
  }
  copyTree(src, path.join(target, rel))
  copied += 1
}
for (const [from, to] of Object.entries(ROOT_FILES)) {
  const src = path.join(ROOT, from)
  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${from}`)
    continue
  }
  fs.copyFileSync(src, path.join(target, to))
}

// 3. refuse to publish anything that looks like a secret
const SECRET_RE = /(PRIVATE_KEY\s*=\s*0x[0-9a-fA-F]{64}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----|xoxb-[0-9A-Za-z-]+|sk_live_[0-9A-Za-z]+)/
function scan(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.git') continue
    const p = path.join(dir, entry)
    if (fs.statSync(p).isDirectory()) {
      scan(p)
      continue
    }
    if (fs.statSync(p).size > 2_000_000) continue
    const text = fs.readFileSync(p, 'latin1')
    if (SECRET_RE.test(text)) {
      console.error(`refusing to publish: ${path.relative(target, p)} looks like it holds a secret`)
      process.exit(2)
    }
  }
}
scan(target)

console.log(`mirror ready at ${target}: ${copied} allow-listed paths + ${Object.keys(ROOT_FILES).length} root files`)
