<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>管理中心</h2>
        </div>
        <button class="secondary-link" type="button" :disabled="usersLoading" @click="loadUsers">
          {{ usersLoading ? '刷新中' : '刷新' }}
        </button>
      </div>
      <p class="muted-copy">管理员可以添加用户、设置角色，并停用不再使用的账号。</p>
    </section>

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>添加用户</h2>
        </div>
      </div>
      <form class="admin-user-form" @submit.prevent="createUser">
        <label>
          <span>用户名</span>
          <input v-model.trim="newUser.username" required maxlength="80" placeholder="请输入用户名" />
        </label>
        <label>
          <span>邮箱</span>
          <input v-model.trim="newUser.email" required type="email" placeholder="用于登录" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="newUser.password" required minlength="8" type="password" placeholder="至少 8 位" />
        </label>
        <label>
          <span>角色</span>
          <select v-model="newUser.role">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </label>
        <button class="primary-link" type="submit" :disabled="usersBusy">
          {{ usersBusy ? '添加中' : '添加用户' }}
        </button>
      </form>
    </section>

    <StateBlock v-if="usersError" title="用户管理失败" :message="usersError" tone="danger" />

    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <h2>用户列表</h2>
        </div>
        <span class="status-chip good">{{ users.length }} 个账号</span>
      </div>
      <div class="table-wrap admin-users-table">
        <table>
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.username }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.role === 'admin' ? '管理员' : '普通用户' }}</td>
              <td>{{ user.status === 'active' ? '正常' : '已停用' }}</td>
              <td>
                <button
                  class="danger-link compact-link"
                  type="button"
                  :disabled="usersBusy || user.id === authSession.user?.id || user.status !== 'active'"
                  @click="disableUser(user)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'

import StateBlock from '@/components/StateBlock.vue'
import { createAdminUser, disableAdminUser, getAdminUsers } from '@/services/auth'
import { authSession } from '@/stores/authStore'

const users = ref([])
const usersLoading = ref(false)
const usersBusy = ref(false)
const usersError = ref('')
const newUser = reactive({
  username: '',
  email: '',
  password: '',
  role: 'user',
})

async function loadUsers() {
  usersLoading.value = true
  usersError.value = ''
  try {
    users.value = await getAdminUsers()
  } catch (err) {
    usersError.value = err instanceof Error ? err.message : '用户列表加载失败'
  } finally {
    usersLoading.value = false
  }
}

async function createUser() {
  usersBusy.value = true
  usersError.value = ''
  try {
    await createAdminUser(newUser)
    Object.assign(newUser, { username: '', email: '', password: '', role: 'user' })
    await loadUsers()
  } catch (err) {
    usersError.value = err instanceof Error ? err.message : '用户添加失败'
  } finally {
    usersBusy.value = false
  }
}

async function disableUser(user) {
  if (!window.confirm(`确定删除用户 ${user.username} 吗？该账号将无法继续登录。`)) return
  usersBusy.value = true
  usersError.value = ''
  try {
    await disableAdminUser(user.id)
    await loadUsers()
  } catch (err) {
    usersError.value = err instanceof Error ? err.message : '用户删除失败'
  } finally {
    usersBusy.value = false
  }
}

onMounted(loadUsers)
</script>
