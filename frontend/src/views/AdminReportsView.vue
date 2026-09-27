<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = 'http://localhost:5000/api'

const reports = ref([])
const isLoading = ref(true)
const message = ref('')
const searchText = ref('')
const selectedClassId = ref('')
const selectedSubjectId = ref('')

const classes = computed(() => {
  const uniqueClasses = new Map()

  reports.value.forEach((report) => {
    if (!uniqueClasses.has(report.classId)) {
      uniqueClasses.set(report.classId, {
        id: report.classId,
        className: report.className,
        academicYear: report.academicYear
      })
    }
  })

  return [...uniqueClasses.values()]
})

const subjects = computed(() => {
  const uniqueSubjects = new Map()

  reports.value
    .filter((report) => {
      return (
        !selectedClassId.value ||
        String(report.classId) === String(selectedClassId.value)
      )
    })
    .forEach((report) => {
      if (!uniqueSubjects.has(report.subjectId)) {
        uniqueSubjects.set(report.subjectId, {
          id: report.subjectId,
          subjectName: report.subjectName,
          subjectCode: report.subjectCode
        })
      }
    })

  return [...uniqueSubjects.values()]
})

const filteredReports = computed(() => {
  const search = searchText.value.trim().toLowerCase()

  return reports.value.filter((report) => {
    const matchesClass =
      !selectedClassId.value ||
      String(report.classId) === String(selectedClassId.value)

    const matchesSubject =
      !selectedSubjectId.value ||
      String(report.subjectId) === String(selectedSubjectId.value)

    const searchableText = [
      report.firstName,
      report.lastName,
      report.studentCode,
      report.email,
      report.subjectName,
      report.subjectCode,
      report.className
    ]
      .join(' ')
      .toLowerCase()

    const matchesSearch =
      !search || searchableText.includes(search)

    return matchesClass && matchesSubject && matchesSearch
  })
})

const trackedStudents = computed(() => {
  return new Set(
    filteredReports.value.map((report) => report.studentId)
  ).size
})

const overallPercentage = computed(() => {
  const totals = filteredReports.value.reduce(
    (result, report) => {
      result.sessions += Number(report.sessionsHeld || 0)
      result.present += Number(report.presentCount || 0)
      return result
    },
    { sessions: 0, present: 0 }
  )

  if (totals.sessions === 0) {
    return null
  }

  return Math.round(
    (totals.present / totals.sessions) * 100
  )
})

const totalPresent = computed(() => {
  return filteredReports.value.reduce((total, report) => {
    return total + Number(report.presentCount || 0)
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

function resetFilters() {
  searchText.value = ''
  selectedClassId.value = ''
  selectedSubjectId.value = ''
}

function attendanceLabel(report) {
  if (report.attendancePercentage === null) {
    return 'No sessions yet'
  }

  return `${report.attendancePercentage}%`
}

function attendanceClass(report) {
  const percentage = report.attendancePercentage

  if (percentage === null) {
    return 'none'
  }

  if (percentage >= 75) {
    return 'good'
  }

  if (percentage >= 50) {
    return 'warning'
  }

  return 'low'
}

async function loadReports() {
  isLoading.value = true
  message.value = ''

  try {
    const response = await axios.get(
      `${apiUrl}/admin/reports/student-attendance`,
      authHeaders()
    )

    reports.value = response.data.reports
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    message.value =
      error.response?.data?.message ||
      'Could not load attendance reports.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadReports)
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

        <button
          class="nav-item"
          type="button"
          @click="router.push('/admin/attendance')"
        >
          ✓ <span>Attendance sessions</span>
        </button>

        <button class="nav-item active" type="button">
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
          <p class="eyebrow">ATTENDANCE REPORTS</p>
          <h1>Student attendance</h1>
          <p class="subtext">
            Review attendance percentages by student and subject.
          </p>
        </div>

        <button
          class="refresh-button"
          type="button"
          @click="loadReports"
        >
          ↻ Refresh
        </button>
      </header>

      <p v-if="message" class="message error">
        {{ message }}
      </p>

      <section class="stat-grid">
        <article class="stat-card">
          <div class="stat-icon teal">♙</div>
          <div>
            <p>Students tracked</p>
            <strong>{{ trackedStudents }}</strong>
            <small>In the selected report</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon blue">%</div>
          <div>
            <p>Overall attendance</p>
            <strong>
              {{
                overallPercentage === null
                  ? '—'
                  : `${overallPercentage}%`
              }}
            </strong>
            <small>Across selected records</small>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-icon orange">✓</div>
          <div>
            <p>Present records</p>
            <strong>{{ totalPresent }}</strong>
            <small>Successful attendance marks</small>
          </div>
        </article>
      </section>

      <section class="filters-panel">
        <label>
          Search
          <input
            v-model="searchText"
            type="search"
            placeholder="Student, roll number, subject…"
          />
        </label>

        <label>
          Class
          <select
            v-model="selectedClassId"
            @change="selectedSubjectId = ''"
          >
            <option value="">All classes</option>

            <option
              v-for="classItem in classes"
              :key="classItem.id"
              :value="classItem.id"
            >
              {{ classItem.className }} —
              {{ classItem.academicYear }}
            </option>
          </select>
        </label>

        <label>
          Subject
          <select v-model="selectedSubjectId">
            <option value="">All subjects</option>

            <option
              v-for="subject in subjects"
              :key="subject.id"
              :value="subject.id"
            >
              {{ subject.subjectName }}
            </option>
          </select>
        </label>

        <button
          class="clear-button"
          type="button"
          @click="resetFilters"
        >
          Clear filters
        </button>
      </section>

      <section class="table-panel">
        <div class="panel-title">
          <div>
            <p class="panel-eyebrow">REPORT DIRECTORY</p>
            <h2>Student subject reports</h2>
          </div>

          <span class="count-badge">
            {{ filteredReports.length }} records
          </span>
        </div>

        <div v-if="isLoading" class="empty-state">
          Loading attendance reports…
        </div>

        <div
          v-else-if="reports.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">▧</div>
          <strong>No report data yet</strong>
          <p>
            Assign students, then run attendance sessions to build
            their reports.
          </p>
        </div>

        <div
          v-else-if="filteredReports.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">⌕</div>
          <strong>No matching records</strong>
          <p>Try clearing or changing the report filters.</p>
        </div>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Sessions</th>
                <th>Present</th>
                <th>Attendance</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="report in filteredReports"
                :key="`${report.studentId}-${report.subjectId}`"
              >
                <td>
                  <strong>
                    {{ report.firstName }} {{ report.lastName }}
                  </strong>
                  <small>{{ report.studentCode }}</small>
                </td>

                <td>
                  <strong>{{ report.className }}</strong>
                  <small>{{ report.academicYear }}</small>
                </td>

                <td>
                  <strong>{{ report.subjectName }}</strong>
                  <small>{{ report.subjectCode }}</small>
                </td>

                <td>{{ report.sessionsHeld }}</td>
                <td>{{ report.presentCount }}</td>

                <td>
                  <span
                    class="percentage"
                    :class="attendanceClass(report)"
                  >
                    {{ attendanceLabel(report) }}
                  </span>
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

.refresh-button,
.clear-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.refresh-button {
  color: #0d897e;
  background: #eef7f5;
}

.clear-button {
  height: 45px;
  color: #087c73;
  background: #d8efeb;
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
.filters-panel,
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

.filters-panel {
  display: grid;
  grid-template-columns: minmax(210px, 1.4fr) 1fr 1fr auto;
  align-items: end;
  gap: 15px;
  margin-top: 22px;
  padding: 20px;
}

.filters-panel label {
  display: grid;
  gap: 7px;
  color: #30424c;
  font-size: 13px;
  font-weight: 700;
}

.filters-panel input,
.filters-panel select {
  width: 100%;
  height: 45px;
  padding: 0 12px;
  border: 1px solid #cedbdc;
  border-radius: 9px;
  outline: none;
  color: #293b45;
  background: #f9fdfc;
  font: inherit;
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

.count-badge {
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

.percentage {
  display: inline-block;
  padding: 6px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}

.percentage.good {
  color: #087c73;
  background: #d8efeb;
}

.percentage.warning {
  color: #8a6a35;
  background: #fcedd8;
}

.percentage.low {
  color: #a64040;
  background: #fbe4e4;
}

.percentage.none {
  color: #718087;
  background: #e4eceb;
}

@media (max-width: 1000px) {
  .filters-panel {
    grid-template-columns: 1fr 1fr;
  }

  .clear-button {
    grid-column: 1 / -1;
  }
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

  .filters-panel {
    grid-template-columns: 1fr;
  }

  .clear-button {
    grid-column: auto;
  }
}
</style>