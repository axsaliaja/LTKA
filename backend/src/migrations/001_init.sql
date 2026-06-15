-- ============================================================
-- Schema for the face-recognition attendance system (RDS MySQL).
-- Geofencing is intentionally out of scope.
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
  id              VARCHAR(64) PRIMARY KEY,            -- NIM
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('student','lecturer') NOT NULL DEFAULT 'student',
  face_descriptor JSON NOT NULL,                      -- array of 128 floats
  photo_s3_key    VARCHAR(512),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_sessions (
  id                     VARCHAR(64) PRIMARY KEY,     -- UUID
  course_name            VARCHAR(255) NOT NULL,
  lecturer_id            VARCHAR(64) NOT NULL,
  start_time             DATETIME NOT NULL,
  end_time               DATETIME NOT NULL,
  late_threshold_minutes INT NOT NULL DEFAULT 15,
  is_open                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_lecturer
    FOREIGN KEY (lecturer_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id      VARCHAR(64) NOT NULL,
  student_id      VARCHAR(64) NOT NULL,
  checkin_time    DATETIME DEFAULT CURRENT_TIMESTAMP,
  status          ENUM('present','late') NOT NULL,
  match_distance  DECIMAL(6,4),
  liveness_passed BOOLEAN,
  UNIQUE KEY uniq_session_student (session_id, student_id),  -- block double check-in
  CONSTRAINT fk_att_session FOREIGN KEY (session_id) REFERENCES class_sessions(id),
  CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
