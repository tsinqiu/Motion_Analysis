import { communityPosts } from '@/mock/garsync'
import { apiClient, unwrapApiResponse } from '@/services/http'
import { collectionPayload, getEnvelope, mutateEnvelope, useMockData } from '@/services/api'

function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') return ''
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) return value
  if (!value.startsWith('/')) return value
  const baseUrl = apiClient.defaults.baseURL || ''
  if (baseUrl.startsWith('/')) return value
  try {
    return `${new URL(baseUrl).origin}${value}`
  } catch {
    return value
  }
}

let mockPosts = communityPosts.map((post, index) => normalizePost({
  id: post.id,
  userId: 9100 + index,
  username: post.user,
  userBio: '热爱运动和数据记录',
  content: post.text,
  activityType: post.type,
  likeCount: post.likes,
  commentCount: 0,
  shareCount: 0,
  visibility: 'public',
  createdAt: new Date().toISOString(),
}))
let mockComments = {}

export function normalizePost(row = {}) {
  return {
    ...row,
    id: row.id,
    username: row.username || row.user || 'User',
    userId: row.userId || row.user_id || null,
    userBio: row.userBio || row.user_bio || row.bio || '',
    content: row.content || row.text || '',
    activityType: row.activityType || row.activity_type || row.type || '',
    activityId: row.activityId || row.activity_id || null,
    activityName: row.activityName || row.activity_name || '',
    activityLocalStartTime: row.activityLocalStartTime || row.activity_local_start_time || '',
    visibility: row.visibility || 'public',
    imageUrl: resolveMediaUrl(row.imageUrl || row.image_url || row.imagePath || row.image_path || ''),
    imageOriginalName: row.imageOriginalName || row.image_original_name || '',
    imageSizeBytes: row.imageSizeBytes ?? row.image_size_bytes ?? null,
    likeCount: Number(row.likeCount ?? row.likes ?? 0),
    commentCount: Number(row.commentCount ?? 0),
    shareCount: Number(row.shareCount ?? 0),
    likedByMe: Boolean(row.likedByMe),
    followedByMe: Boolean(row.followedByMe),
    createdAt: row.createdAt || row.created_at || '',
  }
}

function normalizeComment(row = {}) {
  return {
    ...row,
    id: row.id,
    username: row.username || row.user || 'User',
    content: row.content || '',
    createdAt: row.createdAt || row.created_at || '',
  }
}

function normalizePaged(payload, normalizer) {
  const page = collectionPayload(payload)
  return {
    ...page,
    items: (page.items || []).map(normalizer),
  }
}

export async function getCommunityPosts(params = {}) {
  if (useMockData()) return normalizePaged(mockPosts, normalizePost)

  const envelope = await getEnvelope('/community/posts', { params })
  return normalizePaged(envelope.data, normalizePost)
}

export async function createCommunityPost(payload) {
  if (useMockData()) {
    const post = normalizePost({
      ...payload,
      id: `mock-post-${Date.now()}`,
      username: 'Mock User',
      imageUrl: payload.image ? URL.createObjectURL(payload.image) : '',
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
    })
    mockPosts = [post, ...mockPosts]
    return post
  }

  const formData = new FormData()
  formData.append('content', payload.content)
  formData.append('visibility', payload.visibility || 'public')
  if (payload.activityId) {
    formData.append('activityId', payload.activityId)
  }
  if (payload.image) {
    formData.append('image', payload.image)
  }

  const response = await apiClient.post('/community/posts', formData)
  return normalizePost(unwrapApiResponse(response.data).data)
}

export async function getPostComments(postId, params = {}) {
  if (useMockData()) return normalizePaged(mockComments[postId] || [], normalizeComment)

  const envelope = await getEnvelope(`/community/posts/${postId}/comments`, { params })
  return normalizePaged(envelope.data, normalizeComment)
}

export async function createPostComment(postId, payload) {
  if (useMockData()) {
    const comment = normalizeComment({
      ...payload,
      id: `mock-comment-${Date.now()}`,
      username: 'Mock User',
      createdAt: new Date().toISOString(),
    })
    mockComments[postId] = [comment, ...(mockComments[postId] || [])]
    mockPosts = mockPosts.map((post) => post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)
    return comment
  }

  const envelope = await mutateEnvelope('post', `/community/posts/${postId}/comments`, payload, { normalizer: normalizeComment })
  return envelope.data
}

export async function likePost(postId) {
  if (useMockData()) {
    mockPosts = mockPosts.map((post) =>
      post.id === postId ? { ...post, likedByMe: true, likeCount: post.likeCount + (post.likedByMe ? 0 : 1) } : post,
    )
    return { liked: true }
  }

  const envelope = await mutateEnvelope('post', `/community/posts/${postId}/like`, {})
  return envelope.data
}

export async function unlikePost(postId) {
  if (useMockData()) {
    mockPosts = mockPosts.map((post) =>
      post.id === postId ? { ...post, likedByMe: false, likeCount: Math.max(0, post.likeCount - (post.likedByMe ? 1 : 0)) } : post,
    )
    return { liked: false }
  }

  const envelope = await mutateEnvelope('delete', `/community/posts/${postId}/like`)
  return envelope.data
}

export async function sharePost(postId, channel = 'copy_link') {
  if (useMockData()) {
    mockPosts = mockPosts.map((post) => post.id === postId ? { ...post, shareCount: post.shareCount + 1 } : post)
    return { shared: true, channel }
  }

  const envelope = await mutateEnvelope('post', `/community/posts/${postId}/share`, { channel })
  return envelope.data
}

export async function followUser(userId) {
  if (useMockData()) {
    mockPosts = mockPosts.map((post) => Number(post.userId) === Number(userId) ? { ...post, followedByMe: true } : post)
    return { userId, following: true }
  }

  const envelope = await mutateEnvelope('post', `/community/users/${userId}/follow`, {})
  return envelope.data
}

export async function unfollowUser(userId) {
  if (useMockData()) {
    mockPosts = mockPosts.map((post) => Number(post.userId) === Number(userId) ? { ...post, followedByMe: false } : post)
    return { userId, following: false }
  }

  const envelope = await mutateEnvelope('delete', `/community/users/${userId}/follow`)
  return envelope.data
}
