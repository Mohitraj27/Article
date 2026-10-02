import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, stat, utimes } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { collectUploads } from '../scripts/uploads.js'

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'article-uploads-'))
  try { await run(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}

test('Markdown and same-name cover images become one listing', () => fixture(async directory => {
  await writeFile(path.join(directory, 'first-post.md'), '# My **first** article\n\nSome **content** here.')
  await writeFile(path.join(directory, 'first-post.jpg'), '')
  const articles = await collectUploads(directory)
  assert.equal(articles.length, 1)
  assert.equal(articles[0].title, 'My first article')
  assert.equal(articles[0].summary, 'Some content here.')
  assert.equal(articles[0].image, 'uploads/first-post.jpg')
  assert.equal(articles[0].kind, 'article')
}))

test('nested Markdown image references and filenames with spaces are supported', () => fixture(async directory => {
  await mkdir(path.join(directory, 'story'))
  await writeFile(path.join(directory, 'story', 'my story.md'), '# Story\n\n![Cover](my%20photo.png)\n\nText')
  await writeFile(path.join(directory, 'story', 'my photo.png'), '')
  const articles = await collectUploads(directory)
  assert.equal(articles.length, 1)
  assert.equal(articles[0].url, 'uploads/story/my%20story.md')
  assert.equal(articles[0].image, 'uploads/story/my%20photo.png')
}))

test('all images embedded in an article remain grouped rather than listed separately', () => fixture(async directory => {
  await mkdir(path.join(directory, 'assets'))
  await writeFile(path.join(directory, 'article.md'), '# Article\n\n![First](assets/first.png)\n\n![Animation](assets/second.gif)')
  await writeFile(path.join(directory, 'assets', 'first.png'), '')
  await writeFile(path.join(directory, 'assets', 'second.gif'), '')
  const articles = await collectUploads(directory)
  assert.equal(articles.length, 1)
  assert.equal(articles[0].image, 'uploads/assets/first.png')
}))

test('text, HTML, documents, and standalone images are listed; hidden files are ignored', () => fixture(async directory => {
  for (const file of ['notes.txt', 'page.html', 'report.pdf', 'photo.webp', '.gitkeep']) await writeFile(path.join(directory, file), 'Content')
  const articles = await collectUploads(directory)
  assert.equal(articles.length, 4)
  assert.equal(articles.find(article => article.id === 'notes.txt').body, 'Content')
  assert.equal(articles.find(article => article.id === 'page.html').kind, 'article')
  assert.equal(articles.find(article => article.id === 'report.pdf').kind, 'file')
  assert.equal(articles.find(article => article.id === 'photo.webp').kind, 'image')
}))

test('empty folders and very long content work without content truncation', () => fixture(async directory => {
  assert.deepEqual(await collectUploads(directory), [])
  const body = '# Long article\n\n' + 'Content\n'.repeat(100000)
  await writeFile(path.join(directory, 'long.md'), body)
  assert.equal((await collectUploads(directory))[0].body, body)
}))

test('local upload dates use file creation rather than rebuild or modification time', () => fixture(async directory => {
  const file = path.join(directory, 'dated.txt')
  await writeFile(file, 'An article')
  const info = await stat(file)
  const first = (await collectUploads(directory))[0]
  assert.equal(first.uploadedAt, (info.birthtimeMs > 0 ? info.birthtime : info.mtime).toISOString())
  if (info.birthtimeMs > 0) {
    await utimes(file, new Date('2020-01-01'), new Date('2020-01-01'))
    assert.equal((await collectUploads(directory))[0].uploadedAt, first.uploadedAt)
  }
}))

test('metadata overrides one article date and stays hidden across rebuilds', () => fixture(async directory => {
  await writeFile(path.join(directory, 'imported.md'), '# Imported article')
  await writeFile(path.join(directory, 'other.txt'), 'Another article')
  await writeFile(path.join(directory, '.metadata.json'), JSON.stringify({ 'imported.md': { uploadedAt: '2025-05-08' } }))
  const first = await collectUploads(directory)
  assert.equal(first.length, 2)
  assert.equal(first.find(article => article.id === 'imported.md').uploadedAt, '2025-05-08T00:00:00.000Z')
  const info = await stat(path.join(directory, 'other.txt'))
  assert.equal(first.find(article => article.id === 'other.txt').uploadedAt, (info.birthtimeMs > 0 ? info.birthtime : info.mtime).toISOString())
  assert.equal((await collectUploads(directory)).find(article => article.id === 'imported.md').uploadedAt, '2025-05-08T00:00:00.000Z')
}))

test('invalid date overrides are rejected instead of silently changed', () => fixture(async directory => {
  await writeFile(path.join(directory, 'article.txt'), 'Content')
  for (const uploadedAt of ['2025-02-30', '08/05/2025', 123]) {
    await writeFile(path.join(directory, '.metadata.json'), JSON.stringify({ 'article.txt': { uploadedAt } }))
    await assert.rejects(collectUploads(directory), /Invalid upload date/)
  }
}))