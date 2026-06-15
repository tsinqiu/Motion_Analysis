<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>运动圈</h2>
        </div>
        <span class="status-chip good">动态</span>
      </div>
      <form class="community-form" @submit.prevent="publish">
        <textarea v-model.trim="draft.content" maxlength="2000" placeholder="分享一次训练、恢复感受或数据库记录观察" />
        <div class="community-options">
          <label>
            <span>可见范围</span>
            <select v-model="draft.visibility">
              <option value="private">私密</option>
              <option value="followers">关注者</option>
              <option value="public">公开</option>
            </select>
          </label>
          <label>
            <span>关联活动</span>
            <select v-model="draft.activityId">
              <option value="">不关联</option>
              <option v-for="activity in activityOptions" :key="activity.id" :value="activity.id">
                {{ formatActivityOption(activity) }}
              </option>
            </select>
          </label>
          <label class="upload-drop">
            <span>图片</span>
            <input :key="imageInputKey" type="file" accept="image/*" @change="handleImageChange" />
            <small>{{ imageLabel }}</small>
          </label>
        </div>
        <div class="form-row">
          <button class="primary-link" type="submit" :disabled="posting || !draft.content">
            <Send :size="16" />
            {{ posting ? '发布中' : '发布动态' }}
          </button>
        </div>
      </form>
      <p v-if="notice" class="success-copy">{{ notice }}</p>
      <p v-if="actionError" class="form-error">{{ actionError }}</p>
      <p v-if="activityLoadError" class="muted-copy">{{ activityLoadError }}</p>
    </section>

    <StateBlock
      v-if="loading"
      title="正在加载运动圈"
      message="正在读取运动动态。"
    />
    <StateBlock
      v-else-if="loadError"
      title="运动圈加载失败"
      :message="loadError"
      action-label="重试"
      tone="danger"
      @action="load"
    />
    <StateBlock
      v-else-if="posts.items.length === 0"
      title="暂无动态"
      message="当前暂无公开内容。"
    />

    <div v-else class="community-feed">
      <article v-for="post in posts.items" :key="post.id" class="dark-panel post-card">
        <div class="post-head">
          <span class="avatar">{{ post.username.slice(0, 1).toUpperCase() }}</span>
          <div>
            <strong>{{ post.username }}</strong>
            <small>{{ post.activityType || visibilityLabel(post.visibility) }} · {{ formatDateTime(post.createdAt) }}</small>
            <p v-if="post.userBio" class="author-bio">{{ post.userBio }}</p>
          </div>
          <button
            v-if="canFollow(post)"
            class="secondary-link compact-link follow-button"
            type="button"
            :disabled="busy"
            @click="toggleFollow(post)"
          >
            {{ post.followedByMe ? '已关注' : '关注' }}
          </button>
        </div>
        <p>{{ post.content }}</p>
        <button v-if="post.imageUrl" class="image-preview-trigger" type="button" @click="openImagePreview(post.imageUrl, post.content)">
          <img class="post-image" :src="post.imageUrl" alt="" />
        </button>
        <div class="post-metrics compact-metrics">
          <span><small>关联活动</small><b>{{ formatPostActivity(post) }}</b></span>
          <span><small>评论</small><b>{{ post.commentCount }}</b></span>
        </div>
        <div class="post-actions">
          <button type="button" :disabled="busy" @click="toggleLike(post)">
            <Heart :size="16" /> {{ post.likeCount }}
          </button>
          <button type="button" :disabled="busy" @click="toggleComments(post)">
            <MessageCircle :size="16" /> 评论
          </button>
        </div>

        <div v-if="activePostId === post.id" class="comment-panel">
          <StateBlock v-if="commentsLoading" title="正在加载评论" message="正在读取评论。" />
          <StateBlock v-else-if="currentComments.items.length === 0" title="暂无评论" message="可以添加第一条评论。" />
          <div v-else class="log-list">
            <span v-for="comment in currentComments.items" :key="comment.id">{{ comment.username }}：{{ comment.content }}</span>
          </div>
          <form class="comment-form" @submit.prevent="comment(post)">
            <input v-model.trim="commentDraft" maxlength="1000" placeholder="写评论" />
            <button class="secondary-link" type="submit" :disabled="busy || !commentDraft">发送</button>
          </form>
        </div>
      </article>
    </div>

    <div v-if="previewImage.url" class="image-lightbox" role="dialog" aria-modal="true" @click.self="closeImagePreview">
      <button class="lightbox-exit" type="button" @click="closeImagePreview">退出</button>
      <img :src="previewImage.url" :alt="previewImage.alt" />
      <p v-if="previewImage.alt">{{ previewImage.alt }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Heart, MessageCircle, Send } from '@lucide/vue'

import StateBlock from '@/components/StateBlock.vue'
import { getActivities } from '@/services/activities'
import {
  createCommunityPost,
  createPostComment,
  followUser,
  getCommunityPosts,
  getPostComments,
  likePost,
  unlikePost,
  unfollowUser,
} from '@/services/community'
import { authSession } from '@/stores/authStore'

const posts = ref({ items: [] })
const commentsByPost = ref({})
const activityOptions = ref([])
const draft = reactive({ content: '', visibility: 'public', activityId: '' })
const commentDraft = ref('')
const imageFile = ref(null)
const imageInputKey = ref(0)
const previewImage = ref({ url: '', alt: '' })
const activePostId = ref('')
const loading = ref(false)
const commentsLoading = ref(false)
const posting = ref(false)
const busy = ref(false)
const loadError = ref('')
const actionError = ref('')
const notice = ref('')
const activityLoadError = ref('')
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const currentComments = computed(() => commentsByPost.value[activePostId.value] || { items: [] })
const imageLabel = computed(() => {
  if (!imageFile.value) return '可选，支持常见图片格式，最大 10MB。'
  const mb = imageFile.value.size / 1024 / 1024
  return `${imageFile.value.name} · ${mb.toFixed(1)}MB`
})

function visibilityLabel(value) {
  return { private: '私密', followers: '关注者', public: '公开' }[value] || value || '--'
}

function formatDateTime(value) {
  if (!value) return '--'
  return String(value).replace('T', ' ').slice(0, 19)
}

function formatActivityOption(activity) {
  const date = String(activity.local_start_time || activity.start_time_utc || '').slice(0, 10)
  return [date, activity.activity_name || activity.activity_type || `活动 ${activity.id}`].filter(Boolean).join(' · ')
}

function formatPostActivity(post) {
  if (!post.activityId) return '--'
  return post.activityName || post.activityType || `活动 ${post.activityId}`
}

function handleImageChange(event) {
  const file = event.target.files?.[0] || null
  notice.value = ''
  actionError.value = ''
  if (!file) {
    imageFile.value = null
    return
  }
  if (!file.type.startsWith('image/')) {
    actionError.value = '请选择图片文件。'
    event.target.value = ''
    imageFile.value = null
    return
  }
  if (file.size > MAX_IMAGE_BYTES) {
    actionError.value = '图片文件不能超过 10MB。'
    event.target.value = ''
    imageFile.value = null
    return
  }
  imageFile.value = file
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    posts.value = await getCommunityPosts({ page: 1, page_size: 20 })
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '运动圈加载失败'
  } finally {
    loading.value = false
  }
}

async function loadActivityOptions() {
  activityLoadError.value = ''
  try {
    activityOptions.value = await getActivities({ page: 1, page_size: 50 })
  } catch (err) {
    activityLoadError.value = '关联活动列表暂不可用。'
  }
}

function openImagePreview(url, alt = '') {
  previewImage.value = { url, alt }
  document.body.classList.add('lightbox-open')
}

function closeImagePreview() {
  previewImage.value = { url: '', alt: '' }
  document.body.classList.remove('lightbox-open')
}

function handlePreviewKeydown(event) {
  if (event.key === 'Escape') {
    closeImagePreview()
  }
}

async function publish() {
  posting.value = true
  actionError.value = ''
  notice.value = ''
  try {
    await createCommunityPost({
      content: draft.content,
      visibility: draft.visibility,
      activityId: draft.activityId,
      image: imageFile.value,
    })
    draft.content = ''
    draft.activityId = ''
    imageFile.value = null
    imageInputKey.value += 1
    notice.value = '动态已发布。'
    await load()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '动态发布失败'
  } finally {
    posting.value = false
  }
}

async function withPostAction(action, successMessage) {
  busy.value = true
  actionError.value = ''
  notice.value = ''
  try {
    await action()
    notice.value = successMessage
    await load()
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '操作失败'
  } finally {
    busy.value = false
  }
}

function toggleLike(post) {
  return withPostAction(
    () => post.likedByMe ? unlikePost(post.id) : likePost(post.id),
    post.likedByMe ? '已取消点赞。' : '已点赞。',
  )
}

function canFollow(post) {
  return post.userId && Number(post.userId) !== Number(authSession.user?.id)
}

function toggleFollow(post) {
  return withPostAction(
    () => post.followedByMe ? unfollowUser(post.userId) : followUser(post.userId),
    post.followedByMe ? '已取消关注。' : '已关注。',
  )
}

async function toggleComments(post) {
  activePostId.value = activePostId.value === post.id ? '' : post.id
  if (!activePostId.value || commentsByPost.value[post.id]) return

  commentsLoading.value = true
  try {
    commentsByPost.value = {
      ...commentsByPost.value,
      [post.id]: await getPostComments(post.id, { page: 1, page_size: 20 }),
    }
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : '评论加载失败'
  } finally {
    commentsLoading.value = false
  }
}

async function comment(post) {
  await withPostAction(
    async () => {
      await createPostComment(post.id, { content: commentDraft.value })
      commentsByPost.value = {
        ...commentsByPost.value,
        [post.id]: await getPostComments(post.id, { page: 1, page_size: 20 }),
      }
      commentDraft.value = ''
    },
    '评论已发布。',
  )
}

onMounted(() => {
  load()
  loadActivityOptions()
  window.addEventListener('keydown', handlePreviewKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handlePreviewKeydown)
  document.body.classList.remove('lightbox-open')
})
</script>
