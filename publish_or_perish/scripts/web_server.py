"""画面のファイル (web/) を配る HTTP サーバー. /rosbridge への WebSocket は rosbridge (9090) に中継する.
python3 -m http.server と同じだが, Cache-Control: no-cache を付ける.
付けないと, 更新したあともブラウザが古い .js を使い続けることがある (画面の作りと説明の .md が食い違う).
中継するのは, 画面と rosbridge を同じ口 (ホストとポート) で開けるようにするため.
別の口だと, 画面を公開用の仕組み (ログインの要るリバースプロキシなど) を通して開いたときに rosbridge へ届かないことがある.
  python3 web_server.py <port> <directory> [<rosbridge のポート (9090)>]"""
import functools
import http.server
import socket
import sys
import threading


class Handler(http.server.SimpleHTTPRequestHandler):
    rosbridge = ('127.0.0.1', 9090)

    def end_headers(self):
        # 毎回確かめに来させる (変わっていなければ 304 で中身は送らない)
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == '/rosbridge' and self.headers.get('Upgrade', '').lower() == 'websocket':
            self.proxy_websocket()
        else:
            super().do_GET()

    def proxy_websocket(self):
        """WebSocket の要求を rosbridge にそのまま渡し, そのあとは両方向のバイト列を流すだけにする.
        Host と Origin も変えずに渡す (rosbridge は両者が合っているかを見ることがある)."""
        try:
            upstream = socket.create_connection(self.rosbridge, timeout=5)
        except OSError:
            self.send_error(502, 'rosbridge (port %d) is not running' % self.rosbridge[1])
            return
        upstream.settimeout(None)
        head = ['GET / HTTP/1.1'] + [f'{k}: {v}' for k, v in self.headers.items()]
        upstream.sendall(('\r\n'.join(head) + '\r\n\r\n').encode('latin-1'))
        client = self.connection
        client.settimeout(None)

        def pump(src, dst):
            try:
                while data := src.recv(65536):
                    dst.sendall(data)
            except OSError:
                pass
            finally:
                # 片方が閉じたら, もう片方も閉じる
                for s in (src, dst):
                    try:
                        s.shutdown(socket.SHUT_RDWR)
                    except OSError:
                        pass

        back = threading.Thread(target=pump, args=(upstream, client), daemon=True)
        back.start()
        pump(client, upstream)
        back.join()
        upstream.close()
        self.close_connection = True


def main():
    port, directory = int(sys.argv[1]), sys.argv[2]
    if len(sys.argv) > 3:
        Handler.rosbridge = ('127.0.0.1', int(sys.argv[3]))
    server = http.server.ThreadingHTTPServer(("", port), functools.partial(Handler, directory=directory))
    server.daemon_threads = True
    server.serve_forever()


if __name__ == "__main__":
    main()
