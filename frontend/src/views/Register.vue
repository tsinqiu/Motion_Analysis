<template>
  <main class="auth-page">
    <section class="auth-card">
      <div class="auth-topline">
        <RouterLink class="auth-brand" to="/login">
          <span class="brand-mark">GS</span>
          <span>
            <strong>GarSync Motion</strong>
          </span>
        </RouterLink>
        <button class="theme-toggle auth-theme-toggle" type="button" @click="toggleTheme">
          <component :is="isNightTheme ? Sun : Moon" :size="16" />
          {{ isNightTheme ? '日间' : '夜晚' }}
        </button>
      </div>

      <div class="auth-heading">
        <p class="overline">创建账号</p>
        <h1>注册访问账号</h1>
        <p>新账号注册后会自动登录，可立即进入 Garmin 运动数据分析数据库系统。</p>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>用户名</span>
          <div class="input-with-icon">
            <UserRound :size="18" />
            <input v-model.trim="form.username" autocomplete="username" placeholder="2-80 个字符" required />
          </div>
        </label>

        <label>
          <span>邮箱</span>
          <div class="input-with-icon">
            <Mail :size="18" />
            <input v-model.trim="form.email" type="email" autocomplete="email" placeholder="name@example.com" required />
          </div>
        </label>

        <label>
          <span>密码</span>
          <div class="input-with-icon">
            <LockKeyhole :size="18" />
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="至少 8 位"
              required
            />
            <button class="icon-button subtle" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="17" />
              <Eye v-else :size="17" />
            </button>
          </div>
        </label>

        <label>
          <span>确认密码</span>
          <div class="input-with-icon">
            <LockKeyhole :size="18" />
            <input v-model="form.confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required />
          </div>
        </label>

        <p v-if="localError || authSession.error" class="form-error">{{ localError || authSession.error }}</p>

        <button class="auth-submit" type="submit" :disabled="authSession.loading">
          <UserRound :size="18" />
          {{ authSession.loading ? '注册中' : '注册并登录' }}
        </button>
      </form>

      <p class="auth-switch">
        已有账号？
        <RouterLink :to="{ name: 'login', query: route.query }">返回登录</RouterLink>
      </p>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, LockKeyhole, Mail, Moon, Sun, UserRound } from '@lucide/vue'

import { useThemeMode } from '@/composables/useThemeMode'
import { authSession, normalizeRedirect, signUp } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()
const { isNightTheme, toggleTheme } = useThemeMode()
const showPassword = ref(false)
const localError = ref('')
const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

function validate() {
  if (form.username.length < 2 || form.username.length > 80) {
    return '用户名需要 2-80 个字符'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    return '请输入有效邮箱'
  }
  if (form.password.length < 8) {
    return '密码至少 8 位'
  }
  if (form.password !== form.confirmPassword) {
    return '两次输入的密码不一致'
  }
  return ''
}

async function submit() {
  localError.value = validate()
  if (localError.value) return

  try {
    await signUp({
      username: form.username,
      email: form.email,
      password: form.password,
    })
    router.replace(normalizeRedirect(route.query.redirect))
  } catch {
    // authSession.error is rendered above.
  }
}
</script>
