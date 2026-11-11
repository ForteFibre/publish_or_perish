"""画面のファイル (web/) を配る HTTP サーバー.
python3 -m http.server と同じだが, Cache-Control: no-cache を付ける.
付けないと, 更新したあともブラウザが古い .js を使い続けることがある (画面の作りと説明の .md が食い違う).
  python3 web_server.py <port> <directory>"""
import functools
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 毎回確かめに来させる (変わっていなければ 304 で中身は送らない)
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    port, directory = int(sys.argv[1]), sys.argv[2]
    server = http.server.ThreadingHTTPServer(("", port), functools.partial(Handler, directory=directory))
    server.serve_forever()


if __name__ == "__main__":
    main()
