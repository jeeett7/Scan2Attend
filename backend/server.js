require('dotenv').config({ override: true })

const express = require('express')
const cors = require('cors')
const {
  testDatabaseConnection,
  ensureAttendanceDeviceGuardSchema,
  ensureClassTimetableSchema
} = require('./config/database')
const authRoutes = require('./routes/authRoutes')
const adminRoutes = require('./routes/adminRoutes')
const teacherRoutes = require('./routes/teacherRoutes')
const studentRoutes = require('./routes/studentRoutes')
const attendanceRoutes = require('./routes/attendanceRoutes')

const app = express()
const PORT = process.env.PORT || 5000

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean)

// While developing on a phone hotspot, Windows can receive a different
// private IP each time it joins the hotspot. Permit Vite's standard port on
// private local networks, while keeping public website origins blocked.
const localDevelopmentOrigin =
  /^http:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}):5173$/

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      localDevelopmentOrigin.test(origin)
    ) {
      callback(null, true)
      return
    }

    callback(new Error('This website address is not allowed.'))
  }
}))

app.use(express.json({ limit: '8mb' }))

app.get('/api/health', (request, response) => {
  response.json({
    message: 'Scan2Attend backend is running',
    status: 'ok'
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/attendance', attendanceRoutes)

async function startServer() {
  try {
    await testDatabaseConnection()
    await ensureAttendanceDeviceGuardSchema()
    await ensureClassTimetableSchema()

    console.log('Connected to the Scan2Attend MySQL database')

    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Database connection failed:', error.message)
    process.exit(1)
  }
}

startServer()
