const db = require('better-sqlite3')('data.db');
try {
  console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets'").get());
} catch (e) {
  console.error(e);
}
