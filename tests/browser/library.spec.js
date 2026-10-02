import { test, expect } from '@playwright/test'
import { writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII='
const article = { id: 'stories/first.md', title: 'My first article', body: '# My first article\n\nPublic **content**.\n\n![Cover](cover.png)', summary: 'Public content.', image: 'uploads/stories/cover.png', url: 'uploads/stories/first.md', format: 'md', kind: 'article', uploadedAt: '2026-10-02T10:00:00.000Z' }

async function loadCollection(page, data = [article]) {
  await page.route('**/articles.json', route => route.fulfill({ json: data }))
  await page.route('**/uploads/stories/cover.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(image, 'base64') }))
}

test('manual uploads appear and disappear automatically from the real folder', async ({ page }) => {
  const filename = `local-upload-check-${Date.now()}`
  const directory = path.resolve('public/uploads')
  const markdown = path.join(directory, filename + '.md')
  const cover = path.join(directory, filename + '.png')
  await page.goto('/')
  try {
    await writeFile(markdown, '# Local upload check\n\nUploaded content.')
    await writeFile(cover, Buffer.from(image, 'base64'))
    const row = page.locator('.article-row').filter({ hasText: 'Local upload check' })
    await expect(row).toBeVisible({ timeout: 10000 })
    await expect(row.locator('img')).toBeVisible()
    await expect.poll(() => row.locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
    await rm(markdown)
    await rm(cover)
    await expect(row).toHaveCount(0, { timeout: 10000 })
  } finally {
    await rm(markdown, { force: true })
    await rm(cover, { force: true })
  }
})

test('only listings are visible; uploaded articles and images can be read', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await loadCollection(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Articles', exact: true })).toHaveCount(0)
  await expect(page.locator('.brand')).toHaveText('')
  await expect(page.locator('.brand svg')).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search articles' })).toBeVisible()
  await expect(page.locator('textarea, dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Write|Preview|Publish|Connect|Upload|Edit/ })).toHaveCount(0)
  await expect(page.locator('.article-row')).toHaveCount(1)
  await expect.poll(() => page.locator('.thumbnail').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  await page.locator('.article-row').click()
  await expect(page.locator('#reader h1')).toHaveCount(1)
  await expect(page.locator('#reader strong')).toHaveText('content')
  await expect(page.locator('#reader img')).toHaveAttribute('src', /\/uploads\/stories\/cover.png$/)
  await expect(page.locator('#reader img')).toHaveCount(1)
  await page.getByRole('button', { name: 'All articles' }).click()
  await expect(page.locator('#articles-view')).toBeVisible()
  await page.goBack()
  await expect(page.locator('#reader-view')).toBeVisible()
  expect(errors).toEqual([])
})

test('HTML is sanitized, text stays literal, and documents and images are listed', async ({ page }) => {
  await loadCollection(page, [
    { ...article, id: 'page.html', title: 'HTML page', body: '<p>Safe</p><script>alert(1)</script><img src="x" onerror="alert(1)">', format: 'html', image: '' },
    { ...article, id: 'notes.txt', title: 'Notes', body: '<b>Literal text</b>', format: 'txt', image: '' },
    { ...article, id: 'report.pdf', title: 'Report', body: '', kind: 'file', format: 'pdf', url: 'uploads/report.pdf', image: '' },
    { ...article, id: 'photo.png', title: 'Photo', body: '', kind: 'image', format: 'png', url: 'uploads/stories/cover.png' },
  ])
  await page.goto('/?article=page.html')
  await expect(page.locator('#reader')).toContainText('Safe')
  await expect(page.locator('#reader script, #reader [onerror]')).toHaveCount(0)
  await page.goto('/?article=notes.txt')
  await expect(page.locator('.plain-text')).toHaveText('<b>Literal text</b>')
  await expect(page.locator('.plain-text b')).toHaveCount(0)
  await page.goto('/?article=report.pdf')
  await expect(page.getByRole('link', { name: 'Open PDF file' })).toHaveAttribute('href', /\/uploads\/report.pdf$/)
  await page.goto('/?article=photo.png')
  await expect(page.locator('.article-image')).toBeVisible()
})

test('empty collections and failed loading have clear states', async ({ page }) => {
  await loadCollection(page, [])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No articles yet' })).toBeVisible()
  await page.route('**/articles.json', route => route.fulfill({ status: 500, body: '' }))
  await page.reload()
  await expect(page.locator('#notice')).toContainText('could not be loaded')
})

test('search filters titles and full content beside the matching item count', async ({ page }) => {
  await loadCollection(page, [article, { ...article, id: 'learning.txt', title: 'Reinforcement learning', body: 'Exploration and reward signals', summary: '', image: '', format: 'txt' }])
  await page.goto('/')
  await expect(page.locator('#article-count')).toHaveText('2 items')
  const search = page.getByRole('searchbox', { name: 'Search articles' })
  await search.fill('REINFORCEMENT')
  await expect(page.locator('.article-row')).toHaveCount(1)
  await expect(page.locator('#article-count')).toHaveText('1 item')
  await search.fill('exploration')
  await expect(page.locator('.article-row h2')).toHaveText('Reinforcement learning')
  await search.fill('missing')
  await expect(page.getByRole('heading', { name: 'No matching articles' })).toBeVisible()
  await expect(page.locator('#article-count')).toHaveText('0 items')
  await search.fill('')
  await expect(page.locator('.article-row')).toHaveCount(2)
  const countBounds = await page.locator('#article-count').boundingBox()
  const searchBounds = await search.boundingBox()
  expect(searchBounds.x).toBeGreaterThan(countBounds.x + countBounds.width)
})

test('profile name replaces About Me and social links remain visible on mobile', async ({ page }, testInfo) => {
  await loadCollection(page)
  await page.goto('/?view=about')
  await expect(page.locator('#articles-view')).toBeVisible()
  await expect(page).not.toHaveURL(/view=about/)
  await expect(page.locator('.profile-name')).toHaveText('Mohit Raj')
  await expect(page.locator('.profile-name svg')).toBeVisible()
  await expect(page.locator('#about-view, #about-nav')).toHaveCount(0)
  await expect(page.getByText('About Me', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Mohit Raj on LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/in/mohitraj27/')
  await expect(page.getByRole('link', { name: 'Mohit Raj on GitHub' })).toHaveAttribute('href', 'https://github.com/Mohitraj27/')
  await expect(page.getByRole('link', { name: 'Email Mohit Raj' })).toHaveAttribute('href', 'mailto:mohit.raj2711@gmail.com')
  await expect(page.locator('.social-links a').nth(2)).toHaveAccessibleName('Email Mohit Raj')
  await expect(page.locator('.social-links svg')).toHaveCount(3)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('.profile-name')).toBeInViewport()
    await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`), fullPage: true })
  }
})

test('repository links and mobile layouts work with rendered images', async ({ page }, testInfo) => {
  await loadCollection(page)
  await page.goto('/articles/')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.article-row')).toBeVisible()
    await expect.poll(() => page.locator('.thumbnail').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`listing-${width}.png`), fullPage: true })
  }
  await page.locator('.article-row').click()
  await expect(page.locator('#source-link')).toHaveAttribute('href', /\/articles\/uploads\/stories\/first.md$/)
  await page.reload()
  await expect(page.locator('#reader h1')).toHaveText('My first article')
})

test('upload dates and paired images appear in listings and inside text articles', async ({ page }) => {
  await loadCollection(page, [{ ...article, body: 'An article about learning through rewards.', format: 'txt' }])
  await page.goto('/')
  await expect(page.locator('.article-row time')).toHaveAttribute('datetime', article.uploadedAt)
  await expect(page.locator('.article-row time')).toHaveText('Oct 2, 2026')
  await page.locator('.article-row').click()
  await expect(page.locator('#reader time')).toHaveAttribute('datetime', article.uploadedAt)
  await expect(page.locator('#reader time')).toHaveText('Oct 2, 2026')
  await expect(page.locator('.article-cover')).toBeVisible()
  await expect.poll(() => page.locator('.article-cover').evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('.plain-text')).toHaveText('An article about learning through rewards.')
})