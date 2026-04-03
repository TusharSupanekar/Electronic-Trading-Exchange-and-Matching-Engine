from psycopg2 import pool

_pool = pool.ThreadedConnectionPool(
    minconn=10,
    maxconn=50,
    dbname="trading_exchange",
    user="postgres",
    password="postgres",
    host="localhost",
    port="5432",
)


def get_connection():
    return _pool.getconn()


def put_connection(conn):
    _pool.putconn(conn)