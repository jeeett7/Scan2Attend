<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const profile = ref(null)
const isLoading = ref(true)
const message = ref('')
const showPasswordForm = ref(false)
const isChangingPassword = ref(false)
const passwordMessage = ref('')
const passwordMessageType = ref('success')
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const fullName = computed(() => {
  if (!profile.value) return 'Student'
  return `${profile.value.firstName} ${profile.value.lastName}`
})

function authHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('scan2attend_token')}` } }
}

function logout() {
  localStorage.removeItem('scan2attend_token')
  localStorage.removeItem('scan2attend_user')
  router.push('/')
}

async function loadProfile() {
  isLoading.value = true
  message.value = ''
  try {
    const response = await axios.get(`${apiUrl}/student/profile`, authHeaders())
    profile.value = response.data.profile
  } catch (error) {
    if (error.response?.status === 401) return logout()
    message.value = error.response?.data?.message || 'Could not load your profile.'
  } finally {
    isLoading.value = false
  }
}

function resetPasswordForm() {
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  }
}

function closePasswordForm() {
  showPasswordForm.value = false
  passwordMessage.value = ''
  resetPasswordForm()
}

async function changePassword() {
  passwordMessage.value = ''

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordMessageType.value = 'error'
    passwordMessage.value = 'Your new password and confirmation do not match.'
    return
  }

  isChangingPassword.value = true

  try {
    const response = await axios.put(
      `${apiUrl}/student/password`,
      {
        currentPassword: passwordForm.value.currentPassword,
        newPassword: passwordForm.value.newPassword
      },
      authHeaders()
    )

    passwordMessageType.value = 'success'
    passwordMessage.value = response.data.message
    resetPasswordForm()
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    passwordMessageType.value = 'error'
    passwordMessage.value =
      error.response?.data?.message ||
      'Could not change your password. Please try again.'
  } finally {
    isChangingPassword.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <div class="page">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="brand-icon">✓</div><div><strong class="wordmark">Scan<span>2</span>Attend</strong><small>STUDENT PORTAL</small></div></div>
      <nav class="navigation">
        <button class="nav-item" type="button" @click="router.push('/student/dashboard')">⌂ <span>Dashboard</span></button>
        <button class="nav-item" type="button" @click="router.push('/student/attendance-history')">✓ <span>Attendance history</span></button>
        <button class="nav-item" type="button" @click="router.push('/student/timetable')">▦ <span>Lecture timetable</span></button>
        <button class="nav-item active" type="button">♙ <span>My profile</span></button>
      </nav>
      <div class="sidebar-bottom"><button class="logout" type="button" @click="logout">↪ <span>Log out</span></button></div>
    </aside>

    <main class="content">
      <header class="hero"><div><p class="eyebrow">STUDENT ACCOUNT</p><h1>My profile</h1><p>View the account details created by your administrator.</p></div></header>
      <p v-if="message" class="message">{{ message }}</p>
      <section v-if="isLoading" class="profile-card loading">Loading your profile…</section>
      <section v-else-if="profile" class="profile-card">
        <div class="profile-header"><div class="avatar">{{ fullName.charAt(0).toUpperCase() }}</div><div><p class="eyebrow dark">STUDENT DETAILS</p><h2>{{ fullName }}</h2><p class="role">Student account</p></div></div>
        <div class="details-grid"><article><small>ROLL NUMBER</small><strong>{{ profile.studentCode }}</strong></article><article><small>EMAIL ADDRESS</small><strong>{{ profile.email }}</strong></article><article><small>PHONE NUMBER</small><strong>{{ profile.phone || 'Not provided' }}</strong></article><article><small>ACCOUNT STATUS</small><strong class="active">Active</strong></article></div>
        <p class="note">Contact your administrator if any profile detail needs to be corrected.</p>
      </section>

      <section v-if="profile" class="form-panel password-panel">
        <div class="panel-title password-panel-title">
          <div>
            <p class="eyebrow">ACCOUNT SECURITY</p>
            <h2>Change password</h2>
            <p class="password-description">
              Use your current password to choose a new one.
            </p>
          </div>

          <button
            class="manage-button"
            type="button"
            @click="showPasswordForm = !showPasswordForm"
          >
            {{ showPasswordForm ? 'Close form' : 'Change password' }}
          </button>
        </div>

        <form
          v-if="showPasswordForm"
          class="password-form"
          @submit.prevent="changePassword"
        >
          <label>
            Current password
            <input
              v-model="passwordForm.currentPassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>

          <label>
            New password
            <input
              v-model="passwordForm.newPassword"
              type="password"
              minlength="8"
              autocomplete="new-password"
              placeholder="At least 8 characters"
              required
            />
          </label>

          <label>
            Confirm new password
            <input
              v-model="passwordForm.confirmPassword"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </label>

          <p
            v-if="passwordMessage"
            class="message password-message"
            :class="{ error: passwordMessageType === 'error' }"
          >
            {{ passwordMessage }}
          </p>

          <div class="form-actions password-actions">
            <button
              class="cancel-button"
              type="button"
              :disabled="isChangingPassword"
              @click="closePasswordForm"
            >
              Cancel
            </button>
            <button
              class="save-button"
              type="submit"
              :disabled="isChangingPassword"
            >
              {{ isChangingPassword ? 'Changing password…' : 'Save new password' }}
            </button>
          </div>
        </form>
      </section>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }.page { min-height: 100vh; display: flex; color: #293b45; background: #e6f0ef; font-family: "Segoe UI",Arial,sans-serif; }.sidebar { width:255px; min-height:100vh; position:fixed; display:flex; flex-direction:column; padding:26px 16px; color:white; background:#293b45; }.sidebar-brand { display:flex; align-items:center; gap:11px; padding:0 10px 30px; border-bottom:1px solid rgba(255,255,255,.13); }.brand-icon { display:grid; width:39px; height:39px; place-items:center; border-radius:11px; background:#119e91; font-size:22px; font-weight:800; }.wordmark { display:block; font-size:23px; font-weight:800; letter-spacing:-1.3px; line-height:1; }.wordmark span { color:#2fd3c3; }.sidebar small { display:block; margin-top:3px; color:#c7d0d3; font-size:9px; letter-spacing:1.6px; }.navigation { display:grid; gap:7px; padding-top:28px; }.nav-item,.logout { width:100%; display:flex; align-items:center; gap:13px; border:0; border-radius:9px; padding:12px 14px; color:#c7d0d3; background:transparent; text-align:left; cursor:pointer; font-size:14px; font-weight:700; }.nav-item:hover,.nav-item.active { color:white; background:#119e91; }.sidebar-bottom { margin-top:auto; }.logout:hover { color:white; background:rgba(255,255,255,.1); }.content { width:100%; min-height:100vh; margin-left:255px; padding:42px clamp(24px,5vw,70px); }.hero { padding:30px 34px; border-radius:18px; color:white; background:linear-gradient(135deg,#119e91,#0d897e); box-shadow:0 12px 28px rgba(17,158,145,.18); }.eyebrow { margin:0 0 10px; font-size:12px; font-weight:900; letter-spacing:2px; }.eyebrow::after { content:''; display:block; width:145px; height:3px; margin-top:7px; background:currentColor; }.hero h1 { margin:0; font-size:clamp(30px,3.5vw,44px); }.hero p:not(.eyebrow) { margin:10px 0 0; font-size:16px; }.message { margin:20px 0 0; padding:13px 16px; border-radius:11px; color:#a64040; background:#fbe2e2; font-weight:700; }.profile-card { max-width:850px; margin-top:28px; padding:32px; border:1px solid #d3e3e0; border-radius:18px; background:#f0f7f6; box-shadow:0 8px 24px rgba(35,55,65,.06); }.profile-card.loading { color:#718087; }.profile-header { display:flex; align-items:center; gap:18px; padding-bottom:25px; border-bottom:1px solid #d3e3e0; }.avatar { display:grid; width:72px; height:72px; place-items:center; border-radius:20px; color:white; background:#119e91; font-size:30px; font-weight:800; }.dark { color:#119e91; }.profile-header h2 { margin:0; font-size:28px; }.role { margin:6px 0 0; color:#718087; }.details-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:25px; }.details-grid article { display:grid; gap:7px; padding:17px; border:1px solid #d3e3e0; border-radius:12px; background:#eaf4f2; }.details-grid small { color:#718087; font-size:10px; font-weight:800; letter-spacing:1px; }.details-grid strong { font-size:15px; overflow-wrap:anywhere; }.active { color:#0c887c; }.note { margin:22px 0 0; color:#718087; font-size:13px; }@media(max-width:750px) { .page { display:block; }.sidebar { width:100%; min-height:auto; position:static; padding:17px; }.sidebar-brand { padding-bottom:15px; }.navigation { display:flex; overflow-x:auto; padding-top:15px; }.nav-item,.logout { width:auto; white-space:nowrap; }.sidebar-bottom { display:none; }.content { margin-left:0; padding:28px 17px; }.details-grid { grid-template-columns:1fr; } }

.password-panel { max-width: 980px; }
.password-panel-title { align-items: flex-start; }
.password-description { max-width: 440px; margin: 6px 0 0; color: #718087; font-size: 13px; line-height: 1.5; }
.password-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 22px; }
.password-form label { display: grid; gap: 8px; }
.password-form label:last-of-type { grid-column: 1 / -1; }
.password-message { grid-column: 1 / -1; margin: 0; }
.password-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 750px) { .password-panel-title { display: grid; gap: 16px; }.password-form { grid-template-columns: 1fr; }.password-form label:last-of-type { grid-column: auto; }.password-actions { grid-column: auto; } }
</style>
