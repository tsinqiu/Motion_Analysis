<template>
  <RouterView v-if="route.meta.authLayout" />
  <AppShell v-else />
</template>

<script setup>
import { useRoute } from 'vue-router'

import AppShell from '@/components/AppShell.vue'

const route = useRoute()
</script>
