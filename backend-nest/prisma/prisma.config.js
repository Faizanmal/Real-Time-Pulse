// Ensure .env is loaded when Prisma loads this config
try {
  require('dotenv').config();
} catch (e) {
  // ignore
}

module.exports = {
  db: {
    url: "postgresql://real_time_pulse:real_time7890@localhost:5432/real_time_pulse_db"
  }
}
