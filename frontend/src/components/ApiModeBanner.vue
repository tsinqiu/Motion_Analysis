<template>
  <section class="api-banner" :class="{ live: !isMock }">
    <div>
      <strong>{{ isMock ? '演示数据' : '实时数据' }}</strong>
      <span>{{ message }}</span>
    </div>
    <code v-if="isMock">{{ baseUrl }}</code>
  </section>
</template>

<script setup>
const isMock = import.meta.env.VITE_USE_MOCK !== 'false'
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const message = isMock
  ? '当前展示的是示例运动数据，适合快速浏览功能。'
  : '数据已连接到你的运动资料库，页面会自动读取最新记录。'
</script>
