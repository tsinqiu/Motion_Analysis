import { exploreArticles } from '@/mock/garsync'
import { apiClient, unwrapApiResponse } from '@/services/http'
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
    username: row.username || '',
    userBio: row.userBio || row.user_bio || row.bio || '',
    videoUrl: row.videoUrl || row.video_url || '',
    videoOriginalName: row.videoOriginalName || row.video_original_name || '',
    videoSizeBytes: row.videoSizeBytes ?? row.video_size_bytes ?? null,
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

export async function createExploreArticle(payload) {
  if (useMockData()) {
    return normalizeArticle({
      ...payload,
      id: `mock-article-${Date.now()}`,
      username: 'Mock User',
      userBio: '热爱运动和课程分享',
      videoOriginalName: payload.video?.name || '',
      videoSizeBytes: payload.video?.size || null,
      publishedAt: new Date().toISOString(),
    })
  }

  const formData = new FormData()
  formData.append('type', payload.type)
  formData.append('title', payload.title)
  formData.append('summary', payload.summary || '')
  formData.append('content', payload.content || '')
  if (payload.video) {
    formData.append('video', payload.video)
  }

  const response = await apiClient.post('/explore/articles', formData)
  return normalizeArticle(unwrapApiResponse(response.data).data)
}
