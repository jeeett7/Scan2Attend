const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const { dbPool } = require('../config/database')

const router = express.Router()

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(191),
  password: z.string().min(1).max(128),
  role: z.enum(['admin', 'teacher', 'student'])
})

router.post('/login', async (request, response) => {
  const validation = loginSchema.safeParse(request.body)

  if (!validation.success) {
    return response.status(400).json({
      message: 'Enter your login details.'
    })
  }

  const { identifier, password, role } = validation.data

  try {
    const [users] = await dbPool.execute(
      `SELECT
        users.id,
        users.email,
        users.username,
        users.password_hash,
        users.role,
        users.is_active,
        COALESCE(students.first_name, teachers.first_name, users.username) AS first_name
      FROM users
      LEFT JOIN students ON students.user_id = users.id
      LEFT JOIN teachers ON teachers.user_id = users.id
      WHERE (
        users.email = ?
        OR users.username = ?
        OR students.student_code = ?
        OR teachers.teacher_code = ?
      )
      AND users.role = ?
      LIMIT 1`,
      [identifier, identifier, identifier, identifier, role]
    )

    const user = users[0]

    if (!user || !user.is_active) {
      return response.status(401).json({
        message: 'Invalid login details.'
      })
    }

    const passwordIsCorrect = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordIsCorrect) {
      return response.status(401).json({
        message: 'Invalid login details.'
      })
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h', issuer: 'scan2attend' }
    )

    return response.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return response.status(500).json({
      message: 'Could not log in. Please try again.'
    })
  }
})

module.exports = router