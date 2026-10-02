import './library.css'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { createIcons, BookOpen, ArrowUpRight, ArrowLeft, FileText, Search, UserRound, Mail } from 'lucide'
import { icon as brandIcon } from '@fortawesome/fontawesome-svg-core'
import { faGithub, faLinkedinIn } from '@fortawesome/free-brands-svg-icons'

const icons = { BookOpen, ArrowUpRight, ArrowLeft, FileText, Search, UserRound, Mail }
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`
const escapeText = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const siteBase = new URL('./', location.href)
const element = id => document.getElementById(id)
let articles = []

document.querySelector('#app').innerHTML = `
  <div class="layout">
  <aside class="sidebar"><a id="home" class="brand" href="./" aria-label="Articles home" title="All articles">${icon('book-open')}</a><div class="profile-details"><div class="profile-name">${icon('user-round')}<span>Mohit Raj</span></div><div class="social-links"><a href="https://www.linkedin.com/in/mohitraj27/" target="_blank" rel="noopener noreferrer" aria-label="Mohit Raj on LinkedIn" title="LinkedIn">${brandIcon(faLinkedinIn).html.join('')}</a><a href="https://github.com/Mohitraj27/" target="_blank" rel="noopener noreferrer" aria-label="Mohit Raj on GitHub" title="GitHub">${brandIcon(faGithub).html.join('')}</a><a href="mailto:mohit.raj2711@gmail.com" aria-label="Email Mohit Raj" title="Gmail: mohit.raj2711@gmail.com">${icon('mail')}</a></div></div></aside>
  <main>
    <section id="articles-view" aria-label="Article collection"><div class="list-heading"><span id="article-count" aria-live="polite"></span><label class="search-field">${icon('search')}<input id="search" type="search" aria-label="Search articles" placeholder="Search articles" autocomplete="off"></label></div><div id="article-list" aria-live="polite"><p class="status">Loading articles...</p></div></section>
    <section id="reader-view" hidden><div class="reader-tools"><button id="back" class="text-button">${icon('arrow-left')} All articles</button><a id="source-link" class="text-button" target="_blank" rel="noopener noreferrer">Open file ${icon('arrow-up-right')}</a></div><article id="reader" class="prose"></article></section>
    <p id="notice" class="status" role="status" hidden></p>
  </main>
  </div>
`

function refreshIcons() { createIcons({ icons, attrs: { 'stroke-width': 1.6 } }) }

function assetUrl(value) {
  const url = new URL(value, siteBase)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported file URL.')
  return url.href
}

function dateLabel(article) {
  const date = new Date(article.uploadedAt)
  if (Number.isNaN(date.getTime())) return ''
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `<time class="upload-date" datetime="${escapeText(article.uploadedAt)}" title="Upload date">${escapeText(label)}</time>`
}

function renderArticles() {
  const query = element('search').value.trim().toLocaleLowerCase()
  const filtered = articles.filter(article => `${article.title} ${article.summary} ${article.body}`.toLocaleLowerCase().includes(query))
  element('article-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`
  element('article-list').innerHTML = filtered.length ? filtered.map(article => `
    <button class="article-row" data-id="${escapeText(article.id)}">
      ${article.image ? `<img class="thumbnail" src="${escapeText(assetUrl(article.image))}" alt="" loading="lazy">` : ''}
      <div class="article-info"><div class="article-meta"><span class="file-type">${escapeText(article.format)}</span>${dateLabel(article)}</div><h2>${escapeText(article.title)}</h2>${article.summary ? `<p>${escapeText(article.summary)}</p>` : ''}</div>${icon('arrow-up-right')}
    </button>
  `).join('') : `<div class="empty-state">${icon('file-text')}<h2>${query ? 'No matching articles' : 'No articles yet'}</h2></div>`
  refreshIcons()
}

function showCollection() {
  element('articles-view').hidden = false
  element('reader-view').hidden = true
  element('notice').hidden = true
}

function openArticle(id) {
  const article = articles.find(item => item.id === id)
  if (!article) {
    showCollection()
    element('notice').textContent = 'Article not found.'
    element('notice').hidden = false
    return
  }
  const file = assetUrl(article.url)
  element('source-link').href = file
  let content = ''
  if (article.kind === 'image') content = `<img class="article-image" src="${escapeText(file)}" alt="${escapeText(article.title)}">`
  else if (article.kind === 'file') content = `<p><a href="${escapeText(file)}" target="_blank" rel="noopener noreferrer">Open ${escapeText(article.format.toUpperCase())} file ${icon('arrow-up-right')}</a></p>`
  else if (article.format === 'txt') content = `<div class="plain-text">${escapeText(article.body)}</div>`
  else {
    const html = article.format === 'html' || article.format === 'htm' ? article.body : marked.parse(article.body)
    content = DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'button'], FORBID_ATTR: ['style'] })
  }
  element('reader').innerHTML = `<div class="article-meta"><span class="file-type">${escapeText(article.format)}</span>${dateLabel(article)}</div><h1>${escapeText(article.title)}</h1><div id="article-content">${content}</div>`
  const heading = element('article-content').firstElementChild
  if (heading?.tagName === 'H1' && heading.textContent.trim() === article.title.trim()) heading.remove()
  for (const image of element('reader').querySelectorAll('img')) {
    const source = image.getAttribute('src')
    if (source) image.src = new URL(source, file).href
    image.loading = 'lazy'
  }
  if (article.kind === 'article' && article.image) {
    const coverUrl = assetUrl(article.image)
    if (![...element('reader').querySelectorAll('img')].some(image => image.src === coverUrl)) {
      const cover = document.createElement('img')
      cover.className = 'article-cover'
      cover.src = coverUrl
      cover.alt = `Image for ${article.title}`
      element('article-content').before(cover)
    }
  }
  for (const link of element('reader').querySelectorAll('a[href]')) {
    const href = link.getAttribute('href')
    if (href.startsWith('#')) continue
    link.href = new URL(href, file).href
    link.rel = 'noopener noreferrer'
  }
  element('articles-view').hidden = true
  element('reader-view').hidden = false
  element('notice').hidden = true
  document.title = `${article.title} | Articles`
  refreshIcons()
}

element('home').onclick = event => {
  event.preventDefault()
  const url = new URL(location.href)
  url.searchParams.delete('article')
  url.searchParams.delete('view')
  history.pushState(null, '', url)
  showCollection()
  document.title = 'Articles'
}
element('search').oninput = renderArticles
element('article-list').onclick = event => {
  const row = event.target.closest('[data-id]')
  if (!row) return
  const url = new URL(location.href)
  url.searchParams.delete('view')
  url.searchParams.set('article', row.dataset.id)
  history.pushState(null, '', url)
  openArticle(row.dataset.id)
  scrollTo({ top: 0 })
}
element('back').onclick = () => {
  const url = new URL(location.href)
  url.searchParams.delete('article')
  history.pushState(null, '', url)
  showCollection()
  document.title = 'Articles'
}
window.addEventListener('popstate', () => {
  const url = new URL(location.href)
  const id = url.searchParams.get('article')
  if (id) openArticle(id)
  else { showCollection(); document.title = 'Articles' }
})

async function initialize() {
  refreshIcons()
  const url = new URL(location.href)
  if (url.searchParams.get('view') === 'about') {
    url.searchParams.delete('view')
    history.replaceState(null, '', url)
    document.title = 'Articles'
  }
  try {
    const response = await fetch(new URL('articles.json', siteBase), { cache: 'no-store' })
    if (!response.ok) throw new Error('Articles could not be loaded. Please try again later.')
    const data = await response.json()
    const fields = ['id', 'title', 'body', 'summary', 'image', 'url', 'format', 'kind']
    if (!Array.isArray(data) || data.some(article => !article || fields.some(field => typeof article[field] !== 'string') || !['article', 'file', 'image'].includes(article.kind))) throw new Error('The article collection is invalid.')
    articles = data
    renderArticles()
    const id = url.searchParams.get('article')
    if (id) openArticle(id)
  } catch (error) {
    element('article-list').innerHTML = ''
    element('notice').textContent = error.message
    element('notice').hidden = false
  }
}

initialize()