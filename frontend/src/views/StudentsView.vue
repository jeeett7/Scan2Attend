<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const router = useRouter()
const apiUrl = 'http://localhost:5000/api'

const students = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const deletingId = ref(null)
const showForm = ref(false)
const message = ref('')
const messageType = ref('success')

const form = ref({
  firstName: '',
  lastName: '',
  studentCode: '',
  email: '',
  phone: '',
  password: ''
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
    firstName: '',
    lastName: '',
    studentCode: '',
    email: '',
    phone: '',
    password: ''
  }
}

async function loadStudents() {
  isLoading.value = true

  try {
    const response = await axios.get(
      `${apiUrl}/admin/students`,
      authHeaders()
    )

    students.value = response.data.students.filter(
  (student) => student.isActive
)
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    showMessage(
      error.response?.data?.message || 'Could not load students.',
      'error'
    )
  } finally {
    isLoading.value = false
  }
}

async function addStudent() {
  isSaving.value = true
  message.value = ''

  try {
    const response = await axios.post(
      `${apiUrl}/admin/students`,
      form.value,
      authHeaders()
    )

    showMessage(response.data.message)
    resetForm()
    showForm.value = false
    await loadStudents()
  } catch (error) {
    showMessage(
      error.response?.data?.message || 'Could not add the student.',
      'error'
    )
  } finally {
    isSaving.value = false
  }
}

async function deleteStudent(student) {
  const confirmed = window.confirm(
    `Permanently delete ${student.firstName} ${student.lastName}? This cannot be undone.`
  )

  if (!confirmed) {
    return
  }

  deletingId.value = student.id
  message.value = ''

  try {
    const response = await axios.delete(
      `${apiUrl}/admin/students/${student.id}`,
      authHeaders()
    )

    showMessage(response.data.message)
    await loadStudents()
  } catch (error) {
    showMessage(
      error.response?.data?.message || 'Could not permanently delete the student.',
      'error'
    )
  } finally {
    deletingId.value = null
  }
}

onMounted(loadStudents)
</script>

<template>
  <div class="students-page">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">✓</div>

        <div>
          <strong class="wordmark">Scan<span>2</span>Attend</strong>
          <small>ADMIN PORTAL</small>
        </div>
      </div>

      <nav class="navigation">
        <button class="nav-item" type="button" @click="router.push('/admin/dashboard')">
          ⌂ <span>Dashboard</span>
        </button>

        <button class="nav-item active" type="button">
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
          <p class="eyebrow">STUDENT MANAGEMENT</p>
          <h1>Students</h1>
          <p class="subtext">Create, view, and manage student accounts.</p>
        </div>

        <button class="add-button" type="button" @click="showForm = !showForm">
          {{ showForm ? 'Close form' : '+ Add student' }}
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
            <p class="eyebrow">NEW ACCOUNT</p>
            <h2>Add student</h2>
          </div>
        </div>

        <form class="student-form" @submit.prevent="addStudent">
          <label>
            First name
            <input v-model.trim="form.firstName" type="text" required />
          </label>

          <label>
            Last name
            <input v-model.trim="form.lastName" type="text" required />
          </label>

          <label>
            Roll number
            <input
              v-model.trim="form.studentCode"
              type="text"
              placeholder="Example:24BC0000"
              required
            />
          </label>

          <label>
            Email address
            <input
              v-model.trim="form.email"
              type="email"
              placeholder="student@example.com"
              required
            />
          </label>

          <label>
            Phone number <span class="optional">(optional)</span>
            <input v-model.trim="form.phone" type="text" />
          </label>

          <label>
            Temporary password
            <input
              v-model="form.password"
              type="password"
              minlength="8"
              placeholder="At least 8 characters"
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
              {{ isSaving ? 'Adding student…' : 'Add student' }}
            </button>
          </div>
        </form>
      </section>

      <section class="table-panel">
        <div class="panel-title">
          <div>
            <p class="eyebrow">STUDENT DIRECTORY</p>
            <h2>All students</h2>
          </div>

          <span class="count-badge">{{ students.length }} total</span>
        </div>

        <div v-if="isLoading" class="empty-state">
          Loading students…
        </div>

        <div v-else-if="students.length === 0" class="empty-state">
          <div class="empty-icon">♙</div>
          <strong>No students yet</strong>
          <p>Click “Add student” to create the first student account.</p>
        </div>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll number</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="student in students" :key="student.id">
                <td>
                  <strong>{{ student.firstName }} {{ student.lastName }}</strong>
                </td>
                <td>{{ student.studentCode }}</td>
                <td>{{ student.email }}</td>
                <td>{{ student.phone || '—' }}</td>
                <td>
                  <span
                    class="status"
                    :class="{ inactive: !student.isActive }"
                  >
                    {{ student.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="action-cell">
                  <button
                    v-if="student.isActive"
                    class="delete-button"
                    type="button"
                    :disabled="deletingId === student.id"
                    @click="deleteStudent(student)"
                  >
                    {{ deletingId === student.id ? 'Deleting…' : 'Delete' }}
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

.students-page {
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
  background: white;
  font-weight: 700;
  cursor: pointer;
}

.add-button:hover,
.save-button:hover {
  transform: translateY(-1px);
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
  border: 1px solid #dbe4e4;
  border-radius: 16px;
  background: #fbfdfd;
  box-shadow: 0 8px 24px rgba(35, 55, 65, 0.06);
}

.panel-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.student-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px;
  margin-top: 23px;
}

.student-form label {
  display: grid;
  gap: 7px;
  color: #30424c;
  font-size: 13px;
  font-weight: 700;
}

.optional {
  color: #7b898d;
  font-weight: 400;
}

.student-form input {
  width: 100%;
  height: 45px;
  padding: 0 13px;
  border: 1px solid #cedbdc;
  border-radius: 9px;
  outline: none;
  background: #f4f8f8;
  color: #293b45;
}

.student-form input:focus {
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
  background: white;
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
.status {
  padding: 6px 9px;
  border-radius: 20px;
  color: #0c887c;
  background: #d8efeb;
  font-size: 11px;
  font-weight: 700;
}

.status.inactive {
  color: #707c80;
  background: #e6ebeb;
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
  border-bottom: 1px solid #e1e8e8;
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

.delete-button:hover {
  background: #f7d4d4;
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
  .students-page {
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

  .student-form {
    grid-template-columns: 1fr;
  }
}
/* Softer mint student-management surfaces */
.students-page {
  background: #e6f0ef;
}

.form-panel,
.table-panel {
  background: #f0f7f6;
  border-color: #d3e3e0;
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
