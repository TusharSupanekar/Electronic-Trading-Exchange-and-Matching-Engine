from locust import HttpUser, task, between
import random
import uuid


SYMBOL = "AAPL"


def random_price():
    return random.randint(18700, 18850)


class TradingUser(HttpUser):
    wait_time = between(0.1, 0.5)

    def on_start(self):
        self.user_id = f"user_{uuid.uuid4().hex[:8]}"
        self.order_ids = []

    @task(6)
    def place_limit_order(self):
        side = random.choice(["BUY", "SELL"])
        payload = {
            "user_id": self.user_id,
            "symbol": SYMBOL,
            "side": side,
            "type": "LIMIT",
            "qty": random.randint(1, 20),
            "price_cents": random_price(),
            "client_order_id": str(uuid.uuid4())
        }

        with self.client.post("/orders", json=payload, catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                order_id = data.get("order_id")
                if order_id:
                    self.order_ids.append(order_id)
                resp.success()
            else:
                resp.failure(f"Failed to place order: {resp.text}")

    @task(2)
    def place_market_order(self):
        side = random.choice(["BUY", "SELL"])
        payload = {
            "user_id": self.user_id,
            "symbol": SYMBOL,
            "side": side,
            "type": "MARKET",
            "qty": random.randint(1, 10),
            "client_order_id": str(uuid.uuid4())
        }

        with self.client.post("/orders", json=payload, catch_response=True) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Failed market order: {resp.text}")

    @task(1)
    def cancel_order(self):
        if not self.order_ids:
            return

        order_id = random.choice(self.order_ids)
        with self.client.delete(f"/orders/{order_id}", catch_response=True) as resp:
            if resp.status_code in (200, 404):
                resp.success()
            else:
                resp.failure(f"Failed cancel: {resp.text}")

    @task(1)
    def get_snapshot(self):
        with self.client.get("/book/snapshot?depth=10", catch_response=True) as resp:
            if resp.status_code == 200:
                resp.success()
            else:
                resp.failure(f"Failed snapshot: {resp.text}")