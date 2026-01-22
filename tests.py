import unittest
import json
import os
import sqlite3
from app import app, init_db
from unittest.mock import patch, MagicMock

class TodoTestCase(unittest.TestCase):
    
    # Цей метод запускається ПЕРЕД кожним тестом
    def setUp(self):
        # Налаштовуємо Flask для тестів
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Використовуємо окрему базу даних для тестів, щоб не псувати основну!
        self.test_db = 'test_database.db'
        
        # Перевизначаємо функцію підключення до БД в app.py на нашу тестову
        app.config['DATABASE'] = self.test_db
        
        # Хак: ми підміняємо ім'я файлу БД в глобальному скоупі app
        # (У реальних проектах це робиться через конфігурацію, але так теж спрацює)
        global original_get_db
        self.original_connect = sqlite3.connect
        
        def mock_connect(*args, **kwargs):
             return sqlite3.connect(self.test_db)
        
        # Ініціалізуємо чисту базу
        with sqlite3.connect(self.test_db) as conn:
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS shared_lists 
                         (id TEXT PRIMARY KEY, data TEXT, user_id TEXT)''')
            c.execute('''CREATE TABLE IF NOT EXISTS users 
                         (id TEXT PRIMARY KEY, username TEXT UNIQUE, email TEXT, password_hash TEXT)''')
            conn.commit()

    # Цей метод запускається ПІСЛЯ кожного тесту
    def tearDown(self):
        # Видаляємо тестову базу
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    # --- ТЕСТ 1: Перевірка головної сторінки ---
    def test_home_page(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'To-Do List', response.data)

    # --- ТЕСТ 2: Реєстрація користувача ---
    def test_register(self):
        response = self.client.post('/api/register', json={
            'username': 'testuser',
            'password': 'password123',
            'email': 'test@example.com'
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')

    # --- ТЕСТ 3: Вхід у систему ---
    def test_login(self):
        # Спочатку реєструємо
        self.client.post('/api/register', json={
            'username': 'loginuser',
            'password': 'mypassword',
            'email': 'login@example.com'
        })
        
        # Тепер пробуємо увійти
        response = self.client.post('/api/login', json={
            'username': 'loginuser',
            'password': 'mypassword'
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['username'], 'loginuser')

    # --- ТЕСТ 4: Створення списку (API Share) ---
    def test_share_list(self):
        # Відправляємо список
        response = self.client.post('/api/share', json={
            'name': 'Тестовий список',
            'tasks': [{'text': 'Завдання 1', 'disabled': False}]
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue('id' in data) # Перевіряємо, чи повернувся ID

    # --- ТЕСТ 5: Відправка другу (з імітацією пошти) ---
    @patch('app.smtplib.SMTP') # Ми "мокаємо" пошту, щоб не відправляти реальні листи під час тестів
    def test_send_to_user(self, mock_smtp):
        # 1. Реєструємо двох користувачів
        self.client.post('/api/register', json={'username': 'sender', 'password': '123', 'email': 's@ex.com'})
        self.client.post('/api/register', json={'username': 'receiver', 'password': '123', 'email': 'r@ex.com'})

        # 2. Логінимося як відправник
        self.client.post('/api/login', json={'username': 'sender', 'password': '123'})

        # 3. Відправляємо список отримувачу
        list_data = {'name': 'Gift List', 'tasks': []}
        response = self.client.post('/api/send-to-user', json={
            'username': 'receiver',
            'list_data': list_data
        })

        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')
        
        # Перевіряємо, чи Python намагався відправити лист (але не відправив насправді)
        self.assertTrue(mock_smtp.called)

if __name__ == '__main__':
    unittest.main()