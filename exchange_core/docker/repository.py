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