<template>
  <section class="panel chart-panel">
    <div class="panel-heading">
      <div>
        <p class="overline">{{ eyebrow }}</p>
        <h2>{{ title }}</h2>
      </div>
      <slot name="action" />
    </div>
    <div ref="chartRef" class="chart-canvas" role="img" :aria-label="title"></div>
  </section>
</template>

<script setup>
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

use([BarChart, CanvasRenderer, GridComponent, LegendComponent, LineChart, PieChart, TooltipComponent])

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  eyebrow: {
    type: String,
    default: '图表',
  },
  option: {
    type: Object,
    required: true,
  },
})

const chartRef = ref(null)
const chart = shallowRef(null)
let resizeObserver = null

function renderChart() {
  if (!chartRef.value) return

  if (!chart.value) {
    chart.value = init(chartRef.value)
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
