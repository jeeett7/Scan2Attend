const express = require('express')
const bcrypt = require('bcrypt')
const { z } = require('zod')
const { dbPool } = require('../config/database')
const {
  authenticate,
  authorizeRoles
} = require('../middleware/auth')

const router = express.Router()

const studentSchema = z.object({
  email: z.string().trim().email().max(191),
  studentCode: z.string().trim().min(2).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(25).optional(),
  password: z.string().min(8).max(128)
})

const teacherSchema = z.object({
  email: z.string().trim().email().max(191),
  teacherCode: z.string().trim().min(2).max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(25).optional(),
  password: z.string().min(8).max(128)
})

const classSchema = z.object({
  classCode: z.string().trim().min(2).max(40),
  className: z.string().trim().min(2).max(120),
  academicYear: z.string().trim().min(4).max(20)
})

const timetableImageSchema = z.object({
  imageData: z
    .string()
    .max(7_000_000)
    .regex(
      /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i,
      'Choose a valid JPG, PNG, or WebP timetable image.'
    )
})

const subjectSchema = z.object({
  subjectCode: z.string().trim().min(2).max(40),
  subjectName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional()
})

const classSubjectSchema = z.object({
  subjectId: z.coerce.number().int().positive()
})

const teacherAssignmentSchema = z.object({
  teacherId: z.coerce.number().int().positive(),
  classSubjectId: z.coerce.number().int().positive()
})

const enrollmentSchema = z.object({
  classId: z.coerce.number().int().positive()
})

const studentSubjectEnrollmentSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  classSubjectId: z.coerce.number().int().positive()
})

router.get(
  '/dashboard',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [
        [studentRows],
        [teacherRows],
        [classRows],
        [attendanceRows]
      ] = await Promise.all([
        dbPool.query(
          `SELECT COUNT(*) AS total
           FROM students
           INNER JOIN users ON users.id = students.user_id
           WHERE users.is_active = TRUE`
        ),
        dbPool.query(
          `SELECT COUNT(*) AS total
           FROM teachers
           INNER JOIN users ON users.id = teachers.user_id
           WHERE users.is_active = TRUE`
        ),
        dbPool.query(
          `SELECT COUNT(*) AS total
           FROM classes
           WHERE is_active = TRUE`
        ),
        dbPool.query(
          `SELECT COUNT(*) AS total
           FROM attendance_records
           WHERE DATE(marked_at) = CURDATE()`
        )
      ])

      return response.json({
        totalStudents: studentRows[0].total,
        totalTeachers: teacherRows[0].total,
        activeClasses: classRows[0].total,
        attendanceToday: attendanceRows[0].total
      })
    } catch (error) {
      console.error('Admin dashboard error:', error)

      return response.status(500).json({
        message: 'Could not load dashboard data.'
      })
    }
  }
)

router.get(
  '/students',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [students] = await dbPool.query(
        `SELECT
          students.id,
          students.student_code AS studentCode,
          students.first_name AS firstName,
          students.last_name AS lastName,
          students.phone,
          students.created_at AS createdAt,
          users.email,
          users.is_active AS isActive
        FROM students
        INNER JOIN users ON users.id = students.user_id
        ORDER BY students.created_at DESC`
      )

      return response.json({ students })
    } catch (error) {
      console.error('Student list error:', error)

      return response.status(500).json({
        message: 'Could not load students.'
      })
    }
  }
)

router.post(
  '/students',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const validation = studentSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Please enter valid student details. Password needs at least 8 characters.'
      })
    }

    const {
      email,
      studentCode,
      firstName,
      lastName,
      phone,
      password
    } = validation.data

    let connection

    try {
      connection = await dbPool.getConnection()
      await connection.beginTransaction()

      const passwordHash = await bcrypt.hash(password, 12)

      // Support any inactive student accounts left behind by older versions
      // of the app, which used soft deletion.
      const [existingAccounts] = await connection.execute(
        `SELECT
           users.id AS userId,
           users.role,
           users.is_active AS isActive,
           students.id AS studentId
         FROM users
         LEFT JOIN students ON students.user_id = users.id
         WHERE users.email = ?
         FOR UPDATE`,
        [email]
      )

      if (existingAccounts.length > 0) {
        const existingAccount = existingAccounts[0]

        if (
          existingAccount.role === 'student' &&
          !existingAccount.isActive &&
          existingAccount.studentId
        ) {
          await connection.execute(
            `UPDATE users
             SET password_hash = ?, is_active = TRUE
             WHERE id = ?`,
            [passwordHash, existingAccount.userId]
          )

          await connection.execute(
            `UPDATE students
             SET student_code = ?, first_name = ?, last_name = ?, phone = ?
             WHERE id = ?`,
            [
              studentCode,
              firstName,
              lastName,
              phone || null,
              existingAccount.studentId
            ]
          )

          await connection.commit()

          return response.status(200).json({
            message: 'Student account reactivated successfully.',
            student: {
              id: existingAccount.studentId,
              studentCode,
              firstName,
              lastName,
              email,
              phone: phone || null
            }
          })
        }

        await connection.rollback()
        return response.status(409).json({
          message: 'That email address is already connected to an active account.'
        })
      }

      const [userResult] = await connection.execute(
        `INSERT INTO users (email, password_hash, role)
         VALUES (?, ?, 'student')`,
        [email, passwordHash]
      )

      const [studentResult] = await connection.execute(
        `INSERT INTO students
          (user_id, student_code, first_name, last_name, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userResult.insertId,
          studentCode,
          firstName,
          lastName,
          phone || null
        ]
      )

      await connection.commit()

      return response.status(201).json({
        message: 'Student added successfully.',
        student: {
          id: studentResult.insertId,
          studentCode,
          firstName,
          lastName,
          email,
          phone: phone || null
        }
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }

      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'That email address or student code is already in use.'
        })
      }

      console.error('Create student error:', error)

      return response.status(500).json({
        message: 'Could not add the student.'
      })
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)
router.delete(
  '/students/:studentId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const studentId = Number(request.params.studentId)

    if (!Number.isInteger(studentId) || studentId < 1) {
      return response.status(400).json({
        message: 'Invalid student ID.'
      })
    }

    let connection

    try {
      connection = await dbPool.getConnection()
      await connection.beginTransaction()

      const [students] = await connection.execute(
        `SELECT id, user_id AS userId
         FROM students
         WHERE id = ?
         FOR UPDATE`,
        [studentId]
      )

      if (students.length === 0) {
        await connection.rollback()
        return response.status(404).json({
          message: 'Student not found.'
        })
      }

      const userId = students[0].userId

      await connection.execute(
        `DELETE FROM attendance_records WHERE student_id = ?`,
        [studentId]
      )
      await connection.execute(
        `DELETE FROM student_subject_enrollments WHERE student_id = ?`,
        [studentId]
      )
      await connection.execute(
        `DELETE FROM enrollments WHERE student_id = ?`,
        [studentId]
      )
      await connection.execute(
        `DELETE FROM students WHERE id = ?`,
        [studentId]
      )
      await connection.execute(
        `DELETE FROM users WHERE id = ?`,
        [userId]
      )

      await connection.commit()

      return response.json({
        message: 'Student permanently deleted successfully.'
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }

      console.error('Delete student error:', error)

      return response.status(500).json({
        message: 'Could not permanently delete the student.'
      })
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)
router.get(
  '/teachers',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [teachers] = await dbPool.query(
        `SELECT
          teachers.id,
          teachers.teacher_code AS teacherCode,
          teachers.first_name AS firstName,
          teachers.last_name AS lastName,
          teachers.phone,
          teachers.created_at AS createdAt,
          users.email,
          users.is_active AS isActive
        FROM teachers
        INNER JOIN users ON users.id = teachers.user_id
        ORDER BY teachers.created_at DESC`
      )

      return response.json({ teachers })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load teachers.'
      })
    }
  }
)

router.post(
  '/teachers',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const validation = teacherSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Please enter valid teacher details. Password needs at least 8 characters.'
      })
    }

    const {
      email,
      teacherCode,
      firstName,
      lastName,
      phone,
      password
    } = validation.data

    let connection

    try {
      connection = await dbPool.getConnection()
      await connection.beginTransaction()

      const passwordHash = await bcrypt.hash(password, 12)

      // Support any inactive teacher accounts left behind by older versions
      // of the app, which used soft deletion.
      // This keeps historical assignments and attendance records valid.
      const [existingAccounts] = await connection.execute(
        `SELECT
           users.id AS userId,
           users.role,
           users.is_active AS isActive,
           teachers.id AS teacherId
         FROM users
         LEFT JOIN teachers ON teachers.user_id = users.id
         WHERE users.email = ?
         FOR UPDATE`,
        [email]
      )

      if (existingAccounts.length > 0) {
        const existingAccount = existingAccounts[0]

        if (
          existingAccount.role === 'teacher' &&
          !existingAccount.isActive &&
          existingAccount.teacherId
        ) {
          await connection.execute(
            `UPDATE users
             SET password_hash = ?, is_active = TRUE
             WHERE id = ?`,
            [passwordHash, existingAccount.userId]
          )

          await connection.execute(
            `UPDATE teachers
             SET teacher_code = ?, first_name = ?, last_name = ?, phone = ?
             WHERE id = ?`,
            [
              teacherCode,
              firstName,
              lastName,
              phone || null,
              existingAccount.teacherId
            ]
          )

          await connection.commit()

          return response.status(200).json({
            message: 'Teacher account reactivated successfully.',
            teacher: {
              id: existingAccount.teacherId,
              teacherCode,
              firstName,
              lastName,
              email,
              phone: phone || null
            }
          })
        }

        await connection.rollback()
        return response.status(409).json({
          message: 'That email address is already connected to an active account.'
        })
      }

      const [userResult] = await connection.execute(
        `INSERT INTO users (email, password_hash, role)
         VALUES (?, ?, 'teacher')`,
        [email, passwordHash]
      )

      const [teacherResult] = await connection.execute(
        `INSERT INTO teachers
          (user_id, teacher_code, first_name, last_name, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userResult.insertId,
          teacherCode,
          firstName,
          lastName,
          phone || null
        ]
      )

      await connection.commit()

      return response.status(201).json({
        message: 'Teacher added successfully.',
        teacher: {
          id: teacherResult.insertId,
          teacherCode,
          firstName,
          lastName,
          email,
          phone: phone || null
        }
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }

      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'That email address or teacher ID is already in use.'
        })
      }

      return response.status(500).json({
        message: 'Could not add the teacher.'
      })
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)

router.delete(
  '/teachers/:teacherId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const teacherId = Number(request.params.teacherId)

    if (!Number.isInteger(teacherId) || teacherId < 1) {
      return response.status(400).json({
        message: 'Invalid teacher ID.'
      })
    }

    let connection

    try {
      connection = await dbPool.getConnection()
      await connection.beginTransaction()

      const [teachers] = await connection.execute(
        `SELECT id, user_id AS userId
         FROM teachers
         WHERE id = ?
         FOR UPDATE`,
        [teacherId]
      )

      if (teachers.length === 0) {
        await connection.rollback()
        return response.status(404).json({
          message: 'Teacher not found.'
        })
      }

      const userId = teachers[0].userId

      await connection.execute(
        `DELETE attendance_scan_claims
         FROM attendance_scan_claims
         INNER JOIN attendance_sessions
           ON attendance_sessions.id =
             attendance_scan_claims.attendance_session_id
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         WHERE teacher_assignments.teacher_id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE attendance_device_marks
         FROM attendance_device_marks
         INNER JOIN attendance_sessions
           ON attendance_sessions.id =
             attendance_device_marks.attendance_session_id
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         WHERE teacher_assignments.teacher_id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE attendance_qr_tokens
         FROM attendance_qr_tokens
         INNER JOIN attendance_sessions
           ON attendance_sessions.id =
             attendance_qr_tokens.attendance_session_id
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         WHERE teacher_assignments.teacher_id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE attendance_records
         FROM attendance_records
         INNER JOIN attendance_sessions
           ON attendance_sessions.id =
             attendance_records.attendance_session_id
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         WHERE teacher_assignments.teacher_id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE attendance_sessions
         FROM attendance_sessions
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         WHERE teacher_assignments.teacher_id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE FROM teacher_assignments WHERE teacher_id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE FROM teachers WHERE id = ?`,
        [teacherId]
      )
      await connection.execute(
        `DELETE FROM users WHERE id = ?`,
        [userId]
      )

      await connection.commit()

      return response.json({
        message: 'Teacher permanently deleted successfully.'
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }

      console.error('Delete teacher error:', error)

      return response.status(500).json({
        message: 'Could not permanently delete the teacher.'
      })
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)
router.get(
  '/classes',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [classes] = await dbPool.query(
        `SELECT
          id,
          class_code AS classCode,
          class_name AS className,
          academic_year AS academicYear,
          timetable_image IS NOT NULL AS hasTimetable,
          is_active AS isActive
        FROM classes
        ORDER BY created_at DESC`
      )

      return response.json({ classes })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load classes.'
      })
    }
  }
)

router.put(
  '/classes/:classId/timetable',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const classId = Number(request.params.classId)
    const validation = timetableImageSchema.safeParse(request.body)

    if (!Number.isInteger(classId) || classId < 1) {
      return response.status(400).json({
        message: 'Invalid class ID.'
      })
    }

    if (!validation.success) {
      return response.status(400).json({
        message:
          validation.error.issues[0]?.message ||
          'Choose a valid timetable image.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `UPDATE classes
         SET timetable_image = ?
         WHERE id = ?
           AND is_active = TRUE`,
        [validation.data.imageData, classId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Active class not found.'
        })
      }

      return response.json({
        message: 'Timetable saved successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not save the timetable image.'
      })
    }
  }
)

router.post(
  '/classes',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const validation = classSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Enter a valid class code, class name, and academic year.'
      })
    }

    const { classCode, className, academicYear } = validation.data

    try {
      const [result] = await dbPool.execute(
        `INSERT INTO classes
          (class_code, class_name, academic_year)
         VALUES (?, ?, ?)`,
        [classCode, className, academicYear]
      )

      return response.status(201).json({
        message: 'Class added successfully.',
        classItem: {
          id: result.insertId,
          classCode,
          className,
          academicYear,
          isActive: true
        }
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'That class code is already in use.'
        })
      }

      return response.status(500).json({
        message: 'Could not add the class.'
      })
    }
  }
)

router.delete(
  '/classes/:classId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const classId = Number(request.params.classId)

    if (!Number.isInteger(classId) || classId < 1) {
      return response.status(400).json({
        message: 'Invalid class ID.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `UPDATE classes
         SET is_active = FALSE
         WHERE id = ?`,
        [classId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Class not found.'
        })
      }

      return response.json({
        message: 'Class deactivated successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not deactivate the class.'
      })
    }
  }
)
router.get(
  '/subjects',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [subjects] = await dbPool.query(
        `SELECT
          id,
          subjects.id AS subjectId,
          subject_name AS subjectName,
          description,
          is_active AS isActive
        FROM subjects
        ORDER BY created_at DESC`
      )

      return response.json({ subjects })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load subjects.'
      })
    }
  }
)

router.post(
  '/subjects',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const validation = subjectSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Enter a valid subject code and subject name.'
      })
    }

    const { subjectCode, subjectName, description } = validation.data

    try {
      const [result] = await dbPool.execute(
        `INSERT INTO subjects
          (subject_code, subject_name, description)
         VALUES (?, ?, ?)`,
        [subjectCode, subjectName, description || null]
      )

      return response.status(201).json({
        message: 'Subject added successfully.',
        subject: {
          id: result.insertId,
          subjectCode,
          subjectName,
          description: description || null,
          isActive: true
        }
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'That subject code is already in use.'
        })
      }

      return response.status(500).json({
        message: 'Could not add the subject.'
      })
    }
  }
)

router.delete(
  '/subjects/:subjectId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const subjectId = Number(request.params.subjectId)

    if (!Number.isInteger(subjectId) || subjectId < 1) {
      return response.status(400).json({
        message: 'Invalid subject ID.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `UPDATE subjects
         SET is_active = FALSE
         WHERE id = ?`,
        [subjectId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Subject not found.'
        })
      }

      return response.json({
        message: 'Subject deactivated successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not deactivate the subject.'
      })
    }
  }
)
router.get(
  '/classes/:classId/subjects',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const classId = Number(request.params.classId)

    if (!Number.isInteger(classId) || classId < 1) {
      return response.status(400).json({
        message: 'Invalid class ID.'
      })
    }

    try {
      const [subjects] = await dbPool.execute(
        `SELECT
          subjects.id,
          subjects.subject_code AS subjectCode,
          subjects.subject_name AS subjectName,
          subjects.description
        FROM class_subjects
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE class_subjects.class_id = ?
          AND subjects.is_active = TRUE
        ORDER BY subjects.subject_name`,
        [classId]
      )

      return response.json({ subjects })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load class subjects.'
      })
    }
  }
)

router.post(
  '/classes/:classId/subjects',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const classId = Number(request.params.classId)
    const validation = classSubjectSchema.safeParse(request.body)

    if (!Number.isInteger(classId) || classId < 1) {
      return response.status(400).json({
        message: 'Invalid class ID.'
      })
    }

    if (!validation.success) {
      return response.status(400).json({
        message: 'Choose a valid subject.'
      })
    }

    const { subjectId } = validation.data

    try {
      const [validRows] = await dbPool.execute(
        `SELECT classes.id
         FROM classes
         INNER JOIN subjects
         WHERE classes.id = ?
           AND classes.is_active = TRUE
           AND subjects.id = ?
           AND subjects.is_active = TRUE`,
        [classId, subjectId]
      )

      if (validRows.length === 0) {
        return response.status(404).json({
          message: 'Active class or subject not found.'
        })
      }

      await dbPool.execute(
        `INSERT INTO class_subjects (class_id, subject_id)
         VALUES (?, ?)`,
        [classId, subjectId]
      )

      return response.status(201).json({
        message: 'Subject assigned to class successfully.'
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'This subject is already assigned to the class.'
        })
      }

      return response.status(500).json({
        message: 'Could not assign subject to class.'
      })
    }
  }
)

router.delete(
  '/classes/:classId/subjects/:subjectId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const classId = Number(request.params.classId)
    const subjectId = Number(request.params.subjectId)

    if (
      !Number.isInteger(classId) ||
      !Number.isInteger(subjectId) ||
      classId < 1 ||
      subjectId < 1
    ) {
      return response.status(400).json({
        message: 'Invalid class or subject ID.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `DELETE FROM class_subjects
         WHERE class_id = ? AND subject_id = ?`,
        [classId, subjectId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'This subject is not assigned to the class.'
        })
      }

      return response.json({
        message: 'Subject removed from class successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not remove subject from class.'
      })
    }
  }
)
router.get(
  '/teacher-assignments',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [assignments] = await dbPool.query(
        `SELECT
          teacher_assignments.id,
          teachers.id AS teacherId,
          CONCAT(teachers.first_name, ' ', teachers.last_name) AS teacherName,
          users.email AS teacherEmail,
          class_subjects.id AS classSubjectId,
          subjects.id AS subjectId,
          classes.class_name AS className,
          classes.class_code AS classCode,
          subjects.subject_name AS subjectName,
          subjects.subject_code AS subjectCode
        FROM teacher_assignments
        INNER JOIN teachers ON teachers.id = teacher_assignments.teacher_id
        INNER JOIN users ON users.id = teachers.user_id
        INNER JOIN class_subjects
          ON class_subjects.id = teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE users.is_active = TRUE
          AND classes.is_active = TRUE
          AND subjects.is_active = TRUE
        ORDER BY classes.class_name, subjects.subject_name`
      )

      return response.json({ assignments })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load teacher assignments.'
      })
    }
  }
)

router.post(
  '/teacher-assignments',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const validation = teacherAssignmentSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Choose a valid teacher and class subject.'
      })
    }

    const { teacherId, classSubjectId } = validation.data

    try {
      const [validRows] = await dbPool.execute(
        `SELECT teachers.id
         FROM teachers
         INNER JOIN users ON users.id = teachers.user_id
         CROSS JOIN class_subjects
         INNER JOIN classes ON classes.id = class_subjects.class_id
         INNER JOIN subjects ON subjects.id = class_subjects.subject_id
         WHERE teachers.id = ?
           AND class_subjects.id = ?
           AND users.is_active = TRUE
           AND classes.is_active = TRUE
           AND subjects.is_active = TRUE`,
        [teacherId, classSubjectId]
      )

      if (validRows.length === 0) {
        return response.status(404).json({
          message: 'Active teacher, class, or subject not found.'
        })
      }

      await dbPool.execute(
        `INSERT INTO teacher_assignments
          (teacher_id, class_subject_id)
         VALUES (?, ?)`,
        [teacherId, classSubjectId]
      )

      return response.status(201).json({
        message: 'Teacher assigned successfully.'
      })
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'This teacher is already assigned to this class and subject.'
        })
      }

      return response.status(500).json({
        message: 'Could not assign the teacher.'
      })
    }
  }
)

router.delete(
  '/teacher-assignments/:assignmentId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const assignmentId = Number(request.params.assignmentId)

    if (!Number.isInteger(assignmentId) || assignmentId < 1) {
      return response.status(400).json({
        message: 'Invalid assignment ID.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `DELETE FROM teacher_assignments
         WHERE id = ?`,
        [assignmentId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Teacher assignment not found.'
        })
      }

      return response.json({
        message: 'Teacher assignment removed successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not remove teacher assignment.'
      })
    }
  }
)
router.get(
  '/subjects/:subjectId/classes',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const subjectId = Number(request.params.subjectId)

    if (!Number.isInteger(subjectId) || subjectId < 1) {
      return response.status(400).json({
        message: 'Invalid subject ID.'
      })
    }

    try {
      const [classes] = await dbPool.execute(
        `SELECT
          class_subjects.id AS classSubjectId,
          classes.id AS classId,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear
        FROM class_subjects
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE class_subjects.subject_id = ?
          AND classes.is_active = TRUE
          AND subjects.is_active = TRUE
        ORDER BY classes.class_name`,
        [subjectId]
      )

      return response.json({ classes })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load classes for this subject.'
      })
    }
  }
)
router.get(
  '/students/:studentId/enrollments',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const studentId = Number(request.params.studentId)

    if (!Number.isInteger(studentId) || studentId < 1) {
      return response.status(400).json({
        message: 'Invalid student ID.'
      })
    }

    try {
      const [enrollments] = await dbPool.execute(
        `SELECT
          classes.id AS classId,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear,
          enrollments.enrolled_at AS enrolledAt
        FROM enrollments
        INNER JOIN classes ON classes.id = enrollments.class_id
        INNER JOIN students ON students.id = enrollments.student_id
        INNER JOIN users ON users.id = students.user_id
        WHERE enrollments.student_id = ?
          AND enrollments.is_active = TRUE
          AND classes.is_active = TRUE
          AND users.is_active = TRUE
        ORDER BY classes.class_name`,
        [studentId]
      )

      return response.json({ enrollments })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load student enrollments.'
      })
    }
  }
)

router.post(
  '/students/:studentId/enrollments',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const studentId = Number(request.params.studentId)
    const validation = enrollmentSchema.safeParse(request.body)

    if (!Number.isInteger(studentId) || studentId < 1) {
      return response.status(400).json({
        message: 'Invalid student ID.'
      })
    }

    if (!validation.success) {
      return response.status(400).json({
        message: 'Choose a valid class.'
      })
    }

    const { classId } = validation.data

    try {
      const [[studentRows], [classRows]] = await Promise.all([
        dbPool.execute(
          `SELECT students.id
           FROM students
           INNER JOIN users ON users.id = students.user_id
           WHERE students.id = ? AND users.is_active = TRUE`,
          [studentId]
        ),
        dbPool.execute(
          `SELECT id
           FROM classes
           WHERE id = ? AND is_active = TRUE`,
          [classId]
        )
      ])

      if (studentRows.length === 0 || classRows.length === 0) {
        return response.status(404).json({
          message: 'Active student or class not found.'
        })
      }

      await dbPool.execute(
        `INSERT INTO enrollments (student_id, class_id, is_active)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           is_active = TRUE,
           enrolled_at = CURRENT_TIMESTAMP`,
        [studentId, classId]
      )

      return response.status(201).json({
        message: 'Student enrolled successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not enroll the student.'
      })
    }
  }
)

router.delete(
  '/students/:studentId/enrollments/:classId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const studentId = Number(request.params.studentId)
    const classId = Number(request.params.classId)

    if (
      !Number.isInteger(studentId) ||
      !Number.isInteger(classId) ||
      studentId < 1 ||
      classId < 1
    ) {
      return response.status(400).json({
        message: 'Invalid student or class ID.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `UPDATE enrollments
         SET is_active = FALSE
         WHERE student_id = ?
           AND class_id = ?
           AND is_active = TRUE`,
        [studentId, classId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Active enrollment not found.'
        })
      }

      return response.json({
        message: 'Student removed from this class.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not remove the enrollment.'
      })
    }
  }
)
router.get(
  '/subjects/:subjectId/student-enrollments',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const subjectId = Number(request.params.subjectId)

    if (!Number.isInteger(subjectId) || subjectId < 1) {
      return response.status(400).json({
        message: 'Invalid subject ID.'
      })
    }

    try {
      const [enrollments] = await dbPool.execute(
        `SELECT
          student_subject_enrollments.id AS enrollmentId,
          students.id AS studentId,
          students.student_code AS studentCode,
          students.first_name AS firstName,
          students.last_name AS lastName,
          users.email AS email,
          class_subjects.id AS classSubjectId,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear,
          student_subject_enrollments.enrolled_at AS enrolledAt
        FROM student_subject_enrollments
        INNER JOIN students
          ON students.id = student_subject_enrollments.student_id
        INNER JOIN users ON users.id = students.user_id
        INNER JOIN class_subjects
          ON class_subjects.id =
            student_subject_enrollments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        WHERE class_subjects.subject_id = ?
          AND student_subject_enrollments.is_active = TRUE
          AND users.is_active = TRUE
          AND classes.is_active = TRUE
        ORDER BY classes.class_name, students.first_name, students.last_name`,
        [subjectId]
      )

      return response.json({ enrollments })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load student subject assignments.'
      })
    }
  }
)

router.post(
  '/subjects/:subjectId/student-enrollments',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const subjectId = Number(request.params.subjectId)
    const validation = studentSubjectEnrollmentSchema.safeParse(
      request.body
    )

    if (!Number.isInteger(subjectId) || subjectId < 1) {
      return response.status(400).json({
        message: 'Invalid subject ID.'
      })
    }

    if (!validation.success) {
      return response.status(400).json({
        message: 'Choose a valid student and class.'
      })
    }

    const { studentId, classSubjectId } = validation.data

    try {
      const [[studentRows], [classSubjectRows]] = await Promise.all([
        dbPool.execute(
          `SELECT students.id
           FROM students
           INNER JOIN users ON users.id = students.user_id
           WHERE students.id = ?
             AND users.is_active = TRUE`,
          [studentId]
        ),
        dbPool.execute(
          `SELECT class_subjects.id
           FROM class_subjects
           INNER JOIN classes
             ON classes.id = class_subjects.class_id
           INNER JOIN subjects
             ON subjects.id = class_subjects.subject_id
           WHERE class_subjects.id = ?
             AND class_subjects.subject_id = ?
             AND classes.is_active = TRUE
             AND subjects.is_active = TRUE`,
          [classSubjectId, subjectId]
        )
      ])

      if (studentRows.length === 0 || classSubjectRows.length === 0) {
        return response.status(404).json({
          message: 'Active student, subject, or class not found.'
        })
      }

      await dbPool.execute(
        `INSERT INTO student_subject_enrollments
          (student_id, class_subject_id, is_active)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           is_active = TRUE,
           enrolled_at = CURRENT_TIMESTAMP`,
        [studentId, classSubjectId]
      )

      return response.status(201).json({
        message: 'Student assigned to this subject successfully.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not assign the student to this subject.'
      })
    }
  }
)

router.delete(
  '/subjects/:subjectId/student-enrollments/:enrollmentId',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const subjectId = Number(request.params.subjectId)
    const enrollmentId = Number(request.params.enrollmentId)

    if (
      !Number.isInteger(subjectId) ||
      !Number.isInteger(enrollmentId) ||
      subjectId < 1 ||
      enrollmentId < 1
    ) {
      return response.status(400).json({
        message: 'Invalid subject or assignment ID.'
      })
    }

    try {
      const [result] = await dbPool.execute(
        `UPDATE student_subject_enrollments
         INNER JOIN class_subjects
           ON class_subjects.id =
             student_subject_enrollments.class_subject_id
         SET student_subject_enrollments.is_active = FALSE
         WHERE student_subject_enrollments.id = ?
           AND class_subjects.subject_id = ?
           AND student_subject_enrollments.is_active = TRUE`,
        [enrollmentId, subjectId]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Active student assignment not found.'
        })
      }

      return response.json({
        message: 'Student removed from this subject.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not remove the student assignment.'
      })
    }
  }
)
router.get(
  '/attendance/sessions',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      await dbPool.execute(
        `UPDATE attendance_sessions
         SET status = 'expired',
             ended_at = expires_at
         WHERE status = 'active'
           AND expires_at <= NOW()`
      )

      const [sessions] = await dbPool.query(
        `SELECT
          attendance_sessions.id AS sessionId,
          attendance_sessions.session_public_id AS sessionPublicId,
          attendance_sessions.started_at AS startedAt,
          attendance_sessions.expires_at AS expiresAt,
          attendance_sessions.ended_at AS endedAt,
          attendance_sessions.status,
          CONCAT(
            teachers.first_name,
            ' ',
            teachers.last_name
          ) AS teacherName,
          teachers.teacher_code AS teacherCode,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear,
          subjects.subject_code AS subjectCode,
          subjects.subject_name AS subjectName,
          COUNT(DISTINCT attendance_records.id) AS presentCount,
          COUNT(DISTINCT enrolled_student_users.id) AS eligibleStudentCount
        FROM attendance_sessions
        INNER JOIN teacher_assignments
          ON teacher_assignments.id =
            attendance_sessions.teacher_assignment_id
        INNER JOIN teachers
          ON teachers.id = teacher_assignments.teacher_id
        INNER JOIN class_subjects
          ON class_subjects.id =
            teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        LEFT JOIN attendance_records
          ON attendance_records.attendance_session_id =
            attendance_sessions.id
        LEFT JOIN student_subject_enrollments
          ON student_subject_enrollments.class_subject_id =
            class_subjects.id
          AND student_subject_enrollments.is_active = TRUE
          LEFT JOIN students AS enrolled_students
  ON enrolled_students.id = student_subject_enrollments.student_id
LEFT JOIN users AS enrolled_student_users
  ON enrolled_student_users.id = enrolled_students.user_id
  AND enrolled_student_users.is_active = TRUE
        GROUP BY
          attendance_sessions.id,
          attendance_sessions.session_public_id,
          attendance_sessions.started_at,
          attendance_sessions.expires_at,
          attendance_sessions.ended_at,
          attendance_sessions.status,
          teachers.first_name,
          teachers.last_name,
          teachers.teacher_code,
          classes.class_code,
          classes.class_name,
          classes.academic_year,
          subjects.subject_code,
          subjects.subject_name
        ORDER BY attendance_sessions.started_at DESC
        LIMIT 100`
      )

      return response.json({ sessions })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load attendance sessions.'
      })
    }
  }
)
router.get(
  '/reports/student-attendance',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    try {
      const [reports] = await dbPool.query(
        `SELECT
          students.id AS studentId,
          students.student_code AS studentCode,
          students.first_name AS firstName,
          students.last_name AS lastName,
          users.email,
          classes.id AS classId,
          classes.class_code AS classCode,
          classes.class_name AS className,
          classes.academic_year AS academicYear,
          subjects.id AS subjectId,
          subjects.subject_code AS subjectCode,
          subjects.subject_name AS subjectName,
          COUNT(
            DISTINCT attendance_sessions.id
          ) AS sessionsHeld,
          COUNT(
            DISTINCT attendance_records.id
          ) AS presentCount
        FROM student_subject_enrollments
        INNER JOIN students
          ON students.id = student_subject_enrollments.student_id
        INNER JOIN users ON users.id = students.user_id
        INNER JOIN class_subjects
          ON class_subjects.id =
            student_subject_enrollments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        LEFT JOIN teacher_assignments
          ON teacher_assignments.class_subject_id =
            class_subjects.id
        LEFT JOIN attendance_sessions
          ON attendance_sessions.teacher_assignment_id =
            teacher_assignments.id
          AND attendance_sessions.status IN ('ended', 'expired')
        LEFT JOIN attendance_records
          ON attendance_records.attendance_session_id =
            attendance_sessions.id
          AND attendance_records.student_id = students.id
        WHERE student_subject_enrollments.is_active = TRUE
          AND users.is_active = TRUE
          AND classes.is_active = TRUE
          AND subjects.is_active = TRUE
        GROUP BY
          students.id,
          students.student_code,
          students.first_name,
          students.last_name,
          users.email,
          classes.id,
          classes.class_code,
          classes.class_name,
          classes.academic_year,
          subjects.id,
          subjects.subject_code,
          subjects.subject_name
        ORDER BY
          classes.class_name,
          subjects.subject_name,
          students.first_name,
          students.last_name`
      )

      const attendanceReports = reports.map((report) => {
        const sessionsHeld = Number(report.sessionsHeld)
        const presentCount = Number(report.presentCount)

        return {
          ...report,
          sessionsHeld,
          presentCount,
          attendancePercentage:
            sessionsHeld === 0
              ? null
              : Math.round(
                  (presentCount / sessionsHeld) * 100
                )
        }
      })

      return response.json({
        reports: attendanceReports
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not load attendance reports.'
      })
    }
  }
)
router.delete(
  '/attendance/sessions/completed',
  authenticate,
  authorizeRoles('admin'),
  async (request, response) => {
    const connection = await dbPool.getConnection()

    try {
      await connection.beginTransaction()

      await connection.query(
        `UPDATE attendance_sessions
         SET status = 'expired',
             ended_at = expires_at
         WHERE status = 'active'
           AND expires_at <= NOW()`
      )

      const [countRows] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM attendance_sessions
         WHERE status IN ('ended', 'expired')
         FOR UPDATE`
      )

      const deletedCount = Number(countRows[0].total)

      if (deletedCount === 0) {
        await connection.commit()

        return response.json({
          message: 'There are no completed sessions to clear.',
          deletedCount: 0
        })
      }

      await connection.query(
        `DELETE attendance_qr_tokens
         FROM attendance_qr_tokens
         INNER JOIN attendance_sessions
           ON attendance_sessions.id =
             attendance_qr_tokens.attendance_session_id
         WHERE attendance_sessions.status IN ('ended', 'expired')`
      )

      await connection.query(
        `DELETE attendance_records
         FROM attendance_records
         INNER JOIN attendance_sessions
           ON attendance_sessions.id =
             attendance_records.attendance_session_id
         WHERE attendance_sessions.status IN ('ended', 'expired')`
      )

      await connection.query(
        `DELETE FROM attendance_sessions
         WHERE status IN ('ended', 'expired')`
      )

      await connection.commit()

      return response.json({
        message: `${deletedCount} completed session(s) cleared.`,
        deletedCount
      })
    } catch (error) {
      await connection.rollback()

      return response.status(500).json({
        message: 'Could not clear completed sessions.'
      })
    } finally {
      connection.release()
    }
  }
)
module.exports = router
