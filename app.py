# ============================================================
# Домашняя библиотека — серверная часть
# Flask + SQLite
# ============================================================

import os
import sqlite3
from flask import (
    Flask, render_template, request, redirect,
    url_for, jsonify, g, abort
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'library.db')
SCHEMA   = os.path.join(BASE_DIR, 'schema.sql')

app = Flask(__name__)

# -------- Работа с БД --------

def get_db():
    """Соединение с БД в контексте запроса."""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row   # доступ по имени колонки
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db

@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Создаёт таблицы из schema.sql, если их нет."""
    con = sqlite3.connect(DB_PATH)
    with open(SCHEMA, 'r', encoding='utf-8') as f:
        con.executescript(f.read())
    con.commit()
    con.close()

# -------- Валидация --------

ALLOWED_GENRES   = {'classic', 'fantasy', 'drama', 'science', 'history', 'other'}
ALLOWED_SORT     = {
    'title': 'title',
    'author': 'author',
    'year': 'year',
    'rating': 'rating',
    'pages': 'pages',
}

def validate_book(data):
    """Проверка и нормализация входных данных."""
    errors = []

    title = (data.get('title') or '').strip()
    author = (data.get('author') or '').strip()
    genre = (data.get('genre') or '').strip()
    description = (data.get('description') or '').strip()

    if not title or len(title) > 200:
        errors.append('Название обязательно, до 200 символов.')
    if not author or len(author) > 150:
        errors.append('Автор обязателен, до 150 символов.')
    if genre not in ALLOWED_GENRES:
        errors.append('Недопустимый жанр.')

    try:
        year = int(data.get('year') or 0)
        if year and not (0 < year < 2100):
            errors.append('Год должен быть в диапазоне 1–2099.')
    except ValueError:
        year = 0
        errors.append('Год должен быть числом.')

    try:
        rating = float(data.get('rating') or 0)
        if not (0 <= rating <= 5):
            errors.append('Рейтинг от 0 до 5.')
    except ValueError:
        rating = 0
        errors.append('Рейтинг должен быть числом.')

    try:
        pages = int(data.get('pages') or 0)
        if pages < 0 or pages > 20000:
            errors.append('Страниц от 0 до 20000.')
    except ValueError:
        pages = 0
        errors.append('Страниц должно быть числом.')

    return {
        'title': title, 'author': author, 'genre': genre,
        'year': year, 'rating': rating, 'pages': pages,
        'description': description,
    }, errors

# -------- Маршруты --------

@app.route('/')
def index():
    """Главная страница: список книг с сортировкой и фильтрацией."""
    db = get_db()

    # --- параметры из URL ---
    genre = request.args.get('genre', 'all')
    sort  = request.args.get('sort', 'title')
    order = request.args.get('order', 'asc').lower()

    # --- защита: белые списки (никакой конкатенации сырых данных в SQL) ---
    sort_col = ALLOWED_SORT.get(sort, 'title')
    order_sql = 'ASC' if order != 'desc' else 'DESC'

    # --- сборка запроса с параметрами ---
    sql = "SELECT * FROM books"
    params = []

    if genre != 'all' and genre in ALLOWED_GENRES:
        sql += " WHERE genre = ?"
        params.append(genre)

    # имя колонки и ASC/DESC подставляются только из белого списка,
    # поэтому SQL-инъекция через sort/order невозможна
    sql += f" ORDER BY {sort_col} {order_sql}"

    books = db.execute(sql, params).fetchall()

    # --- серверные вычисления (агрегаты) ---
    stats = db.execute("""
        SELECT
            COUNT(*)            AS total,
            COALESCE(AVG(rating), 0) AS avg_rating,
            COALESCE(SUM(pages), 0)  AS total_pages
        FROM books
    """).fetchone()

    # --- запись визита в БД (демонстрация INSERT) ---
    db.execute(
        "INSERT INTO visits (ip, user_agent) VALUES (?, ?)",
        (request.remote_addr, request.headers.get('User-Agent', '')[:300])
    )
    db.commit()

    visits_count = db.execute("SELECT COUNT(*) FROM visits").fetchone()[0]

    return render_template(
        'index.html',
        books=books,
        stats=stats,
        current_genre=genre,
        current_sort=sort,
        current_order=order,
        visits_count=visits_count,
        genres=ALLOWED_GENRES,
    )

@app.route('/about')
def about():
    db = get_db()
    stats = db.execute("""
        SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
        FROM books
    """).fetchone()
    visits_count = db.execute("SELECT COUNT(*) FROM visits").fetchone()[0]
    return render_template('about.html', stats=stats, visits_count=visits_count)

# -------- API: CRUD --------

@app.route('/api/books', methods=['GET'])
def api_list_books():
    """Чтение: список книг с сортировкой и фильтрацией."""
    db = get_db()
    genre = request.args.get('genre', 'all')
    sort  = request.args.get('sort', 'title')
    order = request.args.get('order', 'asc').lower()

    sort_col = ALLOWED_SORT.get(sort, 'title')
    order_sql = 'ASC' if order != 'desc' else 'DESC'

    sql = "SELECT * FROM books"
    params = []
    if genre != 'all' and genre in ALLOWED_GENRES:
        sql += " WHERE genre = ?"
        params.append(genre)
    sql += f" ORDER BY {sort_col} {order_sql}"

    rows = db.execute(sql, params).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route('/api/books', methods=['POST'])
def api_create_book():
    """Запись: добавить книгу."""
    data = request.get_json(silent=True) or {}
    book, errors = validate_book(data)
    if errors:
        return jsonify({'ok': False, 'errors': errors}), 400

    db = get_db()
    cur = db.execute("""
        INSERT INTO books (title, author, genre, year, rating, pages, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        book['title'], book['author'], book['genre'],
        book['year'], book['rating'], book['pages'], book['description']
    ))
    db.commit()
    return jsonify({'ok': True, 'id': cur.lastrowid}), 201

@app.route('/api/books/<int:book_id>', methods=['PUT'])
def api_update_book(book_id):
    """Обновление: изменить книгу."""
    data = request.get_json(silent=True) or {}
    book, errors = validate_book(data)
    if errors:
        return jsonify({'ok': False, 'errors': errors}), 400

    db = get_db()
    exists = db.execute("SELECT id FROM books WHERE id = ?", (book_id,)).fetchone()
    if not exists:
        abort(404)

    db.execute("""
        UPDATE books
        SET title = ?, author = ?, genre = ?, year = ?,
            rating = ?, pages = ?, description = ?
        WHERE id = ?
    """, (
        book['title'], book['author'], book['genre'],
        book['year'], book['rating'], book['pages'], book['description'],
        book_id
    ))
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def api_delete_book(book_id):
    """Удаление: убрать книгу."""
    db = get_db()
    cur = db.execute("DELETE FROM books WHERE id = ?", (book_id,))
    db.commit()
    if cur.rowcount == 0:
        return jsonify({'ok': False, 'error': 'Книга не найдена'}), 404
    return jsonify({'ok': True})

# -------- Запуск --------

try:
    init_db()
    print("✅ База данных инициализирована успешно", flush=True)
except Exception as e:
    import traceback
    print("❌ ОШИБКА при init_db():", e, flush=True)
    print(traceback.format_exc(), flush=True)
    raise

if __name__ == '__main__':
    app.run(debug=False, port=5000)
    
print("🔍 DB_PATH =", DB_PATH, flush=True)
print("🔍 SCHEMA  =", SCHEMA, flush=True)
print("🔍 exists? ", os.path.exists(SCHEMA), flush=True)
