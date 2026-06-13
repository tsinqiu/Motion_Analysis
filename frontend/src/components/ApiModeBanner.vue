<template>
  <section class="api-banner" :class="{ live: !isMock }">
    <div>
      <strong>{{ isMock ? 'Mock 数据模式' : '后端 API 模式' }}</strong>
      <span>{{ message }}</span>
    </div>
    <code>{{ baseUrl }}</code>
  </section>
</template>

<script setup>
const isMock = import.meta.env.VITE_USE_MOCK !== 'false'
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const message = isMock
  ? '当前页面使用合成运动数据，适合后端接口完成前演示和联调。'
  : '当前页面会请求后端接口，请确认服务已启动且返回字段符合契约。'
</script>
