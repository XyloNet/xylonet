// Zips the extension for Chrome Web Store upload → payx-extension-v<version>.zip (next to this file).
import { execSync } from 'node:child_process'
import { readFileSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'))
const out = resolve(__dirname, `payx-extension-v${manifest.version}.zip`)
if (existsSync(out)) rmSync(out)
const files = ['manifest.json', 'background.js', 'content.js', 'content.css', 'popup.html', 'popup.js', 'popup.css', 'PRIVACY_POLICY.html', 'icons']
const list = files.map((f) => `'${f}'`).join(',')
execSync(`powershell -NoProfile -Command "Compress-Archive -Path ${list} -DestinationPath '${out}' -Force"`, { cwd: __dirname, stdio: 'inherit' })
console.log(`\nPacked: ${out}\nUpload at https://chrome.google.com/webstore/devconsole (new version ${manifest.version}).`)
