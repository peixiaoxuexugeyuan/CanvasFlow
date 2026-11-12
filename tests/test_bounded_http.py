import unittest
import test_remaining_audit as legacy


class BoundedHTTPTests(unittest.TestCase):
    test_thread_limit_recovers = legacy.RemainingAuditTests.test_http_thread_limit_recovers_after_slow_request_finishes


if __name__=='__main__':unittest.main()
