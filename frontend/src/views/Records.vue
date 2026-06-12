<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Personal bests</p>
          <h2>最佳记录</h2>
        </div>
        <button class="secondary-link" type="button" :disabled="isSyncing" @click="refreshRecords">
          <CloudUpload :size="17" />
          {{ isSyncing ? '同步中' : '同步' }}
        </button>
      </div>
    </section>

    <StateBlock v-if="loading" title="正在加载最佳记录" message="正在读取 personal-bests 聚合结果。" />
    <StateBlock v-else-if="error" title="最佳记录加载失败" :message="error" action-label="重试" tone="danger" @action="load" />

    <div v-else class="records-grid">
      <RecordGroup title="步数记录" :items="records.steps || []" />
      <RecordGroup title="跑步记录" :items="records.running || []" />
      <RecordGroup title="骑行记录" :items="records.cycling || []" />
      <RecordGroup title="游泳记录" :items="records.swimming || []" />
    </div>
  </div>
</template>

<script setup>
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CloudUpload, ChevronRight } from '@lucide/vue'

import StateBlock from '@/components/StateBlock.vue'
import { useAsyncData } from '@/composables/useAsyncData'
import { getPersonalBests } from '@/services/activities'

const router = useRouter()
const { data, error, load, loading } = useAsyncData(getPersonalBests, {})
const records = computed(() => data.value || {})
const isSyncing = ref(false)

async function refreshRecords() {
  isSyncing.value = true
  try {
    await load()
  } finally {
    isSyncing.value = false
  }
}

const RecordGroup = {
  props: {
    title: String,
    items: Array,
  },
  setup(props) {
    return () => h('section', { class: 'dark-panel record-group' }, [
      h('div', { class: 'section-heading' }, [
        h('div', [h('p', { class: 'overline' }, 'Record group'), h('h2', props.title)]),
      ]),
      h('div', { class: 'record-list' }, props.items.map((item) =>
        h('button', {
          type: 'button',
          disabled: !item.activityId,
          onClick: () => item.activityId && router.push(`/activities/${item.activityId}`),
        }, [
          h('span', item.label),
          h('strong', `${item.value ?? '--'}${item.unit ? ` ${item.unit}` : ''}`),
          h(ChevronRight, { size: 17 }),
        ]),
      )),
    ])
  },
}
</script>
