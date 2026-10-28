/* ===== 日本語 ⇄ 英語 =====
   日本語の文字そのものをキーにして、画面に出ている文字を入れ替える。
   既存のHTMLに data-i18n を書き足さずに済むので、付け忘れや取り違えが起きない。
   ・元の日本語と、こちらが書いた英語の両方をノードに覚えておく。
     書いた英語と違う値になっていたら「JSが書き換えた」と判断して覚え直す
   ・JSが作った部分にも追いつくよう、英語のあいだだけ MutationObserver で見張る
     （このサイトは textContent を読み戻して判定している箇所が無いので安全）
   ・「3段」のような数字つきは I18N_RE の形で拾う
   ・選んだ言語は localStorage に覚える。初回はブラウザの言語で決める */
const I18N_TITLE = { ja: document.title, en: I18N_TITLE_EN };
const I18N_PLURAL = (one, many) => (m, n) => n + ' ' + (n === '1' ? one : many);
const I18N_RE = [
  [/^(\d+)段$/, I18N_PLURAL('row', 'rows')],
  [/^(\d+)ライン$/, I18N_PLURAL('line', 'lines')],
  [/^(\d+)個$/, I18N_PLURAL('piece', 'pieces')],
  [/^(\d+)手$/, I18N_PLURAL('move', 'moves')],
  [/^(\d+)件$/, I18N_PLURAL('solution', 'solutions')],
  [/^(\d+(?:\.\d+)?)秒$/, '$1 s'],
];
/* 日本語に無い語でも、英語のときだけ差し替えたいもの（REN → C4W など）。
   「REN」は単位としても使われるので、辞書ではなく場所を指定して入れ替える */
const I18N_SEL = [
  ['#renModeBtn', 'C4W'],
  ['[data-ui-item="ren"] .opt-label', 'C4W'],
].concat(typeof I18N_SEL2 !== 'undefined' ? I18N_SEL2 : []);
let LANG = 'ja';
try {
  LANG = localStorage.getItem('tetren.lang')
      || ((navigator.language || '').toLowerCase().indexOf('ja') === 0 ? 'ja' : 'en');
} catch (e) {}

function i18nWord(t) {
  const hit = (typeof I18N_EN2 !== 'undefined' && I18N_EN2[t]) || I18N_EN[t];
  if (hit) return hit;
  for (const [re, to] of I18N_RE) if (re.test(t)) return t.replace(re, to);
  return null;
}

// 英語 → 日本語の逆引き。JSが英語で書き込んだ文を日本語に戻すのに使う
const I18N_JA = {};
for (const k in I18N_EN) if (!(I18N_EN[k] in I18N_JA)) I18N_JA[I18N_EN[k]] = k;
if (typeof I18N_EN2 !== 'undefined') for (const k in I18N_EN2) I18N_JA[I18N_EN2[k]] = k;

// T()/TF() が作った文は、作った時点の言語で固まってしまう（元の日本語がDOMに残らない）。
// 日本語版と英語版を対にして覚えておき、あとからどちらにも戻せるようにする。
const i18nPairs = new Map();

function i18nRemember(ja, en) {
  if (!ja || ja === en) return;
  const pair = { ja, en };
  i18nPairs.set(ja, pair);
  i18nPairs.set(en, pair);
  while (i18nPairs.size > 600) i18nPairs.delete(i18nPairs.keys().next().value);
}

function T(ja) {
  if (LANG !== 'en' || ja == null) return ja;
  const s = String(ja);
  const hit = i18nWord(s);
  if (hit) return hit;
  const t = s.trim();
  if (!t) return ja;
  const h2 = i18nWord(t);
  return h2 ? s.replace(t, h2) : ja;
}

// 数字や記号を埋め込む文は、文そのものを訳してから {0} {1} … を埋める
function TF(ja) {
  const v = Array.prototype.slice.call(arguments, 1);
  // 埋め込む語そのものが日本語のこともあるので（「パフェ」「3手」など）、英語版では引数も訳す
  const fill = (s, tr) => String(s).replace(/\{(\d+)\}/g, (m, i) => {
    const x = v[i];
    if (x === undefined) return m;
    return (tr && typeof x === 'string') ? (i18nWord(x) || x) : x;
  });
  const jaOut = fill(ja, false), enOut = fill(i18nWord(ja) || ja, true);
  i18nRemember(jaOut, enOut);
  return (LANG === 'en') ? enOut : jaOut;
}

// 空白や改行はそのままにして、中身だけ差し替える
function i18nText(node) {
  const now = node.nodeValue;
  if (node.__out === undefined || now !== node.__out) {
    // JSが書き換えた。英語で書き込まれていたら、対から日本語版を割り出しておく
    const s0 = now.trim();
    const pair = i18nPairs.get(s0) || (I18N_JA[s0] ? { ja: I18N_JA[s0] } : null);
    node.__ja = (pair && pair.ja) ? now.replace(s0, pair.ja) : now;
  }
  const ja = node.__ja, t = ja.trim();
  if (!t) return;
  let hit = null;
  if (LANG === 'en') {
    const pair = i18nPairs.get(t);
    hit = (pair && pair.en) || i18nWord(t);
  }
  node.__out = hit ? ja.replace(t, hit) : ja;
  if (now !== node.__out) node.nodeValue = node.__out;
}

const I18N_ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];

function i18nAttrs(el) {
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const now = el.getAttribute(a), kj = '__ja_' + a, ko = '__out_' + a;
    if (el[ko] === undefined || now !== el[ko]) el[kj] = now;
    const ja = el[kj], t = (ja || '').trim();
    if (!t) continue;
    const hit = (LANG === 'en') ? i18nWord(t) : null;
    el[ko] = hit ? ja.replace(t, hit) : ja;
    if (now !== el[ko]) el.setAttribute(a, el[ko]);
  }
}

let i18nBusy = false;

function applyLang(root) {
  root = root || document.body;
  if (!root || i18nBusy) return;
  i18nBusy = true;
  try {
    if (root.nodeType === 3) { i18nText(root); return; }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode && n.parentNode.nodeName;
        return (p === 'SCRIPT' || p === 'STYLE') ? NodeFilter.FILTER_REJECT
                                                 : NodeFilter.FILTER_ACCEPT;
      }
    });
    // 場所指定の差し替えを先にやる。あとにすると、英語で始まったときに
    // 「元の日本語」として英語を覚えてしまい、日本語に戻せなくなる
    if (root.nodeType === 1) {
      for (const [sel, en] of I18N_SEL) {
        const els = Array.from(root.querySelectorAll(sel));
        if (root.matches && root.matches(sel)) els.push(root);
        for (const el of els) {
          // <br> などを残したいので innerHTML で出し入れする
          const now = el.innerHTML;
          if (el.__sel_out === undefined || now !== el.__sel_out) el.__sel_ja = now;
          el.__sel_out = (LANG === 'en') ? en : el.__sel_ja;
          if (now !== el.__sel_out) el.innerHTML = el.__sel_out;
        }
      }
    }
    const list = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
    list.forEach(i18nText);
    if (root.nodeType === 1) {
      i18nAttrs(root);
      root.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(i18nAttrs);
    }
  } finally {
    i18nBusy = false;
  }
}

// 英語のあいだだけ、あとから作られた部分にも追いつく
let i18nQueue = null, i18nObs = null;

function i18nWatch(on) {
  if (!on) { if (i18nObs) { i18nObs.disconnect(); i18nObs = null; } return; }
  if (i18nObs) return;
  i18nObs = new MutationObserver(ms => {
    if (i18nBusy) return;
    if (!i18nQueue) {
      i18nQueue = [];
      // requestAnimationFrame はタブが裏にあると止まってしまうので setTimeout にする
      setTimeout(() => {
        const q = i18nQueue; i18nQueue = null;
        q.forEach(n => { if (n.isConnected) applyLang(n); });
      }, 0);
    }
    for (const m of ms) {
      if (m.type === 'childList') m.addedNodes.forEach(n => {
        if (n.nodeType === 1 || n.nodeType === 3) i18nQueue.push(n);
      });
      else i18nQueue.push(m.type === 'characterData' ? m.target : m.target);
    }
  });
  i18nObs.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: I18N_ATTRS
  });
}

function setLang(l) {
  LANG = (l === 'en') ? 'en' : 'ja';
  try { localStorage.setItem('tetren.lang', LANG); } catch (e) {}
  document.documentElement.lang = LANG;
  document.title = I18N_TITLE[LANG] || I18N_TITLE.ja;
  // 言語で出し分けが変わるものは、訳す前に作り直してもらう
  //   applyUiHidden … 英語のあいだは言語ボタンを隠さない
  //   renderUiList  … 「表示」の一覧で言語の行を触らせない
  try { if (typeof applyUiHidden === 'function') applyUiHidden(); } catch (e) {}
  try { if (typeof renderUiList === 'function') renderUiList(); } catch (e) {}
  applyLang(document.body);
  i18nWatch(LANG === 'en');
  const b = document.getElementById('langBtn');
  if (b) {
    b.textContent = (LANG === 'ja') ? 'English' : '日本語';
    b.title = (LANG === 'ja') ? 'Switch to English' : '日本語に切り替える';
  }
}

function toggleLang() { setLang(LANG === 'ja' ? 'en' : 'ja'); }

// 本体スクリプトより前に読み込むので、最初の適用はDOMが出来てから行う
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setLang(LANG));
} else {
  setLang(LANG);
}
