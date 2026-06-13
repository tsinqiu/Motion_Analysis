<template>
  <div class="page-stack">
    <section class="app-hero">
      <div>
        <p class="overline">Explore</p>
        <h2>探索</h2>
        <p>训练课程、恢复建议和运动知识中心。生产模式只展示服务器 ExploreArticles 与推荐接口返回的内容。</p>
      </div>
    </section>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Content filters</p>
          <h2>内容筛选</h2>
        </div>
        <span class="status-chip" :class="isMockMode ? 'neutral' : 'good'">{{ isMockMode ? 'Mock mode' : '真实接口' }}</span>
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

    <StateBlock v-if="loading" title="正在加载探索内容" message="正在读取 ExploreArticles 和 recommendations。" />
    <StateBlock v-else-if="error" title="探索内容加载失败" :message="error" action-label="重试" tone="danger" @action="load" />
    <StateBlock v-else-if="articles.items.length === 0" title="暂无探索内容" message="服务器 ExploreArticles 当前为空；导入课程或文章后这里会自动展示。" />

    <template v-else>
      <div class="article-grid">
        <article v-for="article in articles.items" :key="article.id" class="dark-panel article-card">
          <span>{{ typeLabel(article.type) }}</span>
          <h3>{{ article.title }}</h3>
          <p>{{ article.summary || `${article.level} · ${article.readTime || '未标注时长'}` }}</p>
          <button class="secondary-link" type="button" @click="selected = article">查看课程</button>
        </article>
      </div>

      <section v-if="selected" class="dark-panel">
        <div class="section-heading">
          <div>
            <p class="overline">{{ typeLabel(selected.type) }}</p>
            <h2>{{ selected.title }}</h2>
          </div>
          <button class="secondary-link" type="button" @click="selected = null">关闭</button>
        </div>
        <p class="muted-copy">{{ selected.content || selected.summary || '该内容暂未填写正文。' }}</p>
      </section>

      <section class="dark-panel">
        <div class="section-heading">
          <div>
            <p class="overline">Recommendations</p>
            <h2>推荐内容</h2>
          </div>
        </div>
        <StateBlock v-if="recommendations.items.length === 0" title="暂无推荐" message="后端 recommendations 当前没有返回内容。" />
        <div v-else class="log-list">
          <span v-for="article in recommendations.items" :key="`rec-${article.id}`">
            {{ typeLabel(article.type) }} · {{ article.title }} · {{ article.summary || article.level || '暂无摘要' }}
          </span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

import StateBlock from '@/components/StateBlock.vue'
import { useMockData } from '@/services/api'
import { getExploreArticles, getExploreRecommendations } from '@/services/explore'

const isMockMode = useMockData()
const filters = reactive({ type: '', keyword: '' })
const articles = ref({ items: [] })
const recommendations = ref({ items: [] })
const selected = ref(null)
const loading = ref(false)
const error = ref('')

function typeLabel(type) {
  return { course: '课程', article: '文章', training_advice: '训练建议' }[type] || type || '内容'
}

async function load() {
  loading.value = true
  error.value = ''
  selected.value = null
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

watch(() => ({ ...filters }), load, { immediate: true })
</script>
