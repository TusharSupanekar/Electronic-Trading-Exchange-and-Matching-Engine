import json
from docker.db import get_connection, put_connection


def insert_order(order):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO orders (
            order_id, client_order_id, user_id, symbol, side, type,
            qty, remaining_qty, price_cents, status, reject_reason, created_ms
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        order.order_id,
        order.client_order_id,
        order.user_id,
        order.symbol,
        order.side.value,
        order.type.value,
        order.qty,
        order.remaining_qty,
        order.price_cents,
        order.status.value,
        order.reject_reason,
        order.created_ms,
    ))

    conn.commit()
    cur.close()
    put_connection(conn)


def update_order(order):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE orders
        SET remaining_qty = %s,
            status = %s,
            reject_reason = %s
        WHERE order_id = %s
    """, (
        order.remaining_qty,
        order.status.value,
        order.reject_reason,
        order.order_id,
    ))

    conn.commit()
    cur.close()
    put_connection(conn)


def insert_trade(trade):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO trades (
            trade_id, symbol, price_cents, qty,
            maker_order_id, taker_order_id, ts_ms
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        trade.trade_id,
        trade.symbol,
        trade.price_cents,
        trade.qty,
        trade.maker_order_id,
        trade.taker_order_id,
        trade.ts_ms,
    ))

    conn.commit()
    cur.close()
    put_connection(conn)


def insert_command(seq, command_type, payload, created_ms):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO commands (seq, command_type, payload_json, created_ms)
        VALUES (%s, %s, %s, %s)
    """, (
        seq,
        command_type,
        json.dumps(payload),
        created_ms
    ))

    conn.commit()
    cur.close()
    put_connection(conn)


def get_all_commands():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT seq, command_type, payload_json, created_ms
        FROM commands
        ORDER BY seq ASC
    """)

    rows = cur.fetchall()
    cur.close()
    put_connection(conn)

    commands = []
    for seq, command_type, payload_json, created_ms in rows:
        commands.append({
            "seq": seq,
            "command_type": command_type,
            "payload": json.loads(payload_json),
            "created_ms": created_ms,
        })

    return commands


#Login AUTH

def create_user(username,email,password):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
                INSERT INTO users (username,email,password)
                VALUES (%s, %s, %s)
                RETURNING id
            """, (username,email,password))
    user_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    put_connection(conn)
    return user_id

def get_user_by_email(email):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, username, email, password
        FROM users
        WHERE email = %s
    """, (email,))

    user = cur.fetchone()

    cur.close()
    put_connection(conn)

    return user

def get_all_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, username, email FROM users ORDER BY id")
    rows = cur.fetchall()
    cur.close()
    put_connection(conn)
    return rows


def get_user_holdings(user_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT symbol, quantity, avg_price
        FROM holdings
        WHERE user_id = %s AND quantity > 0
        ORDER BY symbol
    """, (user_id,))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {
            "symbol": row[0],
            "quantity": row[1],
            "avg_price": float(row[2]) if row[2] is not None else 0
        }
        for row in rows
    ]


def get_holding_quantity(user_id, symbol):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT quantity
        FROM holdings
        WHERE user_id = %s AND symbol = %s
    """, (user_id, symbol))

    row = cur.fetchone()
    cur.close()
    conn.close()

    return row[0] if row else 0


def update_holding_after_buy(user_id, symbol, qty, price):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT quantity, avg_price
        FROM holdings
        WHERE user_id = %s AND symbol = %s
    """, (user_id, symbol))

    row = cur.fetchone()

    if row:
        old_qty, old_avg = row
        new_qty = old_qty + qty
        new_avg = ((old_qty * float(old_avg)) + (qty * float(price))) / new_qty

        cur.execute("""
            UPDATE holdings
            SET quantity = %s, avg_price = %s
            WHERE user_id = %s AND symbol = %s
        """, (new_qty, new_avg, user_id, symbol))
    else:
        cur.execute("""
            INSERT INTO holdings (user_id, symbol, quantity, avg_price)
            VALUES (%s, %s, %s, %s)
        """, (user_id, symbol, qty, price))

    conn.commit()
    cur.close()
    conn.close()


def update_holding_after_sell(user_id, symbol, qty):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE holdings
        SET quantity = quantity - %s
        WHERE user_id = %s AND symbol = %s
    """, (qty, user_id, symbol))

    conn.commit()
    cur.close()
    conn.close()

# ── Wallet ────────────────────────────────────────────────────────────────────

def get_wallet(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO wallets (user_id, balance_cents)
        VALUES (%s, 0)
        ON CONFLICT (user_id) DO NOTHING
    """, (user_id,))
    conn.commit()
    cur.execute("""
        SELECT wallet_id, balance_cents, updated_at
        FROM wallets WHERE user_id = %s
    """, (user_id,))
    row = cur.fetchone()
    cur.close()
    put_connection(conn)
    return {"wallet_id": row[0], "balance_cents": row[1], "updated_at": str(row[2])}


def wallet_deposit(user_id, amount_cents, reference=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO wallets (user_id, balance_cents)
        VALUES (%s, %s)
        ON CONFLICT (user_id) DO UPDATE
        SET balance_cents = wallets.balance_cents + EXCLUDED.balance_cents,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, amount_cents))
    cur.execute("""
        INSERT INTO wallet_transactions (user_id, type, amount_cents, status, reference)
        VALUES (%s, 'DEPOSIT', %s, 'SUCCESS', %s)
        RETURNING txn_id, created_at
    """, (user_id, amount_cents, reference))
    txn = cur.fetchone()
    cur.execute("SELECT balance_cents FROM wallets WHERE user_id = %s", (user_id,))
    balance = cur.fetchone()[0]
    conn.commit()
    cur.close()
    put_connection(conn)
    return {"txn_id": txn[0], "balance_cents": balance, "created_at": str(txn[1])}


def wallet_withdraw(user_id, amount_cents, reference=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT balance_cents FROM wallets WHERE user_id = %s FOR UPDATE", (user_id,))
    row = cur.fetchone()
    if not row or row[0] < amount_cents:
        cur.close()
        put_connection(conn)
        return None
    cur.execute("""
        UPDATE wallets
        SET balance_cents = balance_cents - %s, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s
    """, (amount_cents, user_id))
    cur.execute("""
        INSERT INTO wallet_transactions (user_id, type, amount_cents, status, reference)
        VALUES (%s, 'WITHDRAWAL', %s, 'SUCCESS', %s)
        RETURNING txn_id, created_at
    """, (user_id, amount_cents, reference))
    txn = cur.fetchone()
    cur.execute("SELECT balance_cents FROM wallets WHERE user_id = %s", (user_id,))
    balance = cur.fetchone()[0]
    conn.commit()
    cur.close()
    put_connection(conn)
    return {"txn_id": txn[0], "balance_cents": balance, "created_at": str(txn[1])}


def get_wallet_transactions(user_id, limit=50):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT txn_id, type, amount_cents, status, reference, created_at
        FROM wallet_transactions
        WHERE user_id = %s
        ORDER BY created_at DESC LIMIT %s
    """, (user_id, limit))
    rows = cur.fetchall()
    cur.close()
    put_connection(conn)
    return [
        {"txn_id": r[0], "type": r[1], "amount_cents": r[2],
         "status": r[3], "reference": r[4], "created_at": str(r[5])}
        for r in rows
    ]


def get_payment_methods(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT payment_method_id, method_type, provider, last4,
               bank_name, account_mask, is_default, created_at
        FROM payment_methods
        WHERE user_id = %s
        ORDER BY is_default DESC, created_at ASC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    put_connection(conn)
    return [
        {"payment_method_id": r[0], "method_type": r[1], "provider": r[2],
         "last4": r[3], "bank_name": r[4], "account_mask": r[5],
         "is_default": r[6], "created_at": str(r[7])}
        for r in rows
    ]


def add_payment_method(user_id, method_type, provider=None, last4=None,
                       bank_name=None, account_mask=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM payment_methods WHERE user_id = %s", (user_id,))
    count = cur.fetchone()[0]
    is_default = (count == 0)
    cur.execute("""
        INSERT INTO payment_methods
            (user_id, method_type, provider, last4, bank_name, account_mask, is_default)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING payment_method_id, created_at
    """, (user_id, method_type, provider, last4, bank_name, account_mask, is_default))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    put_connection(conn)
    return {"payment_method_id": row[0], "is_default": is_default, "created_at": str(row[1])}


def delete_payment_method(user_id, payment_method_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM payment_methods
        WHERE payment_method_id = %s AND user_id = %s
        RETURNING is_default
    """, (payment_method_id, user_id))
    row = cur.fetchone()
    if row and row[0]:
        cur.execute("""
            UPDATE payment_methods SET is_default = TRUE
            WHERE payment_method_id = (
                SELECT payment_method_id FROM payment_methods
                WHERE user_id = %s ORDER BY created_at ASC LIMIT 1
            )
        """, (user_id,))
    conn.commit()
    cur.close()
    put_connection(conn)
    return row is not None


def set_default_payment_method(user_id, payment_method_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE payment_methods SET is_default = FALSE WHERE user_id = %s", (user_id,))
    cur.execute("""
        UPDATE payment_methods SET is_default = TRUE
        WHERE payment_method_id = %s AND user_id = %s
        RETURNING payment_method_id
    """, (payment_method_id, user_id))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    put_connection(conn)
    return row is not None


def wallet_debit(user_id, amount_cents, reference="trade_fill"):
    """Deduct amount from wallet. Creates row if missing. Casts user_id to int."""
    uid = int(user_id)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO wallets (user_id, balance_cents)
        VALUES (%s, 0)
        ON CONFLICT (user_id) DO NOTHING
    """, (uid,))
    cur.execute("""
        UPDATE wallets
        SET balance_cents = balance_cents - %s, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s
    """, (amount_cents, uid))
    cur.execute("""
        INSERT INTO wallet_transactions (user_id, type, amount_cents, status, reference)
        VALUES (%s, 'BUY_DEBIT', %s, 'SUCCESS', %s)
    """, (uid, amount_cents, reference))
    conn.commit()
    cur.close()
    put_connection(conn)


def wallet_credit(user_id, amount_cents, reference="trade_fill"):
    """Credit amount to wallet. Creates row if missing. Casts user_id to int."""
    uid = int(user_id)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO wallets (user_id, balance_cents)
        VALUES (%s, 0)
        ON CONFLICT (user_id) DO NOTHING
    """, (uid,))
    cur.execute("""
        UPDATE wallets
        SET balance_cents = balance_cents + %s, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s
    """, (amount_cents, uid))
    cur.execute("""
        INSERT INTO wallet_transactions (user_id, type, amount_cents, status, reference)
        VALUES (%s, 'SELL_CREDIT', %s, 'SUCCESS', %s)
    """, (uid, amount_cents, reference))
    conn.commit()
    cur.close()
    put_connection(conn)
