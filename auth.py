from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db_connection

def register_user(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()

    hashed_password = generate_password_hash(password)

    cursor.execute(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        (username, hashed_password)
    )

    conn.commit()
    conn.close()


def validate_user(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,)
    )

    user = cursor.fetchone()
    conn.close()

    if user is None:
        return False

    return check_password_hash(user["password"], password)