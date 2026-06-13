import { exploreArticles } from '@/mock/garsync'
import { collectionPayload, getEnvelope, useMockData } from '@/services/api'

function normalizeArticle(row = {}) {
  return {
    ...row,
    id: row.id || row.slug || row.title,
    title: row.title || '',
    type: row.type || row.category || 'article',
    category: row.category || row.type || 'article',
    level: row.level || row.difficulty || 'general',
    readTime: row.readTime || row.read_time || '',
    summary: row.summary || row.excerpt || row.description || '',
    content: row.content || '',
    publishedAt: row.publishedAt || row.published_at || '',
  }
}

function normalizePaged(payload) {
  const page = collectionPayload(payload)
  return {
    ...page,
    items: (page.items || []).map(normalizeArticle),
  }
}

export async function getExploreArticles(params = {}) {
  if (useMockData()) return normalizePaged(exploreArticles)

  const envelope = await getEnvelope('/explore/articles', { params })
  return normalizePaged(envelope.data)
}

export async function getExploreArticle(id) {
  if (useMockData()) return exploreArticles.map(normalizeArticle).find((article) => String(article.id) === String(id)) || null

  const envelope = await getEnvelope(`/explore/articles/${id}`, { normalizer: normalizeArticle })
  return envelope.data || null
}

export async function getExploreRecommendations(params = {}) {
  if (useMockData()) return normalizePaged(exploreArticles.slice(0, 2))

  const envelope = await getEnvelope('/explore/recommendations', { params })
  return normalizePaged(envelope.data)
}
