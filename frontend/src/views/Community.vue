<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Sports community</p>
          <h2>运动圈</h2>
        </div>
        <span class="status-chip" :class="isMockMode ? 'neutral' : 'good'">{{ isMockMode ? 'Mock mode' : '真实接口' }}</span>
      </div>
      <form class="community-form" @submit.prevent="publish">
        <textarea v-model.trim="draft.content" maxlength="2000" placeholder="分享一次训练、恢复感受或数据库记录观察" />
        <div class="form-row">
          <select v-model="draft.visibility">
            <option value="private">私密</option>
            <option value="followers">关注者</option>
            <option value="public">公开</option>
          </select>
          <button class="primary-link" type="submit" :disabled="posting || !draft.content">
            <Send :size="16" />
            {{ posting ? '发布中' : '发布动态' }}
          </button>
        </div>
      </form>
      <p v-if="notice" class="success-copy">{{ notice }}</p>
    </section>

    <StateBlock
      v-if="loading"
      title="正在加载运动圈"
      message="正在读取 CommunityPosts。"
    />
    <StateBlock
      v-else-if="error"
      title="运动圈加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />
    <StateBlock
      v-else-if="posts.items.length === 0"
      title="暂无动态"
      message="服务器 CommunityPosts 暂无公开内容。"
    />

    <div v-else class="community-feed">
      <article v-for="post in posts.items" :key="post.id" class="dark-panel post-card">
        <div class="post-head">
          <span class="avatar">{{ post.username.slice(0, 1).toUpperCase() }}</span>
          <div>
            <strong>{{ post.username }}</strong>
            <small>{{ post.activityType || visibilityLabel(post.visibility) }} · {{ formatDateTime(post.createdAt) }}</small>
          </div>
        </div>
        <p>{{ post.content }}</p>
        <div class="post-metrics">
          <span><small>可见性</small><b>{{ visibilityLabel(post.visibility) }}</b></span>
          <span><small>关联活动</small><b>{{ post.activityId || '--' }}</b></span>
          <span><small>评论</small><b>{{ post.commentCount }}</b></span>
          <span><small>分享</small><b>{{ post.shareCount }}</b></span>
        </div>
        <div class="post-actions">
          <button type="button" :disabled="busy" @click="toggleLike(post)">
            <Heart :size="16" /> {{ post.likeCount }}
          </button>
          <button type="button" :disabled="busy" @click="toggleComments(post)">
            <MessageCircle :size="16" /> 评论
          </button>
          <button type="button" :disabled="busy" @click="share(post)">
            <Share2 :size="16" /> 分享
          </button>
        </div>

        <div v-if="activePostId === post.id" class="comment-panel">
          <StateBlock v-if="commentsLoading" title="正在加载评论" message="正在读取 CommunityComments。" />
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
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Heart, MessageCircle, Send, Share2 } from '@lucide/vue'

import StateBlock from '@/components/StateBlock.vue'
import { useMockData } from '@/services/api'
import {
  createCommunityPost,
  createPostComment,
  getCommunityPosts,
  getPostComments,
  likePost,
  sharePost,
  unlikePost,
} from '@/services/community'

const isMockMode = useMockData()
const posts = ref({ items: [] })
const commentsByPost = ref({})
const draft = reactive({ content: '', visibility: 'public' })
const commentDraft = ref('')
const activePostId = ref('')
const loading = ref(false)
const commentsLoading = ref(false)
const posting = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')

const currentComments = computed(() => commentsByPost.value[activePostId.value] || { items: [] })

function visibilityLabel(value) {
  return { private: '私密', followers: '关注者', public: '公开' }[value] || value || '--'
}

function formatDateTime(value) {
  if (!value) return '--'
  return String(value).replace('T', ' ').slice(0, 19)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    posts.value = await getCommunityPosts({ page: 1, page_size: 20 })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '运动圈加载失败'
  } finally {
    loading.value = false
  }
}

async function publish() {
  posting.value = true
  error.value = ''
  notice.value = ''
  try {
    await createCommunityPost({ content: draft.content, visibility: draft.visibility })
    draft.content = ''
    notice.value = '动态已发布到服务器。'
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '动态发布失败'
  } finally {
    posting.value = false
  }
}

async function withPostAction(action, successMessage) {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
    notice.value = successMessage
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败'
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

function share(post) {
  return withPostAction(
    () => sharePost(post.id, 'copy_link'),
    '分享记录已写入服务器。',
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
    error.value = err instanceof Error ? err.message : '评论加载失败'
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

onMounted(load)
</script>
