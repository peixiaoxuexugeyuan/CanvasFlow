"""Native desktop backend entry point. Build with tools/native/build.ps1."""
import sys


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('host', 'serve'):
        raise SystemExit('Expected host or serve')
    mode = sys.argv.pop(1)
    if mode == 'host':
        import desktop_host
        raise SystemExit(desktop_host.main())
    import server
    server.main()


if __name__ == '__main__':
    main()
