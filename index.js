const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sleep.db');

// 平均を計算
function calcAverages(data, type = 'week') {
  const grouped = {};
  data.forEach(({ date, sleep_quality }) => {
    if (!sleep_quality) return;
    const d = new Date(date);
    const key = type === 'week'
      ? `${d.getFullYear()}年第${getWeek(d)}週`
      : `${d.getFullYear()}年${('0' + (d.getMonth() + 1)).slice(-2)}月`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(sleep_quality);
  });

  return Object.entries(grouped).map(([key, values]) => ({
    label: key,
    avg: Math.round((values.reduce((a, b) => a + b) / values.length) * 100) / 100
  }));
}

function getWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function countConsecutiveDays(data) {
  if (!data.length) return 0;
  const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
  let count = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const d1 = new Date(sorted[i].date);
    const d2 = new Date(sorted[i - 1].date);
    const diff = (d1 - d2) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// メイン画面
router.get('/', (req, res) => {
  db.all(`SELECT * FROM sleep_data ORDER BY date DESC`, (err, rows) => {
    if (err) return res.status(500).send("DB Error");
    const recentHistory = rows.slice(0, 5);
    const streakDays = countConsecutiveDays(rows);
    const weekAverages = calcAverages(rows, 'week');
    const monthAverages = calcAverages(rows, 'month');
    res.render('index', {
      history: recentHistory,
      streakDays,
      saved: req.query.saved,
      updated: req.query.updated,
      weekAverages,
      monthAverages,
      editData: null
    });
  });
});

// 編集用データ取得
router.get('/edit/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT * FROM sleep_data WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).send("DB Error");
    db.all(`SELECT * FROM sleep_data ORDER BY date DESC`, (err2, rows) => {
      if (err2) return res.status(500).send("DB Error");
      const recentHistory = rows.slice(0, 5);
      const streakDays = countConsecutiveDays(rows);
      const weekAverages = calcAverages(rows, 'week');
      const monthAverages = calcAverages(rows, 'month');
      res.render('index', {
        history: recentHistory,
        streakDays,
        saved: null,
        updated: null,
        weekAverages,
        monthAverages,
        editData: row
      });
    });
  });
});

// 保存 or 上書き
router.post('/sleep', (req, res) => {
  const { id, date, sleep_start, sleep_end, sleep_quality, caffeine, smartphone, exercise, note } = req.body;

  if (id) {
    // 更新
    const stmt = db.prepare(`
      UPDATE sleep_data
      SET date = ?, sleep_start = ?, sleep_end = ?, sleep_quality = ?, caffeine = ?, smartphone = ?, exercise = ?, note = ?
      WHERE id = ?
    `);
    stmt.run(
      date, sleep_start, sleep_end, sleep_quality,
      caffeine || 0, smartphone || 0, exercise || 0, note || '', id,
      (err) => {
        if (err) return res.status(500).send("更新に失敗しました");
        res.redirect('/?updated=true');
      }
    );
  } else {
    // 上書きまたは新規
    db.get(`SELECT * FROM sleep_data WHERE date = ?`, [date], (err, row) => {
      if (err) return res.status(500).send("DB Error");

      if (row) {
        const stmt = db.prepare(`
          UPDATE sleep_data 
          SET sleep_start = ?, sleep_end = ?, sleep_quality = ?, caffeine = ?, smartphone = ?, exercise = ?, note = ?
          WHERE date = ?
        `);
        stmt.run(
          sleep_start, sleep_end, sleep_quality,
          caffeine || 0, smartphone || 0, exercise || 0, note || '', date,
          (err) => {
            if (err) return res.status(500).send("更新に失敗しました");
            res.redirect('/?updated=true');
          }
        );
      } else {
        const stmt = db.prepare(`
          INSERT INTO sleep_data
          (date, sleep_start, sleep_end, sleep_quality, caffeine, smartphone, exercise, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          date, sleep_start, sleep_end, sleep_quality,
          caffeine || 0, smartphone || 0, exercise || 0, note || '',
          (err) => {
            if (err) return res.status(500).send("追加に失敗しました");
            res.redirect('/?saved=true');
          }
        );
      }
    });
  }
});

// 削除
router.post('/delete/:id', (req, res) => {
  const id = req.params.id;
  const stmt = db.prepare(`DELETE FROM sleep_data WHERE id = ?`);
  stmt.run(id, (err) => {
    if (err) return res.status(500).send("削除に失敗しました");
    res.redirect('/');
  });
});

module.exports = router;
