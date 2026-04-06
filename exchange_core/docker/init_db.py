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

    cur.execute("""
    CREATE TABLE IF NOT EXISTS holdings (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        avg_price NUMERIC(12,2) DEFAULT 0,
        UNIQUE(user_id, symbol)
    );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wallets (
            wallet_id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            balance_cents BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS wallet_transactions (
            txn_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(30) NOT NULL,
            amount_cents BIGINT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
            reference VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_methods (
            payment_method_id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            method_type VARCHAR(20) NOT NULL,
            provider VARCHAR(50),
            last4 VARCHAR(4),
            bank_name VARCHAR(100),
            account_mask VARCHAR(10),
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

    conn.commit()
    cur.close()
    conn.close()
    print("Tables created successfully.")
    
if __name__ == "__main__":
    init_db()