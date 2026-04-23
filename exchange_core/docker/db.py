from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from psycopg2 import pool
import os

_DB_WORKERS = 40

DATABSE_URL = os.getenv("DATABSE_URL")
if DATABSE_URL:
    _pool = pool.ThreadedConnectionPool(
        minconn=2,
        maxconn=_DB_WORKERS + 5,  # slight headroom above worker count
        dsn=DATABSE_URL,
    )

_pool = pool.ThreadedConnectionPool(
    minconn=10,
    maxconn=_DB_WORKERS + 5,  # slight headroom above worker count
    dbname="trading_exchange",
    user="postgres",
    password="postgres",
    host="localhost",
    port="5432",
)

# Single shared executor — limits concurrent DB threads to _DB_WORKERS,
# so the connection pool is never exhausted.
DB_EXECUTOR = ThreadPoolExecutor(max_workers=_DB_WORKERS)


def get_connection():
    return _pool.getconn()


def put_connection(conn):
    _pool.putconn(conn)


@contextmanager
def get_conn():
    """Always returns the connection to the pool, even if an exception occurs."""
    conn = _pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
