import pytest
from models import Order, Side, OrderType
from orderbook import OrderBook
from matcher import match_order


def dollars(x: float) -> int:
    return int(round(x * 100))


def test_basic_match_limit():
    book = OrderBook("AAPL")
    sell = Order(user_id="s", symbol="AAPL", side=Side.SELL, type=OrderType.LIMIT, qty=10, price_cents=dollars(187.60))
    match_order(book, sell)

    buy = Order(user_id="b", symbol="AAPL", side=Side.BUY, type=OrderType.LIMIT, qty=5, price_cents=dollars(187.60))
    trades = match_order(book, buy)

    assert len(trades) == 1
    assert trades[0].qty == 5
    assert trades[0].price_cents == dollars(187.60)

    snap = book.snapshot_l2()
    # remaining 5 shares at ask 187.60
    assert snap["asks"][0][0] == dollars(187.60)
    assert snap["asks"][0][1] == 5


# TODO (Sprint 2+): Add tests for FIFO at same price, partial fills both sides, cancellation behavior.