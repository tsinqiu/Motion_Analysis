<template>
  <div class="page-stack">
    <StateBlock
      v-if="loading"
      title="正在加载统计分析"
      message="正在读取运动类型聚合统计。"
    />
    <StateBlock
      v-else-if="error"
      title="统计分析加载失败"
      :message="error"
      action-label="重试"
      tone="danger"
      @action="load"
    />
    <StateBlock
      v-else-if="stats.length === 0"
      title="暂无统计数据"
      message="当前数据源没有返回运动类型聚合结果。"
    />

    <div v-else class="analytics-grid">
    <ChartPanel title="运动类型占比" eyebrow="stats API" :option="typeOption" />
    <ChartPanel title="类型距离统计" eyebrow="聚合查询" :option="distanceOption" />
    <section class="panel wide">
      <div class="panel-heading">
        <div>
          <p class="overline">SQL aggregation</p>
          <h2>统计分析接口预留</h2>
        </div>
      </div>
      <div class="stat-list">
        <article v-for="item in stats" :key="item.activity_type">
          <strong>{{ item.activity_type }}</strong>
          <span>{{ item.activity_count }} 次</span>
          <span>{{ formatDistance(item.total_distance_m) }}</span>
          <span>{{ formatAverageHeartRate(item.avg_heart_rate_bpm) }}</span>
        </article>
      </div>
    </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import ChartPanel from '@/components/ChartPanel.vue'
import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { getActivityTypeStats } from '@/services/stats'
import { formatDistance } from '@/utils/formatters'

const { data, error, load, loading } = useAsyncData(getActivityTypeStats)
const stats = computed(() => data.value || [])

function formatAverageHeartRate(value) {
  return Number.isFinite(value) ? `${Math.round(value)} bpm` : '--'
}

const typeOption = computed(() => ({
  color: ['#21d47b', '#2563eb', '#0f172a'],
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, textStyle: { color: '#5b6577' } },
  series: [
    {
      name: '活动类型',
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['50%', '45%'],
      label: { formatter: '{b}: {c} 次' },
      data: stats.value.map((item) => ({
        name: item.activity_type,
        value: item.activity_count,
      })),
    },
  ],
}))

const distanceOption = computed(() => ({
  color: ['#21d47b'],
  tooltip: { trigger: 'axis' },
  grid: { left: 56, right: 20, top: 30, bottom: 36 },
  xAxis: {
    type: 'category',
    data: stats.value.map((item) => item.activity_type),
    axisLine: { lineStyle: { color: '#d7dde8' } },
    axisLabel: { color: '#687385' },
  },
  yAxis: {
    type: 'value',
    name: 'm',
    axisLabel: { color: '#687385' },
    splitLine: { lineStyle: { color: '#ecf0f5' } },
  },
  series: [
    {
      name: '总距离',
      type: 'bar',
      barWidth: 36,
      data: stats.value.map((item) => item.total_distance_m),
    },
  ],
}))

</script>
