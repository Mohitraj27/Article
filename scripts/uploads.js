import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'])
const textExtensions = new Set(['.md', '.markdown', '.txt', '.html', '.htm'])
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const executeFile = promisify(execFile)

async function uploadDate(directory, file, metadata) {
  const override = metadata[file]?.uploadedAt
  if (override !== undefined) {
    if (typeof override !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(override)) throw new Error(`Invalid upload date for ${file}. Use YYYY-MM-DD.`)
    const date = new Date(override + 'T00:00:00.000Z')
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== override) throw new Error(`Invalid upload date for ${file}. Use a real calendar date.`)
    return date.toISOString()
  }
  try {
    const { stdout } = await executeFile('git', ['log', '--follow', '--diff-filter=A', '--format=%cI', '--', file], { cwd: directory, windowsHide: true })
    const firstAdded = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)
    if (firstAdded && !Number.isNaN(Date.parse(firstAdded))) return new Date(firstAdded).toISOString()
  } catch {}
  const info = await stat(path.join(directory, file))
  return (info.birthtimeMs > 0 ? info.birthtime : info.mtime).toISOString()
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const relative = prefix + entry.name
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative + '/'))
    else if (entry.isFile()) files.push(relative)
  }
  return files.sort((first, second) => first.localeCompare(second, 'en'))
}

const fileUrl = file => 'uploads/' + file.split('/').map(encodeURIComponent).join('/')
const stem = file => file.slice(0, -path.posix.extname(file).length).toLowerCase()
const tokenText = tokens => tokens.map(token => token.type === 'image' || token.type === 'html' ? '' : token.tokens ? tokenText(token.tokens) : token.text || '').join('')

export async function collectUploads(directory) {
  await mkdir(directory, { recursive: true })
  let metadata = {}
  try {
    metadata = JSON.parse(await readFile(path.join(directory, '.metadata.json'), 'utf8'))
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Upload metadata must be a JSON object.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const files = await listFiles(directory)
  const images = files.filter(file => imageExtensions.has(path.posix.extname(file).toLowerCase()))
  const usedImages = new Set()
  const articles = []
  for (const file of files.filter(file => !images.includes(file))) {
    const extension = path.posix.extname(file).toLowerCase()
    const format = extension.slice(1) || 'file'
    let title = path.posix.basename(file, extension).replace(/[-_]/g, ' ')
    let body = ''
    let summary = ''
    let imageFile = images.find(image => stem(image) === stem(file))
    let image = imageFile ? fileUrl(imageFile) : ''
    if (textExtensions.has(extension)) {
      body = await readFile(path.join(directory, file), 'utf8')
      if (extension === '.md' || extension === '.markdown') {
        const tokens = marked.lexer(body)
        const heading = tokens.find(token => token.type === 'heading' && token.depth === 1)
        if (heading) title = tokenText(heading.tokens)
        const paragraph = tokens.find(token => token.type === 'paragraph')
        if (paragraph) summary = tokenText(paragraph.tokens).replace(/\s+/g, ' ').trim().slice(0, 200)
        marked.walkTokens(tokens, token => {
          if (token.type !== 'image' || /^https?:\/\//i.test(token.href)) return
          try {
            const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(token.href.split(/[?#]/)[0])))
            if (images.includes(relative)) usedImages.add(relative)
          } catch {}
        })
        if (!image) {
          let reference
          marked.walkTokens(tokens, token => { if (!reference && token.type === 'image') reference = token.href })
          if (reference && /^https?:\/\//i.test(reference)) image = reference
          else if (reference) {
            try {
              const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(reference.split(/[?#]/)[0])))
              if (images.includes(relative)) { imageFile = relative; image = fileUrl(relative) }
            } catch {}
          }
        }
      } else if (extension === '.txt') summary = body.replace(/\s+/g, ' ').trim().slice(0, 200)
    }
    if (imageFile) usedImages.add(imageFile)
    articles.push({ id: file, title, body, summary, image, url: fileUrl(file), format, kind: textExtensions.has(extension) ? 'article' : 'file', uploadedAt: await uploadDate(directory, file, metadata) })
  }
  for (const file of images.filter(image => !usedImages.has(image))) {
    articles.push({ id: file, title: path.posix.basename(file, path.posix.extname(file)).replace(/[-_]/g, ' '), body: '', summary: '', image: fileUrl(file), url: fileUrl(file), format: path.posix.extname(file).slice(1).toLowerCase(), kind: 'image', uploadedAt: await uploadDate(directory, file, metadata) })
  }
  return articles.sort((first, second) => first.title.localeCompare(second.title, 'en'))
}

export async function generateUploads(root = projectRoot) {
  const articles = await collectUploads(path.join(root, 'public', 'uploads'))
  await writeFile(path.join(root, 'public', 'articles.json'), JSON.stringify(articles, null, 2) + '\n')
  return articles
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const articles = await generateUploads()
  console.log(`Indexed ${articles.length} uploaded items.`)
}