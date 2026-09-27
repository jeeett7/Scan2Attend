const express = require('express')
const bcrypt = require('bcrypt')
const { z } = require('zod')
const { dbPool } = require('../config/database')
const {
  authenticate,
  authorizeRoles
} = require('../middleware/auth')

const router = express.Router()

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128)
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Your new password must be different from the current password.',
    path: ['newPassword']
  })

async function getStudentProfile(userId) {
  const [rows] = await dbPool.execute(
    `SELECT
      students.id AS studentId,
      students.student_code AS studentCode,
      students.first_name AS firstName,
      students.last_name AS lastName,
      students.phone,
      users.email
    FROM students
    INNER JOIN users ON users.id = students.user_id
    WHERE students.user_id = ?
      AND users.is_active = TRUE`,
    [userId]
  )

  return rows[0] || null
}

async function getSubjectSummaries(studentId) {
  const [subjects] = await dbPool.execute(
    `SELECT
      class_subjects.id AS classSubjectId,
      classes.id AS classId,
      classes.class_code AS classCode,
      classes.class_name AS className,
      classes.academic_year AS academicYear,
      subjects.id AS subjectId,
      subjects.subject_code AS subjectCode,
      subjects.subject_name AS subjectName,
      COUNT(DISTINCT attendance_sessions.id) AS sessionsHeld,
      COUNT(DISTINCT attendance_records.id) AS presentCount
    FROM student_subject_enrollments
    INNER JOIN class_subjects
      ON class_subjects.id = student_subject_enrollments.class_subject_id
    INNER JOIN classes ON classes.id = class_subjects.class_id
    INNER JOIN subjects ON subjects.id = class_subjects.subject_id
    LEFT JOIN teacher_assignments
      ON teacher_assignments.class_subject_id = class_subjects.id
    LEFT JOIN attendance_sessions
      ON attendance_sessions.teacher_assignment_id = teacher_assignments.id
      AND attendance_sessions.status IN ('ended', 'expired')
      AND attendance_sessions.started_at >= student_subject_enrollments.enrolled_at
    LEFT JOIN attendance_records
      ON attendance_records.attendance_session_id = attendance_sessions.id
      AND attendance_records.student_id = student_subject_enrollments.student_id
    WHERE student_subject_enrollments.student_id = ?
      AND student_subject_enrollments.is_active = TRUE
      AND classes.is_active = TRUE
      AND subjects.is_active = TRUE
    GROUP BY
      class_subjects.id,
      classes.id,
      classes.class_code,
      classes.class_name,
      classes.academic_year,
      subjects.id,
      subjects.subject_code,
      subjects.subject_name
    ORDER BY classes.class_name, subjects.subject_name`,
    [studentId]
  )

  return subjects.map((subject) => {
    const sessionsHeld = Number(subject.sessionsHeld)
    const presentCount = Number(subject.presentCount)

    return {
      ...subject,
      sessionsHeld,
      presentCount,
      attendancePercentage:
        sessionsHeld === 0
          ? null
          : Math.round((presentCount / sessionsHeld) * 100)
    }
  })
}

async function getAttendanceHistory(studentId, limit = null) {
  const limitClause = limit ? `LIMIT ${Number(limit)}` : ''

  const [history] = await dbPool.execute(
    `SELECT
      attendance_sessions.session_public_id AS sessionPublicId,
      attendance_sessions.started_at AS startedAt,
      attendance_sessions.ended_at AS endedAt,
      attendance_sessions.status AS sessionStatus,
      classes.class_code AS classCode,
      classes.class_name AS className,
      subjects.subject_code AS subjectCode,
      subjects.subject_name AS subjectName,
      CONCAT(teachers.first_name, ' ', teachers.last_name) AS teacherName,
      CASE
        WHEN attendance_records.id IS NULL THEN 'Absent'
        ELSE 'Present'
      END AS attendanceStatus,
      attendance_records.marked_at AS markedAt
    FROM student_subject_enrollments
    INNER JOIN class_subjects
      ON class_subjects.id = student_subject_enrollments.class_subject_id
    INNER JOIN classes ON classes.id = class_subjects.class_id
    INNER JOIN subjects ON subjects.id = class_subjects.subject_id
    INNER JOIN teacher_assignments
      ON teacher_assignments.class_subject_id = class_subjects.id
    INNER JOIN teachers ON teachers.id = teacher_assignments.teacher_id
    INNER JOIN attendance_sessions
      ON attendance_sessions.teacher_assignment_id = teacher_assignments.id
      AND attendance_sessions.status IN ('ended', 'expired')
      AND attendance_sessions.started_at >= student_subject_enrollments.enrolled_at
    LEFT JOIN attendance_records
      ON attendance_records.attendance_session_id = attendance_sessions.id
      AND attendance_records.student_id = student_subject_enrollments.student_id
    WHERE student_subject_enrollments.student_id = ?
      AND student_subject_enrollments.is_active = TRUE
      AND classes.is_active = TRUE
      AND subjects.is_active = TRUE
    ORDER BY attendance_sessions.started_at DESC
    ${limitClause}`,
    [studentId]
  )

  return history
}

router.get(
  '/dashboard',
  authenticate,
  authorizeRoles('student'),
  async (request, response) => {
    try {
      const profile = await getStudentProfile(request.user.id)

      if (!profile) {
        return response.status(404).json({
          message: 'Active student account not found.'
        })
      }

      const [subjects, recentHistory, todayRows] = await Promise.all([
        getSubjectSummaries(profile.studentId),
        getAttendanceHistory(profile.studentId, 5),
        dbPool.execute(
          `SELECT COUNT(DISTINCT attendance_records.id) AS presentToday
          FROM attendance_records
          WHERE attendance_records.student_id = ?
            AND DATE(attendance_records.marked_at) = CURDATE()`,
          [profile.studentId]
        )
      ])

      const totalSessions = subjects.reduce(
        (total, subject) => total + subject.sessionsHeld,
        0
      )
      const totalPresent = subjects.reduce(
        (total, subject) => total + subject.presentCount,
        0
      )

      return response.json({
        profile,
        stats: {
          overallAttendance:
            totalSessions === 0
              ? null
              : Math.round((totalPresent / totalSessions) * 100),
          enrolledClasses: new Set(
            subjects.map((subject) => subject.classId)
          ).size,
          subjects: subjects.length,
          totalSessions,
          totalPresent,
          presentToday: Number(todayRows[0][0].presentToday)
        },
        subjects,
        recentHistory
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load the student dashboard.'
      })
    }
  }
)

router.get(
  '/attendance-history',
  authenticate,
  authorizeRoles('student'),
  async (request, response) => {
    try {
      const profile = await getStudentProfile(request.user.id)

      if (!profile) {
        return response.status(404).json({
          message: 'Active student account not found.'
        })
      }

      const history = await getAttendanceHistory(profile.studentId)
      return response.json({ history })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load attendance history.'
      })
    }
  }
)

router.get(
  '/timetable',
  authenticate,
  authorizeRoles('student'),
  async (request, response) => {
    try {
      const profile = await getStudentProfile(request.user.id)

      if (!profile) {
        return response.status(404).json({
          message: 'Active student account not found.'
        })
      }

      const [timetables] = await dbPool.execute(
        `SELECT DISTINCT
          classes.id AS classId,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear,
          classes.timetable_image AS timetableImage
        FROM student_subject_enrollments
        INNER JOIN class_subjects
          ON class_subjects.id = student_subject_enrollments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        WHERE student_subject_enrollments.student_id = ?
          AND student_subject_enrollments.is_active = TRUE
          AND classes.is_active = TRUE
          AND classes.timetable_image IS NOT NULL
          AND classes.timetable_image <> ''
        ORDER BY classes.class_name`,
        [profile.studentId]
      )

      return response.json({ timetables })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load your lecture timetable.'
      })
    }
  }
)

router.get(
  '/profile',
  authenticate,
  authorizeRoles('student'),
  async (request, response) => {
    try {
      const profile = await getStudentProfile(request.user.id)

      if (!profile) {
        return response.status(404).json({
          message: 'Active student account not found.'
        })
      }

      return response.json({ profile })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load the student profile.'
      })
    }
  }
)

router.put(
  '/password',
  authenticate,
  authorizeRoles('student'),
  async (request, response) => {
    const validation = changePasswordSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message:
          validation.error.issues[0]?.message ||
          'Enter a current password and a new password with at least 8 characters.'
      })
    }

    const { currentPassword, newPassword } = validation.data

    try {
      const [userRows] = await dbPool.execute(
        `SELECT users.password_hash AS passwordHash
         FROM users
         INNER JOIN students ON students.user_id = users.id
         WHERE users.id = ?
           AND users.role = 'student'
           AND users.is_active = TRUE`,
        [request.user.id]
      )

      if (userRows.length === 0) {
        return response.status(404).json({
          message: 'Active student account not found.'
        })
      }

      const currentPasswordIsCorrect = await bcrypt.compare(
        currentPassword,
        userRows[0].passwordHash
      )

      if (!currentPasswordIsCorrect) {
        return response.status(400).json({
          message: 'Your current password is incorrect.'
        })
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 12)

      await dbPool.execute(
        `UPDATE users
         SET password_hash = ?
         WHERE id = ?`,
        [newPasswordHash, request.user.id]
      )

      return response.json({
        message: 'Your password has been changed successfully.'
      })
    } catch (error) {
      console.error('Student password change error:', error.message)

      return response.status(500).json({
        message: 'Could not change your password. Please try again.'
      })
    }
  }
)

module.exports = router
