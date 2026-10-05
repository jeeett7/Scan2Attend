const express = require('express')
const crypto = require('crypto')
const { z } = require('zod')
const { dbPool } = require('../config/database')
const {
  authenticate,
  authorizeRoles
} = require('../middleware/auth')

const router = express.Router()

const SESSION_LENGTH_MS = 60 * 1000
const QR_INTERVAL_MS = 10 * 1000

const startSessionSchema = z.object({
  teacherAssignmentId: z.coerce.number().int().positive()
})

const qrScanSchema = z.object({
  sessionPublicId: z.string().uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/i),
  deviceId: z.string().uuid()
})

const markAttendanceSchema = z.object({
  scanClaim: z.string().regex(/^[a-f0-9]{64}$/i)
})

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}

function createQrToken(sessionPublicId, intervalNumber) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`scan2attend:${sessionPublicId}:${intervalNumber}`)
    .digest('hex')
}

async function expireSessionIfNeeded(sessionPublicId) {
  await dbPool.execute(
    `UPDATE attendance_sessions
     SET status = 'expired',
         ended_at = expires_at
     WHERE session_public_id = ?
       AND status = 'active'
       AND expires_at <= NOW()`,
    [sessionPublicId]
  )
}

async function getTeacherSession(sessionPublicId, userId) {
  await expireSessionIfNeeded(sessionPublicId)

  const [sessions] = await dbPool.execute(
    `SELECT
      attendance_sessions.id AS sessionId,
      attendance_sessions.session_public_id AS sessionPublicId,
      attendance_sessions.started_at AS startedAt,
      attendance_sessions.expires_at AS expiresAt,
      attendance_sessions.status,
      teacher_assignments.id AS teacherAssignmentId,
      class_subjects.id AS classSubjectId,
      classes.class_code AS classCode,
      classes.class_name AS className,
      classes.academic_year AS academicYear,
      subjects.subject_code AS subjectCode,
      subjects.subject_name AS subjectName,
      COUNT(attendance_records.id) AS presentCount
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
    WHERE attendance_sessions.session_public_id = ?
      AND teachers.user_id = ?
    GROUP BY
      attendance_sessions.id,
      attendance_sessions.session_public_id,
      attendance_sessions.started_at,
      attendance_sessions.expires_at,
      attendance_sessions.status,
      teacher_assignments.id,
      class_subjects.id,
      classes.class_code,
      classes.class_name,
      classes.academic_year,
      subjects.subject_code,
      subjects.subject_name`,
    [sessionPublicId, userId]
  )

  const session = sessions[0] || null

  if (!session) {
    return null
  }

  const [recentMarks] = await dbPool.execute(
    `SELECT
      attendance_records.id AS recordId,
      students.first_name AS firstName,
      students.last_name AS lastName,
      students.student_code AS studentCode,
      attendance_records.marked_at AS markedAt
    FROM attendance_records
    INNER JOIN students ON students.id = attendance_records.student_id
    WHERE attendance_records.attendance_session_id = ?
    ORDER BY attendance_records.marked_at ASC, attendance_records.id ASC`,
    [session.sessionId]
  )

  return {
    ...session,
    recentMarks
  }
}

async function getQrTokenForSession(session) {
  const startedAt = new Date(session.startedAt)
  const expiresAt = new Date(session.expiresAt)

  const elapsedMs = Math.max(0, Date.now() - startedAt.getTime())
  const intervalNumber = Math.floor(elapsedMs / QR_INTERVAL_MS)

  const validFrom = new Date(
    startedAt.getTime() + intervalNumber * QR_INTERVAL_MS
  )

  const tokenExpiresAt = new Date(
    Math.min(
      validFrom.getTime() + QR_INTERVAL_MS,
      expiresAt.getTime()
    )
  )

  const token = createQrToken(
    session.sessionPublicId,
    intervalNumber
  )

  await dbPool.execute(
    `INSERT INTO attendance_qr_tokens
      (attendance_session_id, token_hash, interval_number, valid_from, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       token_hash = VALUES(token_hash),
       valid_from = VALUES(valid_from),
       expires_at = VALUES(expires_at)`,
    [
      session.sessionId,
      hashToken(token),
      intervalNumber,
      validFrom,
      tokenExpiresAt
    ]
  )

  return {
    token,
    validUntil: tokenExpiresAt
  }
}

router.get(
  '/teacher/assignments',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      const [assignments] = await dbPool.execute(
        `SELECT
          teacher_assignments.id AS teacherAssignmentId,
          class_subjects.id AS classSubjectId,
          classes.class_name AS className,
          classes.class_code AS classCode,
          classes.academic_year AS academicYear,
          subjects.subject_name AS subjectName,
          subjects.subject_code AS subjectCode
        FROM teacher_assignments
        INNER JOIN teachers
          ON teachers.id = teacher_assignments.teacher_id
        INNER JOIN users ON users.id = teachers.user_id
        INNER JOIN class_subjects
          ON class_subjects.id =
            teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE teachers.user_id = ?
          AND users.is_active = TRUE
          AND classes.is_active = TRUE
          AND subjects.is_active = TRUE
        ORDER BY classes.class_name, subjects.subject_name`,
        [request.user.id]
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
  '/teacher/sessions',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    const validation = startSessionSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Choose a valid class and subject.'
      })
    }

    const { teacherAssignmentId } = validation.data

    try {
      const [assignmentRows] = await dbPool.execute(
        `SELECT teacher_assignments.id
         FROM teacher_assignments
         INNER JOIN teachers
           ON teachers.id = teacher_assignments.teacher_id
         INNER JOIN users ON users.id = teachers.user_id
         INNER JOIN class_subjects
           ON class_subjects.id =
             teacher_assignments.class_subject_id
         INNER JOIN classes ON classes.id = class_subjects.class_id
         INNER JOIN subjects ON subjects.id = class_subjects.subject_id
         WHERE teacher_assignments.id = ?
           AND teachers.user_id = ?
           AND users.is_active = TRUE
           AND classes.is_active = TRUE
           AND subjects.is_active = TRUE`,
        [teacherAssignmentId, request.user.id]
      )

      if (assignmentRows.length === 0) {
        return response.status(404).json({
          message: 'That teacher assignment was not found.'
        })
      }

      await dbPool.execute(
        `UPDATE attendance_sessions
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         INNER JOIN teachers
           ON teachers.id = teacher_assignments.teacher_id
         SET attendance_sessions.status =
               CASE
                 WHEN attendance_sessions.expires_at <= NOW()
                   THEN 'expired'
                 ELSE 'ended'
               END,
             attendance_sessions.ended_at =
               CASE
                 WHEN attendance_sessions.expires_at <= NOW()
                   THEN attendance_sessions.expires_at
                 ELSE NOW()
               END
         WHERE teachers.user_id = ?
           AND attendance_sessions.status = 'active'`,
        [request.user.id]
      )

      const sessionPublicId = crypto.randomUUID()
      const startedAt = new Date()
      const expiresAt = new Date(
        startedAt.getTime() + SESSION_LENGTH_MS
      )

      await dbPool.execute(
        `INSERT INTO attendance_sessions
          (session_public_id, teacher_assignment_id, started_at, expires_at, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [
          sessionPublicId,
          teacherAssignmentId,
          startedAt,
          expiresAt
        ]
      )

      const session = await getTeacherSession(
        sessionPublicId,
        request.user.id
      )

      const qr = await getQrTokenForSession(session)

      return response.status(201).json({
        message: 'Attendance session started.',
        session,
        qrToken: qr.token,
        qrValidUntil: qr.validUntil
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not start the attendance session.'
      })
    }
  }
)

router.get(
  '/teacher/sessions/:sessionPublicId',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      const session = await getTeacherSession(
        request.params.sessionPublicId,
        request.user.id
      )

      if (!session) {
        return response.status(404).json({
          message: 'Attendance session not found.'
        })
      }

      let qrToken = null
      let qrValidUntil = null

      if (session.status === 'active') {
        const qr = await getQrTokenForSession(session)
        qrToken = qr.token
        qrValidUntil = qr.validUntil
      }

      return response.json({
        session,
        qrToken,
        qrValidUntil
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not refresh the attendance session.'
      })
    }
  }
)

router.post(
  '/teacher/sessions/:sessionPublicId/end',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    try {
      const [result] = await dbPool.execute(
        `UPDATE attendance_sessions
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         INNER JOIN teachers
           ON teachers.id = teacher_assignments.teacher_id
         SET attendance_sessions.status = 'ended',
             attendance_sessions.ended_at = NOW()
         WHERE attendance_sessions.session_public_id = ?
           AND teachers.user_id = ?
           AND attendance_sessions.status = 'active'`,
        [request.params.sessionPublicId, request.user.id]
      )

      if (result.affectedRows === 0) {
        return response.status(404).json({
          message: 'Active attendance session not found.'
        })
      }

      return response.json({
        message: 'Attendance session ended.'
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not end the attendance session.'
      })
    }
  }
)

router.delete(
  '/teacher/sessions/:sessionPublicId',
  authenticate,
  authorizeRoles('teacher'),
  async (request, response) => {
    let connection

    try {
      connection = await dbPool.getConnection()
      await connection.beginTransaction()

      const [sessions] = await connection.execute(
        `SELECT attendance_sessions.id AS sessionId
         FROM attendance_sessions
         INNER JOIN teacher_assignments
           ON teacher_assignments.id =
             attendance_sessions.teacher_assignment_id
         INNER JOIN teachers
           ON teachers.id = teacher_assignments.teacher_id
         WHERE attendance_sessions.session_public_id = ?
           AND teachers.user_id = ?
           AND attendance_sessions.status = 'active'
         FOR UPDATE`,
        [request.params.sessionPublicId, request.user.id]
      )

      if (sessions.length === 0) {
        await connection.rollback()
        return response.status(404).json({
          message: 'Active attendance session not found.'
        })
      }

      const sessionId = sessions[0].sessionId

      // A cancelled session is intentionally removed rather than ended, so it
      // cannot appear in history or affect attendance statistics.
      await connection.execute(
        `DELETE FROM attendance_scan_claims
         WHERE attendance_session_id = ?`,
        [sessionId]
      )

      await connection.execute(
        `DELETE FROM attendance_qr_tokens
         WHERE attendance_session_id = ?`,
        [sessionId]
      )

      await connection.execute(
        `DELETE FROM attendance_records
         WHERE attendance_session_id = ?`,
        [sessionId]
      )

      await connection.execute(
        `DELETE FROM attendance_sessions
         WHERE id = ?`,
        [sessionId]
      )

      await connection.commit()

      return response.json({
        message: 'Attendance session cancelled and removed from history.'
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }

      return response.status(500).json({
        message: 'Could not cancel the attendance session.'
      })
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)

router.post(
  '/student/claim',
  async (request, response) => {
    const validation = qrScanSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Invalid QR attendance link.'
      })
    }

    const { sessionPublicId, token, deviceId } = validation.data
    const deviceHash = hashToken(deviceId)

    try {
      await expireSessionIfNeeded(sessionPublicId)

      const [tokenRows] = await dbPool.execute(
        `SELECT
          attendance_sessions.id AS sessionId,
          attendance_sessions.expires_at AS expiresAt
        FROM attendance_qr_tokens
        INNER JOIN attendance_sessions
          ON attendance_sessions.id =
            attendance_qr_tokens.attendance_session_id
        WHERE attendance_sessions.session_public_id = ?
          AND attendance_qr_tokens.token_hash = ?
          AND attendance_sessions.status = 'active'
          AND attendance_sessions.expires_at > NOW()
          AND attendance_qr_tokens.valid_from <= NOW()
          AND attendance_qr_tokens.expires_at > NOW()`,
        [sessionPublicId, hashToken(token)]
      )

      if (tokenRows.length === 0) {
        return response.status(400).json({
          message: 'This QR code has expired. Please scan the newest live code.'
        })
      }

      // A phone can complete only one attendance mark for one live session.
      // Check this before creating another login claim so a repeat scan gives
      // the student a clear answer immediately.
      const [existingDeviceMarks] = await dbPool.execute(
        `SELECT id
         FROM attendance_device_marks
         WHERE attendance_session_id = ?
           AND device_hash = ?
         LIMIT 1`,
        [tokenRows[0].sessionId, deviceHash]
      )

      if (existingDeviceMarks.length > 0) {
        return response.status(409).json({
          message: 'Attendance is already marked for this session.'
        })
      }

      const scanClaim = crypto.randomBytes(32).toString('hex')

      await dbPool.execute(
        `INSERT INTO attendance_scan_claims
          (attendance_session_id, claim_hash, device_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [
          tokenRows[0].sessionId,
          hashToken(scanClaim),
          deviceHash,
          tokenRows[0].expiresAt
        ]
      )

      return response.status(201).json({
        scanClaim,
        expiresAt: tokenRows[0].expiresAt
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Could not verify this QR code.'
      })
    }
  }
)

router.post(
  '/student/mark',
  authenticate,
  authorizeRoles('student'),
  async (request, response) => {
    const validation = markAttendanceSchema.safeParse(request.body)

    if (!validation.success) {
      return response.status(400).json({
        message: 'Invalid attendance scan pass.'
      })
    }

    const { scanClaim } = validation.data
    let connection

    try {
      connection = await dbPool.getConnection()
      await connection.beginTransaction()

      const [claimRows] = await connection.execute(
        `SELECT
          attendance_scan_claims.id AS claimId,
          attendance_scan_claims.device_hash AS deviceHash,
          attendance_scan_claims.claimed_at AS claimedAt,
          attendance_sessions.id AS sessionId,
          class_subjects.id AS classSubjectId,
          classes.class_name AS className,
          subjects.subject_name AS subjectName
        FROM attendance_scan_claims
        INNER JOIN attendance_sessions
          ON attendance_sessions.id =
            attendance_scan_claims.attendance_session_id
        INNER JOIN teacher_assignments
          ON teacher_assignments.id =
            attendance_sessions.teacher_assignment_id
        INNER JOIN class_subjects
          ON class_subjects.id =
            teacher_assignments.class_subject_id
        INNER JOIN classes ON classes.id = class_subjects.class_id
        INNER JOIN subjects ON subjects.id = class_subjects.subject_id
        WHERE attendance_scan_claims.claim_hash = ?
          AND attendance_scan_claims.used_at IS NULL
          AND attendance_scan_claims.expires_at > NOW()
          AND attendance_sessions.status = 'active'
          AND attendance_sessions.expires_at > NOW()
        FOR UPDATE`,
        [hashToken(scanClaim)]
      )

      if (claimRows.length === 0) {
        await connection.rollback()
        return response.status(400).json({
          message: 'Your scan pass has expired. Please scan the newest live QR code.'
        })
      }

      const [studentRows] = await connection.execute(
        `SELECT students.id AS studentId
         FROM students
         INNER JOIN users ON users.id = students.user_id
         WHERE students.user_id = ?
           AND users.is_active = TRUE`,
        [request.user.id]
      )

      if (studentRows.length === 0) {
        await connection.rollback()
        return response.status(404).json({
          message: 'Active student account not found.'
        })
      }

      const session = claimRows[0]
      const studentId = studentRows[0].studentId

      // The QR claim is deliberately tied to a login that happened after the
      // student scanned it. This prevents an old saved login from marking a
      // newly-created attendance session automatically.
      const loginIssuedAt = Number(request.user.issuedAt || 0) * 1000
      const claimCreatedAt = new Date(session.claimedAt).getTime()

      if (
        !Number.isFinite(claimCreatedAt) ||
        loginIssuedAt < claimCreatedAt - 999
      ) {
        await connection.rollback()
        return response.status(401).json({
          message: 'Please log in after scanning this QR code to mark attendance.'
        })
      }

      if (!session.deviceHash) {
        await connection.rollback()
        return response.status(400).json({
          message: 'Please scan the newest live QR code before marking attendance.'
        })
      }

      const [assignmentRows] = await connection.execute(
        `SELECT id
         FROM student_subject_enrollments
         WHERE student_id = ?
           AND class_subject_id = ?
           AND is_active = TRUE`,
        [studentId, session.classSubjectId]
      )

      if (assignmentRows.length === 0) {
        await connection.rollback()
        return response.status(403).json({
          message: 'You are not assigned to this subject.'
        })
      }

      const [existingStudentRecords] = await connection.execute(
        `SELECT id
         FROM attendance_records
         WHERE attendance_session_id = ?
           AND student_id = ?
         LIMIT 1`,
        [session.sessionId, studentId]
      )

      if (existingStudentRecords.length > 0) {
        await connection.rollback()
        return response.status(409).json({
          message: 'Attendance is already marked for this session.'
        })
      }

      try {
        await connection.execute(
          `INSERT INTO attendance_device_marks
            (attendance_session_id, device_hash)
           VALUES (?, ?)`,
          [session.sessionId, session.deviceHash]
        )
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          await connection.rollback()
          return response.status(409).json({
            message: 'Attendance is already marked for this session.'
          })
        }

        throw error
      }

      await connection.execute(
        `INSERT INTO attendance_records
          (attendance_session_id, student_id, status)
         VALUES (?, ?, 'present')`,
        [session.sessionId, studentId]
      )

      await connection.execute(
        `UPDATE attendance_scan_claims
         SET used_at = NOW()
         WHERE id = ?`,
        [session.claimId]
      )

      await connection.commit()

      return response.status(201).json({
        message: 'Attendance marked successfully.',
        className: session.className,
        subjectName: session.subjectName
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }

      console.error(
        'Could not mark attendance:',
        error.code || error.message
      )

      if (error.code === 'ER_DUP_ENTRY') {
        return response.status(409).json({
          message: 'Attendance has already been marked for this session.'
        })
      }

      return response.status(500).json({
        message: 'Could not mark attendance.'
      })
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
)

module.exports = router
