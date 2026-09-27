<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import QRCode from 'qrcode'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

const assignments = ref([])
const selectedAssignmentId = ref('')
const activeSession = ref(null)
const qrImage = ref('')
const isQrExpanded = ref(false)
const isLoading = ref(true)
const isStarting = ref(false)
const isEnding = ref(false)
const isCancelling = ref(false)
const message = ref('')
const messageType = ref('success')
const secondsRemaining = ref(0)

let countdownTimer = null
let refreshTimer = null

const selectedAssignment = computed(() => {
  return assignments.value.find(
    (item) =>
      item.teacherAssignmentId ===
      Number(selectedAssignmentId.value)
  )
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

function showMessage(text, type = 'success') {
  message.value = text
  messageType.value = type
}

function stopTimers() {
  clearInterval(countdownTimer)
  clearInterval(refreshTimer)

  countdownTimer = null
  refreshTimer = null
}

function updateCountdown() {
  if (!activeSession.value) {
    secondsRemaining.value = 0
    return
  }

  const expiresAt = new Date(
    activeSession.value.expiresAt
  ).getTime()

  secondsRemaining.value = Math.max(
    0,
    Math.ceil((expiresAt - Date.now()) / 1000)
  )
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

async function createQrImage(token) {
  if (!activeSession.value || !token) {
    isQrExpanded.value = false
    qrImage.value = ''
    return
  }

  const appUrl =
    import.meta.env.VITE_PUBLIC_APP_URL ||
    window.location.origin

  const scanUrl =
    `${appUrl}/attendance/scan/` +
    `${encodeURIComponent(activeSession.value.sessionPublicId)}/` +
    encodeURIComponent(token)

  qrImage.value = await QRCode.toDataURL(scanUrl, {
    width: 760,
    margin: 2,
    color: {
      dark: '#193943',
      light: '#ffffff'
    }
  })
}

async function loadAssignments() {
  isLoading.value = true

  try {
    const response = await axios.get(
      `${apiUrl}/attendance/teacher/assignments`,
      authHeaders()
    )

    assignments.value = response.data.assignments
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    showMessage(
      error.response?.data?.message ||
        'Could not load your assigned subjects.',
      'error'
    )
  } finally {
    isLoading.value = false
  }
}

async function refreshSession() {
  if (!activeSession.value) {
    return
  }

  try {
    const response = await axios.get(
      `${apiUrl}/attendance/teacher/sessions/${activeSession.value.sessionPublicId}`,
      authHeaders()
    )

    activeSession.value = response.data.session
    updateCountdown()

    if (activeSession.value.status !== 'active') {
      qrImage.value = ''
      stopTimers()
      showMessage('This attendance session has ended.')
      return
    }

    await createQrImage(response.data.qrToken)
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
    }
  }
}

function startTimers() {
  stopTimers()
  updateCountdown()

  countdownTimer = setInterval(updateCountdown, 1000)
  // Fetch often enough to display each five-second QR as soon as it changes.
  refreshTimer = setInterval(refreshSession, 1000)
}

async function startSession() {
  if (!selectedAssignmentId.value) {
    showMessage(
      'Choose a class and subject before starting.',
      'error'
    )
    return
  }

  isStarting.value = true
  message.value = ''

  try {
    const response = await axios.post(
      `${apiUrl}/attendance/teacher/sessions`,
      {
        teacherAssignmentId: Number(selectedAssignmentId.value)
      },
      authHeaders()
    )

    activeSession.value = response.data.session
    await createQrImage(response.data.qrToken)
    startTimers()

    showMessage(response.data.message)
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not start the attendance session.',
      'error'
    )
  } finally {
    isStarting.value = false
  }
}

async function endSession() {
  if (!activeSession.value) {
    return
  }

  isEnding.value = true

  try {
    const response = await axios.post(
      `${apiUrl}/attendance/teacher/sessions/${activeSession.value.sessionPublicId}/end`,
      {},
      authHeaders()
    )

    activeSession.value = {
      ...activeSession.value,
      status: 'ended'
    }

    qrImage.value = ''
    stopTimers()
    showMessage(response.data.message)
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not end the attendance session.',
      'error'
    )
  } finally {
    isEnding.value = false
  }
}

async function cancelSession() {
  if (!activeSession.value) {
    return
  }

  const confirmed = window.confirm(
    'Cancel this attendance session? It will be permanently removed from attendance history.'
  )

  if (!confirmed) {
    return
  }

  isCancelling.value = true

  try {
    const response = await axios.delete(
      `${apiUrl}/attendance/teacher/sessions/${activeSession.value.sessionPublicId}`,
      authHeaders()
    )

    activeSession.value = null
    qrImage.value = ''
    isQrExpanded.value = false
    stopTimers()
    showMessage(response.data.message)
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not cancel the attendance session.',
      'error'
    )
  } finally {
    isCancelling.value = false
  }
}

onMounted(loadAssignments)
onBeforeUnmount(stopTimers)
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
        <button
          class="nav-item"
          type="button"
          @click="router.push('/teacher/dashboard')"
        >
          ⌂ <span>Dashboard</span>
        </button>

        <button class="nav-item active" type="button">
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
          <p class="eyebrow">LIVE ATTENDANCE</p>
          <h1>Take attendance</h1>
          <p class="subtext">
            Start a one-minute session and display its live QR code.
          </p>
        </div>

        <button
          class="back-button"
          type="button"
          @click="router.push('/teacher/dashboard')"
        >
          Back to dashboard
        </button>
      </header>

      <p
        v-if="message"
        class="message"
        :class="{ error: messageType === 'error' }"
      >
        {{ message }}
      </p>

      <section
        v-if="!activeSession || activeSession.status !== 'active'"
        class="panel"
      >
        <p class="panel-eyebrow">START SESSION</p>
        <h2>Choose a class and subject</h2>

        <div v-if="isLoading" class="empty-state">
          Loading your assignments…
        </div>

        <div
          v-else-if="assignments.length === 0"
          class="empty-state"
        >
          <div class="empty-icon">▣</div>
          <strong>No teaching assignments yet</strong>
          <p>
            Your administrator must assign you to a class and
            subject first.
          </p>
        </div>

        <div v-else class="start-form">
          <label>
            Your assigned subject
            <select v-model="selectedAssignmentId">
              <option value="" disabled>
                Choose a class and subject
              </option>

              <option
                v-for="assignment in assignments"
                :key="assignment.teacherAssignmentId"
                :value="assignment.teacherAssignmentId"
              >
                {{ assignment.subjectName }} —
                {{ assignment.className }}
              </option>
            </select>
          </label>

          <div v-if="selectedAssignment" class="selection-note">
            <strong>{{ selectedAssignment.subjectCode }}</strong>
            <span>
              {{ selectedAssignment.className }} ·
              {{ selectedAssignment.academicYear }}
            </span>
          </div>

          <div class="form-actions">
            <button
              class="primary-button"
              type="button"
              :disabled="isStarting || !selectedAssignmentId"
              @click="startSession"
            >
              {{
                isStarting
                  ? 'Starting…'
                  : 'Start QR attendance'
              }}
            </button>
          </div>
        </div>
      </section>

      <section
        v-else
        class="live-session"
      >
        <div class="session-heading">
          <div>
            <p class="panel-eyebrow">SESSION ACTIVE</p>
            <h2>{{ activeSession.subjectName }}</h2>
            <p class="session-description">
              {{ activeSession.subjectCode }} ·
              {{ activeSession.className }} ·
              {{ activeSession.academicYear }}
            </p>
          </div>

          <div class="countdown">
            <small>TIME REMAINING</small>
            <strong>{{ formatTime(secondsRemaining) }}</strong>
          </div>
                </div>

        <div class="live-grid">
          <div class="qr-area">
  <button
    class="qr-frame qr-trigger"
    type="button"
    @click="isQrExpanded = true"
  >
    <img
      v-if="qrImage"
      :src="qrImage"
      alt="Live attendance QR code. Click to enlarge."
    />
    <span v-else>Refreshing QR…</span>
  </button>

  <p>
    Click the QR code to enlarge it. It refreshes automatically
    every 5 seconds.
  </p>
</div>

          <div class="live-details">
            <div class="attendance-count">
              <span>✓</span>
              <div>
                <strong>{{ activeSession.presentCount }}</strong>
                <p>
                  {{
                    activeSession.presentCount === 1
                      ? 'student marked present'
                      : 'students marked present'
                  }}
                </p>
              </div>
            </div>

            <div class="info-card">
              <strong>How students mark attendance</strong>
              <p>
                Students scan this code with their phone camera,
                log in if needed, and are marked present
                automatically.
              </p>
            </div>

            <div class="session-actions">
              <button
                class="end-button"
                type="button"
                :disabled="isEnding || isCancelling"
                @click="endSession"
              >
                {{
                  isEnding
                    ? 'Ending…'
                    : 'End attendance session'
                }}
              </button>

              <button
                class="cancel-button"
                type="button"
                :disabled="isEnding || isCancelling"
                @click="cancelSession"
              >
                {{ isCancelling ? 'Cancelling…' : 'Cancel session' }}
              </button>
            </div>
          </div>
        </div>
      </section>
      <div
  v-if="isQrExpanded && qrImage"
  class="qr-overlay"
  role="dialog"
  aria-modal="true"
  aria-label="Enlarged attendance QR code"
  @click.self="isQrExpanded = false"
>
  <div class="qr-modal">
    <div class="qr-modal-header">
      <div>
        <strong>Live attendance QR</strong>
        <span>Students can scan this from farther away.</span>
      </div>

      <button
        class="close-qr-button"
        type="button"
        @click="isQrExpanded = false"
      >
        × Close
      </button>
    </div>

    <img
      :src="qrImage"
      alt="Enlarged live attendance QR code"
    />
  </div>
</div>
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

.back-button,
.primary-button,
.end-button,
.cancel-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.back-button {
  color: #0d897e;
  background: #eef7f5;
}

.primary-button {
  color: white;
  background: #119e91;
}

.end-button {
  flex: 1;
  color: white;
  background: #293b45;
}

.primary-button:disabled,
.end-button:disabled,
.cancel-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.session-actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.cancel-button {
  flex: 1;
  color: #a64040;
  background: #fbe4e4;
}

.message {
  margin: 18px 0 0;
  padding: 12px 15px;
  border-radius: 10px;
  color: #08766c;
  background: #d8efeb;
  font-size: 13px;
  font-weight: 700;
}

.message.error {
  color: #a64040;
  background: #fae0e0;
}

.panel,
.live-session {
  margin-top: 22px;
  padding: 24px;
  border: 1px solid #d3e3e0;
  border-radius: 16px;
  background: #f0f7f6;
  box-shadow: 0 8px 24px rgba(35, 55, 65, 0.06);
}

.panel-eyebrow {
  margin: 0 0 7px;
  color: #119e91;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}

.start-form {
  margin-top: 24px;
}

.start-form label {
  display: grid;
  max-width: 650px;
  gap: 7px;
  color: #30424c;
  font-size: 13px;
  font-weight: 700;
}

.start-form select {
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

.selection-note {
  display: flex;
  gap: 9px;
  margin-top: 13px;
  color: #718087;
  font-size: 13px;
}

.selection-note strong {
  color: #119e91;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.session-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.session-description {
  margin: 7px 0 0;
  color: #718087;
  font-size: 13px;
}

.countdown {
  min-width: 126px;
  padding: 12px;
  border-radius: 12px;
  color: #087c73;
  background: #d8efeb;
  text-align: center;
}

.countdown small {
  display: block;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}

.countdown strong {
  display: block;
  margin-top: 4px;
  font-size: 24px;
}

.live-grid {
  display: grid;
  grid-template-columns: minmax(250px, 0.8fr) minmax(260px, 1fr);
  align-items: center;
  gap: 32px;
  margin-top: 24px;
}

.qr-area {
  text-align: center;
}

.qr-frame {
  width: min(100%, 320px);
  min-height: 320px;
  display: grid;
  place-items: center;
  margin: auto;
  padding: 10px;
  border: 1px solid #d3e3e0;
  border-radius: 16px;
  color: #718087;
  background: white;
}

.qr-frame img {
  width: 100%;
  height: auto;
  display: block;
}

.qr-area p {
  margin: 13px 0 0;
  color: #718087;
  font-size: 12px;
}

.live-details {
  min-width: 0;
}

.attendance-count {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 13px;
  background: #e1f1df;
}

.attendance-count > span {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #55915e;
  background: #f4fbf3;
  font-size: 25px;
  font-weight: 800;
}

.attendance-count strong {
  display: block;
  color: #29434e;
  font-size: 28px;
}

.attendance-count p {
  margin: 2px 0 0;
  color: #718087;
  font-size: 12px;
}

.info-card {
  margin-top: 15px;
  padding: 17px;
  border: 1px solid #d3e3e0;
  border-radius: 12px;
  background: #eaf4f2;
}

.info-card strong {
  color: #293b45;
  font-size: 14px;
}

.info-card p {
  margin: 6px 0 0;
  color: #718087;
  font-size: 12px;
  line-height: 1.5;
}

.empty-state {
  display: grid;
  justify-items: center;
  padding: 50px 20px 0;
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
  max-width: 280px;
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.5;
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

  .topbar,
  .session-heading,
  .live-grid {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
  }

  .live-grid {
    gap: 22px;
  }

  .qr-area,
  .live-details {
    width: 100%;
  }

  .back-button {
    width: 100%;
  }
}
.qr-trigger {
  cursor: zoom-in;
  font: inherit;
}

.qr-trigger:hover {
  border-color: #119e91;
  box-shadow: 0 0 0 4px rgba(17, 158, 145, 0.13);
}

.qr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(18, 42, 49, 0.8);
}

.qr-modal {
  width: min(92vw, 720px);
  padding: 22px;
  border-radius: 18px;
  background: #f0f7f6;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
}

.qr-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 17px;
}

.qr-modal-header strong,
.qr-modal-header span {
  display: block;
}

.qr-modal-header strong {
  color: #293b45;
  font-size: 18px;
}

.qr-modal-header span {
  margin-top: 4px;
  color: #718087;
  font-size: 12px;
}

.close-qr-button {
  flex: 0 0 auto;
  border: 0;
  padding: 10px 13px;
  border-radius: 9px;
  color: #a64040;
  background: #fbe4e4;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.qr-modal img {
  width: min(55vh, 540px);
  height: min(55vh, 540px);
  max-width: 100%;
  display: block;
  margin: 0 auto;
  object-fit: contain;
  border-radius: 10px;
  background: white;
}
</style>
