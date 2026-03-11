from models import Order, Side, OrderType, OrderStatus
from orderbook import OrderBook
from matcher import match_order


def dollars(x: float) -> int:
    return int(round(x * 100))


def test_basic_limit_match():
    book = OrderBook("AAPL")

    sell = Order(
        user_id="s1",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=10,
        price_cents=dollars(187.60),
    )
    match_order(book, sell)

    buy = Order(
        user_id="b1",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.60),
    )
    trades = match_order(book, buy)

    assert len(trades) == 1
    assert trades[0].qty == 5
    assert trades[0].price_cents == dollars(187.60)

    snap = book.snapshot_l2()
    assert snap["asks"][0] == (dollars(187.60), 5)


def test_fifo_same_price():
    book = OrderBook("AAPL")

    sell1 = Order(
        user_id="s1",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.70),
    )
    match_order(book, sell1)

    sell2 = Order(
        user_id="s2",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.70),
    )
    match_order(book, sell2)

    buy = Order(
        user_id="b1",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.70),
    )
    trades = match_order(book, buy)

    assert len(trades) == 1
    assert trades[0].maker_order_id == sell1.order_id
    assert sell1.status == OrderStatus.FILLED
    assert sell2.status == OrderStatus.RESTING


def test_partial_fill_and_resting_remainder():
    book = OrderBook("AAPL")

    sell = Order(
        user_id="s1",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.60),
    )
    match_order(book, sell)

    buy = Order(
        user_id="b1",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.LIMIT,
        qty=10,
        price_cents=dollars(187.60),
    )
    trades = match_order(book, buy)

    assert len(trades) == 1
    assert trades[0].qty == 5
    assert buy.status == OrderStatus.RESTING
    assert buy.remaining_qty == 5

    snap = book.snapshot_l2()
    assert snap["bids"][0] == (dollars(187.60), 5)


def test_cancel_resting_order():
    book = OrderBook("AAPL")

    sell = Order(
        user_id="s1",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=10,
        price_cents=dollars(187.60),
    )
    match_order(book, sell)

    assert book.cancel(sell.order_id) is True
    assert sell.status == OrderStatus.CANCELED
    assert sell.active is False


def test_market_order_executes_when_liquidity_exists():
    book = OrderBook("AAPL")

    sell = Order(
        user_id="s1",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=10,
        price_cents=dollars(187.60),
    )
    match_order(book, sell)

    market_buy = Order(
        user_id="b1",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.MARKET,
        qty=3,
    )
    trades = match_order(book, market_buy)

    assert len(trades) == 1
    assert trades[0].qty == 3
    assert trades[0].price_cents == dollars(187.60)
    assert market_buy.status == OrderStatus.FILLED


def test_market_order_rejected_when_no_liquidity():
    book = OrderBook("AAPL")

    market_buy = Order(
        user_id="b1",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.MARKET,
        qty=3,
    )
    trades = match_order(book, market_buy)

    assert trades == []
    assert market_buy.status == OrderStatus.REJECTED
    assert market_buy.reject_reason is not None


def test_symbol_mismatch_rejected():
    book = OrderBook("AAPL")

    order = Order(
        user_id="u1",
        symbol="MSFT",
        side=Side.BUY,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(100.00),
    )
    trades = match_order(book, order)

    assert trades == []
    assert order.status == OrderStatus.REJECTED