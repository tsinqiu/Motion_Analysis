<template>
  <div class="page-stack">
    <section class="dark-panel">
      <div class="section-heading">
        <div>
          <p class="overline">Sports community</p>
          <h2>运动圈</h2>
        </div>
        <button class="primary-link" type="button" @click="posted = true">
          <Send :size="16" />
          发布动态
        </button>
      </div>
      <p v-if="posted" class="success-copy">动态已保存到本地模拟信息流。</p>
    </section>

    <div class="community-feed">
      <article v-for="post in communityPosts" :key="post.id" class="dark-panel post-card">
        <div class="post-head">
          <span class="avatar">{{ post.user.slice(0, 1) }}</span>
          <div>
            <strong>{{ post.user }}</strong>
            <small>{{ post.type }} · 刚刚</small>
          </div>
        </div>
        <p>{{ post.text }}</p>
        <div class="post-metrics">
          <span><small>距离</small><b>{{ post.distance }}</b></span>
          <span><small>时长</small><b>{{ post.duration }}</b></span>
          <span><small>配速/速度</small><b>{{ post.pace }}</b></span>
        </div>
        <div class="post-actions">
          <button type="button"><Heart :size="16" /> {{ post.likes }}</button>
          <button type="button"><MessageCircle :size="16" /> 评论</button>
          <button type="button"><Share2 :size="16" /> 分享</button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Heart, MessageCircle, Send, Share2 } from '@lucide/vue'

import { communityPosts } from '@/mock/garsync'

const posted = ref(false)
</script>
