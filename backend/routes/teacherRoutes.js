const express = require('express')
const { dbPool } = require('../config/database')
const {
  authenticate,
  authorizeRoles
} = require('../middleware/auth')

const router = express.Router()

async function expireOldSessions() {
  await dbPool.execute(
    `UPDATE attendance_sessions
     SET status = 'expired', ended_at = expires_at
     WHERE status = 'active' AND expires_at <= NOW()`
  )
}

router.get(
  '/dashboard',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      const [[teacherRows], [assignments], [studentRows]] = await Promise.all([
        dbPool.execute(
          `SELECT
            teachers.id AS teacherId,
            teachers.first_name AS firstName,
            teachers.last_name AS lastName,
            users.email
          FROM teachers
          INNER JOIN users ON users.id = teachers.user_id
          WHERE teachers.user_id = ?
            AND users.is_active = TRUE`,
          [request.user.id]
        ),
        dbPool.execute(
          `SELECT
            teacher_assignments.id AS assignmentId,
            class_subjects.id AS classSubjectId,
            classes.id AS classId,
            classes.class_code AS classCode,
            classes.class_name AS className,
            classes.academic_year AS academicYear,
            subjects.id AS subjectId,
            subjects.subject_code AS subjectCode,
            subjects.subject_name AS subjectName,
            COUNT(DISTINCT student_users.id) AS studentCount
          FROM teacher_assignments
          INNER JOIN teachers
            ON teachers.id = teacher_assignments.teacher_id
          INNER JOIN users ON users.id = teachers.user_id
          INNER JOIN class_subjects
            ON class_subjects.id = teacher_assignments.class_subject_id
          INNER JOIN classes ON classes.id = class_subjects.class_id
          INNER JOIN subjects ON subjects.id = class_subjects.subject_id
          LEFT JOIN student_subject_enrollments
            ON student_subject_enrollments.class_subject_id = class_subjects.id
            AND student_subject_enrollments.is_active = TRUE
          LEFT JOIN students
            ON students.id = student_subject_enrollments.student_id
          LEFT JOIN users AS student_users
            ON student_users.id = students.user_id
            AND student_users.is_active = TRUE
          WHERE teachers.user_id = ?
            AND users.is_active = TRUE
            AND classes.is_active = TRUE
            AND subjects.is_active = TRUE
          GROUP BY
            teacher_assignments.id,
            class_subjects.id,
            classes.id,
            classes.class_code,
            classes.class_name,
            classes.academic_year,
            subjects.id,
            subjects.subject_code,
            subjects.subject_name
          ORDER BY classes.class_name, subjects.subject_name`,
          [request.user.id]
        ),
        dbPool.execute(
          `SELECT COUNT(DISTINCT student_users.id) AS totalStudents
          FROM teacher_assignments
          INNER JOIN teachers
            ON teachers.id = teacher_assignments.teacher_id
          INNER JOIN student_subject_enrollments
            ON student_subject_enrollments.class_subject_id =
              teacher_assignments.class_subject_id
            AND student_subject_enrollments.is_active = TRUE
          INNER JOIN students
            ON students.id = student_subject_enrollments.student_id
          INNER JOIN users AS student_users
            ON student_users.id = students.user_id
          WHERE teachers.user_id = ?
            AND student_users.is_active = TRUE`,
          [request.user.id]
        )
      ])

      if (teacherRows.length === 0) {
        return response.status(404).json({
          message: 'Active teacher account not found.'
        })
      }

      const assignedClasses = new Set(
        assignments.map((assignment) => assignment.classId)
      ).size

      const assignedSubjects = new Set(
        assignments.map((assignment) => assignment.subjectId)
      ).size

      return response.json({
        teacher: teacherRows[0],
        assignments,
        stats: {
          assignedClasses,
          assignedSubjects,
          totalStudents: Number(studentRows[0].totalStudents),
          sessionsToday: 0
        }
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load the teacher dashboard.'
      })
    }
  }
)

router.get(
  '/attendance/sessions',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      await expireOldSessions()

      const [sessions] = await dbPool.execute(
        `SELECT
          attendance_sessions.session_public_id AS sessionPublicId,
          attendance_sessions.started_at AS startedAt,
          attendance_sessions.expires_at AS expiresAt,
          attendance_sessions.ended_at AS endedAt,
          attendance_sessions.status,
          classes.class_name AS className,
          classes.class_code AS classCode,
          subjects.subject_name AS subjectName,
          subjects.subject_code AS subjectCode,
          COUNT(DISTINCT attendance_records.id) AS presentCount,
          COUNT(DISTINCT enrolled_student_users.id) AS studentCount
        FROM attendance_sessions
        INNER JOIN teacher_assignments
          ON teacher_assignments.id = attendance_sessions.teacher_assignment_id
        INNER JOIN teachers ON teachers.id = teacher_assignments.teacher_id
        INNER JOIN class_subjects
          ON class_subjects.id = teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        LEFT JOIN attendance_records
          ON attendance_records.attendance_session_id = attendance_sessions.id
        LEFT JOIN student_subject_enrollments
          ON student_subject_enrollments.class_subject_id = class_subjects.id
          AND student_subject_enrollments.is_active = TRUE
        LEFT JOIN students AS enrolled_students
          ON enrolled_students.id = student_subject_enrollments.student_id
        LEFT JOIN users AS enrolled_student_users
          ON enrolled_student_users.id = enrolled_students.user_id
          AND enrolled_student_users.is_active = TRUE
        WHERE teachers.user_id = ?
        GROUP BY
          attendance_sessions.id,
          attendance_sessions.session_public_id,
          attendance_sessions.started_at,
          attendance_sessions.expires_at,
          attendance_sessions.ended_at,
          attendance_sessions.status,
          classes.class_name,
          classes.class_code,
          subjects.subject_name,
          subjects.subject_code
        ORDER BY attendance_sessions.started_at DESC`,
        [request.user.id]
      )

      return response.json({ sessions })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load attendance history.'
      })
    }
  }
)

router.get(
  '/timetables',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      const [timetables] = await dbPool.execute(
        `SELECT
          classes.id AS classId,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear,
          classes.timetable_image AS timetableImage,
          COUNT(DISTINCT subjects.id) AS assignedSubjectCount
        FROM teacher_assignments
        INNER JOIN teachers
          ON teachers.id = teacher_assignments.teacher_id
        INNER JOIN users ON users.id = teachers.user_id
        INNER JOIN class_subjects
          ON class_subjects.id = teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE teachers.user_id = ?
          AND users.is_active = TRUE
          AND classes.is_active = TRUE
          AND subjects.is_active = TRUE
        GROUP BY
          classes.id,
          classes.class_code,
          classes.class_name,
          classes.academic_year,
          classes.timetable_image
        ORDER BY classes.class_name`,
        [request.user.id]
      )

      return response.json({ timetables })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load class timetables.'
      })
    }
  }
)

router.get(
  '/attendance/sessions/:sessionPublicId/report',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      await expireOldSessions()

      const [sessionRows] = await dbPool.execute(
        `SELECT
          attendance_sessions.id AS sessionId,
          attendance_sessions.session_public_id AS sessionPublicId,
          attendance_sessions.started_at AS startedAt,
          attendance_sessions.ended_at AS endedAt,
          attendance_sessions.status,
          class_subjects.id AS classSubjectId,
          classes.class_name AS className,
          classes.class_code AS classCode,
          subjects.subject_name AS subjectName,
          subjects.subject_code AS subjectCode
        FROM attendance_sessions
        INNER JOIN teacher_assignments
          ON teacher_assignments.id = attendance_sessions.teacher_assignment_id
        INNER JOIN teachers ON teachers.id = teacher_assignments.teacher_id
        INNER JOIN class_subjects
          ON class_subjects.id = teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE attendance_sessions.session_public_id = ?
          AND teachers.user_id = ?`,
        [request.params.sessionPublicId, request.user.id]
      )

      if (sessionRows.length === 0) {
        return response.status(404).json({
          message: 'Attendance session not found.'
        })
      }

      const session = sessionRows[0]
      const [records] = await dbPool.execute(
        `SELECT
          students.id AS studentId,
          students.student_code AS studentCode,
          students.first_name AS firstName,
          students.last_name AS lastName,
          users.email,
          CASE
            WHEN attendance_records.id IS NULL THEN 'Absent'
            ELSE 'Present'
          END AS attendanceStatus,
          attendance_records.marked_at AS markedAt
        FROM student_subject_enrollments
        INNER JOIN students
          ON students.id = student_subject_enrollments.student_id
        INNER JOIN users ON users.id = students.user_id
        LEFT JOIN attendance_records
          ON attendance_records.attendance_session_id = ?
          AND attendance_records.student_id = students.id
        WHERE student_subject_enrollments.class_subject_id = ?
          AND student_subject_enrollments.is_active = TRUE
          AND users.is_active = TRUE
        ORDER BY students.first_name, students.last_name`,
        [session.sessionId, session.classSubjectId]
      )

      return response.json({
        session,
        records,
        presentCount: records.filter(
          (record) => record.attendanceStatus === 'Present'
        ).length
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not prepare the attendance report.'
      })
    }
  }
)

module.exports = router
