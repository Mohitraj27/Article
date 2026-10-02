import { marked } from 'marked'
import { parseHTML } from 'linkedom'

export function imageReferences(tokens) {
  const references = []
  marked.walkTokens(tokens, token => {
    if (token.type === 'image') references.push({ href: token.href })
    else if (token.type === 'html') {
      const { document } = parseHTML(token.raw)
      for (const image of document.querySelectorAll('img[src]')) {
        const href = image.getAttribute('src')
        if (href) references.push({ href })
      }
    }
  })
  return references
}