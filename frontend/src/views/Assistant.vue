<template>
  <div class="assistant-page">
    <section class="assistant-header dark-panel">
      <div>
        <p class="overline">Local AI</p>
        <h2>AI 助手</h2>
        <p>围绕近期运动、训练负荷、恢复和今日安排提供建议。</p>
      </div>
      <span class="ai-mode-pill" :class="{ fallback: modelStatus.fallback }">
        {{ modelStatus.label }}
      </span>
    </section>

    <section class="assistant-surface">
      <div class="assistant-messages" ref="messageListRef">
        <article
          v-for="message in messages"
          :key="message.id"
          class="assistant-message"
          :class="message.role"
        >
          <div class="assistant-avatar">{{ message.role === 'user' ? userInitial : 'AI' }}</div>
          <div class="assistant-bubble">
            <p>{{ message.content }}</p>
          </div>
        </article>
        <article v-if="sending" class="assistant-message assistant">
          <div class="assistant-avatar">AI</div>
          <div class="assistant-bubble">
            <p>正在结合你的运动数据生成建议...</p>
          </div>
        </article>
      </div>

      <div class="assistant-prompts">
        <button
          v-for="prompt in quickPrompts"
          :key="prompt"
          type="button"
          @click="ask(prompt)"
        >
          {{ prompt }}
        </button>
      </div>

      <form class="assistant-composer" @submit.prevent="submit">
        <textarea
          v-model.trim="draft"
          rows="2"
          placeholder="问问近期训练、恢复状态或今天怎么安排..."
          @keydown.enter.exact.prevent="submit"
        ></textarea>
        <button class="primary-link" type="submit" :disabled="sending || !draft">
          <Send :size="16" />
          发送
        </button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { Send } from '@lucide/vue'

import { getAiHealth, sendAiMessage } from '@/services/ai'
import { authSession } from '@/stores/authStore'

const quickPrompts = ['今天适合训练吗？', '最近训练负荷怎么样？', '下一次跑步怎么安排？']
const messages = ref([
  {
    id: 1,
    role: 'assistant',
    content: '你好，我会基于你的运动记录和训练负荷给出简洁建议。目前不会保存聊天记录。',
  },
])
const draft = ref('')
const sending = ref(false)
const health = ref(null)
const messageListRef = ref(null)

const userInitial = computed(() => (authSession.user?.username || 'U').slice(0, 1).toUpperCase())
const modelStatus = computed(() => {
  if (!health.value) return { label: '检测中', fallback: true }
  if (health.value.status === 'ok') {
    const provider = health.value.activeProvider || health.value.provider
    if (provider === 'deepseek') return { label: `DeepSeek ${health.value.model || ''}`.trim(), fallback: false }
    if (provider === 'ollama') return { label: `Ollama ${health.value.model || ''}`.trim(), fallback: false }
    return { label: health.value.model || 'AI 在线', fallback: false }
  }
  return { label: '规则助手模式', fallback: true }
})

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

async function loadHealth() {
  try {
    health.value = await getAiHealth()
  } catch (_error) {
    health.value = { status: 'fallback' }
  }
}

async function ask(text) {
  draft.value = text
  await submit()
}

async function submit() {
  const content = draft.value.trim()
  if (!content || sending.value) return

  messages.value.push({ id: Date.now(), role: 'user', content })
  draft.value = ''
  sending.value = true
  scrollToBottom()

  try {
    const envelope = await sendAiMessage(content)
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: envelope.data?.content || '暂时没有生成有效建议。',
    })
    if (envelope.meta?.ai) {
      health.value = envelope.meta.ai.fallback
        ? { status: 'fallback' }
        : { status: 'ok', provider: envelope.meta.ai.provider, activeProvider: envelope.meta.ai.provider, model: envelope.meta.ai.model }
    }
  } catch (error) {
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: error instanceof Error ? error.message : 'AI 助手暂时不可用。',
    })
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

onMounted(loadHealth)
</script>
