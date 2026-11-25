#!/usr/bin/env python3
import os
import sys
import pty
import select
import struct
import fcntl
import termios
import signal

def set_winsize(fd, rows, cols):
    try:
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass

def main():
    if len(sys.argv) < 5:
        sys.stderr.write("Usage: ptyHost.py <cwd> <cols> <rows> <cmd> [args...]\n")
        sys.exit(1)

    cwd = sys.argv[1]
    cols = int(sys.argv[2])
    rows = int(sys.argv[3])
    cmd = sys.argv[4:]

    pid, master_fd = pty.fork()
    if pid == 0:
        # Child process inside real Linux PTY
        try:
            if cwd and os.path.isdir(cwd):
                os.chdir(cwd)
        except Exception:
            pass
        os.environ["TERM"] = "xterm-256color"
        os.environ["COLORTERM"] = "truecolor"
        os.environ["LANG"] = os.environ.get("LANG", "en_US.UTF-8")
        os.environ["FORCE_COLOR"] = "1"
        os.environ["PATH"] = (
            "/home/fidel/.pi/agent/bin:/home/fidel/.local/share/pi-node/current/bin:"
            + os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin")
        )
        os.execvp(cmd[0], cmd)
        os._exit(127)

    # Parent process: configure initial window size & proxy raw bytes
    set_winsize(master_fd, rows, cols)

    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()

    # Resize control sequence sent by Node over stdin: \x1b]9999;COLS;ROWS\x07
    RESIZE_PREFIX = b"\x1b]9999;"
    RESIZE_SUFFIX = b"\x07"

    try:
        while True:
            rlist, _, _ = select.select([master_fd, stdin_fd], [], [], 0.5)

            if master_fd in rlist:
                try:
                    data = os.read(master_fd, 16384)
                    if not data:
                        break
                    os.write(stdout_fd, data)
                except OSError:
                    break

            if stdin_fd in rlist:
                try:
                    inp = os.read(stdin_fd, 16384)
                    if not inp:
                        break
                    # Extract any inline resize control packets
                    while RESIZE_PREFIX in inp:
                        start = inp.find(RESIZE_PREFIX)
                        end = inp.find(RESIZE_SUFFIX, start + len(RESIZE_PREFIX))
                        if end == -1:
                            break
                        before = inp[:start]
                        ctrl = inp[start + len(RESIZE_PREFIX):end]
                        after = inp[end + 1:]
                        if before:
                            os.write(master_fd, before)
                        try:
                            c_str, r_str = ctrl.decode("ascii").split(";")
                            c_val = max(20, min(400, int(c_str)))
                            r_val = max(5, min(200, int(r_str)))
                            set_winsize(master_fd, r_val, c_val)
                            os.kill(pid, signal.SIGWINCH)
                        except Exception:
                            pass
                        inp = after
                    if inp:
                        os.write(master_fd, inp)
                except OSError:
                    break

            # Check if child exited
            wpid, _ = os.waitpid(pid, os.WNOHANG)
            if wpid == pid:
                break
    finally:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass

if __name__ == "__main__":
    main()
