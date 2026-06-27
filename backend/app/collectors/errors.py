class CollectorError(Exception):
    """Raised when an exchange collector fails."""

    def __init__(self, exchange: str, message: str):
        self.exchange = exchange
        super().__init__(f"[{exchange}] {message}")
