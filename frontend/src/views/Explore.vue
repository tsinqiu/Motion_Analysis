<template>
  <div class="page-stack">
    <section class="app-hero">
      <div>
        <h2>探索</h2>
        <p>上传锻炼视频课程，记录训练经验文章。</p>
      </div>
    </section>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>发布内容</h2>
        </div>
        <span class="status-chip good">课程 / 文章</span>
      </div>
      <form class="explore-upload-form" @submit.prevent="publish">
        <label>
          <span>类型</span>
          <select v-model="draft.type">
            <option value="course">课程视频</option>
            <option value="article">经验文章</option>
            <option value="training_advice">训练建议</option>
          </select>
        </label>
        <label>
          <span>标题</span>
          <input v-model.trim="draft.title" maxlength="200" placeholder="请输入标题" required />
        </label>
        <label class="settings-wide">
          <span>简介</span>
          <input v-model.trim="draft.summary" maxlength="500" placeholder="用一句话说明内容重点" />
        </label>
        <label class="settings-wide">
          <span>正文</span>
          <textarea v-model.trim="draft.content" maxlength="10000" placeholder="写下课程要点、训练经验或注意事项" />
        </label>
        <label class="settings-wide upload-drop">
          <span>{{ uploadLabel }}</span>
          <input :key="fileInputKey" type="file" :accept="uploadAccept" @change="handleMediaChange" />
          <small>{{ mediaLabel }}</small>
        </label>
        <div class="settings-actions">
          <button class="primary-link" type="submit" :disabled="publishing || !draft.title">
            {{ publishing ? '发布中' : '发布内容' }}
          </button>
          <span v-if="publishNotice" class="success-copy">{{ publishNotice }}</span>
        </div>
      </form>
    </section>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>内容筛选</h2>
        </div>
        <span class="status-chip good">内容库</span>
      </div>
      <div class="filter-grid">
        <label>
          <span>类型</span>
          <select v-model="filters.type">
            <option value="">全部</option>
            <option value="course">课程</option>
            <option value="article">文章</option>
            <option value="training_advice">训练建议</option>
          </select>
        </label>
        <label>
          <span>关键词</span>
          <input v-model.trim="filters.keyword" placeholder="标题 / 摘要" />
        </label>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载探索内容" message="正在读取内容库。" />
    <StateBlock v-else-if="error" title="探索内容加载失败" :message="error" action-label="重试" tone="danger" @action="load" />
    <StateBlock v-else-if="articles.items.length === 0" title="暂无探索内容" message="当前没有课程或文章内容。" />

    <template v-else>
      <div class="article-grid">
        <article v-for="article in articles.items" :key="article.id" class="dark-panel article-card">
          <span>{{ typeLabel(article.type) }}</span>
          <h3>{{ article.title }}</h3>
          <div v-if="expandedArticleId === article.id" class="article-detail-inline">
            <p>{{ article.summary || `${article.level} · ${article.readTime || '未标注时长'}` }}</p>
            <p class="muted-copy">{{ article.content || article.summary || '该内容暂未填写正文。' }}</p>
            <button v-if="article.imageUrl" class="image-preview-trigger" type="button" @click="openImagePreview(article.imageUrl, article.title)">
              <img class="content-image" :src="article.imageUrl" alt="" />
            </button>
            <small v-if="article.username" class="author-line">
              {{ article.username }}<template v-if="article.userBio"> · {{ article.userBio }}</template>
            </small>
            <small v-if="article.videoOriginalName" class="author-line">视频：{{ article.videoOriginalName }}</small>
            <a v-if="article.videoUrl" class="secondary-link inline-action" :href="article.videoUrl" target="_blank" rel="noreferrer">查看视频</a>
          </div>
          <button class="secondary-link" type="button" @click="toggleArticle(article)">
            {{ expandedArticleId === article.id ? '收起' : '查看课程' }}
          </button>
        </article>
      </div>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <h2>推荐内容</h2>
          </div>
        </div>
        <StateBlock v-if="recommendations.items.length === 0" title="暂无推荐" message="当前没有推荐内容。" />
        <div v-else class="log-list">
          <span v-for="article in recommendations.items" :key="`rec-${article.id}`">
            {{ typeLabel(article.type) }} · {{ article.title }} · {{ article.summary || article.level || '暂无摘要' }}
          </span>
        </div>
      </section>
    </template>

    <div v-if="previewImage.url" class="image-lightbox" role="dialog" aria-modal="true" @click.self="closeImagePreview">
      <button class="lightbox-exit" type="button" @click="closeImagePreview">退出</button>
      <img :src="previewImage.url" :alt="previewImage.alt" />
      <p v-if="previewImage.alt">{{ previewImage.alt }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

import StateBlock from '@/components/StateBlock.vue'
import { createExploreArticle, getExploreArticles, getExploreRecommendations } from '@/services/explore'

const filters = reactive({ type: '', keyword: '' })
const draft = reactive({ type: 'course', title: '', summary: '', content: '' })
const articles = ref({ items: [] })
const recommendations = ref({ items: [] })
const expandedArticleId = ref('')
const loading = ref(false)
const publishing = ref(false)
const error = ref('')
const publishNotice = ref('')
const mediaFile = ref(null)
const fileInputKey = ref(0)
const previewImage = ref({ url: '', alt: '' })
const MAX_VIDEO_BYTES = 200 * 1024 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const isCourse = computed(() => draft.type === 'course')
const uploadLabel = computed(() => isCourse.value ? '视频文件' : '图片文件')
const uploadAccept = computed(() => isCourse.value ? 'video/*' : 'image/*')
const mediaLabel = computed(() => {
  if (!mediaFile.value) {
    return isCourse.value
      ? '可选，支持常见视频格式，最大 200MB。'
      : '可选，支持常见图片格式，最大 10MB。'
  }
  const mb = mediaFile.value.size / 1024 / 1024
  return `${mediaFile.value.name} · ${mb.toFixed(1)}MB`
})

function typeLabel(type) {
  return { course: '课程', article: '文章', training_advice: '训练建议' }[type] || type || '内容'
}

async function load() {
  loading.value = true
  error.value = ''
  expandedArticleId.value = ''
  try {
    const params = { page: 1, page_size: 12, ...filters }
    const [nextArticles, nextRecommendations] = await Promise.all([
      getExploreArticles(params),
      getExploreRecommendations(params),
    ])
    articles.value = nextArticles
    recommendations.value = nextRecommendations
  } catch (err) {
    error.value = err instanceof Error ? err.message : '探索内容加载失败'
  } finally {
    loading.value = false
  }
}

function handleMediaChange(event) {
  const file = event.target.files?.[0] || null
  publishNotice.value = ''
  error.value = ''
  if (!file) {
    mediaFile.value = null
    return
  }
  const expectedPrefix = isCourse.value ? 'video/' : 'image/'
  if (!file.type.startsWith(expectedPrefix)) {
    error.value = isCourse.value ? '请选择视频文件。' : '请选择图片文件。'
    event.target.value = ''
    mediaFile.value = null
    return
  }
  const maxBytes = isCourse.value ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    error.value = isCourse.value ? '视频文件不能超过 200MB。' : '图片文件不能超过 10MB。'
    event.target.value = ''
    mediaFile.value = null
    return
  }
  mediaFile.value = file
}

function toggleArticle(article) {
  expandedArticleId.value = expandedArticleId.value === article.id ? '' : article.id
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
  publishing.value = true
  error.value = ''
  publishNotice.value = ''
  try {
    await createExploreArticle({
      ...draft,
      video: isCourse.value ? mediaFile.value : null,
      image: isCourse.value ? null : mediaFile.value,
    })
    Object.assign(draft, { type: 'course', title: '', summary: '', content: '' })
    mediaFile.value = null
    fileInputKey.value += 1
    publishNotice.value = '内容已发布。'
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '内容发布失败'
  } finally {
    publishing.value = false
  }
}

watch(() => draft.type, () => {
  mediaFile.value = null
  fileInputKey.value += 1
})

watch(() => ({ ...filters }), load, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', handlePreviewKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handlePreviewKeydown)
  document.body.classList.remove('lightbox-open')
})
</script>
