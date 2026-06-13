<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">My activities</p>
          <h2>我的运动</h2>
        </div>
        <button class="primary-link" type="button" @click="openCreate">
          <Plus :size="17" />
          手动添加
        </button>
      </div>

      <SportTabs v-model="filters.activity_type" :items="sportFilters" />

      <div class="filter-grid">
        <label>
          <span>关键词</span>
          <input v-model.trim="filters.keyword" placeholder="地点 / 名称 / 类型" />
        </label>
        <label>
          <span>开始日期</span>
          <input v-model="filters.start_date" type="date" />
        </label>
        <label>
          <span>结束日期</span>
          <input v-model="filters.end_date" type="date" />
        </label>
        <label>
          <span>排序</span>
          <select v-model="filters.sort_by">
            <option value="local_start_time">时间</option>
            <option value="distance_m">距离</option>
            <option value="duration_s">时长</option>
            <option value="avg_heart_rate_bpm">平均心率</option>
            <option value="activity_training_load">训练负荷</option>
          </select>
        </label>
        <label>
          <span>顺序</span>
          <select v-model="filters.sort_order">
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
        </label>
      </div>
    </section>

    <StateBlock
      v-if="loading"
      title="正在加载运动记录"
      message="正在读取 Activities 与 Sessions 聚合结果。"
    />
    <StateBlock
      v-else-if="error"
      title="运动记录加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />
    <StateBlock
      v-else-if="activities.length === 0"
      title="暂无活动"
      message="当前筛选条件没有匹配的运动记录。"
    />

    <section v-else class="activity-list-section">
      <div class="list-meta">
        <span>{{ meta.total || activities.length }} 条记录</span>
        <span>第 {{ meta.page || 1 }} / {{ meta.totalPages || 1 }} 页</span>
      </div>
      <div class="activity-card-grid">
        <ActivityCard
          v-for="activity in activities"
          :key="activity.id"
          :activity="activity"
          @select="goToActivity"
        >
          <template #actions>
            <button v-if="activity.is_manual" type="button" @click.stop="openEdit(activity)">编辑</button>
          </template>
        </ActivityCard>
      </div>

      <div class="pagination-row">
        <button type="button" :disabled="filters.page <= 1" @click="filters.page -= 1">上一页</button>
        <button type="button" :disabled="filters.page >= (meta.totalPages || 1)" @click="filters.page += 1">下一页</button>
      </div>
    </section>

    <ManualActivityModal
      v-if="modalOpen"
      :activity="editingActivity"
      :save="saveManualActivity"
      @close="closeModal"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'

import ActivityCard from '@/components/ActivityCard.vue'
import ManualActivityModal from '@/components/ManualActivityModal.vue'
import SportTabs from '@/components/SportTabs.vue'
import StateBlock from '@/components/StateBlock.vue'
import { sportFilters } from '@/mock/garsync'
import { createManualActivity, getActivityPage, updateManualActivity } from '@/services/activities'
import { hasAuthToken, normalizeRedirect } from '@/stores/authStore'

const router = useRouter()
const activities = ref([])
const meta = ref({})
const error = ref('')
const loading = ref(false)
const modalOpen = ref(false)
const editingActivity = ref(null)

const filters = reactive({
  page: 1,
  page_size: 12,
  activity_type: 'all',
  keyword: '',
  start_date: '',
  end_date: '',
  sort_by: 'local_start_time',
  sort_order: 'desc',
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const envelope = await getActivityPage(filters)
    activities.value = envelope.data
    meta.value = envelope.meta
  } catch (err) {
    error.value = err instanceof Error ? err.message : '活动列表加载失败'
  } finally {
    loading.value = false
  }
}

function goToActivity(activity) {
  router.push(`/activities/${activity.id}`)
}

function openCreate() {
  if (!hasAuthToken()) {
    error.value = '请先登录后再手动添加运动'
    router.push({ name: 'login', query: { redirect: normalizeRedirect(router.currentRoute.value.fullPath) } })
    return
  }
  editingActivity.value = null
  modalOpen.value = true
}

function openEdit(activity) {
  if (!hasAuthToken()) {
    error.value = '请先登录后再编辑运动'
    router.push({ name: 'login', query: { redirect: normalizeRedirect(router.currentRoute.value.fullPath) } })
    return
  }
  editingActivity.value = activity
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

async function saveManualActivity(payload) {
  if (editingActivity.value) {
    return updateManualActivity(editingActivity.value.id, payload)
  }
  return createManualActivity(payload)
}

async function handleSaved() {
  closeModal()
  await load()
}

watch(
  filters,
  () => {
    if (filters.page < 1) filters.page = 1
    load()
  },
  { deep: true, immediate: true },
)
</script>
