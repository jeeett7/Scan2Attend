<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const timetables = ref([])
const isLoading = ref(true)
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

async function loadTimetable() {
  isLoading.value = true
  message.value = ''

  try {
    const response = await axios.get(
      `${apiUrl}/student/timetable`,
      authHeaders()
    )
    timetables.value = response.data.timetables
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    message.value =
      error.response?.data?.message ||
      'Could not load your lecture timetable.'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadTimetable)
</script>

<template>
  <div class="timetable-page">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>
        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>STUDENT PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
        <button
          class="nav-item"
          type="button"
          @click="router.push('/student/dashboard')"
        >
          ⌂ <span>Dashboard</span>
        </button>
        <button
          class="nav-item"
          type="button"
          @click="router.push('/student/attendance-history')"
        >
          ✓ <span>Attendance history</span>
        </button>
        <button class="nav-item active" type="button">
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
      <header class="hero">
        <div>
          <p class="eyebrow">ACADEMIC SCHEDULE</p>
          <h1>Lecture timetable</h1>
          <p>View the latest timetable shared by your administrator.</p>
        </div>

        <button class="refresh-button" type="button" @click="loadTimetable">
          ↻ Refresh
        </button>
      </header>

      <p v-if="message" class="message">{{ message }}</p>

      <section v-if="isLoading" class="timetable-card empty-state">
        Loading your lecture timetable…
      </section>

      <section v-else-if="timetables.length === 0" class="timetable-card empty-state">
        <div class="empty-icon">▦</div>
        <h2>No timetable has been added yet</h2>
        <p>Your administrator will add the timetable for your class here.</p>
      </section>

      <template v-else>
        <section
          v-for="timetable in timetables"
          :key="timetable.classId"
          class="timetable-card"
        >
          <div class="timetable-heading">
            <div>
              <p class="panel-eyebrow">CLASS TIMETABLE</p>
              <h2>{{ timetable.className }}</h2>
              <p>{{ timetable.classCode }} · {{ timetable.academicYear }}</p>
            </div>
            <span class="updated-pill">Current timetable</span>
          </div>

          <div class="image-frame">
            <img
              :src="timetable.timetableImage"
              :alt="`${timetable.className} lecture timetable`"
            />
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }
.timetable-page { min-height: 100vh; display: flex; color: #293b45; background: #e6f0ef; font-family: "Segoe UI", Arial, sans-serif; }
.sidebar { width: 255px; min-height: 100vh; position: fixed; display: flex; flex-direction: column; padding: 26px 16px; color: white; background: #293b45; }
.sidebar-brand { display: flex; align-items: center; gap: 11px; padding: 0 10px 30px; border-bottom: 1px solid rgba(255,255,255,.13); }
.brand-icon { display: grid; width: 39px; height: 39px; place-items: center; border-radius: 11px; background: #119e91; font-size: 22px; font-weight: 800; }
.wordmark { display: block; color: white; font-size: 23px; font-weight: 800; letter-spacing: -1.3px; line-height: 1; }.wordmark span { color: #2fd3c3; }.sidebar small { display: block; margin-top: 3px; color: #c7d0d3; font-size: 9px; letter-spacing: 1.6px; }
.navigation { display: grid; gap: 7px; padding-top: 28px; }.nav-item,.logout { width: 100%; display: flex; align-items: center; gap: 13px; border: 0; border-radius: 9px; padding: 12px 14px; color: #c7d0d3; background: transparent; text-align: left; cursor: pointer; font-size: 14px; font-weight: 700; }.nav-item:hover,.nav-item.active { color: white; background: #119e91; }.sidebar-bottom { margin-top: auto; }.logout:hover { color: white; background: rgba(255,255,255,.1); }
.content { width: 100%; min-height: 100vh; margin-left: 255px; padding: 42px clamp(24px,5vw,70px); }.hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 30px 34px; border-radius: 18px; color: white; background: linear-gradient(135deg,#119e91,#0d897e); box-shadow: 0 12px 28px rgba(17,158,145,.18); }.eyebrow { display: inline-block; margin: 0 0 10px; padding-bottom: 7px; border-bottom: 3px solid #d7f4f0; font-size: 12px; font-weight: 900; letter-spacing: 2px; }.hero h1 { margin: 0; font-size: clamp(30px,3.5vw,44px); }.hero p:not(.eyebrow) { margin: 10px 0 0; font-size: 16px; }.refresh-button { border: 0; border-radius: 10px; padding: 12px 16px; cursor: pointer; color: #087c73; background: #f4fbfa; font: inherit; font-weight: 800; }
.message { margin: 20px 0 0; padding: 13px 16px; border-radius: 11px; color: #a64040; background: #fbe2e2; font-weight: 700; }.timetable-card { max-width: 1120px; margin-top: 24px; padding: 28px; border: 1px solid #d3e3e0; border-radius: 18px; background: #f0f7f6; box-shadow: 0 8px 24px rgba(35,55,65,.06); }.timetable-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }.panel-eyebrow { margin: 0 0 8px; color: #119e91; font-size: 10px; font-weight: 900; letter-spacing: 2px; }.timetable-heading h2 { margin: 0; font-size: 24px; }.timetable-heading p:not(.panel-eyebrow) { margin: 6px 0 0; color: #718087; font-size: 13px; }.updated-pill { padding: 7px 10px; border-radius: 20px; color: #0c887c; background: #d8efeb; font-size: 11px; font-weight: 800; white-space: nowrap; }.image-frame { display: grid; justify-items: center; overflow: auto; padding: 16px; border: 1px solid #d3e3e0; border-radius: 14px; background: white; }.image-frame img { display: block; width: 100%; max-width: 1040px; height: auto; border-radius: 8px; object-fit: contain; }.empty-state { display: grid; min-height: 340px; place-content: center; justify-items: center; color: #718087; text-align: center; }.empty-state h2 { margin: 0 0 8px; color: #293b45; font-size: 20px; }.empty-state p { max-width: 360px; margin: 0; line-height: 1.5; }.empty-icon { display: grid; width: 54px; height: 54px; place-items: center; margin-bottom: 14px; border-radius: 14px; color: #119e91; background: #d8efeb; font-size: 25px; font-weight: 800; }
@media (max-width: 750px) { .timetable-page { display: block; }.sidebar { width: 100%; min-height: auto; position: static; padding: 17px; }.sidebar-brand { padding-bottom: 15px; }.navigation { display: flex; overflow-x: auto; padding-top: 15px; }.nav-item,.logout { width: auto; white-space: nowrap; }.sidebar-bottom { display: none; }.content { margin-left: 0; padding: 28px 17px; }.hero { align-items: flex-start; flex-direction: column; }.timetable-card { padding: 20px; }.timetable-heading { align-items: flex-start; flex-direction: column; }.image-frame { padding: 8px; } }
</style>
