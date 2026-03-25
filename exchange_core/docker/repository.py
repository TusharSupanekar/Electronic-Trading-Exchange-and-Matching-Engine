import json
from docker.db import get_connection


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
    conn.close()


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
    conn.close()


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
    conn.close()


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
    conn.close()


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
    conn.close()

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
    conn.close()
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
    conn.close()

    return user