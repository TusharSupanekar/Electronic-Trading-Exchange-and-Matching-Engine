from db import get_connection


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        client_order_id TEXT,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        qty INT NOT NULL,
        remaining_qty INT NOT NULL,
        price_cents INT,
        status TEXT NOT NULL,
        reject_reason TEXT,
        created_ms BIGINT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS trades (
        trade_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        price_cents INT NOT NULL,
        qty INT NOT NULL,
        maker_order_id TEXT NOT NULL,
        taker_order_id TEXT NOT NULL,
        ts_ms BIGINT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS commands (
        seq BIGINT PRIMARY KEY,
        command_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_ms BIGINT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Tables created successfully.")
    
if __name__ == "__main__":
    init_db()