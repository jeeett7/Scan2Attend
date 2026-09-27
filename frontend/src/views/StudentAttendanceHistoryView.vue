<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const history = ref([])
const isLoading = ref(true)
const message = ref('')

const presentCount = computed(() =>
  history.value.filter((item) => item.attendanceStatus === 'Present').length
)
const absentCount = computed(() => history.value.length - presentCount.value)

function authHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('scan2attend_token')}` } }
}

function logout() {
  localStorage.removeItem('scan2attend_token')
  localStorage.removeItem('scan2attend_user')
  router.push('/')
}

function formatDate(date) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

async function loadHistory() {
  isLoading.value = true
  message.value = ''

  try {
    const response = await axios.get(`${apiUrl}/student/attendance-history`, authHeaders())
    history.value = response.data.history
  } catch (error) {
    if (error.response?.status === 401) return logout()
    message.value = error.response?.data?.message || 'Could not load attendance history.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadHistory)
</script>

<template>
  <div class="page">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="brand-icon">✓</div><div><strong class="wordmark">Scan<span>2</span>Attend</strong><small>STUDENT PORTAL</small></div></div>
      <nav class="navigation">
        <button class="nav-item" type="button" @click="router.push('/student/dashboard')">⌂ <span>Dashboard</span></button>
        <button class="nav-item active" type="button">✓ <span>Attendance history</span></button>
        <button class="nav-item" type="button" @click="router.push('/student/timetable')">▦ <span>Lecture timetable</span></button>
        <button class="nav-item" type="button" @click="router.push('/student/profile')">♙ <span>My profile</span></button>
      </nav>
      <div class="sidebar-bottom"><button class="logout" type="button" @click="logout">↪ <span>Log out</span></button></div>
    </aside>

    <main class="content">
      <header class="hero">
        <div><p class="eyebrow">STUDENT RECORDS</p><h1>Attendance history</h1><p>Review your completed attendance sessions by subject and date.</p></div>
        <button class="refresh-button" type="button" @click="loadHistory">↻ Refresh</button>
      </header>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="stat-grid">
        <article class="stat-card"><span class="stat-icon teal">✓</span><div><p>Present</p><strong>{{ presentCount }}</strong><small>Completed sessions attended</small></div></article>
        <article class="stat-card"><span class="stat-icon red">!</span><div><p>Absent</p><strong>{{ absentCount }}</strong><small>Completed sessions missed</small></div></article>
        <article class="stat-card"><span class="stat-icon blue">▤</span><div><p>Total sessions</p><strong>{{ history.length }}</strong><small>Across your assigned subjects</small></div></article>
      </section>

      <section class="history-card">
        <div class="section-title"><div><p class="eyebrow dark">SESSION DIRECTORY</p><h2>All completed sessions</h2></div><span class="count-pill">{{ history.length }} total</span></div>
        <div v-if="isLoading" class="empty-state">Loading your attendance history…</div>
        <div v-else-if="history.length === 0" class="empty-state"><div class="empty-icon">✓</div><h3>No completed sessions yet</h3><p>Your past attendance sessions will appear here after a teacher completes them.</p></div>
        <div v-else class="table-wrap"><table><thead><tr><th>Subject & class</th><th>Teacher</th><th>Session date</th><th>Status</th><th>Marked at</th></tr></thead><tbody><tr v-for="item in history" :key="item.sessionPublicId"><td><strong>{{ item.subjectName }}</strong><small>{{ item.subjectCode }} · {{ item.className }}</small></td><td>{{ item.teacherName }}</td><td>{{ formatDate(item.startedAt) }}</td><td><span class="record-status" :class="item.attendanceStatus.toLowerCase()">{{ item.attendanceStatus }}</span></td><td>{{ item.markedAt ? formatDate(item.markedAt) : '—' }}</td></tr></tbody></table></div>
      </section>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }.page { min-height: 100vh; display: flex; color: #293b45; background: #e6f0ef; font-family: "Segoe UI", Arial, sans-serif; }.sidebar { width: 255px; min-height: 100vh; position: fixed; display: flex; flex-direction: column; padding: 26px 16px; color: white; background: #293b45; }.sidebar-brand { display: flex; align-items: center; gap: 11px; padding: 0 10px 30px; border-bottom: 1px solid rgba(255,255,255,.13); }.brand-icon { display: grid; width: 39px; height: 39px; place-items: center; border-radius: 11px; background: #119e91; font-size: 22px; font-weight: 800; }.wordmark { display: block; color: white; font-size: 23px; font-weight: 800; letter-spacing: -1.3px; line-height: 1; }.wordmark span { color: #2fd3c3; }.sidebar small { display: block; margin-top: 3px; color: #c7d0d3; font-size: 9px; letter-spacing: 1.6px; }.navigation { display: grid; gap: 7px; padding-top: 28px; }.nav-item,.logout { width: 100%; display: flex; align-items: center; gap: 13px; border: 0; border-radius: 9px; padding: 12px 14px; color: #c7d0d3; background: transparent; text-align: left; cursor: pointer; font-size: 14px; font-weight: 700; }.nav-item:hover,.nav-item.active { color: white; background: #119e91; }.sidebar-bottom { margin-top: auto; }.logout:hover { color: white; background: rgba(255,255,255,.1); }.content { width: 100%; min-height: 100vh; margin-left: 255px; padding: 42px clamp(24px,5vw,70px); }.hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 30px 34px; border-radius: 18px; color: white; background: linear-gradient(135deg,#119e91,#0d897e); box-shadow: 0 12px 28px rgba(17,158,145,.18); }.eyebrow { margin: 0 0 10px; font-size: 12px; font-weight: 900; letter-spacing: 2px; }.eyebrow::after { content: ''; display: block; width: 150px; height: 3px; margin-top: 7px; background: currentColor; }.hero h1 { margin: 0; font-size: clamp(30px,3.5vw,44px); }.hero p:not(.eyebrow) { margin: 10px 0 0; font-size: 16px; }.refresh-button { border: 0; border-radius: 10px; padding: 12px 16px; cursor: pointer; color: #087c73; background: #f4fbfa; font: inherit; font-weight: 800; }.message { margin: 20px 0 0; padding: 13px 16px; border-radius: 11px; color: #a64040; background: #fbe2e2; font-weight: 700; }.stat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 17px; margin-top: 27px; }.stat-card,.history-card { border: 1px solid #d3e3e0; border-radius: 16px; background: #f0f7f6; box-shadow: 0 8px 24px rgba(35,55,65,.06); }.stat-card { display: flex; align-items: center; gap: 14px; padding: 20px; }.stat-icon { display: grid; width: 45px; height: 45px; place-items: center; border-radius: 13px; font-size: 20px; font-weight: 800; }.teal { color: #0c887c; background: #d8efeb; }.red { color: #a64040; background: #fbe2e2; }.blue { color: #4476bf; background: #ddeafa; }.stat-card p { margin: 0 0 3px; color: #718087; font-size: 12px; }.stat-card strong { display: block; font-size: 25px; }.stat-card small { color: #8a989d; font-size: 10px; }.history-card { margin-top: 22px; padding: 25px; }.section-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.dark { color: #119e91; }.section-title h2 { margin: 0; font-size: 22px; }.count-pill { padding: 7px 10px; border-radius: 20px; color: #0c887c; background: #d8efeb; font-size: 11px; font-weight: 800; }.empty-state { display: grid; min-height: 250px; place-content: center; justify-items: center; text-align: center; color: #7b898d; }.empty-icon { display: grid; width: 49px; height: 49px; place-items: center; margin-bottom: 12px; border-radius: 12px; color: #119e91; background: #d8efeb; font-size: 23px; font-weight: 800; }.empty-state h3 { margin: 0 0 6px; color: #293b45; }.empty-state p { max-width: 330px; margin: 0; line-height: 1.5; }.table-wrap { overflow-x: auto; margin-top: 20px; }table { width: 100%; min-width: 820px; border-collapse: collapse; }th,td { padding: 14px; border-bottom: 1px solid #d3e3e0; text-align: left; font-size: 13px; }th { color: #718087; font-size: 11px; letter-spacing: .7px; text-transform: uppercase; }td small { display: block; margin-top: 4px; color: #718087; }.record-status { display: inline-block; padding: 6px 9px; border-radius: 20px; font-size: 11px; font-weight: 800; }.record-status.present { color: #0c887c; background: #d8efeb; }.record-status.absent { color: #a64040; background: #fbe2e2; }@media (max-width:750px) { .page { display: block; }.sidebar { width: 100%; min-height: auto; position: static; padding: 17px; }.sidebar-brand { padding-bottom: 15px; }.navigation { display: flex; overflow-x: auto; padding-top: 15px; }.nav-item,.logout { width: auto; white-space: nowrap; }.sidebar-bottom { display: none; }.content { margin-left: 0; padding: 28px 17px; }.hero { align-items: flex-start; flex-direction: column; }.stat-grid { grid-template-columns: 1fr; } }
</style>
