<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Settings</p>
          <h2>设置</h2>
        </div>
        <span class="status-chip good">隐私优先</span>
      </div>
      <p class="muted-copy">前端不会保存真实邮箱、服务器账号、数据库密码或个人轨迹原始文件；`.env` 只保留本地。</p>
    </section>

    <section class="settings-grid">
      <label>
        <span>距离单位</span>
        <select v-model="settings.distanceUnit">
          <option>公里</option>
          <option>英里</option>
        </select>
      </label>
      <label>
        <span>体重单位</span>
        <select v-model="settings.weightUnit">
          <option>kg</option>
          <option>lb</option>
        </select>
      </label>
      <label>
        <span>温度单位</span>
        <select v-model="settings.temperatureUnit">
          <option>℃</option>
          <option>℉</option>
        </select>
      </label>
      <label>
        <span>配速显示</span>
        <select v-model="settings.paceUnit">
          <option>min/km</option>
          <option>min/mi</option>
        </select>
      </label>
      <label class="toggle-row">
        <span>隐藏地图起终点</span>
        <input v-model="settings.hideMapEndpoints" type="checkbox" />
      </label>
      <label class="toggle-row">
        <span>同步健康数据</span>
        <input v-model="settings.healthSync" type="checkbox" />
      </label>
    </section>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

import { userSettings } from '@/mock/garsync'

const settings = reactive({ ...userSettings })
</script>
