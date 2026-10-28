# -*- coding: utf-8 -*-
"""テト練のHTMLに日本語⇄英語の仕組みを入れる（何度でも実行できる）"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = '/Users/take/クロード/テトリス/demo'
MARK_A, MARK_B = '<!-- i18n:start -->', '<!-- i18n:end -->'

words = json.load(io.open(os.path.join(HERE, 'ui.json'), encoding='utf-8'))
for extra in ('log.json', 'js.json'):
    p = os.path.join(HERE, extra)
    if os.path.exists(p):
        words.update(json.load(io.open(p, encoding='utf-8')))
engine = io.open(os.path.join(HERE, 'engine.js'), encoding='utf-8').read()

def make_block(title_en, over, sel):
    return (MARK_A + '\n<script>\nconst I18N_TITLE_EN = ' + json.dumps(title_en)
            + ';\nconst I18N_EN2 = ' + json.dumps(over, ensure_ascii=False)
            + ';\nconst I18N_SEL2 = ' + json.dumps(sel, ensure_ascii=False)
            + ';\nconst I18N_EN = '
            + json.dumps(words, ensure_ascii=False, indent=0, sort_keys=True)
            + ';\n' + engine + '\n</script>\n' + MARK_B)

# data-ui を付けておくと、設定の「表示」タブで出し入れできる
BTN_PC = ('      <button id="langBtn" class="kc-open-btn" data-ui="lang" style="background:#374151;"\n'
          '        onclick="toggleLang()" title="Switch to English">English</button>\n')
BTN_SP = ('    <button class="side-btn" id="langBtn" data-ui="lang" style="margin-top:2px;"\n'
          '      onclick="toggleLang()">English</button>\n')

def install(path, btn, after, title_en, over=None, sel=None):
    s = io.open(path, encoding='utf-8').read()
    # 前に入れたものがあれば外す
    s = re.sub(re.escape(MARK_A) + '.*?' + re.escape(MARK_B) + '\n?', '', s, flags=re.S)
    s = re.sub(r'[ \t]*<button[^>]*id="langBtn".*?</button>\n', '', s, flags=re.S)
    if after not in s:
        raise SystemExit('ボタンの置き場所が見つからない: %s' % path)
    s = s.replace(after, after + btn, 1)
    # 本体スクリプトが初期化中に T() を呼ぶので、<body> の直後に置いて先に定義する
    i = s.index('<body')
    i = s.index('>', i) + 1
    s = s[:i] + '\n' + make_block(title_en, over or {}, sel or []) + s[i:]
    io.open(path, 'w', encoding='utf-8').write(s)
    return len(s)

n1 = install(os.path.join(ROOT, 'tetren.html'), BTN_PC,
             '''<button class="kc-open-btn" onclick="openConfig()" style="margin-top:0;" title="キーコンフィグ・スキン・その他の設定を開く">⚙ 設定</button>\n''',
             'Tetren | Tetris practice tool')
n2 = install(os.path.join(ROOT, 'tetren_mobile.html'), BTN_SP,
             '''<button class="side-btn" onclick="openConfig()" style="margin-top:2px;">⚙ 設定</button>\n''',
             'Tetren (mobile) | Tetris practice tool',
             # スマホ版は左の列が細いので、はみ出す語だけ短くする
             {'カンペ画像': 'Reference'},
             [['#verSwitchBtn', '\U0001f5a5 Desktop']])
print('辞書 %d語 を入れました  PC %d文字 / スマホ %d文字' % (len(words), n1, n2))
