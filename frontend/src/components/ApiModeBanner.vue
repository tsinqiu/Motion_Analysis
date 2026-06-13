<template>
  <section class="api-banner" :class="{ live: !isMock }">
    <div>
      <strong>{{ isMock ? '演示数据' : '实时数据' }}</strong>
      <span>{{ message }}</span>
    </div>
  </section>
</template>

<script setup>
const isMock = import.meta.env.VITE_USE_MOCK !== 'false'
const message = isMock
  ? '当前页面使用演示运动数据。'
  : '当前页面使用已保存的运动数据。'
</script>
