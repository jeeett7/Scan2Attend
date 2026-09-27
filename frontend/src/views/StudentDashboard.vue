<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const dashboard = ref({
  profile: null,
  stats: {
    overallAttendance: null,
    enrolledClasses: 0,
    subjects: 0,
    totalSessions: 0,
    totalPresent: 0,
    presentToday: 0
  },
  subjects: [],
  recentHistory: []
})
const isLoading = ref(true)
const message = ref('')

const studentName = computed(() => {
  return dashboard.value.profile?.firstName || 'Student'
})

const attendanceRate = computed(() => {
  const percentage = dashboard.value.stats.overallAttendance
  return percentage === null ? '—' : `${percentage}%`
})

function authHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('scan2attend_token')}`
    }
  }
}

function logout() {
  localStorage.removeItem('scan2attend_token')
  localStorage.removeItem('scan2attend_user')
  router.push('/')
}

function formatDate(date) {
  if (!date) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date))
}

async function loadDashboard() {
  isLoading.value = true
  message.value = ''

  try {
    const response = await axios.get(
      `${apiUrl}/student/dashboard`,
      authHeaders()
    )
    dashboard.value = response.data
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    message.value =
      error.response?.data?.message ||
      'Could not load your dashboard.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="student-dashboard">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>
        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>STUDENT PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
        <button class="nav-item active" type="button">
          ⌂ <span>Dashboard</span>
        </button>
        <button
          class="nav-item"
          type="button"
          @click="router.push('/student/attendance-history')"
        >
          ✓ <span>Attendance history</span>
        </button>
        <button
          class="nav-item"
          type="button"
          @click="router.push('/student/timetable')"
        >
          ▦ <span>Lecture timetable</span>
        </button>
        <button
          class="nav-item"
          type="button"
          @click="router.push('/student/profile')"
        >
          ♙ <span>My profile</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <button class="logout" type="button" @click="logout">
          ↪ <span>Log out</span>
        </button>
      </div>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <p class="eyebrow">STUDENT DASHBOARD</p>
          <h1>Welcome back, {{ studentName }}.</h1>
          <p class="subtext">Keep track of your attendance and enrolled subjects.</p>
        </div>

        <div class="profile">
          <div class="profile-icon">{{ studentName.charAt(0).toUpperCase() }}</div>
          <div>
            <strong>{{ studentName }}</strong>
            <small>{{ dashboard.profile?.studentCode || 'Student' }}</small>
          </div>
        </div>
      </header>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="stat-grid" :class="{ muted: isLoading }">
        <article class="stat-card">
          <div class="stat-icon teal">%</div>
          <div>
            <p>Overall attendance</p>
            <strong>{{ attendanceRate }}</strong>
            <small>{{ dashboard.stats.totalSessions }} completed session(s)</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon blue">▣</div>
          <div>
            <p>Enrolled classes</p>
            <strong>{{ dashboard.stats.enrolledClasses }}</strong>
            <small>Classes assigned to you</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon orange">▤</div>
          <div>
            <p>Subjects</p>
            <strong>{{ dashboard.stats.subjects }}</strong>
            <small>Active subject enrolments</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon green">✓</div>
          <div>
            <p>Present today</p>
            <strong>{{ dashboard.stats.presentToday }}</strong>
            <small>Successful QR attendance marks</small>
          </div>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel">
          <p class="panel-eyebrow">ATTENDANCE SUMMARY</p>
          <h2>Your attendance at a glance</h2>

          <div class="summary-list">
            <div class="summary-row">
              <span>Total completed sessions</span>
              <strong>{{ dashboard.stats.totalSessions }}</strong>
            </div>
            <div class="summary-row">
              <span>Present</span>
              <strong>{{ dashboard.stats.totalPresent }}</strong>
            </div>
            <div class="summary-row">
              <span>Attendance rate</span>
              <strong>{{ attendanceRate }}</strong>
            </div>
          </div>

          <p class="summary-note">
            Attendance percentage is calculated from completed sessions in your assigned subjects.
          </p>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div>
              <p class="panel-eyebrow">RECENT ATTENDANCE</p>
              <h2>Attendance history</h2>
            </div>
            <button
              class="link-button"
              type="button"
              @click="router.push('/student/attendance-history')"
            >
              View all
            </button>
          </div>

          <div v-if="isLoading" class="empty-state">Loading your history…</div>

          <div v-else-if="dashboard.recentHistory.length === 0" class="empty-state">
            <div class="empty-icon">✓</div>
            <strong>No completed sessions yet</strong>
            <p>Your attendance history will appear after a teacher completes a session.</p>
          </div>

          <div v-else class="history-list">
            <article
              v-for="item in dashboard.recentHistory"
              :key="item.sessionPublicId"
              class="history-item"
            >
              <div
                class="history-mark"
                :class="item.attendanceStatus.toLowerCase()"
              >
                {{ item.attendanceStatus === 'Present' ? '✓' : '!' }}
              </div>

              <div class="history-content">
                <strong>{{ item.subjectCode }}</strong>
                <p>{{ item.subjectName }}</p>
                <small>{{ item.className }} · {{ formatDate(item.startedAt) }}</small>
              </div>

              <span class="record-status" :class="item.attendanceStatus.toLowerCase()">
                {{ item.attendanceStatus }}
              </span>
            </article>
          </div>
        </article>
      </section>

      <section class="subjects-panel">
        <div class="panel-heading">
          <div>
            <p class="panel-eyebrow">MY SUBJECTS</p>
            <h2>Subjects assigned to you</h2>
          </div>
          <span class="count-pill">{{ dashboard.subjects.length }} total</span>
        </div>

        <div v-if="isLoading" class="empty-state compact">Loading your subjects…</div>

        <div v-else-if="dashboard.subjects.length === 0" class="empty-state compact">
          <p>Your admin has not assigned a subject to you yet.</p>
        </div>

        <div v-else class="subject-list">
          <article v-for="subject in dashboard.subjects" :key="subject.classSubjectId" class="subject-item">
            <div class="subject-icon">{{ subject.subjectCode }}</div>
            <div class="subject-info">
              <strong>{{ subject.subjectCode }}</strong>
              <p>{{ subject.subjectName }}</p>
              <small>{{ subject.className }} · {{ subject.academicYear }}</small>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }
.student-dashboard { min-height: 100vh; display: flex; color: #293b45; background: #e6f0ef; font-family: "Segoe UI", Arial, sans-serif; }
.sidebar { width: 255px; min-height: 100vh; display: flex; position: fixed; flex-direction: column; padding: 26px 16px; color: white; background: #293b45; }.sidebar-brand { display: flex; align-items: center; gap: 11px; padding: 0 10px 30px; border-bottom: 1px solid rgba(255,255,255,.13); }.brand-icon { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 11px; background: #119e91; font-size: 22px; font-weight: 800; }.wordmark { display: block; color: white; font-size: 23px; font-weight: 800; letter-spacing: -1.3px; line-height: 1; }.wordmark span { color: #2fd3c3; }.sidebar-brand small,.profile small { display: block; margin-top: 3px; font-size: 9px; letter-spacing: 1.6px; opacity: .65; }.navigation { display: grid; gap: 7px; padding-top: 28px; }.nav-item,.logout { width: 100%; display: flex; align-items: center; gap: 13px; border: 0; border-radius: 9px; padding: 12px 14px; color: #c7d0d3; background: transparent; text-align: left; cursor: pointer; font-size: 14px; font-weight: 700; }.nav-item:hover,.nav-item.active { color: white; background: #119e91; }.sidebar-bottom { margin-top: auto; }.logout:hover { color: white; background: rgba(255,255,255,.1); }
.content { flex: 1; min-width: 0; margin-left: 255px; padding: 42px clamp(24px,5vw,70px); }.topbar { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 31px; border-radius: 18px; color: white; background: linear-gradient(135deg,#119e91,#0d897e); box-shadow: 0 12px 28px rgba(17,158,145,.2); }.eyebrow { display: inline-block; margin: 0 0 13px; padding-bottom: 7px; border-bottom: 3px solid #d7f4f0; color: white; font-size: 14px; font-weight: 900; letter-spacing: 2.4px; }h1,h2,p { margin-top: 0; }h1 { margin-bottom: 8px; color: white; font-size: clamp(27px,3vw,38px); }h2 { margin-bottom: 0; font-size: 21px; }.subtext { margin-bottom: 0; color: rgba(255,255,255,.84); }.profile { display: flex; align-items: center; gap: 11px; padding: 9px 13px; border-radius: 12px; color: #293b45; background: #eef7f5; }.profile-icon { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 50%; color: white; background: #119e91; font-weight: 800; }.profile strong { display: block; font-size: 13px; }.profile small { color: #718087; letter-spacing: 0; opacity: 1; }.message { margin: 20px 0 0; padding: 13px 16px; border-radius: 11px; color: #a64040; background: #fbe2e2; font-weight: 700; }
.stat-grid { display: grid; grid-template-columns: repeat(4,minmax(170px,1fr)); gap: 17px; margin-top: 36px; }.muted { opacity: .65; }.stat-card,.panel,.subjects-panel { border: 1px solid #d3e3e0; border-radius: 16px; background: #f0f7f6; box-shadow: 0 8px 24px rgba(35,55,65,.06); }.stat-card { display: flex; align-items: center; gap: 14px; padding: 20px; }.stat-icon { width: 45px; height: 45px; display: grid; flex-shrink: 0; place-items: center; border-radius: 13px; font-size: 19px; font-weight: 800; }.teal { color: #0c887c; background: #d8efeb; }.blue { color: #4476bf; background: #ddeafa; }.orange { color: #b87928; background: #fcedd8; }.green { color: #55915e; background: #e1f1df; }.stat-card p { margin-bottom: 3px; color: #718087; font-size: 12px; }.stat-card strong { display: block; font-size: 25px; }.stat-card small { color: #8a989d; font-size: 10px; }
.dashboard-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 20px; margin-top: 22px; }.panel { min-height: 285px; padding: 25px; }.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.panel-eyebrow { margin-bottom: 7px; color: #119e91; font-size: 10px; font-weight: 800; letter-spacing: 2px; }.summary-list { display: grid; gap: 10px; margin-top: 24px; }.summary-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border: 1px solid #d3e3e0; border-radius: 11px; background: #eaf4f2; color: #607177; font-size: 13px; }.summary-row strong { color: #119e91; font-size: 18px; }.summary-note { margin: 18px 0 0; color: #7b898d; font-size: 12px; line-height: 1.5; }.link-button { border: 0; background: transparent; color: #087c73; cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; }.empty-state { display: grid; justify-items: center; padding: 52px 20px 0; text-align: center; color: #7b898d; font-size: 13px; }.empty-state.compact { min-height: 110px; padding-top: 35px; }.empty-icon { display: grid; width: 49px; height: 49px; place-items: center; margin-bottom: 12px; border-radius: 12px; color: #119e91; background: #d8efeb; font-size: 23px; font-weight: 800; }.empty-state strong { color: #293b45; font-size: 14px; }.empty-state p { max-width: 280px; margin: 7px 0 0; line-height: 1.5; }.history-list { display: grid; gap: 10px; margin-top: 17px; }.history-item { display: flex; align-items: center; gap: 11px; padding: 12px; border: 1px solid #d3e3e0; border-radius: 12px; background: #eaf4f2; }.history-mark { display: grid; width: 35px; height: 35px; place-items: center; flex-shrink: 0; border-radius: 10px; font-size: 18px; font-weight: 900; }.history-mark.present { color: #0c887c; background: #d8efeb; }.history-mark.absent { color: #a64040; background: #fbe2e2; }.history-content { min-width: 0; }.history-content strong { display: block; font-size: 14px; }.history-content p,.history-content small { display: block; margin: 3px 0 0; overflow: hidden; color: #718087; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.record-status { margin-left: auto; padding: 6px 9px; border-radius: 20px; font-size: 11px; font-weight: 800; }.record-status.present { color: #0c887c; background: #d8efeb; }.record-status.absent { color: #a64040; background: #fbe2e2; }
.subjects-panel { margin-top: 22px; padding: 25px; }.count-pill { padding: 6px 10px; border-radius: 20px; color: #0c887c; background: #d8efeb; font-size: 11px; font-weight: 800; }.subject-list { display: grid; gap: 10px; margin-top: 20px; }.subject-item { display: flex; align-items: center; gap: 14px; padding: 15px 17px; border: 1px solid #d3e3e0; border-radius: 12px; background: #eaf4f2; }.subject-icon { display: grid; width: 62px; height: 40px; place-items: center; flex-shrink: 0; border-radius: 10px; color: #0c887c; background: #d8efeb; font-size: 11px; font-weight: 900; }.subject-info { min-width: 0; }.subject-info strong { display: block; color: #293b45; font-size: 15px; }.subject-info p { display: block; margin: 3px 0 0; color: #607177; font-size: 13px; }.subject-info small { display: block; margin: 4px 0 0; color: #8a989d; font-size: 11px; }
@media (max-width:1100px) { .stat-grid { grid-template-columns: repeat(2,1fr); }.dashboard-grid { grid-template-columns: 1fr; } }@media (max-width:750px) { .student-dashboard { display: block; }.sidebar { width: 100%; min-height: auto; position: static; padding: 17px; }.sidebar-brand { padding-bottom: 15px; }.navigation { display: flex; overflow-x: auto; padding-top: 15px; }.nav-item,.logout { width: auto; white-space: nowrap; }.sidebar-bottom { display: none; }.content { margin-left: 0; padding: 28px 17px; }.topbar { align-items: flex-start; flex-direction: column; }.profile { display: none; }.subject-grid { grid-template-columns: 1fr; } }@media (max-width:460px) { .stat-grid { grid-template-columns: 1fr; } }
</style>
