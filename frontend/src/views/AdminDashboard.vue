<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()

let savedUser = {}

try {
  savedUser = JSON.parse(
    localStorage.getItem('scan2attend_user') || '{}'
  )
} catch {
  savedUser = {}
}

const displayName = computed(() => {
  return savedUser.firstName || savedUser.username || 'Administrator'
})

const dashboardStats = ref({
  totalStudents: 0,
  totalTeachers: 0,
  activeClasses: 0,
  attendanceToday: 0
})

const isLoading = ref(true)

function logout() {
  localStorage.removeItem('scan2attend_token')
  localStorage.removeItem('scan2attend_user')
  router.push('/')
}

async function loadDashboard() {
  const token = localStorage.getItem('scan2attend_token')

  if (!token) {
    logout()
    return
  }

  try {
    const response = await axios.get(
      'http://localhost:5000/api/admin/dashboard',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    dashboardStats.value = response.data
  } catch (error) {
    console.error('Could not load dashboard data:', error)

    if (error.response?.status === 401) {
      logout()
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="dashboard">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>

        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>ADMIN PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
  <button class="nav-item active" type="button">
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

  <button class="nav-item" type="button" @click="router.push('/admin/attendance')">
    ✓ <span>Attendance sessions</span>
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
          <p class="eyebrow">ADMIN DASHBOARD</p>
          <h1>Welcome back, {{ displayName }}.</h1>
          <p class="subtext">Here is your attendance overview for today.</p>
        </div>

        <div class="profile">
          <div class="profile-icon">
            {{ displayName.charAt(0).toUpperCase() }}
          </div>

          <div>
            <strong>{{ displayName }}</strong>
            <small>Administrator</small>
          </div>
        </div>
      </header>

      <section class="stat-grid">
        <article class="stat-card">
          <div class="stat-icon teal">♙</div>
          <div>
            <p>Total students</p>
<strong>{{ isLoading ? '…' : dashboardStats.totalStudents }}</strong>
            <small>Students will appear here</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon blue">♙</div>
          <div>
            <p>Total teachers</p>
<strong>{{ isLoading ? '…' : dashboardStats.totalTeachers }}</strong>
            <small>Teachers will appear here</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon orange">▣</div>
          <div>
            <p>Active classes</p>
<strong>{{ isLoading ? '…' : dashboardStats.activeClasses }}</strong>
            <small>Classes will appear here</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon green">✓</div>
          <div>
            <p>Attendance today</p>
<strong>{{ isLoading ? '…' : dashboardStats.attendanceToday }}</strong>
            <small>Awaiting first session</small>
          </div>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="panel quick-actions">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">GET STARTED</p>
              <h2>Quick actions</h2>
            </div>
          </div>

          <div class="action-grid">
            <button
  type="button"
  @click="router.push('/admin/students')"
>
  <span class="action-icon">+</span>
  <strong>Add student</strong>
  <small>Create a student account</small>
</button>

            <button type="button" @click="router.push('/admin/teachers')">
  <span class="action-icon">+</span>
  <strong>Add teacher</strong>
  <small>Create a teacher account</small>
</button>

            <button type="button" @click="router.push('/admin/classes')">
  <span class="action-icon">+</span>
  <strong>Create class</strong>
  <small>Set up a new class</small>
</button>

            <button
  type="button"
  @click="router.push('/admin/reports')"
>
  <span class="action-icon">↗</span>
  <strong>View reports</strong>
  <small>See attendance insights</small>
</button>
          </div>
        </article>

        <article class="panel activity-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">SYSTEM ACTIVITY</p>
              <h2>Recent activity</h2>
            </div>

            <span class="status-dot">Live</span>
          </div>

          <div class="empty-state">
            <div class="empty-check">✓</div>
            <strong>No activity yet</strong>
            <p>
              Students, teachers, classes, and attendance sessions will
              appear here.
            </p>
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

.dashboard {
  min-height: 100vh;
  display: flex;
  color: #293b45;
  background: #edf2f2;
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
  font-size: 22px;
  font-weight: 800;
  background: #119e91;
}

.sidebar-brand .wordmark {
  display: block;
  color: white;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -1.3px;
  line-height: 1;
}

.sidebar-brand .wordmark span {
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

.nav-item:hover,
.nav-item.active {
  color: white;
  background: #119e91;
}

.sidebar-bottom {
  margin-top: auto;
  padding-top: 24px;
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
  margin-bottom: 36px;
  padding: 28px 31px;
  border-radius: 18px;
  color: white;
  background: linear-gradient(135deg, #119e91, #0d897e);
  box-shadow: 0 12px 28px rgba(17, 158, 145, 0.2);
}

.eyebrow {
  margin: 0 0 7px;
  color: #119e91;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}

.topbar .eyebrow {
  color: #d7f4f0;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  font-size: clamp(27px, 3vw, 38px);
}

.topbar h1 {
  color: white;
}

h2 {
  margin-bottom: 0;
  font-size: 21px;
}

.subtext {
  margin-bottom: 0;
  color: #718087;
}

.topbar .subtext {
  color: rgba(255, 255, 255, 0.84);
}

.profile {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 13px;
  border-radius: 12px;
  color: #293b45;
  background: #f9fbfb;
  box-shadow: 0 6px 18px rgba(35, 55, 65, 0.1);
}

.profile-icon {
  width: 37px;
  height: 37px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: white;
  font-weight: 800;
  background: #119e91;
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
}

.stat-card,
.panel {
  border: 1px solid #dbe4e4;
  border-radius: 16px;
  background: #fbfdfd;
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
  grid-template-columns: 1.15fr 0.85fr;
  gap: 20px;
  margin-top: 22px;
}

.panel {
  min-height: 290px;
  padding: 24px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}

.status-dot {
  padding: 6px 9px;
  border-radius: 20px;
  color: #0c887c;
  background: #d8efeb;
  font-size: 11px;
  font-weight: 700;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 23px;
}

.action-grid button {
  padding: 16px;
  border: 1px solid #d9e4e4;
  border-radius: 12px;
  background: #f5f9f9;
  text-align: left;
  cursor: pointer;
}

.action-grid button:hover {
  border-color: #119e91;
  background: #edf8f6;
}

.action-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
  border-radius: 9px;
  color: #119e91;
  background: #d8efeb;
  font-size: 19px;
  font-weight: 800;
}

.action-grid strong,
.action-grid small {
  display: block;
}

.action-grid strong {
  margin-bottom: 4px;
  color: #30424c;
  font-size: 13px;
}

.action-grid small {
  color: #7b898d;
  font-size: 10px;
}

.empty-state {
  display: grid;
  justify-items: center;
  padding: 43px 10px 0;
  text-align: center;
}

.empty-check {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  border-radius: 50%;
  color: #119e91;
  background: #d8efeb;
  font-size: 24px;
  font-weight: 800;
}

.empty-state strong {
  font-size: 14px;
}

.empty-state p {
  max-width: 260px;
  margin: 7px 0 0;
  color: #7b898d;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 750px) {
  .dashboard {
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
}

@media (max-width: 460px) {
  .stat-grid,
  .action-grid {
    grid-template-columns: 1fr;
  }
}
/* Softer mint dashboard surfaces */
.dashboard {
  background: #e6f0ef;
}

.stat-card,
.panel {
  background: #f0f7f6;
  border-color: #d3e3e0;
}

.action-grid button {
  background: #eaf4f2;
  border-color: #d3e3e0;
}

.profile {
  background: #eef7f5;
}

.nav-item {
  font-weight: 700;
}
.topbar .eyebrow {
  display: inline-block;
  margin-bottom: 13px;
  padding-bottom: 7px;
  border-bottom: 3px solid #d7f4f0;
  color: #ffffff;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 2.4px;
}
</style>