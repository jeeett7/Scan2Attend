<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const apiUrl =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api'

const status = ref('loading')
const message = ref('Checking this live QR code…')
const attendance = ref(null)
let dashboardRedirectTimer

function createDeviceId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  // Phones opening a local HTTP address are not a secure browser context, so
  // some mobile browsers do not expose crypto.randomUUID(). This identifier
  // only distinguishes one browser from another for the current session; it
  // is not used as an authentication secret.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const randomValue = Math.floor(Math.random() * 16)
      const value =
        character === 'x'
          ? randomValue
          : (randomValue & 0x3) | 0x8

      return value.toString(16)
    }
  )
}

function getDeviceId() {
  const storageKey = 'scan2attend_device_id'
  const savedDeviceId = localStorage.getItem(storageKey)

  if (savedDeviceId) {
    return savedDeviceId
  }

  const deviceId = createDeviceId()
  localStorage.setItem(storageKey, deviceId)
  return deviceId
}

function getSavedUser() {
  try {
    return JSON.parse(
      localStorage.getItem('scan2attend_user') || 'null'
    )
  } catch {
    return null
  }
}

function requireFreshStudentLogin(scanClaim) {
  localStorage.removeItem('scan2attend_token')
  localStorage.removeItem('scan2attend_user')

  sessionStorage.setItem(
    'scan2attend_pending_attendance_claim',
    scanClaim
  )

  router.replace({
    path: '/',
    query: {
      next: `/attendance/scan/claim/${scanClaim}`
    }
  })
}

function getQrDetails() {
  const sessionPublicId = String(
    route.params.sessionPublicId || route.query.session || ''
  )
  const token = String(route.params.token || route.query.token || '')

  return { sessionPublicId, token }
}

function showStudentLogin() {
  status.value = 'login'
  message.value = 'Please log in as a student to complete your attendance.'
}

function hasFreshLoginForClaim(scanClaim) {
  return (
    sessionStorage.getItem('scan2attend_fresh_attendance_claim') ===
    scanClaim
  )
}

async function claimLiveQr() {
  const { sessionPublicId, token } = getQrDetails()

  if (!sessionPublicId || !token) {
    status.value = 'error'
    message.value = 'This attendance QR link is incomplete.'
    return
  }

  status.value = 'loading'
  message.value = 'Checking this live QR code…'

  try {
    const response = await axios.post(
      `${apiUrl}/attendance/student/claim`,
      {
        sessionPublicId,
        token,
        deviceId: getDeviceId()
      },
      { timeout: 10000 }
    )

    const scanClaim = response.data.scanClaim
    const claimPath = `/attendance/scan/claim/${scanClaim}`

    // Remove the expiring QR token from the address immediately. The claim
    // proves that this phone opened the QR while it was live.
    if (route.path !== claimPath) {
      router.replace(claimPath)
    }

    await continueWithScanClaim(scanClaim)
  } catch (error) {
    status.value = 'error'
    message.value =
      error.response?.data?.message ||
      'Could not verify this QR code. Check the network and scan again.'
  }
}

async function continueWithScanClaim(scanClaim) {
  if (!scanClaim) {
    status.value = 'error'
    message.value = 'This attendance scan link is incomplete.'
    return
  }

  const savedUser = getSavedUser()
  const savedToken = localStorage.getItem('scan2attend_token')

  if (
    !savedToken ||
    !savedUser ||
    savedUser.role !== 'student' ||
    !hasFreshLoginForClaim(scanClaim)
  ) {
    requireFreshStudentLogin(scanClaim)
    return
  }

  status.value = 'loading'
  message.value = 'Marking your attendance…'

  try {
    const response = await axios.post(
      `${apiUrl}/attendance/student/mark`,
      {
        scanClaim
      },
      {
        headers: {
          Authorization: `Bearer ${savedToken}`
        },
        timeout: 10000
      }
    )

    attendance.value = response.data
    sessionStorage.removeItem('scan2attend_fresh_attendance_claim')
    status.value = 'success'
    message.value = 'Your attendance has been recorded. Taking you to your dashboard…'

    dashboardRedirectTimer = window.setTimeout(() => {
      router.replace('/student/dashboard')
    }, 2000)
  } catch (error) {
    if (error.response?.status === 401) {
      requireFreshStudentLogin(scanClaim)
      return
    }

    status.value = 'error'
    message.value =
      error.response?.data?.message ||
      'Could not mark attendance. Check the network and try again.'
  }
}

onMounted(() => {
  const scanClaim = String(route.params.scanClaim || '')

  if (scanClaim) {
    continueWithScanClaim(scanClaim)
    return
  }

  claimLiveQr()
})

onBeforeUnmount(() => {
  window.clearTimeout(dashboardRedirectTimer)
})
</script>

<template>
  <main class="scan-page">
    <section class="scan-card">
      <div
        class="status-icon"
        :class="status"
      >
        {{
          status === 'success'
            ? '✓'
            : status === 'error'
              ? '!'
              : status === 'login'
                ? '→'
                : '…'
        }}
      </div>

      <p class="eyebrow">SCAN2ATTEND</p>

      <h1>
        {{
          status === 'success'
            ? 'Attendance marked successfully'
            : status === 'login'
              ? 'Please log in first'
            : status === 'error'
                ? 'Unable to mark attendance'
                : 'Checking live QR code'
        }}
      </h1>

      <p class="message">{{ message }}</p>

      <div
        v-if="status === 'success' && attendance"
        class="attendance-details"
      >
        <strong>{{ attendance.subjectName }}</strong>
        <span>{{ attendance.className }}</span>
      </div>

      <button
        v-if="status === 'login'"
        class="primary-button"
        type="button"
        @click="goToStudentLogin"
      >
        Go to student login
      </button>

      <button
        v-if="status === 'error'"
        class="secondary-button"
        type="button"
        @click="router.push('/')"
      >
        Go to login
      </button>
    </section>
  </main>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.scan-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  color: #293b45;
  background: linear-gradient(135deg, #e6f0ef, #d3ece8);
  font-family: "Segoe UI", Arial, sans-serif;
}

.scan-card {
  width: min(100%, 460px);
  padding: 42px 32px;
  border: 1px solid #d3e3e0;
  border-radius: 22px;
  background: #f0f7f6;
  box-shadow: 0 18px 45px rgba(35, 55, 65, 0.12);
  text-align: center;
}

.status-icon {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  margin: 0 auto 22px;
  border-radius: 50%;
  color: #087c73;
  background: #d8efeb;
  font-size: 33px;
  font-weight: 800;
}

.status-icon.success {
  color: white;
  background: #119e91;
}

.status-icon.error {
  color: #a64040;
  background: #fbe4e4;
}

.status-icon.login {
  color: #4476bf;
  background: #ddeafa;
}

.eyebrow {
  margin: 0 0 10px;
  color: #119e91;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 2px;
}

h1 {
  margin: 0;
  color: #293b45;
  font-size: 28px;
}

.message {
  margin: 13px auto 0;
  color: #718087;
  line-height: 1.55;
}

.attendance-details {
  display: grid;
  gap: 4px;
  margin-top: 24px;
  padding: 17px;
  border-radius: 13px;
  background: #eaf4f2;
}

.attendance-details strong {
  color: #293b45;
}

.attendance-details span {
  color: #718087;
  font-size: 14px;
}

.primary-button,
.secondary-button {
  width: 100%;
  margin-top: 25px;
  border: 0;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
}

.primary-button {
  color: white;
  background: #119e91;
}

.secondary-button {
  color: #087c73;
  background: #d8efeb;
}
</style>
