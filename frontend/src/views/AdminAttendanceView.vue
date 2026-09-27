<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = 'http://localhost:5000/api'

const sessions = ref([])
const isLoading = ref(true)
const isClearing = ref(false)
const messageType = ref('success')
const message = ref('')

let refreshTimer = null

const activeSessions = computed(() => {
  return sessions.value.filter(
    (session) => session.status === 'active'
  )
})

const todaySessions = computed(() => {
  const today = new Date().toDateString()

  return sessions.value.filter((session) => {
    return new Date(session.startedAt).toDateString() === today
  })
})

const todayAttendanceMarks = computed(() => {
  return todaySessions.value.reduce((total, session) => {
    return total + Number(session.presentCount || 0)
  }, 0)
})

function authHeaders() {
  return {
    headers: {
      Authorization: `Bearer ${localStorage.getItem(
        'scan2attend_token'
      )}`
    }
  }
}

function logout() {
  localStorage.removeItem('scan2attend_token')
  localStorage.removeItem('scan2attend_user')
  router.push('/')
}

function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function statusLabel(status) {
  if (status === 'active') {
    return 'Live'
  }

  if (status === 'ended') {
    return 'Ended'
  }

  return 'Expired'
}

function attendanceText(session) {
  const present = Number(session.presentCount || 0)
  const eligible = Number(session.eligibleStudentCount || 0)

  if (eligible === 0) {
    return `${present} marked present`
  }

  return `${present} / ${eligible} present`
}

async function loadSessions(showLoading = true) {
  if (showLoading) {
    isLoading.value = true
  }

  try {
    const response = await axios.get(
      `${apiUrl}/admin/attendance/sessions`,
      authHeaders()
    )

    sessions.value = response.data.sessions
    message.value = ''
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    message.value =
      error.response?.data?.message ||
      'Could not load attendance sessions.'
  } finally {
    isLoading.value = false
  }
}

async function clearCompletedSessions() {
  const completedCount = sessions.value.filter(
    (session) => session.status !== 'active'
  ).length

  if (completedCount === 0) {
    message.value = 'There are no completed sessions to clear.'
    messageType.value = 'success'
    return
  }

  const confirmed = window.confirm(
    `Permanently delete ${completedCount} completed session(s), including their attendance marks?\n\nThis cannot be undone.`
  )

  if (!confirmed) return

  isClearing.value = true
  message.value = ''

  try {
    const response = await axios.delete(
      `${apiUrl}/admin/attendance/sessions/completed`,
      authHeaders()
    )

    await loadSessions(false)
    message.value = response.data.message
    messageType.value = 'success'
  } catch (error) {
    message.value =
      error.response?.data?.message ||
      'Could not clear completed sessions.'
    messageType.value = 'error'
  } finally {
    isClearing.value = false
  }
}

onMounted(() => {
  loadSessions()

  refreshTimer = setInterval(() => {
    loadSessions(false)
  }, 5000)
})

onBeforeUnmount(() => {
  clearInterval(refreshTimer)
})
</script>

<template>
  <div class="page">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>

        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>ADMIN PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
        <button
          class="nav-item"
          type="button"
          @click="router.push('/admin/dashboard')"
        >
          ⌂ <span>Dashboard</span>
        </button>

        <button
          class="nav-item"
          type="button"
          @click="router.push('/admin/students')"
        >
          ♙ <span>Students</span>
        </button>

        <button
          class="nav-item"
          type="button"
          @click="router.push('/admin/teachers')"
        >
          ♙ <span>Teachers</span>
        </button>

        <button
          class="nav-item"
          type="button"
          @click="router.push('/admin/classes')"
        >
          ▣ <span>Classes</span>
        </button>

        <button
          class="nav-item"
          type="button"
          @click="router.push('/admin/subjects')"
        >
          ▤ <span>Subjects</span>
        </button>

        <button class="nav-item active" type="button">
  ✓ <span>Attendance</span>
</button>
<button
  class="nav-item"
  type="button"
  @click="router.push('/admin/reports')"
>
  ▧ <span>Reports</span>
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
          <p class="eyebrow">ATTENDANCE MONITORING</p>
          <h1>Attendance sessions</h1>
          <p class="subtext">
            Track live QR sessions and completed attendance.
          </p>
        </div>

        <div class="topbar-actions">
  <button
    class="refresh-button"
    type="button"
    @click="loadSessions()"
  >
    ↻ Refresh
  </button>

  <button
    class="clear-sessions-button"
    type="button"
    :disabled="isClearing"
    @click="clearCompletedSessions"
  >
    {{
      isClearing
        ? 'Clearing…'
        : 'Clear completed sessions'
    }}
  </button>
</div>
      </header>

      <p
  v-if="message"
  class="message"
  :class="{ error: messageType === 'error' }"
>
        {{ message }}
      </p>

      <section class="stat-grid">
        <article class="stat-card">
          <div class="stat-icon teal">✓</div>
          <div>
            <p>Live sessions</p>
            <strong>{{ activeSessions.length }}</strong>
            <small>Currently accepting scans</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon blue">▣</div>
          <div>
            <p>Sessions today</p>
            <strong>{{ todaySessions.length }}</strong>
            <small>Started today</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon orange">♙</div>
          <div>
            <p>Present today</p>
            <strong>{{ todayAttendanceMarks }}</strong>
            <small>Successful student scans</small>
          </div>
        </article>
      </section>

      <section class="table-panel">
        <div class="panel-title">
          <div>
            <p class="panel-eyebrow">SESSION DIRECTORY</p>
            <h2>All attendance sessions</h2>
          </div>

          <span class="live-note">
            Updates every 5 seconds
          </span>
        </div>

        <div v-if="isLoading" class="empty-state">
          Loading attendance sessions…
        </div>

        <div
          v-else-if="sessions.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">✓</div>
          <strong>No attendance sessions yet</strong>
          <p>
            Sessions will appear here when a teacher starts
            QR attendance.
          </p>
        </div>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Subject & class</th>
                <th>Teacher</th>
                <th>Started</th>
                <th>Attendance</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="session in sessions"
                :key="session.sessionId"
              >
                <td>
                  <span
                    class="table-status"
                    :class="session.status"
                  >
                    {{ statusLabel(session.status) }}
                  </span>
                </td>

                <td>
                  <strong>{{ session.subjectName }}</strong>
                  <small>
                    {{ session.subjectCode }} ·
                    {{ session.className }}
                  </small>
                </td>

                <td>
                  <strong>{{ session.teacherName }}</strong>
                  <small>{{ session.teacherCode }}</small>
                </td>

                <td>{{ formatDateTime(session.startedAt) }}</td>

                <td>
                  <strong>{{ attendanceText(session) }}</strong>
                  <small>
                    {{
                      session.status === 'active'
                        ? 'Live count'
                        : 'Final count'
                    }}
                  </small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.page {
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

.sidebar-brand small {
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
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
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
  color: #293b45;
  font-size: 21px;
}

.subtext {
  margin-bottom: 0;
  color: rgba(255, 255, 255, 0.84);
}

.refresh-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  color: #0d897e;
  background: #eef7f5;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.message {
  margin: 18px 0 0;
  padding: 12px 15px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
}

.message.error {
  color: #a64040;
  background: #fae0e0;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(170px, 1fr));
  gap: 17px;
  margin-top: 28px;
}

.stat-card,
.table-panel {
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

.table-panel {
  margin-top: 22px;
  padding: 25px;
}

.panel-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-eyebrow {
  margin-bottom: 7px;
  color: #119e91;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}

.live-note {
  padding: 6px 10px;
  border-radius: 20px;
  color: #0c887c;
  background: #d8efeb;
  font-size: 11px;
  font-weight: 700;
}

.empty-state {
  display: grid;
  justify-items: center;
  padding: 64px 20px;
  color: #7b898d;
  text-align: center;
}

.empty-icon {
  width: 49px;
  height: 49px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  border-radius: 50%;
  color: #119e91;
  background: #d8efeb;
  font-size: 23px;
}

.empty-state strong {
  color: #30424c;
  font-size: 14px;
}

.empty-state p {
  max-width: 300px;
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.table-wrapper {
  margin-top: 20px;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 14px 11px;
  border-bottom: 1px solid #d9e4e2;
  color: #607177;
  font-size: 13px;
  white-space: nowrap;
}

th {
  color: #718087;
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

td strong,
td small {
  display: block;
}

td strong {
  color: #293b45;
}

td small {
  margin-top: 3px;
  color: #849196;
  font-size: 10px;
}

.table-status {
  display: inline-block;
  padding: 6px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}

.table-status.active {
  color: #087c73;
  background: #d8efeb;
}

.table-status.ended {
  color: #4476bf;
  background: #ddeafa;
}

.table-status.expired {
  color: #8a6a35;
  background: #fcedd8;
}

@media (max-width: 900px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 750px) {
  .page {
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

  .refresh-button {
    width: 100%;
  }
}
.topbar-actions {
  display: flex;
  gap: 10px;
}

.clear-sessions-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  color: #a64040;
  background: #fbe4e4;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.clear-sessions-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.message:not(.error) {
  color: #087c73;
  background: #d8efeb;
}

@media (max-width: 750px) {
  .topbar-actions {
    width: 100%;
    flex-direction: column;
  }

  .clear-sessions-button {
    width: 100%;
  }
}
</style>