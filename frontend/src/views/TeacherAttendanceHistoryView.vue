<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const sessions = ref([])
const isLoading = ref(true)
const selectedSessionId = ref(null)
const report = ref(null)
const isLoadingReport = ref(false)
const message = ref('')

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

function fileName() {
  const session = report.value.session
  const safeSubject = session.subjectCode.replace(/[^a-z0-9]/gi, '-')
  const day = new Date(session.startedAt).toISOString().slice(0, 10)

  return `Scan2Attend-${safeSubject}-${day}`
}

async function loadSessions() {
  isLoading.value = true
  message.value = ''

  try {
    const response = await axios.get(
      `${apiUrl}/teacher/attendance/sessions`,
      authHeaders()
    )
    sessions.value = response.data.sessions
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    message.value =
      error.response?.data?.message ||
      'Could not load attendance history.'
  } finally {
    isLoading.value = false
  }
}

async function viewReport(session) {
  if (selectedSessionId.value === session.sessionPublicId) {
    selectedSessionId.value = null
    report.value = null
    return
  }

  selectedSessionId.value = session.sessionPublicId
  report.value = null
  isLoadingReport.value = true
  message.value = ''

  try {
    const response = await axios.get(
      `${apiUrl}/teacher/attendance/sessions/${session.sessionPublicId}/report`,
      authHeaders()
    )
    report.value = response.data
  } catch (error) {
    selectedSessionId.value = null
    message.value =
      error.response?.data?.message ||
      'Could not load this attendance report.'
  } finally {
    isLoadingReport.value = false
  }
}

function downloadExcel() {
  if (!report.value) return

  const { session, records, presentCount } = report.value
  const rows = [
    ['Scan2Attend — Attendance report'],
    ['Subject', `${session.subjectName} (${session.subjectCode})`],
    ['Class', `${session.className} (${session.classCode})`],
    ['Session started', formatDate(session.startedAt)],
    ['Present', `${presentCount} of ${records.length}`],
    [],
    ['Roll number', 'Student name', 'Email', 'Status', 'Marked at'],
    ...records.map((record) => [
      record.studentCode,
      `${record.firstName} ${record.lastName}`,
      record.email,
      record.attendanceStatus,
      record.markedAt ? formatDate(record.markedAt) : '—'
    ])
  ]

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 32 },
    { wch: 13 },
    { wch: 22 }
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance')
  XLSX.writeFile(workbook, `${fileName()}.xlsx`)
}

function downloadPdf() {
  if (!report.value) return

  const { session, records, presentCount } = report.value
  const document = new jsPDF({ unit: 'mm', format: 'a4' })

  document.setFontSize(18)
  document.setTextColor(17, 158, 145)
  document.text('Scan2Attend', 14, 18)

  document.setFontSize(14)
  document.setTextColor(41, 59, 69)
  document.text('Attendance report', 14, 27)

  document.setFontSize(10)
  document.text(`Subject: ${session.subjectName} (${session.subjectCode})`, 14, 37)
  document.text(`Class: ${session.className} (${session.classCode})`, 14, 43)
  document.text(`Session: ${formatDate(session.startedAt)}`, 14, 49)
  document.text(`Present: ${presentCount} of ${records.length}`, 14, 55)

  autoTable(document, {
    startY: 63,
    head: [['Roll number', 'Student name', 'Status', 'Marked at']],
    body: records.map((record) => [
      record.studentCode,
      `${record.firstName} ${record.lastName}`,
      record.attendanceStatus,
      record.markedAt ? formatDate(record.markedAt) : '—'
    ]),
    headStyles: {
      fillColor: [17, 158, 145]
    },
    styles: {
      fontSize: 9
    }
  })

  document.save(`${fileName()}.pdf`)
}

onMounted(loadSessions)
</script>

<template>
  <div class="page">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>
        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>TEACHER PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
        <button class="nav-item" type="button" @click="router.push('/teacher/dashboard')">
          ⌂ <span>Dashboard</span>
        </button>
        <button class="nav-item" type="button" @click="router.push('/teacher/take-attendance')">
          ▣ <span>Take attendance</span>
        </button>
        <button class="nav-item active" type="button">
          ✓ <span>Attendance report</span>
        </button>
        <button class="nav-item" type="button" @click="router.push('/teacher/timetable')">
          ▦ <span>Lecture timetable</span>
        </button>
      </nav>

      <div class="sidebar-bottom">
        <button class="logout" type="button" @click="logout">↪ <span>Log out</span></button>
      </div>
    </aside>

    <main class="content">
      <header class="hero">
        <div>
          <p class="eyebrow">TEACHER RECORDS</p>
          <h1>Attendance history</h1>
          <p>Review each session and download its class attendance report.</p>
        </div>
        <button class="refresh-button" type="button" @click="loadSessions">↻ Refresh</button>
      </header>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="history-card">
        <div class="section-title">
          <div>
            <p class="eyebrow dark">SESSION DIRECTORY</p>
            <h2>My attendance sessions</h2>
          </div>
          <span class="count-pill">{{ sessions.length }} total</span>
        </div>

        <div v-if="isLoading" class="empty-state">Loading attendance history…</div>

        <div v-else-if="sessions.length === 0" class="empty-state">
          <div class="empty-icon">✓</div>
          <h3>No sessions yet</h3>
          <p>Start an attendance session to create your first record.</p>
        </div>

        <div v-else class="session-list">
          <article v-for="session in sessions" :key="session.sessionPublicId" class="session-row">
            <div class="session-main">
              <span class="status" :class="session.status">{{ session.status }}</span>
              <div>
                <strong>{{ session.subjectName }}</strong>
                <p>{{ session.subjectCode }} · {{ session.className }}</p>
              </div>
            </div>

            <div class="session-detail">
              <small>STARTED</small>
              <span>{{ formatDate(session.startedAt) }}</span>
            </div>

            <div class="session-detail">
              <small>ATTENDANCE</small>
              <strong>{{ session.presentCount }} / {{ session.studentCount }} present</strong>
            </div>

            <button class="view-button" type="button" @click="viewReport(session)">
              {{ selectedSessionId === session.sessionPublicId ? 'Close report' : 'View report' }}
            </button>

            <section
              v-if="selectedSessionId === session.sessionPublicId"
              class="report-panel"
            >
              <div v-if="isLoadingReport" class="empty-state compact">Loading report…</div>

              <template v-else-if="report">
                <div class="report-toolbar">
                  <div>
                    <h3>Student attendance</h3>
                    <p>{{ report.presentCount }} present · {{ report.records.length - report.presentCount }} absent</p>
                  </div>
                  <div class="download-actions">
                    <button type="button" class="excel-button" @click="downloadExcel">Download Excel</button>
                    <button type="button" class="pdf-button" @click="downloadPdf">Download PDF</button>
                  </div>
                </div>

                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Roll number</th>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Marked at</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="record in report.records" :key="record.studentId">
                        <td>{{ record.studentCode }}</td>
                        <td><strong>{{ record.firstName }} {{ record.lastName }}</strong></td>
                        <td>{{ record.email }}</td>
                        <td><span class="record-status" :class="record.attendanceStatus.toLowerCase()">{{ record.attendanceStatus }}</span></td>
                        <td>{{ record.markedAt ? formatDate(record.markedAt) : '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </section>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }
.page { min-height: 100vh; display: flex; color: #293b45; background: #e6f0ef; font-family: "Segoe UI", Arial, sans-serif; }
.sidebar { width: 320px; min-height: 100vh; position: fixed; display: flex; flex-direction: column; padding: 34px 20px; color: white; background: #293b45; }
.sidebar-brand { display: flex; align-items: center; gap: 14px; padding: 0 12px 36px; border-bottom: 1px solid rgba(255,255,255,.17); }
.brand-icon { display: grid; width: 50px; height: 50px; place-items: center; border-radius: 14px; background: #119e91; font-size: 30px; font-weight: 800; }
.wordmark { display: block; font-size: 26px; letter-spacing: -1.5px; }.wordmark span { color: #21c8bb; }.sidebar small { display: block; margin-top: 4px; color: #c5d0d3; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; }
.navigation { display: grid; gap: 10px; margin-top: 32px; }.nav-item, .logout { width: 100%; border: 0; border-radius: 12px; padding: 15px 17px; cursor: pointer; color: #f7fbfb; background: transparent; text-align: left; font: inherit; font-weight: 750; font-size: 16px; }.nav-item span, .logout span { margin-left: 14px; }.nav-item:hover, .nav-item.active { background: #119e91; }.sidebar-bottom { margin-top: auto; }.logout { color: #dfe8e9; }
.content { width: 100%; min-height: 100vh; margin-left: 320px; padding: 40px clamp(24px, 5vw, 68px); font-size: 15px; }.hero { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 30px 34px; border-radius: 20px; color: white; background: linear-gradient(120deg,#19aaa0,#0f8f84); box-shadow: 0 15px 30px rgba(17,158,145,.16); }.eyebrow { margin: 0 0 9px; font-size: 11px; font-weight: 800; letter-spacing: 1.8px; }.eyebrow::after { content: ''; display: block; width: 140px; height: 3px; margin-top: 7px; background: currentColor; }.hero h1 { margin: 0; font-size: clamp(30px,3.5vw,44px); letter-spacing: -1.2px; }.hero p:not(.eyebrow) { margin: 10px 0 0; font-size: 16px; }.refresh-button, .view-button, .excel-button, .pdf-button { border: 0; border-radius: 10px; padding: 11px 15px; cursor: pointer; font: inherit; font-weight: 800; font-size: 14px; }.refresh-button { color: #087c73; background: #f5fbfa; }.message { margin: 20px 0 0; padding: 12px 15px; border-radius: 11px; color: #a64040; background: #fbe2e2; font-weight: 700; }.history-card { margin-top: 28px; padding: 24px; border: 1px solid #d5e3e0; border-radius: 18px; background: #f0f7f6; box-shadow: 0 10px 24px rgba(41,59,69,.05); }.section-title, .report-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 18px; }.dark { color: #119e91; }.section-title h2, .report-toolbar h3 { margin: 0; font-size: 24px; }.count-pill { padding: 8px 11px; border-radius: 99px; color: #087c73; background: #d8efeb; font-size: 12px; font-weight: 800; }.empty-state { display: grid; min-height: 190px; place-content: center; text-align: center; color: #718087; }.empty-state h3 { margin: 12px 0 4px; color: #293b45; }.empty-state p { margin: 0; }.empty-state.compact { min-height: 76px; }.empty-icon { display: grid; width: 46px; height: 46px; place-items: center; margin: auto; border-radius: 50%; color: #119e91; background: #d8efeb; font-size: 22px; font-weight: 900; }.session-list { display: grid; gap: 8px; margin-top: 20px; }.session-row { display: grid; grid-template-columns: minmax(220px,1.7fr) minmax(140px,1fr) minmax(135px,.8fr) auto; gap: 16px; align-items: center; padding: 17px 12px; border-top: 1px solid #d9e5e2; }.session-main { display: flex; align-items: center; gap: 12px; }.session-main strong { font-size: 15px; }.session-main p { margin: 4px 0 0; color: #718087; font-size: 14px; }.status, .record-status { display: inline-block; padding: 6px 9px; border-radius: 99px; text-transform: capitalize; font-size: 11px; font-weight: 800; }.status.ended { color: #356fba; background: #dceafa; }.status.expired { color: #9b681c; background: #fff0d6; }.status.active, .record-status.present { color: #087c73; background: #d8efeb; }.record-status.absent { color: #a64040; background: #fbe2e2; }.session-detail { display: grid; gap: 4px; }.session-detail small { color: #718087; font-size: 10px; font-weight: 800; letter-spacing: .7px; }.session-detail span { font-size: 13px; }.view-button { color: white; background: #119e91; white-space: nowrap; }.report-panel { grid-column: 1 / -1; padding: 20px; border-radius: 13px; background: #e7f1ef; }.report-toolbar p { margin: 5px 0 0; color: #718087; font-size: 14px; }.download-actions { display: flex; flex-wrap: wrap; gap: 8px; }.excel-button { color: #087c73; background: #d8efeb; }.pdf-button { color: white; background: #293b45; }.table-wrap { overflow-x: auto; margin-top: 18px; }table { width: 100%; border-collapse: collapse; min-width: 680px; }th,td { padding: 11px 12px; border-bottom: 1px solid #d2e1de; text-align: left; }th { color: #718087; font-size: 11px; letter-spacing: .5px; text-transform: uppercase; }td { font-size: 13px; }
@media (max-width: 900px) { .sidebar { width: 78px; padding: 24px 10px; }.sidebar-brand { justify-content: center; padding: 0 0 25px; }.sidebar-brand > div:last-child, .nav-item span, .logout span { display: none; }.nav-item,.logout { text-align: center; }.content { margin-left: 78px; padding: 26px; }.session-row { grid-template-columns: 1fr 1fr; }.view-button { justify-self: start; } }
@media (max-width: 620px) { .content { margin-left: 0; padding: 16px; }.sidebar { display: none; }.hero { align-items: flex-start; flex-direction: column; padding: 28px; }.history-card { padding: 20px; }.session-row { grid-template-columns: 1fr; }.report-toolbar { align-items: flex-start; flex-direction: column; } }

/* Match the scale and spacing used by the teacher dashboard. */
.sidebar {
  width: 255px;
  flex: 0 0 255px;
  position: static;
  padding: 26px 16px;
}

.sidebar-brand {
  gap: 11px;
  padding: 0 10px 30px;
  border-color: rgba(255, 255, 255, 0.13);
}

.brand-icon {
  width: 39px;
  height: 39px;
  border-radius: 11px;
  font-size: 22px;
}

.wordmark {
  color: white;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -1.3px;
  line-height: 1;
}

.sidebar small {
  margin-top: 3px;
  color: inherit;
  font-size: 9px;
  font-weight: normal;
  letter-spacing: 1.6px;
  opacity: 0.65;
}

.navigation {
  gap: 7px;
  margin-top: 0;
  padding-top: 28px;
}

.nav-item,
.logout {
  display: flex;
  align-items: center;
  gap: 13px;
  border-radius: 9px;
  padding: 12px 14px;
  color: #c7d0d3;
  font-size: 14px;
  font-weight: 700;
}

.nav-item span,
.logout span {
  margin-left: 0;
}

.nav-item:hover,
.nav-item.active {
  color: white;
}

.content {
  flex: 1;
  width: auto;
  min-width: 0;
  margin-left: 0;
  padding: 42px clamp(24px, 5vw, 70px);
  font-size: 14px;
}

.hero {
  gap: 24px;
  padding: 28px 31px;
  border-radius: 18px;
  background: linear-gradient(135deg, #119e91, #0d897e);
  box-shadow: 0 12px 28px rgba(17, 158, 145, 0.2);
}

.eyebrow {
  display: inline-block;
  margin: 0 0 13px;
  padding-bottom: 7px;
  border-bottom: 3px solid #d7f4f0;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 2.4px;
}

.eyebrow::after {
  display: none;
}

.eyebrow.dark {
  border-color: #119e91;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: clamp(27px, 3vw, 38px);
  letter-spacing: normal;
}

.hero p:not(.eyebrow) {
  margin: 0;
  color: rgba(255, 255, 255, 0.84);
  font-size: 14px;
}

.refresh-button,
.view-button,
.excel-button,
.pdf-button {
  padding: 13px 17px;
  font-size: 13px;
}

.history-card {
  margin-top: 22px;
  padding: 25px;
  border-color: #d3e3e0;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(35, 55, 65, 0.06);
}

.section-title h2,
.report-toolbar h3 {
  font-size: 21px;
}

.session-row {
  padding: 15px 12px;
}

.session-main strong {
  font-size: 14px;
}

.session-main p,
.session-detail span,
.report-toolbar p {
  font-size: 12px;
}

@media (max-width: 750px) {
  .page {
    display: block;
  }

  .sidebar {
    width: 100%;
    min-height: auto;
    display: flex;
    padding: 17px;
  }

  .sidebar-brand {
    justify-content: flex-start;
    padding: 0 10px 15px;
  }

  .sidebar-brand > div:last-child,
  .nav-item span,
  .logout span {
    display: inline;
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

  .hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .session-row {
    grid-template-columns: 1fr;
  }
}
</style>
