"""
Request ID middleware — pure ASGI implementation.

Uses raw ASGI instead of BaseHTTPMiddleware to avoid buffering
streaming responses (SSE streams for journal chat).
"""
import uuid
from starlette.types import ASGIApp, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-Id"


class RequestIdMiddleware:
    """Attach a unique request ID to every HTTP request/response."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract or generate request ID
        headers = dict(scope.get("headers", []))
        req_id = headers.get(b"x-request-id", b"").decode() or str(uuid.uuid4())

        # Store on scope state so downstream can access it
        if "state" not in scope:
            scope["state"] = {}
        scope["state"]["request_id"] = req_id

        async def send_with_request_id(message):
            if message["type"] == "http.response.start":
                # Inject request ID header into response
                response_headers = list(message.get("headers", []))
                response_headers.append(
                    (REQUEST_ID_HEADER.lower().encode(), req_id.encode())
                )
                message = {**message, "headers": response_headers}
            await send(message)

        await self.app(scope, receive, send_with_request_id)
