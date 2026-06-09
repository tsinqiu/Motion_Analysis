<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载活动列表"
      message="正在读取 Activities 与 Sessions 聚合结果。"
    />
    <StateBlock
      v-else-if="error"
      title="活动列表加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="overline">Activities</p>
          <h2>运动活动列表</h2>
        </div>
        <span>{{ activities.length }} 条记录</span>
      </div>
      <StateBlock
        v-if="activities.length === 0"
        title="暂无活动"
        message="当前数据源没有返回运动活动。"
      />
      <ActivityTable v-else :activities="activities" @select="goToActivity" />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import ActivityTable from '@/components/ActivityTable.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { getActivities } from '@/services/activities'

const router = useRouter()
const { data, error, load, loading } = useAsyncData(getActivities)
const activities = computed(() => data.value || [])

function goToActivity(activity) {
  router.push(`/activities/${activity.id}`)
}
</script>
