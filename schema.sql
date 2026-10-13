CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    author      TEXT    NOT NULL,
    genre       TEXT    NOT NULL,
    year        INTEGER,
    rating      REAL    DEFAULT 0,
    pages       INTEGER DEFAULT 0,
    description TEXT,
    created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ip          TEXT,
    user_agent  TEXT,
    visited_at  TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_books_genre  ON books(genre);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_year   ON books(year);

INSERT OR IGNORE INTO books (id, title, author, genre, year, rating, pages, description) VALUES
  (1, 'Мастер и Маргарита', 'М. А. Булгаков', 'classic', 1967, 4.9, 480,
   'Роман о добре и зле, любви и трусости.'),
  (2, '1984',               'Дж. Оруэлл',      'fantasy', 1949, 4.8, 320,
   'Антиутопия, которая не перестаёт быть актуальной.'),
  (3, 'Три товарища',       'Э. М. Ремарк',    'drama',   1936, 4.7, 384,
   'История дружбы и любви на фоне непростого времени.');
