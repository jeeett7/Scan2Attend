require('dotenv').config()

const bcrypt = require('bcrypt')
const { dbPool } = require('../config/database')

async function createInitialAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL
  const username = process.env.INITIAL_ADMIN_USERNAME
  const password = process.env.INITIAL_ADMIN_PASSWORD

  if (!email || !username || !password) {
    throw new Error('Initial admin details are missing from the .env file.')
  }

  const [existingUsers] = await dbPool.execute(
    'SELECT id FROM users WHERE email = ? OR username = ?',
    [email, username]
  )

  if (existingUsers.length > 0) {
    console.log('An admin account with this email or username already exists.')
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const [result] = await dbPool.execute(
    `INSERT INTO users (email, username, password_hash, role)
     VALUES (?, ?, ?, 'admin')`,
    [email, username, passwordHash]
  )

  console.log(`Admin account created successfully. User ID: ${result.insertId}`)
}

createInitialAdmin()
  .catch((error) => {
    console.error('Could not create the admin account:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbPool.end()
  })