"""Bound connection threads so slow requests cannot create unlimited workers."""
import threading
import socket
from http.server import ThreadingHTTPServer as BaseHTTPServer


class ThreadingHTTPServer(BaseHTTPServer):
    max_request_threads = 32

    def __init__(self, *args, **kwargs):
        self.request_slots = threading.BoundedSemaphore(self.max_request_threads)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        if not self.request_slots.acquire(blocking=False):
            try:
                # Windows can reset a socket closed with unread request headers,
                # discarding the 503 we just wrote. Drain only headers already
                # present, never an unbounded upload or a slow client's body.
                request.settimeout(.05)
                try:
                    pending = request.recv(65536, socket.MSG_PEEK)
                    end = pending.find(b'\r\n\r\n')
                    if end >= 0: request.recv(end + 4)
                except (OSError, TimeoutError):
                    pass
                request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nRetry-After: 1\r\nConnection: close\r\n\r\n')
            except OSError:
                pass
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.request_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.request_slots.release()
