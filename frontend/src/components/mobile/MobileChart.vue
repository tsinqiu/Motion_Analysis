<template>
  <div ref="chartRef" class="mobile-chart" :style="{ height: `${height}px` }" role="img" :aria-label="label"></div>
</template>

<script setup>
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

use([BarChart, CanvasRenderer, GridComponent, LegendComponent, LineChart, TooltipComponent])

const props = defineProps({
  option: {
    type: Object,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  height: {
    type: Number,
    default: 220,
  },
})

const chartRef = ref(null)
const chart = shallowRef(null)
let resizeObserver = null

function renderChart() {
  if (!chartRef.value) return

  if (!chart.value) {
    chart.value = init(chartRef.value, 'dark')
  }

  chart.value.setOption(props.option, true)
}

function resizeChart() {
  chart.value?.resize()
}

onMounted(() => {
  renderChart()
  resizeObserver = new ResizeObserver(resizeChart)
  resizeObserver.observe(chartRef.value)
  window.addEventListener('resize', resizeChart)
})

watch(() => props.option, renderChart, { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', resizeChart)
  chart.value?.dispose()
})
</script>
