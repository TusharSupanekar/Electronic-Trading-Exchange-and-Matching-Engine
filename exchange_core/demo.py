from models import Order, Side, OrderType
from orderbook import OrderBook
from matcher import match_order


def dollars(x: float) -> int:
    return int(round(x * 100))


if __name__ == "__main__":
    book = OrderBook("AAPL")

    # Seed some orders
    s1 = Order(user_id="u2", symbol="AAPL", side=Side.SELL, type=OrderType.LIMIT, qty=10, price_cents=dollars(187.60))
    match_order(book, s1)

    b1 = Order(user_id="u1", symbol="AAPL", side=Side.BUY, type=OrderType.LIMIT, qty=5, price_cents=dollars(187.60))
    trades = match_order(book, b1)

    print("TRADES:", [(t.qty, t.price_cents) for t in trades])
    print("BOOK:", book.snapshot_l2(depth=5))