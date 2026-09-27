import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import StudentsView from '../views/StudentsView.vue'
import StudentEnrollmentsView from '../views/StudentEnrollmentsView.vue'
import TeachersView from '../views/TeachersView.vue'
import ClassesView from '../views/ClassesView.vue'
import SubjectsView from '../views/SubjectsView.vue'
import AdminAttendanceView from '../views/AdminAttendanceView.vue'
import AdminReportsView from '../views/AdminReportsView.vue'
import ClassSubjectsView from '../views/ClassSubjectsView.vue'
import AssignmentsView from '../views/AssignmentsView.vue'
import SubjectTeacherAssignView from '../views/SubjectTeacherAssignView.vue'
import SubjectStudentsView from '../views/SubjectStudentsView.vue'
import TeacherDashboard from '../views/TeacherDashboard.vue'
import TakeAttendanceView from '../views/TakeAttendanceView.vue'
import TeacherAttendanceHistoryView from '../views/TeacherAttendanceHistoryView.vue'
import TeacherTimetableView from '../views/TeacherTimetableView.vue'
import AttendanceScanView from '../views/AttendanceScanView.vue'
import StudentDashboard from '../views/StudentDashboard.vue'
import StudentAttendanceHistoryView from '../views/StudentAttendanceHistoryView.vue'
import StudentProfileView from '../views/StudentProfileView.vue'
import StudentTimetableView from '../views/StudentTimetableView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView
    },
    {
      path: '/admin/dashboard',
      name: 'admin-dashboard',
      component: AdminDashboard,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin/students',
      name: 'admin-students',
      component: StudentsView,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
  path: '/admin/students/:studentId/classes',
  name: 'admin-student-enrollments',
  component: StudentEnrollmentsView,
  meta: { requiresAuth: true, role: 'admin' }
},
    {
      path: '/admin/teachers',
      name: 'admin-teachers',
      component: TeachersView,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin/classes',
      name: 'admin-classes',
      component: ClassesView,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin/subjects',
      name: 'admin-subjects',
      component: SubjectsView,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
  path: '/admin/attendance',
  name: 'admin-attendance',
  component: AdminAttendanceView,
  meta: { requiresAuth: true, role: 'admin' }
},
{
  path: '/admin/reports',
  name: 'admin-reports',
  component: AdminReportsView,
  meta: { requiresAuth: true, role: 'admin' }
},

    {
  path: '/admin/subjects/:subjectId/assign-teacher',
  name: 'admin-subject-assign-teacher',
  component: SubjectTeacherAssignView,
  meta: { requiresAuth: true, role: 'admin' }
},
{
  path: '/admin/subjects/:subjectId/assign-students',
  name: 'admin-subject-assign-students',
  component: SubjectStudentsView,
  meta: { requiresAuth: true, role: 'admin' }
},
    {
      path: '/admin/classes/:classId/subjects',
      name: 'admin-class-subjects',
      component: ClassSubjectsView,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/admin/assignments',
      name: 'admin-assignments',
      component: AssignmentsView,
      meta: { requiresAuth: true, role: 'admin' }
    },
{
  path: '/attendance/scan',
  name: 'attendance-scan',
  component: AttendanceScanView
},
    {
      path: '/attendance/scan/claim/:scanClaim',
      name: 'attendance-scan-claim',
      component: AttendanceScanView
    },
    {
      path: '/attendance/scan/:sessionPublicId/:token',
      name: 'attendance-scan-link',
      component: AttendanceScanView
    },
    {
      path: '/teacher/dashboard',
      name: 'teacher-dashboard',
      component: TeacherDashboard,
      meta: { requiresAuth: true, role: 'teacher' }
    },
{
  path: '/teacher/take-attendance',
  name: 'teacher-take-attendance',
  component: TakeAttendanceView,
  meta: { requiresAuth: true, role: 'teacher' }
},
    {
      path: '/teacher/attendance-history',
      name: 'teacher-attendance-history',
      component: TeacherAttendanceHistoryView,
      meta: { requiresAuth: true, role: 'teacher' }
    },
    {
      path: '/teacher/timetable',
      name: 'teacher-timetable',
      component: TeacherTimetableView,
      meta: { requiresAuth: true, role: 'teacher' }
    },
    {
      path: '/student/dashboard',
      name: 'student-dashboard',
      component: StudentDashboard,
      meta: { requiresAuth: true, role: 'student' }
    },
    {
      path: '/student/attendance-history',
      name: 'student-attendance-history',
      component: StudentAttendanceHistoryView,
      meta: { requiresAuth: true, role: 'student' }
    },
    {
      path: '/student/profile',
      name: 'student-profile',
      component: StudentProfileView,
      meta: { requiresAuth: true, role: 'student' }
    },
    {
      path: '/student/timetable',
      name: 'student-timetable',
      component: StudentTimetableView,
      meta: { requiresAuth: true, role: 'student' }
    }
  ]
})

router.beforeEach((to) => {
  const token = localStorage.getItem('scan2attend_token')

  let user = null

  try {
    user = JSON.parse(
      localStorage.getItem('scan2attend_user') || 'null'
    )
  } catch {
    user = null
  }

  if (to.meta.requiresAuth) {
    if (!token || !user || user.role !== to.meta.role) {
      return { name: 'login' }
    }
  }
})

export default router
