<template>
  <button class="phone-metric-tile" :class="{ active }" type="button">
    <component :is="icon" :size="24" aria-hidden="true" />
    <span>{{ label }}</span>
    <small>{{ unit }}</small>
  </button>
</template>

<script setup>
defineProps({
  icon: {
    type: [Object, Function],
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  unit: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: false,
  },
})
</script>
