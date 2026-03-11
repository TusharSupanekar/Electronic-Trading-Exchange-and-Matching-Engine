from models import Order, Side, OrderType
from orderbook import OrderBook
from matcher import match_order


def dollars(x: float) -> int:
    return int(round(x * 100))


def print_book(book: OrderBook) -> None:
    snap = book.snapshot_l2(depth=10)
    print("\n===== ORDER BOOK =====")
    print("BIDS:", [(p / 100.0, q) for p, q in snap["bids"]])
    print("ASKS:", [(p / 100.0, q) for p, q in snap["asks"]])
    print("======================\n")


def print_trades(trades):
    if not trades:
        print("Trades: []")
        return
    print("Trades:")
    for t in trades:
        print(
            f"  qty={t.qty}, price=${t.price_cents/100:.2f}, "
            f"maker={t.maker_order_id[:8]}, taker={t.taker_order_id[:8]}"
        )


if __name__ == "__main__":
    book = OrderBook("AAPL")

    print("STEP 1: Add SELL 10 @ 187.60")
    s1 = Order(
        user_id="seller1",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=10,
        price_cents=dollars(187.60),
    )
    match_order(book, s1)
    print_book(book)

    print("STEP 2: Add BUY 5 @ 187.60")
    b1 = Order(
        user_id="buyer1",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.60),
    )
    trades = match_order(book, b1)
    print_trades(trades)
    print_book(book)

    print("STEP 3: Add two SELL orders at same price 187.70 (FIFO test)")
    s2 = Order(
        user_id="seller2",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.70),
    )
    match_order(book, s2)

    s3 = Order(
        user_id="seller3",
        symbol="AAPL",
        side=Side.SELL,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.70),
    )
    match_order(book, s3)
    print_book(book)

    print("STEP 4: BUY 5 @ 187.70 (should match seller2 first)")
    b2 = Order(
        user_id="buyer2",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.LIMIT,
        qty=5,
        price_cents=dollars(187.70),
    )
    trades2 = match_order(book, b2)
    print_trades(trades2)
    print(f"Expected first maker: seller2 -> {s2.order_id[:8]}")
    print_book(book)

    print("STEP 5: Cancel seller3 order")
    canceled = book.cancel(s3.order_id)
    print("Canceled seller3:", canceled)
    print_book(book)

    print("STEP 6: MARKET BUY 3 (should consume best ask)")
    m1 = Order(
        user_id="buyer3",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.MARKET,
        qty=3,
    )
    trades3 = match_order(book, m1)
    print_trades(trades3)
    print("Market order status:", m1.status, "| reject_reason:", m1.reject_reason)
    print_book(book)

    print("STEP 7: MARKET BUY 100 (insufficient liquidity => partial then cancel remainder)")
    m2 = Order(
        user_id="buyer4",
        symbol="AAPL",
        side=Side.BUY,
        type=OrderType.MARKET,
        qty=100,
    )
    trades4 = match_order(book, m2)
    print_trades(trades4)
    print("Market order status:", m2.status, "| reject_reason:", m2.reject_reason)
    print_book(book)