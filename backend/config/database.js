const mysql = require('mysql2/promise')

const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

async function testDatabaseConnection() {
  const connection = await dbPool.getConnection()

  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}

async function ensureAttendanceDeviceGuardSchema() {
  const [deviceHashColumns] = await dbPool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'attendance_scan_claims'
       AND COLUMN_NAME = 'device_hash'`
  )

  if (deviceHashColumns.length === 0) {
    await dbPool.query(
      `ALTER TABLE attendance_scan_claims
       ADD COLUMN device_hash CHAR(64) NULL AFTER claim_hash,
       ADD KEY index_claim_device_session
         (attendance_session_id, device_hash)`
    )
  }

  await dbPool.query(
    `CREATE TABLE IF NOT EXISTS attendance_device_marks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      attendance_session_id BIGINT UNSIGNED NOT NULL,
      device_hash CHAR(64) NOT NULL,
      marked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_device_attendance_per_session
        (attendance_session_id, device_hash),
      CONSTRAINT fk_device_mark_session
        FOREIGN KEY (attendance_session_id)
        REFERENCES attendance_sessions (id)
        ON DELETE CASCADE
    )`
  )
}

async function ensureClassTimetableSchema() {
  const [timetableColumns] = await dbPool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'classes'
       AND COLUMN_NAME = 'timetable_image'`
  )

  if (timetableColumns.length === 0) {
    await dbPool.query(
      `ALTER TABLE classes
       ADD COLUMN timetable_image LONGTEXT NULL
       AFTER academic_year`
    )
  }
}

module.exports = {
  dbPool,
  testDatabaseConnection,
  ensureAttendanceDeviceGuardSchema,
  ensureClassTimetableSchema
}
