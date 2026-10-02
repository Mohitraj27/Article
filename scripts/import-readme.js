import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'
import { projectRoot } from './uploads.js'
import { imageReferences } from './article-images.js'

const [owner, repository, branch = 'main'] = process.argv.slice(2)
if (!owner || !repository || !/^[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Usage: node scripts/import-readme.js OWNER REPOSITORY [BRANCH]')
const source = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
const rawBase = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}/`
const directory = path.join(projectRoot, 'public', 'uploads')
const destination = path.join(directory, `${repository}.md`)
try {
  await access(destination)
  throw new Error('An article with this filename already exists. Import stopped to avoid overwriting it.')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const response = await fetch(new URL('README.md', rawBase))
if (!response.ok) throw new Error(`Cannot fetch README (${response.status}).`)
const original = await response.text()
let body = original
const tokens = marked.lexer(original)
const images = imageReferences(tokens)
const headingPrefix = tokens.some(token => token.type === 'heading' && token.depth === 1) ? '' : `# ${repository.charAt(0).toUpperCase() + repository.slice(1).replace(/[-_]/g, ' ')}\n\n`
const downloads = new Map()
const extensions = { 'image/png': '.png', 'image/jpeg': '.jpeg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg' }

for (const image of images) {
  const url = new URL(image.href, rawBase)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('An image uses an unsupported URL scheme.')
  let local = downloads.get(url.href)
  if (!local) {
    const asset = await fetch(url)
    if (!asset.ok) throw new Error(`Cannot download image (${asset.status}): ${url.href}`)
    const type = asset.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    const extension = extensions[type]
    if (!extension) throw new Error(`Unsupported image content type: ${type}`)
    const filename = `${String(downloads.size + 1).padStart(2, '0')}${extension}`
    local = `${repository}-assets/${filename}`
    await mkdir(path.join(directory, `${repository}-assets`), { recursive: true })
    await writeFile(path.join(directory, local), Buffer.from(await asset.arrayBuffer()))
    downloads.set(url.href, local)
    console.log(`Downloaded ${local}`)
  }
  body = body.replaceAll(image.href, local)
}

await writeFile(destination, headingPrefix + body.trimEnd() + `\n\n---\n\nSource: [${owner}/${repository}](${source})\n`)
console.log(`Imported complete README (${original.length} characters) and ${downloads.size} images into ${repository}.md.`)