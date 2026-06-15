-- ============================================================
-- SIHADIR schema (RDS MySQL) — Google-Classroom-style model.
--   users          : akun dosen & mahasiswa (+ descriptor wajah)
--   classes        : kelas dengan kode join unik (dibuat dosen)
--   class_members  : relasi mahasiswa <-> kelas
--   sessions       : sesi absensi per kelas (buka/tutup)
--   attendances    : catatan kehadiran (+ foto snapshot)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  role              ENUM('student','lecturer') NOT NULL DEFAULT 'student',
  student_id        VARCHAR(64) UNIQUE,                 -- NIM (mahasiswa)
  jurusan           VARCHAR(255),
  fakultas          VARCHAR(255),
  face_descriptor   JSON,                               -- array 128 float (null sampai enroll)
  photo_s3_key      VARCHAR(512),
  is_face_registered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS classes (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  mata_kuliah   VARCHAR(255) NOT NULL,
  kode_kelas    VARCHAR(8) NOT NULL UNIQUE,             -- kode join 6 karakter
  lecturer_id   BIGINT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_class_lecturer FOREIGN KEY (lecturer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_members (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  class_id     BIGINT NOT NULL,
  student_id   BIGINT NOT NULL,                          -- users.id (role student)
  joined_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_class_student (class_id, student_id),
  CONSTRAINT fk_member_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_member_student FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  class_id     BIGINT NOT NULL,
  name         VARCHAR(255) NOT NULL,                    -- mis. "Pertemuan 1"
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at    DATETIME,
  CONSTRAINT fk_session_class FOREIGN KEY (class_id) REFERENCES classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendances (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id     BIGINT NOT NULL,
  user_id        BIGINT NOT NULL,
  checkin_time   DATETIME DEFAULT CURRENT_TIMESTAMP,
  match_distance DECIMAL(6,4),                           -- jarak Euclidean saat absen
  photo_s3_key   VARCHAR(512),                           -- snapshot wajah saat absensi
  UNIQUE KEY uniq_session_user (session_id, user_id),    -- cegah double absen
  CONSTRAINT fk_att_session FOREIGN KEY (session_id) REFERENCES sessions(id),
  CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
