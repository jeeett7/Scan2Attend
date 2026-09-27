<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const classes = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const deletingId = ref(null)
const uploadingId = ref(null)
const showForm = ref(false)
const message = ref('')
const messageType = ref('success')

const form = ref({
  classCode: '',
  className: '',
  academicYear: ''
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

function showMessage(text, type = 'success') {
  message.value = text
  messageType.value = type
}

function resetForm() {
  form.value = {
    classCode: '',
    className: '',
    academicYear: ''
  }
}

async function loadClasses() {
  isLoading.value = true

  try {
    const response = await axios.get(
      `${apiUrl}/admin/classes`,
      authHeaders()
    )

    classes.value = response.data.classes.filter(
      (classItem) => classItem.isActive
    )
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    showMessage(
      error.response?.data?.message || 'Could not load classes.',
      'error'
    )
  } finally {
    isLoading.value = false
  }
}

async function addClass() {
  isSaving.value = true
  message.value = ''

  try {
    const response = await axios.post(
      `${apiUrl}/admin/classes`,
      form.value,
      authHeaders()
    )

    showMessage(response.data.message)
    resetForm()
    showForm.value = false
    await loadClasses()
  } catch (error) {
    showMessage(
      error.response?.data?.message || 'Could not add the class.',
      'error'
    )
  } finally {
    isSaving.value = false
  }
}

async function deleteClass(classItem) {
  const confirmed = window.confirm(
    `Deactivate ${classItem.className}?`
  )

  if (!confirmed) {
    return
  }

  deletingId.value = classItem.id
  message.value = ''

  try {
    const response = await axios.delete(
      `${apiUrl}/admin/classes/${classItem.id}`,
      authHeaders()
    )

    showMessage(response.data.message)
    await loadClasses()
  } catch (error) {
    showMessage(
      error.response?.data?.message || 'Could not deactivate the class.',
      'error'
    )
  } finally {
    deletingId.value = null
  }
}

function readTimetableImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The selected image could not be read.'))
    reader.readAsDataURL(file)
  })
}

async function uploadTimetable(classItem, event) {
  const [file] = event.target.files || []
  event.target.value = ''

  if (!file) return

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showMessage('Choose a JPG, PNG, or WebP timetable image.', 'error')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    showMessage('Choose an image smaller than 5 MB.', 'error')
    return
  }

  uploadingId.value = classItem.id
  message.value = ''

  try {
    const imageData = await readTimetableImage(file)
    const response = await axios.put(
      `${apiUrl}/admin/classes/${classItem.id}/timetable`,
      { imageData },
      authHeaders()
    )

    showMessage(response.data.message)
    await loadClasses()
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not save the timetable image.',
      'error'
    )
  } finally {
    uploadingId.value = null
  }
}

onMounted(loadClasses)
</script>

<template>
  <div class="classes-page">
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

        <button class="nav-item active" type="button">
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
          <p class="eyebrow">CLASS MANAGEMENT</p>
          <h1>Classes</h1>
          <p class="subtext">Create and manage academic classes.</p>
        </div>

        <button class="add-button" type="button" @click="showForm = !showForm">
          {{ showForm ? 'Close form' : '+ Add class' }}
        </button>
      </header>

      <p
        v-if="message"
        class="message"
        :class="{ error: messageType === 'error' }"
      >
        {{ message }}
      </p>

      <section v-if="showForm" class="form-panel">
        <div class="panel-title">
          <div>
            <p class="panel-eyebrow">NEW CLASS</p>
            <h2>Add class</h2>
          </div>
        </div>

        <form class="class-form" @submit.prevent="addClass">
          <label>
            Class code
            <input
              v-model.trim="form.classCode"
              type="text"
              placeholder="Example: BCA-SEM3"
              required
            />
          </label>

          <label>
            Class name
            <input
              v-model.trim="form.className"
              type="text"
              placeholder="Example: BCA Semester 3"
              required
            />
          </label>

          <label>
            Academic year
            <input
              v-model.trim="form.academicYear"
              type="text"
              placeholder="Example: 2026-2027"
              required
            />
          </label>

          <div class="form-actions">
            <button
              class="cancel-button"
              type="button"
              @click="showForm = false"
            >
              Cancel
            </button>

            <button class="save-button" type="submit" :disabled="isSaving">
              {{ isSaving ? 'Adding class…' : 'Add class' }}
            </button>
          </div>
        </form>
      </section>

      <section class="table-panel">
        <div class="panel-title">
          <div>
            <p class="panel-eyebrow">CLASS DIRECTORY</p>
            <h2>All classes</h2>
          </div>

          <span class="count-badge">{{ classes.length }} total</span>
        </div>

        <div v-if="isLoading" class="empty-state">
          Loading classes…
        </div>

        <div v-else-if="classes.length === 0" class="empty-state">
          <div class="empty-icon">▣</div>
          <strong>No classes yet</strong>
          <p>Click “Add class” to create the first academic class.</p>
        </div>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Class name</th>
                <th>Class code</th>
                <th>Academic year</th>
                <th>Timetable</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="classItem in classes" :key="classItem.id">
                <td>
                  <strong>{{ classItem.className }}</strong>
                </td>
                <td>{{ classItem.classCode }}</td>
                <td>{{ classItem.academicYear }}</td>
                <td>
                  <span
                    class="timetable-status"
                    :class="{ missing: !classItem.hasTimetable }"
                  >
                    {{
                      classItem.hasTimetable
                        ? 'Added'
                        : 'Not added'
                    }}
                  </span>
                </td>
                <td>
                  <span class="status">Active</span>
                </td>
                <td class="action-cell">
  <button
    class="manage-button"
    type="button"
    @click="router.push(`/admin/classes/${classItem.id}/subjects`)"
  >
    Manage subjects
  </button>

  <label class="timetable-button">
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :disabled="uploadingId === classItem.id"
      @change="uploadTimetable(classItem, $event)"
    />
    {{
      uploadingId === classItem.id
        ? 'Saving…'
        : classItem.hasTimetable
          ? 'Replace timetable'
          : 'Add timetable'
    }}
  </label>

  <button
    class="delete-button"
    type="button"
    :disabled="deletingId === classItem.id"
    @click="deleteClass(classItem)"
  >
    {{
      deletingId === classItem.id
        ? 'Deleting…'
        : 'Delete'
    }}
  </button>
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

.classes-page {
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
  text-align: left;
  cursor: pointer;
  font-size: 14px;
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

.panel-eyebrow {
  margin: 0 0 7px;
  color: #119e91;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
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

.add-button,
.save-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  color: #0d897e;
  background: #eef7f5;
  font-weight: 700;
  cursor: pointer;
}

.message {
  margin: 18px 0;
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

.form-panel,
.table-panel {
  margin-top: 22px;
  padding: 24px;
  border: 1px solid #d3e3e0;
  border-radius: 16px;
  background: #f0f7f6;
  box-shadow: 0 8px 24px rgba(35, 55, 65, 0.06);
}

.panel-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.class-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px;
  margin-top: 23px;
}

.class-form label {
  display: grid;
  gap: 7px;
  color: #30424c;
  font-size: 13px;
  font-weight: 700;
}

.class-form input {
  width: 100%;
  height: 45px;
  padding: 0 13px;
  border: 1px solid #cedbdc;
  border-radius: 9px;
  outline: none;
  background: #f4f8f8;
  color: #293b45;
}

.class-form input:focus {
  border-color: #119e91;
  background: white;
  box-shadow: 0 0 0 3px rgba(17, 158, 145, 0.1);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-button {
  border: 1px solid #cfdada;
  border-radius: 10px;
  padding: 12px 16px;
  color: #54646a;
  background: #eef7f5;
  cursor: pointer;
  font-weight: 700;
}

.save-button {
  color: white;
  background: #119e91;
}

.save-button:disabled,
.delete-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.count-badge,
.status,
.timetable-status {
  padding: 6px 9px;
  border-radius: 20px;
  color: #0c887c;
  background: #d8efeb;
  font-size: 11px;
  font-weight: 700;
}

.timetable-status.missing {
  color: #718087;
  background: #e1e8e8;
}

.table-wrapper {
  overflow-x: auto;
  margin-top: 20px;
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

td strong {
  color: #293b45;
}
  .action-cell {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  text-align: right;
}

.delete-button {
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  color: #ae4545;
  background: #fbe6e6;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.manage-button {
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  color: #0c887c;
  background: #d8efeb;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.timetable-button {
  display: inline-flex;
  align-items: center;
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  color: #4476bf;
  background: #ddeafa;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.timetable-button:hover {
  background: #cfe0f7;
}

.timetable-button input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.timetable-button:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.65;
}

.manage-button:hover {
  background: #c7e8e3;
}

.empty-state {
  display: grid;
  justify-items: center;
  padding: 50px 20px;
  color: #7b898d;
  text-align: center;
}

.empty-state strong {
  margin-top: 10px;
  color: #30424c;
}

.empty-state p {
  margin: 7px 0 0;
  font-size: 13px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #119e91;
  background: #d8efeb;
  font-size: 24px;
}

@media (max-width: 750px) {
  .classes-page {
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

  .class-form {
    grid-template-columns: 1fr;
  }
}
</style>
