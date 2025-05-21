// init-db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sleep.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sleep_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      sleep_start TEXT,
      sleep_end TEXT,
      sleep_quality INTEGER,
      caffeine INTEGER,
      smartphone INTEGER,
      exercise INTEGER
    )
  `);
});

db.close();
