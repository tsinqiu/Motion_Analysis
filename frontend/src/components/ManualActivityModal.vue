<template>
  <div class="modal-backdrop" role="presentation" @click.self="$emit('close')">
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="manual-activity-title">
      <header class="modal-header">
        <div>
          <p class="overline">Manual activity</p>
          <h2 id="manual-activity-title">{{ activity ? '编辑手动运动' : '手动添加运动' }}</h2>
        </div>
        <button class="icon-button" type="button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>

      <form class="manual-form" @submit.prevent="submit">
        <label>
          <span>运动名称</span>
          <input v-model="form.activityName" required maxlength="80" />
        </label>
        <label>
          <span>运动类型</span>
          <select v-model="form.activityType">
            <option value="running">跑步</option>
            <option value="cycling">骑行</option>
            <option value="swimming">游泳</option>
            <option value="strength_training">力量训练</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          <span>开始时间</span>
          <input v-model="form.localStartTime" type="datetime-local" required />
        </label>
        <label>
          <span>地点</span>
          <input v-model="form.locationName" maxlength="80" />
        </label>
        <label>
          <span>距离 (m)</span>
          <input v-model.number="form.distanceM" type="number" min="0" step="1" />
        </label>
        <label>
          <span>时长 (s)</span>
          <input v-model.number="form.durationS" type="number" min="0" step="1" required />
        </label>
        <label>
          <span>卡路里</span>
          <input v-model.number="form.calories" type="number" min="0" step="1" />
        </label>
        <label>
          <span>平均心率</span>
          <input v-model.number="form.avgHeartRateBpm" type="number" min="0" step="1" />
        </label>
        <label>
          <span>最大心率</span>
          <input v-model.number="form.maxHeartRateBpm" type="number" min="0" step="1" />
        </label>
        <label>
          <span>训练负荷</span>
          <input v-model.number="form.activityTrainingLoad" type="number" min="0" step="1" />
        </label>

        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="modal-actions">
          <button class="secondary-link" type="button" @click="$emit('close')">取消</button>
          <button class="primary-link" type="submit" :disabled="saving">{{ saving ? '保存中' : '保存' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

const props = defineProps({
  activity: {
    type: Object,
    default: null,
  },
  save: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['close', 'saved'])
const saving = ref(false)
const error = ref('')

const form = reactive({
  activityName: '',
  activityType: 'running',
  localStartTime: '',
  locationName: '',
  distanceM: 0,
  durationS: 1800,
  calories: 0,
  avgHeartRateBpm: null,
  maxHeartRateBpm: null,
  activityTrainingLoad: null,
})

function fillForm(activity) {
  form.activityName = activity?.activity_name || ''
  form.activityType = activity?.raw_activity_type || 'running'
  form.localStartTime = (activity?.local_start_time || new Date().toISOString().slice(0, 16)).replace(' ', 'T').slice(0, 16)
  form.locationName = activity?.location_name || ''
  form.distanceM = activity?.total_distance_m || 0
  form.durationS = activity?.total_timer_time_s || 1800
  form.calories = activity?.total_calories || 0
  form.avgHeartRateBpm = activity?.avg_heart_rate_bpm || null
  form.maxHeartRateBpm = activity?.max_heart_rate_bpm || null
  form.activityTrainingLoad = activity?.activity_training_load || null
}

watch(() => props.activity, fillForm, { immediate: true })

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      ...form,
      localStartTime: form.localStartTime.replace('T', ' '),
    }
    const result = await props.save(payload)
    emit('saved', result)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = false
  }
}
</script>
