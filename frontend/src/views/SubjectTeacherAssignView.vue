<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const apiUrl = 'http://localhost:5000/api'
const subjectId = Number(route.params.subjectId)

const subject = ref(null)
const teachers = ref([])
const classes = ref([])
const assignments = ref([])

const selectedTeacherId = ref('')
const selectedClassSubjectId = ref('')

const isLoading = ref(true)
const isSaving = ref(false)
const removingId = ref(null)
const message = ref('')
const messageType = ref('success')

const subjectTitle = computed(() => {
  return subject.value?.subjectName || 'Assign teacher'
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

async function loadPage() {
  isLoading.value = true

  try {
    const [
      subjectsResponse,
      teachersResponse,
      classesResponse,
      assignmentsResponse
    ] = await Promise.all([
      axios.get(`${apiUrl}/admin/subjects`, authHeaders()),
      axios.get(`${apiUrl}/admin/teachers`, authHeaders()),
      axios.get(
        `${apiUrl}/admin/subjects/${subjectId}/classes`,
        authHeaders()
      ),
      axios.get(`${apiUrl}/admin/teacher-assignments`, authHeaders())
    ])

    subject.value = subjectsResponse.data.subjects.find(
      (item) => item.id === subjectId && item.isActive
    )

    teachers.value = teachersResponse.data.teachers.filter(
      (teacher) => teacher.isActive
    )

    classes.value = classesResponse.data.classes

    assignments.value = assignmentsResponse.data.assignments.filter(
      (assignment) => Number(assignment.subjectId) === subjectId
    )
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    showMessage(
      error.response?.data?.message ||
        'Could not load teacher assignment details.',
      'error'
    )
  } finally {
    isLoading.value = false
  }
}

async function assignTeacher() {
  if (!selectedTeacherId.value || !selectedClassSubjectId.value) {
    showMessage('Choose a teacher and class first.', 'error')
    return
  }

  isSaving.value = true
  message.value = ''

  try {
    const response = await axios.post(
      `${apiUrl}/admin/teacher-assignments`,
      {
        teacherId: Number(selectedTeacherId.value),
        classSubjectId: Number(selectedClassSubjectId.value)
      },
      authHeaders()
    )

    showMessage(response.data.message)
    selectedTeacherId.value = ''
    selectedClassSubjectId.value = ''

    await loadPage()
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not assign the teacher.',
      'error'
    )
  } finally {
    isSaving.value = false
  }
}

async function removeAssignment(assignment) {
  const confirmed = window.confirm(
    `Remove ${assignment.teacherName} from ${subjectTitle.value}?`
  )

  if (!confirmed) {
    return
  }

  removingId.value = assignment.id
  message.value = ''

  try {
    const response = await axios.delete(
      `${apiUrl}/admin/teacher-assignments/${assignment.id}`,
      authHeaders()
    )

    showMessage(response.data.message)
    await loadPage()
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not remove teacher assignment.',
      'error'
    )
  } finally {
    removingId.value = null
  }
}

onMounted(loadPage)
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
          class="nav-item active"
          type="button"
          @click="router.push('/admin/subjects')"
        >
          ▤ <span>Subjects</span>
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
          <p class="eyebrow">ASSIGN TEACHER</p>
          <h1>{{ subjectTitle }}</h1>
          <p class="subtext">
            Choose a teacher and the class where this subject is taught.
          </p>
        </div>

        <button
          class="back-button"
          type="button"
          @click="router.push('/admin/subjects')"
        >
          ← Back to subjects
        </button>
      </header>

      <p
        v-if="message"
        class="message"
        :class="{ error: messageType === 'error' }"
      >
        {{ message }}
      </p>

      <section class="form-panel">
        <div>
          <p class="panel-eyebrow">NEW ASSIGNMENT</p>
          <h2>Assign teacher to {{ subjectTitle }}</h2>
        </div>

        <div class="assignment-form">
          <label>
            Teacher
            <select v-model="selectedTeacherId" :disabled="isLoading">
              <option value="">Choose a teacher</option>

              <option
                v-for="teacher in teachers"
                :key="teacher.id"
                :value="teacher.id"
              >
                {{ teacher.firstName }} {{ teacher.lastName }}
                — {{ teacher.email }}
              </option>
            </select>
          </label>

          <label>
            Class
            <select
              v-model="selectedClassSubjectId"
              :disabled="isLoading || classes.length === 0"
            >
              <option value="">
                {{
                  classes.length
                    ? 'Choose a class'
                    : 'This subject is not assigned to any class'
                }}
              </option>

              <option
                v-for="classItem in classes"
                :key="classItem.classSubjectId"
                :value="classItem.classSubjectId"
              >
                {{ classItem.className }}
                — {{ classItem.academicYear }}
              </option>
            </select>
          </label>
        </div>

        <p v-if="!isLoading && classes.length === 0" class="hint">
          First assign this subject to a class from the Classes page.
        </p>

        <div class="form-actions">
          <button
            class="assign-button"
            type="button"
            :disabled="isSaving || classes.length === 0"
            @click="assignTeacher"
          >
            {{ isSaving ? 'Assigning…' : 'Assign teacher' }}
          </button>
        </div>
      </section>

      <section class="table-panel">
        <div class="panel-title">
          <div>
            <p class="panel-eyebrow">CURRENT TEACHERS</p>
            <h2>Teachers assigned to this subject</h2>
          </div>

          <span class="count-badge">
            {{ assignments.length }} assigned
          </span>
        </div>

        <div v-if="isLoading" class="empty-state">
          Loading teachers…
        </div>

        <div v-else-if="assignments.length === 0" class="empty-state">
          <div class="empty-icon">♙</div>
          <strong>No teacher assigned yet</strong>
          <p>Use the form above to assign the first teacher.</p>
        </div>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Class</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="assignment in assignments"
                :key="assignment.id"
              >
                <td>
                  <strong>{{ assignment.teacherName }}</strong>
                  <small>{{ assignment.teacherEmail }}</small>
                </td>
                <td>
                  {{ assignment.className }}
                  <small>{{ assignment.classCode }}</small>
                </td>
                <td class="action-cell">
                  <button
                    class="remove-button"
                    type="button"
                    :disabled="removingId === assignment.id"
                    @click="removeAssignment(assignment)"
                  >
                    {{
                      removingId === assignment.id
                        ? 'Removing…'
                        : 'Remove'
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

.back-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  color: #0d897e;
  background: #eef7f5;
  cursor: pointer;
  font-weight: 700;
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

.assignment-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px;
  margin-top: 23px;
}

.assignment-form label {
  display: grid;
  gap: 7px;
  color: #30424c;
  font-size: 13px;
  font-weight: 700;
}

.assignment-form select {
  width: 100%;
  height: 45px;
  padding: 0 12px;
  border: 1px solid #cedbdc;
  border-radius: 9px;
  outline: none;
  background: #f4f8f8;
  color: #293b45;
}

.hint {
  margin: 13px 0 0;
  color: #7b898d;
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.assign-button {
  border: 0;
  border-radius: 10px;
  padding: 13px 17px;
  color: white;
  background: #119e91;
  cursor: pointer;
  font-weight: 700;
}

.assign-button:disabled,
.remove-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.panel-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.count-badge {
  padding: 6px 9px;
  border-radius: 20px;
  color: #0c887c;
  background: #d8efeb;
  font-size: 11px;
  font-weight: 700;
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

.action-cell {
  text-align: right;
}

.remove-button {
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  color: #ae4545;
  background: #fbe6e6;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
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

  .assignment-form {
    grid-template-columns: 1fr;
  }
}
</style>