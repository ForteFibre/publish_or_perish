"""訳の表 (en.json) から, C++ が読むヘッダーを作る. CMake がビルドのたびに呼ぶ.
  python3 gen_messages.py <en.json> <出力の .hpp>
入れ子のキーは . でつなぐ (例: {"srv": {"bell": ...}} → "srv.bell"). 引き方は messages.cpp."""
import json
import sys


def flatten(prefix, node, out):
    for k, v in node.items():
        key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            flatten(key, v, out)
        else:
            out[key] = v


def cstr(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'


def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding='utf-8') as f:
        flat = {}
        flatten('', json.load(f), flat)
    lines = [
        '// 自動生成 (cmake/gen_messages.py). 直すときは web/public/i18n/en.json を直す',
        '#pragma once',
        'namespace publish_or_perish::generated',
        '{',
        'struct Entry {const char * key; const char * text;};',
        '// キーの順に並べてある (二分探索で引く)',
        'inline constexpr Entry kEn[] = {',
    ]
    lines += [f'  {{{cstr(k)}, {cstr(flat[k])}}},' for k in sorted(flat)]
    lines += ['};', '}  // namespace publish_or_perish::generated', '']
    text = '\n'.join(lines)
    # 中身が同じなら書き換えない (書くと時刻が変わり, 毎回ビルドし直しになる)
    try:
        with open(dst, encoding='utf-8') as f:
            if f.read() == text:
                return
    except FileNotFoundError:
        pass
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(text)


if __name__ == '__main__':
    main()
