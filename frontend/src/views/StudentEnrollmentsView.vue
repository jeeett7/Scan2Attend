<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const apiUrl = 'http://localhost:5000/api'
const studentId = Number(route.params.studentId)

const student = ref(null)
const classes = ref([])
const enrollments = ref([])
const selectedClassId = ref('')
const isLoading = ref(true)
const isSaving = ref(false)
const removingClassId = ref(null)
const message = ref('')
const messageType = ref('success')

const studentName = computed(() => {
  if (!student.value) {
    return 'Student enrollment'
  }

  return `${student.value.firstName} ${student.value.lastName}`
})

const availableClasses = computed(() => {
  const enrolledClassIds = new Set(
    enrollments.value.map((item) => item.classId)
  )

  return classes.value.filter(
    (classItem) => !enrolledClassIds.has(classItem.id)
  )
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
      studentsResponse,
      classesResponse,
      enrollmentsResponse
    ] = await Promise.all([
      axios.get(`${apiUrl}/admin/students`, authHeaders()),
      axios.get(`${apiUrl}/admin/classes`, authHeaders()),
      axios.get(
        `${apiUrl}/admin/students/${studentId}/enrollments`,
        authHeaders()
      )
    ])

    student.value = studentsResponse.data.students.find(
      (item) => item.id === studentId && item.isActive
    )

    classes.value = classesResponse.data.classes.filter(
      (classItem) => classItem.isActive
    )

    enrollments.value = enrollmentsResponse.data.enrollments
  } catch (error) {
    if (error.response?.status === 401) {
      logout()
      return
    }

    showMessage(
      error.response?.data?.message ||
        'Could not load student enrollment details.',
      'error'
    )
  } finally {
    isLoading.value = false
  }
}

async function enrollStudent() {
  if (!selectedClassId.value) {
    showMessage('Choose a class first.', 'error')
    return
  }

  isSaving.value = true
  message.value = ''

  try {
    const response = await axios.post(
      `${apiUrl}/admin/students/${studentId}/enrollments`,
      {
        classId: Number(selectedClassId.value)
      },
      authHeaders()
    )

    showMessage(response.data.message)
    selectedClassId.value = ''
    await loadPage()
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not enroll the student.',
      'error'
    )
  } finally {
    isSaving.value = false
  }
}

async function removeEnrollment(enrollment) {
  const confirmed = window.confirm(
    `Remove ${studentName.value} from ${enrollment.className}?`
  )

  if (!confirmed) {
    return
  }

  removingClassId.value = enrollment.classId
  message.value = ''

  try {
    const response = await axios.delete(
      `${apiUrl}/admin/students/${studentId}/enrollments/${enrollment.classId}`,
      authHeaders()
    )

    showMessage(response.data.message)
    await loadPage()
  } catch (error) {
    showMessage(
      error.response?.data?.message ||
        'Could not remove this enrollment.',
      'error'
    )
  } finally {
    removingClassId.value = null
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
          class="nav-item active"
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
          <p class="eyebrow">STUDENT ENROLLMENT</p>
          <h1>{{ studentName }}</h1>
          <p class="subtext">
            Assign this student to the classes they are eligible to attend.
          </p>
        </div>

        <button
          class="back-button"
          type="button"
          @click="router.push('/admin/students')"
        >
          ← Back to students
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
          <p class="panel-eyebrow">ENROLL STUDENT</p>
          <h2>Add {{ studentName }} to a class</h2>
        </div>

        <div class="enrollment-form">
          <label>
            Class
            <select
              v-model="selectedClassId"
              :disabled="isLoading || availableClasses.length === 0"
            >
              <option value="">
                {{
                  availableClasses.length
                    ? 'Choose a class'
                    : 'No available classes'
                }}
              </option>

              <option
                v-for="classItem in availableClasses"
                :key="classItem.id"
                :value="classItem.id"
              >
                {{ classItem.className }} — {{ classItem.academicYear }}
              </option>
            </select>
          </label>

          <button
            class="enroll-button"
            type="button"
            :disabled="isSaving || availableClasses.length === 0"
            @click="enrollStudent"
          >
            {{ isSaving ? 'Enrolling…' : 'Enroll student' }}
          </button>
        </div>

        <p
          v-if="!isLoading && availableClasses.length === 0"
          class="hint"
        >
          This student is already enrolled in every active class.
        </p>
      </section>

      <section class="table-panel">
        <div class="panel-title">
          <div>
            <p class="panel-eyebrow">CURRENT CLASSES</p>
            <h2>Student enrollments</h2>
          </div>

          <span class="count-badge">
            {{ enrollments.length }} enrolled
          </span>
        </div>

        <div v-if="isLoading" class="empty-state">
          Loading classes…
        </div>

        <div v-else-if="enrollments.length === 0" class="empty-state">
          <div class="empty-icon">▣</div>
          <strong>No class enrollments yet</strong>
          <p>Choose a class above and click “Enroll student”.</p>
        </div>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Class code</th>
                <th>Academic year</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="enrollment in enrollments"
                :key="enrollment.classId"
              >
                <td>
                  <strong>{{ enrollment.className }}</strong>
                </td>
                <td>{{ enrollment.classCode }}</td>
                <td>{{ enrollment.academicYear }}</td>
                <td class="action-cell">
                  <button
                    class="remove-button"
                    type="button"
                    :disabled="removingClassId === enrollment.classId"
                    @click="removeEnrollment(enrollment)"
                  >
                    {{
                      removingClassId === enrollment.classId
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

.enrollment-form {
  display: flex;
  align-items: end;
  gap: 12px;
  margin-top: 23px;
}

.enrollment-form label {
  flex: 1;
  display: grid;
  gap: 7px;
  color: #30424c;
  font-size: 13px;
  font-weight: 700;
}

.enrollment-form select {
  width: 100%;
  height: 45px;
  padding: 0 12px;
  border: 1px solid #cedbdc;
  border-radius: 9px;
  outline: none;
  background: #f4f8f8;
  color: #293b45;
}

.enroll-button {
  height: 45px;
  border: 0;
  border-radius: 10px;
  padding: 0 17px;
  color: white;
  background: #119e91;
  cursor: pointer;
  font-weight: 700;
}

.enroll-button:disabled,
.remove-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.hint {
  margin: 13px 0 0;
  color: #7b898d;
  font-size: 12px;
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

td strong {
  color: #293b45;
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

  .enrollment-form {
    align-items: stretch;
    flex-direction: column;
  }

  .enroll-button {
    width: 100%;
  }
}
</style>