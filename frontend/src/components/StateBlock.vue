<template>
  <section class="state-block" :class="tone">
    <strong>{{ title }}</strong>
    <p>{{ message }}</p>
    <button v-if="actionLabel" type="button" @click="$emit('action')">{{ actionLabel }}</button>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  actionLabel: {
    type: String,
    default: '',
  },
  tone: {
    type: String,
    default: 'neutral',
  },
})

defineEmits(['action'])
</script>
