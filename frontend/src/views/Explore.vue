<template>
  <div class="page-stack">
    <section class="app-hero">
      <div>
        <p class="overline">Explore</p>
        <h2>探索</h2>
        <p>训练课程、恢复建议和运动知识中心。当前内容为前端合成样例，后续可接 CMS 或后端内容接口。</p>
      </div>
    </section>

    <div class="article-grid">
      <article v-for="article in exploreArticles" :key="article.title" class="dark-panel article-card">
        <span>{{ article.category }}</span>
        <h3>{{ article.title }}</h3>
        <p>{{ article.level }} · {{ article.readTime }}</p>
        <button class="secondary-link" type="button">查看课程</button>
      </article>
    </div>
  </div>
</template>

<script setup>
import { exploreArticles } from '@/mock/garsync'
</script>
