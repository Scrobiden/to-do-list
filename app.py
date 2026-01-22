from flask import Flask, render_template, request, jsonify
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import uuid
import json
import smtplib
from email.mime.text import MIMEText
from contextlib import contextmanager

app = Flask(__name__)
app.secret_key = 'super_secret_key_change_me'

EMAIL_ADDRESS = "anderned51@gmail.com"
EMAIL_PASSWORD = "pgfzgomxawlqnxfw"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin):
    def __init__(self, id, username, email, password_hash):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash


@contextmanager
def get_db():
    db_name = app.config.get('DATABASE', 'database.db') 
    conn = sqlite3.connect(db_name)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS shared_lists
                     (id TEXT PRIMARY KEY, data TEXT, user_id TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS users
                     (id TEXT PRIMARY KEY, username TEXT UNIQUE, email TEXT, password_hash TEXT)''')
        conn.commit()

init_db()

@login_manager.user_loader
def load_user(user_id):
    with get_db() as conn:
        user_data = conn.execute(
            'SELECT * FROM users WHERE id = ?', (user_id,)
        ).fetchone()
    if user_data:
        return User(
            user_data['id'],
            user_data['username'],
            user_data['email'],
            user_data['password_hash']
        )
    return None

def send_email_notification(to_email, friend_name, list_name, tasks):
    try:
        tasks_text = ""
        if tasks:
            for t in tasks:
                status = "✅" if t.get('disabled') else "⬜"
                tasks_text += f"{status} {t['text']}\n"
        else:
            tasks_text = "(Список порожній)"

        subject = f"Вам надіслано список: {list_name} 👽"
        body = f"""
Привіт!

Користувач {friend_name} надіслав вам список завдань "{list_name}".

📝 Зміст списку:
---------------------------
{tasks_text}
---------------------------

Зайдіть на сайт, щоб зберегти його собі у "Вхідних"!
"""

        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = to_email

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())
    except Exception as e:
        print(e)

@app.route('/')
def index():
    return render_template('index.html', user=current_user)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    if not username or not password or not email:
        return jsonify({"status": "error", "message": "Заповніть всі поля"}), 400

    with get_db() as conn:
        try:
            hashed_pw = generate_password_hash(password)
            new_id = str(uuid.uuid4())
            conn.execute(
                'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
                (new_id, username, email, hashed_pw)
            )
            conn.commit()
            return jsonify({"status": "success", "message": "Користувача створено!"})
        except sqlite3.IntegrityError:
            return jsonify({"status": "error", "message": "Такий логін вже зайнятий"}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    with get_db() as conn:
        user_data = conn.execute(
            'SELECT * FROM users WHERE username = ?', (username,)
        ).fetchone()

    if user_data and check_password_hash(user_data['password_hash'], password):
        user_obj = User(
            user_data['id'],
            user_data['username'],
            user_data['email'],
            user_data['password_hash']
        )
        login_user(user_obj)
        return jsonify({"status": "success", "username": username})

    return jsonify({"status": "error", "message": "Невірний логін або пароль"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"status": "success"})

@app.route('/api/share', methods=['POST'])
def share_list():
    try:
        lists_data = request.json
        unique_id = str(uuid.uuid4())
        user_id = current_user.id if current_user.is_authenticated else None

        with get_db() as conn:
            conn.execute(
                "INSERT INTO shared_lists (id, data, user_id) VALUES (?, ?, ?)",
                (unique_id, json.dumps(lists_data), user_id)
            )
            conn.commit()

        return jsonify({"status": "success", "id": unique_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/send-to-user', methods=['POST'])
@login_required
def send_to_user():
    data = request.json
    recipient_username = data.get('username')
    list_data = data.get('list_data')

    if not recipient_username or not list_data:
        return jsonify({"status": "error", "message": "Не вказано користувача або дані"}), 400

    with get_db() as conn:
        try:
            recipient = conn.execute(
                'SELECT id, email FROM users WHERE username = ?',
                (recipient_username,)
            ).fetchone()

            if not recipient:
                return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

            recipient_id = recipient['id']
            recipient_email = recipient['email']

            new_list_id = str(uuid.uuid4())
            list_obj = list_data.copy()
            sender_name = current_user.username
            list_obj['name'] = f"{list_obj['name']} (від {sender_name})"
            list_obj['id'] = new_list_id

            conn.execute(
                "INSERT INTO shared_lists (id, data, user_id) VALUES (?, ?, ?)",
                (new_list_id, json.dumps(list_obj), recipient_id)
            )
            conn.commit()

            if recipient_email:
                send_email_notification(
                    recipient_email,
                    sender_name,
                    list_data['name'],
                    list_data.get('tasks', [])
                )

            return jsonify({"status": "success", "message": "Надіслано!"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get/<list_id>', methods=['GET'])
def get_list(list_id):
    with get_db() as conn:
        row = conn.execute(
            "SELECT data FROM shared_lists WHERE id=?",
            (list_id,)
        ).fetchone()

    if row:
        return jsonify({"status": "success", "data": json.loads(row['data'])})
    return jsonify({"status": "error", "message": "List not found"}), 404

@app.route('/api/my-lists', methods=['GET'])
@login_required
def get_my_lists():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, data FROM shared_lists WHERE user_id=? ORDER BY rowid DESC LIMIT 10",
            (current_user.id,)
        ).fetchall()

    lists_summary = []
    for row in rows:
        data = json.loads(row['data'])
        lists_summary.append({
            "id": row['id'],
            "name": data.get('name', 'Без назви')
        })

    return jsonify({"status": "success", "lists": lists_summary})

@app.route('/api/delete-cloud-list/<list_id>', methods=['DELETE'])
@login_required
def delete_cloud_list(list_id):
    with get_db() as conn:
        conn.execute(
            "DELETE FROM shared_lists WHERE id=? AND user_id=?",
            (list_id, current_user.id)
        )
        conn.commit()

    return jsonify({"status": "success", "message": "Список видалено з хмари"})

@app.route('/api/search-users', methods=['GET'])
@login_required
def search_users():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])

    with get_db() as conn:
        users = conn.execute(
            "SELECT username FROM users WHERE username LIKE ? AND id != ? LIMIT 5",
            (f'{query}%', current_user.id)
        ).fetchall()

    return jsonify([user['username'] for user in users])

if __name__ == '__main__':
    app.run(debug=True, port=8000, host='0.0.0.0')
