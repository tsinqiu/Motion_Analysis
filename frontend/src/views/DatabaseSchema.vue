<template>
  <div class="page-stack">
    <section class="hero-panel schema-hero">
      <div>
        <p class="overline">MotionAnalysis schema</p>
        <h2>数据库结构与字段字典</h2>
        <p>
          本页按 dev 分支的 `database/sql/01_schema.sql` 整理 Activities、Sessions、ActivitySummaries、
          TrackPoints、Laps、Events、Metrics、FitMessages 等表结构，帮助前后端对齐字段口径。
        </p>
      </div>
      <div class="hero-actions">
        <RouterLink class="primary-link" to="/activities">查看活动数据</RouterLink>
        <RouterLink class="secondary-link inverse" to="/statistics">统计分析</RouterLink>
      </div>
    </section>

    <div class="schema-grid">
      <MetricCard label="数据表" :value="String(schemaStats.tableCount)" hint="MotionAnalysis" />
      <MetricCard label="字段数" :value="String(schemaStats.columnCount)" hint="结构字段" />
      <MetricCard label="关系数" :value="String(schemaStats.relationCount)" hint="外键链路" />
      <MetricCard label="索引表" :value="String(schemaStats.indexedTables)" hint="唯一键 + 查询索引" />

      <section class="panel schema-browser wide">
        <div class="panel-heading">
          <div>
            <p class="overline">Tables</p>
            <h2>表结构导航</h2>
          </div>
          <span>点击表名查看字段</span>
        </div>
        <div class="schema-table-tabs" role="list">
          <button
            v-for="table in databaseTables"
            :key="table.name"
            type="button"
            :class="{ active: table.name === selectedTableName }"
            @click="selectedTableName = table.name"
          >
            <strong>{{ table.name }}</strong>
            <span>{{ table.group }} · {{ table.columns.length }} fields</span>
          </button>
        </div>
      </section>

      <section v-if="selectedTable" class="panel schema-detail wide">
        <div class="panel-heading">
          <div>
            <p class="overline">{{ selectedTable.group }}</p>
            <h2>{{ selectedTable.name }}</h2>
          </div>
          <span>{{ selectedTable.columns.length }} fields</span>
        </div>
        <p class="schema-purpose">{{ selectedTable.purpose }}</p>
        <div class="table-wrap schema-field-table">
          <table>
            <thead>
              <tr>
                <th>字段</th>
                <th>类型</th>
                <th>约束 / 索引</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="column in selectedTable.columns" :key="column[0]">
                <td><code>{{ column[0] }}</code></td>
                <td>{{ column[1] }}</td>
                <td>
                  <span v-if="column[2]" class="type-pill">{{ column[2] }}</span>
                  <span v-else class="muted-text">普通字段</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel wide">
        <div class="panel-heading">
          <div>
            <p class="overline">Relations</p>
            <h2>核心关系链路</h2>
          </div>
        </div>
        <div class="schema-relations">
          <article v-for="relation in databaseRelations" :key="relation.join('-')">
            <strong>{{ relation[0] }}</strong>
            <span>{{ relation[2] }}</span>
            <strong>{{ relation[1] }}</strong>
          </article>
        </div>
      </section>

      <section class="panel wide">
        <div class="panel-heading">
          <div>
            <p class="overline">Data safety</p>
            <h2>结构与真实数据隔离</h2>
          </div>
        </div>
        <div class="schema-safety-list">
          <span>保留 schema、查询脚本、导入脚本和 API 契约。</span>
          <span>不提交 Garmin 原始 FIT/JSON/GPX/TCX、签名 URL、导入数据 SQL 或模型产物。</span>
          <span>前端只展示 mock 或后端 API 返回数据，不直连 MySQL。</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import MetricCard from '@/components/MetricCard.vue'
import { databaseRelations, databaseTables, schemaStats } from '@/mock/schema'

const selectedTableName = ref('Activities')

const selectedTable = computed(
  () => databaseTables.find((table) => table.name === selectedTableName.value) || databaseTables[0] || null,
)
</script>
