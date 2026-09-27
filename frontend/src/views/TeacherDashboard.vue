<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

const dashboard = ref({
  teacher: null,
  assignments: [],
  stats: {
    assignedClasses: 0,
    assignedSubjects: 0,
    totalStudents: 0,
    sessionsToday: 0
  }
})

const isLoading = ref(true)
const message = ref('')

let savedUser = {}

try {
  savedUser = JSON.parse(
    localStorage.getItem('scan2attend_user') || '{}'
  )
} catch {
  savedUser = {}
}

const teacherName = computed(() => {
  return (
    dashboard.value.teacher?.firstName ||
    savedUser.firstName ||
    savedUser.username ||
    'Teacher'
  )
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

async function loadDashboard() {
  isLoading.value = true
  message.value = ''

  try {
    const response = await axios.get(
      `${apiUrl}/teacher/dashboard`,
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
      'Could not load your teacher dashboard.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="teacher-dashboard">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>

        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>TEACHER PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
  <button
    class="nav-item active"
    type="button"
    @click="router.push('/teacher/dashboard')"
  >
    ⌂ <span>Dashboard</span>
  </button>

  <button
    class="nav-item"
    type="button"
    @click="router.push('/teacher/take-attendance')"
  >
    ▣ <span>Take attendance</span>
  </button>

  <button
    class="nav-item"
    type="button"
    @click="router.push('/teacher/attendance-history')"
  >
    ✓ <span>Attendance report</span>
  </button>

  <button
    class="nav-item"
    type="button"
    @click="router.push('/teacher/timetable')"
  >
    ▦ <span>Lecture timetable</span>
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
          <p class="eyebrow">TEACHER DASHBOARD</p>
          <h1>Welcome back, {{ teacherName }}.</h1>
          <p class="subtext">
            Manage your classes and take attendance in seconds.
          </p>
        </div>

        <div class="profile">
          <div class="profile-icon">
            {{ teacherName.charAt(0).toUpperCase() }}
          </div>

          <div>
            <strong>{{ teacherName }}</strong>
            <small>Teacher</small>
          </div>
        </div>
      </header>
      <p v-if="message" class="message error">
  {{ message }}
</p>

      <section class="stat-grid">
  <article class="stat-card">
    <div class="stat-icon teal">▣</div>
    <div>
      <p>Assigned classes</p>
      <strong>
        {{ isLoading ? '—' : dashboard.stats.assignedClasses }}
      </strong>
      <small>Classes you teach</small>
    </div>
  </article>

  <article class="stat-card">
    <div class="stat-icon blue">▤</div>
    <div>
      <p>Assigned subjects</p>
      <strong>
        {{ isLoading ? '—' : dashboard.stats.assignedSubjects }}
      </strong>
      <small>Subjects assigned to you</small>
    </div>
  </article>

  <article class="stat-card">
    <div class="stat-icon orange">♙</div>
    <div>
      <p>Total students</p>
      <strong>
        {{ isLoading ? '—' : dashboard.stats.totalStudents }}
      </strong>
      <small>Students in your subjects</small>
    </div>
  </article>

  <article class="stat-card">
    <div class="stat-icon green">✓</div>
    <div>
      <p>Sessions today</p>
      <strong>
        {{ isLoading ? '—' : dashboard.stats.sessionsToday }}
      </strong>
      <small>QR sessions will appear here</small>
    </div>
  </article>
</section>

      <section class="dashboard-grid">
        <article class="panel">
          <p class="panel-eyebrow">QUICK START</p>
          <h2>Ready to take attendance?</h2>

          <div class="action-row">
            <div class="action-icon">▣</div>
            <div>
              <strong>Start a QR attendance session</strong>
              <p>
                Select an assigned class and subject to generate a live QR code.
              </p>
            </div>
          </div>

          <button
  class="primary-button"
  type="button"
  @click="router.push('/teacher/take-attendance')"
>
  Start attendance
</button>
        </article>

        <article class="panel">
  <p class="panel-eyebrow">MY CLASSES</p>

  <div class="panel-header">
    <h2>My subjects</h2>
    <span class="subject-total">
      {{ dashboard.assignments.length }} total
    </span>
  </div>

  <div v-if="isLoading" class="empty-state">
    Loading your subjects…
  </div>

  <div
    v-else-if="dashboard.assignments.length === 0"
    class="empty-state"
  >
    <div class="empty-icon">▤</div>
    <strong>No subjects assigned yet</strong>
    <p>Your administrator will assign your subjects and classes.</p>
  </div>

  <div v-else class="subject-list">
    <article
      v-for="assignment in dashboard.assignments"
      :key="assignment.assignmentId"
      class="subject-row"
    >
      <div class="subject-icon">▤</div>

      <div class="subject-details">
        <strong>{{ assignment.subjectName }}</strong>
        <p>
          {{ assignment.subjectCode }} · {{ assignment.className }}
        </p>
      </div>

      <span class="student-count">
        {{ assignment.studentCount }}
        {{ assignment.studentCount === 1 ? 'student' : 'students' }}
      </span>
    </article>
  </div>
</article>
      </section>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.teacher-dashboard {
  min-height: 100vh;
  display: flex;
  color: #293b45;
  background: #e6f0ef;
  font-family: "Segoe UI", Arial, sans-serif;
}

.sidebar {
  width: 255px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 26px 16px;
  color: white;
  background: #293b45;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 10px 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.13);
}

.brand-icon {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #119e91;
  font-size: 22px;
  font-weight: 800;
}

.wordmark {
  display: block;
  color: white;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -1.3px;
  line-height: 1;
}

.wordmark span {
  color: #2fd3c3;
}

.sidebar-brand small,
.profile small {
  display: block;
  margin-top: 3px;
  font-size: 9px;
  letter-spacing: 1.6px;
  opacity: 0.65;
}

.navigation {
  display: grid;
  gap: 7px;
  padding-top: 28px;
}

.nav-item,
.logout {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 0;
  border-radius: 9px;
  padding: 12px 14px;
  color: #c7d0d3;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
}

.nav-item {
  font-weight: 700;
}

.nav-item:hover,
.nav-item.active {
  color: white;
  background: #119e91;
}

.sidebar-bottom {
  margin-top: auto;
}

.logout:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.content {
  flex: 1;
  min-width: 0;
  padding: 42px clamp(24px, 5vw, 70px);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 31px;
  border-radius: 18px;
  color: white;
  background: linear-gradient(135deg, #119e91, #0d897e);
  box-shadow: 0 12px 28px rgba(17, 158, 145, 0.2);
}

.eyebrow {
  display: inline-block;
  margin: 0 0 13px;
  padding-bottom: 7px;
  border-bottom: 3px solid #d7f4f0;
  color: white;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 2.4px;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  color: white;
  font-size: clamp(27px, 3vw, 38px);
}

h2 {
  margin-bottom: 0;
  font-size: 21px;
}

.subtext {
  margin-bottom: 0;
  color: rgba(255, 255, 255, 0.84);
}

.profile {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 13px;
  border-radius: 12px;
  color: #293b45;
  background: #eef7f5;
}

.profile-icon {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: white;
  background: #119e91;
  font-weight: 800;
}

.profile strong {
  display: block;
  font-size: 13px;
}

.profile small {
  color: #718087;
  letter-spacing: 0;
  opacity: 1;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(170px, 1fr));
  gap: 17px;
  margin-top: 36px;
}

.stat-card,
.panel {
  border: 1px solid #d3e3e0;
  border-radius: 16px;
  background: #f0f7f6;
  box-shadow: 0 8px 24px rgba(35, 55, 65, 0.06);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
}

.stat-icon {
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  font-size: 21px;
  font-weight: 800;
}

.teal {
  color: #0c887c;
  background: #d8efeb;
}

.blue {
  color: #4476bf;
  background: #ddeafa;
}

.orange {
  color: #b87928;
  background: #fcedd8;
}

.green {
  color: #55915e;
  background: #e1f1df;
}

.stat-card p {
  margin-bottom: 3px;
  color: #718087;
  font-size: 12px;
}

.stat-card strong {
  display: block;
  font-size: 25px;
}

.stat-card small {
  color: #8a989d;
  font-size: 10px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 22px;
}

.panel {
  min-height: 300px;
  padding: 25px;
}

.panel-eyebrow {
  margin-bottom: 7px;
  color: #119e91;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}

.action-row {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  margin: 24px 0 20px;
  padding: 16px;
  border: 1px solid #d3e3e0;
  border-radius: 12px;
  background: #eaf4f2;
}

.action-icon,
.empty-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 12px;
  color: #119e91;
  background: #d8efeb;
  font-weight: 800;
}

.action-icon {
  width: 39px;
  height: 39px;
  font-size: 20px;
}

.action-row strong {
  font-size: 14px;
}

.action-row p {
  margin: 5px 0 0;
  color: #718087;
  font-size: 12px;
  line-height: 1.5;
}

.primary-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  color: white;
  background: #119e91;
  cursor: pointer;
  font-weight: 700;
}

.primary-button:hover {
  background: #0d897e;
}

.empty-state {
  display: grid;
  justify-items: center;
  padding: 52px 20px 0;
  text-align: center;
}

.empty-icon {
  width: 49px;
  height: 49px;
  margin-bottom: 12px;
  font-size: 23px;
}

.empty-state strong {
  font-size: 14px;
}

.empty-state p {
  max-width: 280px;
  margin: 7px 0 0;
  color: #7b898d;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 750px) {
  .teacher-dashboard {
    display: block;
  }

  .sidebar {
    width: 100%;
    min-height: auto;
    padding: 17px;
  }

  .sidebar-brand {
    padding-bottom: 15px;
  }

  .navigation {
    display: flex;
    overflow-x: auto;
    padding-top: 15px;
  }

  .nav-item,
  .logout {
    width: auto;
    white-space: nowrap;
  }

  .sidebar-bottom {
    display: none;
  }

  .content {
    padding: 28px 17px;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .profile {
    display: none;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 460px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.subject-total,
.student-count {
  border-radius: 999px;
  color: #087c73;
  background: #d8efeb;
  font-size: 11px;
  font-weight: 700;
}

.subject-total {
  padding: 6px 10px;
}

.subject-list {
  display: grid;
  gap: 11px;
  margin-top: 22px;
}

.subject-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid #d3e3e0;
  border-radius: 12px;
  background: #eaf4f2;
}

.subject-icon {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 10px;
  color: #119e91;
  background: #d8efeb;
  font-size: 18px;
  font-weight: 800;
}

.subject-details {
  min-width: 0;
  flex: 1;
}

.subject-details strong {
  display: block;
  color: #293b45;
  font-size: 14px;
}

.subject-details p {
  margin: 4px 0 0;
  color: #718087;
  font-size: 12px;
}

.student-count {
  padding: 7px 10px;
  white-space: nowrap;
}
</style>
