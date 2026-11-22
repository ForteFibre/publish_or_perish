// Publish or Perish の VSCode 拡張.
//   畑を開く      : ゲームの画面 (http://localhost:8765) をエディタのタブに開く
//   畑を小窓で開く : そのタブを浮動ウィンドウに移し, 常に手前・タイトルなしの表示にする (コードを書きながら隅で見る)
//   ステータスバー : rosbridge から /farm/state を 1 秒ごとに読み, 今の課題と進み具合を出す
//   問題パネル     : 農場の点検 (ワークスペース・package.xml・ビルドの間違い) を, ファイルと行に付けて出す
//   説明を開く     : 今の課題の説明 (畑の guide/<言語>/<id>.md) を, エディタの横に Markdown のプレビューで開く
// 農場から届く文言はキーと値なので, 畑の画面と同じ訳の表 (<url>/i18n/<言語>.json) で訳す.
// 拡張そのものの文言は vscode.l10n で訳す (元は英語, 日本語は l10n/bundle.l10n.ja.json).
const vscode = require('vscode')
const t = vscode.l10n.t

const cfg = key => vscode.workspace.getConfiguration('publishOrPerish').get(key)

// ---------------------------------------------------------------- 訳の表 (web/packages/i18n と同じ規則)
// VSCode の表示言語で訳す. 英語の表にない文 (画面にだけ出る文) は日本語で出す
const lang = vscode.env.language.startsWith('ja') ? 'ja' : 'en'
let catalogs = null   // { ja: { 'a.b': '...' }, en: {...} }

function flatten(node, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else flatten(v, key, out)
  }
  return out
}

async function loadCatalogs() {
  if (catalogs) return catalogs
  const load = async l => flatten(await (await fetch(`${cfg('url')}/i18n/${l}.json`, { cache: 'no-cache' })).json())
  catalogs = { ja: await load('ja'), en: await load('en') }
  return catalogs
}

// キーと値で文にする. 値は文字列か, それ自体を訳す文 ({ key, args })
function tr(key, args = {}, l = lang) {
  const text = catalogs?.[l]?.[key] ?? catalogs?.ja?.[key] ?? key
  return text.replace(/\{\{(\w+)\}\}/g, (all, name) => {
    const v = args[name]
    return v === undefined ? all : typeof v === 'string' ? v : tm(v, l)
  })
}
const tm = (m, l = lang) => tr(m.key, m.args, l)

// ---------------------------------------------------------------- ゲームの画面
let panel = null

function html(url) {
  const origin = new URL(url).origin
  const nonce = Math.random().toString(36).slice(2)
  // 画面そのものは iframe で開く (VSCode の Simple Browser と同じ方式). 音とコピーのボタンのために allow を付ける.
  // 画面の点検の欄で「開く」を押すと iframe から { type: 'open' } が届くので, 拡張に渡してファイルを開く
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${origin} http://localhost:* http://127.0.0.1:*; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>html, body, iframe { margin: 0; padding: 0; border: 0; width: 100%; height: 100%; overflow: hidden; background: #9fd8f5; }</style>
</head><body><iframe src="${url}" allow="autoplay; clipboard-read; clipboard-write"></iframe>
<script nonce="${nonce}">
const api = acquireVsCodeApi()
window.addEventListener('message', e => { if (e.data && (e.data.type === 'open' || e.data.type === 'guide')) api.postMessage(e.data) })
</script></body></html>`
}

async function openFile(file, line) {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file))
  const pos = new vscode.Position(Math.max(0, (line || 1) - 1), 0)
  // 浮動ウィンドウの畑から開いたときも, 本体のウィンドウの最初のエディタに開く
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(pos, pos) })
}

function openPanel() {
  if (panel) {
    panel.reveal(undefined, false)
    return panel
  }
  panel = vscode.window.createWebviewPanel('publishOrPerish.farm', t('Farm'), { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true })
  panel.iconPath = new vscode.ThemeIcon('home')
  // 畑の画面も VSCode の表示言語で出す
  panel.webview.html = html(`${cfg('url')}/?lang=${lang}`)
  panel.webview.onDidReceiveMessage(m => {
    if (m.type === 'open' && m.file) openFile(m.file, m.line)
    if (m.type === 'guide' && m.id) openGuide(m.id)
  })
  panel.onDidDispose(() => { panel = null })
  return panel
}

async function openPip() {
  openPanel()
  // 畑のタブが前に出てから動かす. 浮動ウィンドウを開いた直後はそのウィンドウが前にあるので, 続くコマンドはそこに効く
  await new Promise(r => setTimeout(r, 150))
  await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow')
  await new Promise(r => setTimeout(r, 400))
  await vscode.commands.executeCommand('workbench.action.enableCompactAuxiliaryWindow')
  await vscode.commands.executeCommand('workbench.action.enableWindowAlwaysOnTop')
}

// ---------------------------------------------------------------- 課題の説明
let storage = null      // 説明の .md を書き出す場所 (拡張ごとの保存場所)
let lastState = null

// 文中の ~/src26_ws と tutorial_nodes を, 農場の起動引数の値に置き換える (web/packages/guide/src/index.ts と同じ規則)
function substitute(text, ws, pkg) {
  if (!ws) return text
  const name = ws.split('/').pop()
  return text.replaceAll('~/src26_ws', ws).replaceAll('src26_ws', name).replaceAll('tutorial_nodes', pkg || 'tutorial_nodes')
}

// ターミナルに出る文 ({{msg:キー|名前=値}}) を英語の原文と訳にする (web/packages/guide/src/index.ts の expandMessages と同じ規則)
const MSG_RE = /\{\{msg:([\w.]+)(?:\|([^}]*))?\}\}/g
function parseArgs(s) {
  const out = {}
  for (const kv of (s ?? '').split(',')) {
    const eq = kv.indexOf('=')
    if (eq > 0) out[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim()
  }
  return out
}
function expandMessages(md) {
  const label = tr('guide.translation')
  // 値が $ で始まるときは, それ自体を訳す (例: crop=$crop.wheat)
  const resolve = (args, l) => Object.fromEntries(Object.entries(args).map(([k, v]) => [k, v.startsWith('$') ? tr(v.slice(1), {}, l) : v]))
  const original = (key, args) => tr(key, resolve(args, 'en'), 'en')
  const translated = lang === 'en' ? null : (key, args) => tr(key, resolve(args, lang))
  const lines = md.replace(/\r/g, '').split('\n'), out = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() === '```output') {
      const notes = []
      out.push('```text')
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) {
        out.push(lines[i].replace(MSG_RE, (_, key, a) => {
          const args = parseArgs(a)
          if (translated) notes.push(translated(key, args))
          return original(key, args)
        }))
      }
      out.push('```')
      for (const n of notes) out.push(`> ${label}: ${n}`)
    } else if (l.startsWith('```')) {
      out.push(l)
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) out.push(lines[i])
      if (i < lines.length) out.push(lines[i])
    } else {
      out.push(l.replace(MSG_RE, (_, key, a) => {
        const args = parseArgs(a)
        return `\`${original(key, args)}\`${translated ? ` (${label}: ${translated(key, args)})` : ''}`
      }))
    }
  }
  return out.join('\n')
}

// 説明の .md. その言語の版がなければ日本語の版
async function fetchGuide(id) {
  for (const l of lang === 'ja' ? ['ja'] : [lang, 'ja']) {
    const r = await fetch(`${cfg('url')}/guide/${l}/${id}.md`, { cache: 'no-cache' })
    if (r.ok) return r.text()
  }
  throw new Error('no guide')
}

async function openGuide(id) {
  id = id ?? lastState?.stage?.missions.find(m => !m.done)?.id
  if (!id) {
    vscode.window.showInformationMessage(t('No current task. The farm is not running, or every stage is cleared.'))
    return
  }
  let text
  try {
    await loadCatalogs()
    text = await fetchGuide(id)
  } catch {
    vscode.window.showInformationMessage(t('This task has no guide yet.'))
    return
  }
  const uri = vscode.Uri.joinPath(storage, `${id}.md`)
  await vscode.workspace.fs.createDirectory(storage)
  await vscode.workspace.fs.writeFile(uri, Buffer.from(expandMessages(substitute(text, lastState?.workspace, lastState?.package))))
  await vscode.commands.executeCommand('markdown.showPreviewToSide', uri)
}

// ---------------------------------------------------------------- ステータスバー
const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50)
bar.command = 'publishOrPerish.pip'

// ---------------------------------------------------------------- 点検 → 問題パネル
const diagnostics = vscode.languages.createDiagnosticCollection('publish-or-perish')
let doctorKey = ''

function showDoctor(findings) {
  const key = JSON.stringify(findings)
  if (key === doctorKey) return
  doctorKey = key
  const byFile = new Map()
  const severity = { error: vscode.DiagnosticSeverity.Error, warn: vscode.DiagnosticSeverity.Warning, info: vscode.DiagnosticSeverity.Information }
  for (const f of findings) {
    if (!f.file) continue
    const line = Math.max(0, (f.line || 1) - 1)
    const d = new vscode.Diagnostic(new vscode.Range(line, 0, line, 1000),
      `${tm(f.title)}\n${tm(f.detail)}${f.fix ? '\n' + t('Fix: {0}', f.fix) : ''}`, severity[f.level])
    d.source = t('Farm check')
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(d)
  }
  diagnostics.clear()
  for (const [file, ds] of byFile) diagnostics.set(vscode.Uri.file(file), ds)
}

function showState(s) {
  const cur = s.stage?.missions.find(m => !m.done)
  const warn = s.wires.some(w => w.warn)
  const doctor = s.doctor ?? []
  const errors = doctor.filter(f => f.level === 'error').length, warns = doctor.filter(f => f.level === 'warn').length
  showDoctor(doctor)
  const stageTitle = s.stage ? tr(`stage.${s.stage.id}.title`) : tr('ui.mini.all_clear')
  const stage = stageTitle.split(':')[0]
  const unit = cur?.unit ? tr(`unit.${cur.unit}`) : ''
  const prog = cur && cur.goal > 1 ? ` ${cur.unit === 'm' ? cur.value.toFixed(1) : Math.floor(cur.value)}/${cur.goal}${unit ? ' ' + unit : ''}` : ''
  const curTitle = cur ? tr(`mission.${cur.id}.title`) : ''
  bar.text = `$(home) ${stage}${cur ? ' ・ ' + curTitle + prog : ''}${errors ? `  $(error) ${t('Check {0}', errors)}` : warns ? `  $(warning) ${t('Check {0}', warns)}` : ''}${warn ? `  $(warning) ${t('Wiring')}` : ''}`
  bar.backgroundColor = errors ? new vscode.ThemeColor('statusBarItem.errorBackground')
    : warn || warns ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
  lastState = s
  const md = new vscode.MarkdownString()
  md.isTrusted = { enabledCommands: ['publishOrPerish.guide'] }
  for (const f of doctor.filter(f => f.level !== 'info')) {
    md.appendMarkdown('**')
    md.appendText(tr(`ui.doctor.${f.level}`, { title: tm(f.title) }))
    md.appendMarkdown('**\n\n')
    md.appendText(tm(f.detail) + '\n\n')
    if (f.fix) md.appendCodeblock(f.fix, 'text')
  }
  md.appendMarkdown('**')
  md.appendText(s.stage ? stageTitle : tr('ui.quest.all_clear'))
  md.appendMarkdown('**\n\n')
  if (cur) {
    const sub = text => substitute(text, s.workspace, s.package)
    md.appendText(sub(tr(`mission.${cur.id}.desc`)) + '\n\n')
    md.appendCodeblock(sub(tr(`mission.${cur.id}.hint`)), 'text')
    md.appendMarkdown(`[${t('Open the guide (Ctrl+Alt+G)')}](command:publishOrPerish.guide)\n\n`)
  }
  md.appendMarkdown('\n\n' + t('Lv {0} ・ {1} G ・ Click to open the farm in a small window', s.level, s.money.toLocaleString()))
  bar.tooltip = md
  bar.show()
}

let ws = null, timer = null, lastNotice = null, stopped = false
function connect() {
  clearTimeout(timer)
  if (stopped) return
  if (typeof WebSocket === 'undefined') return   // Node 22 未満の VSCode ではステータスバーを出さない
  try {
    ws = new WebSocket(cfg('rosbridge'))
  } catch {
    timer = setTimeout(connect, 3000)
    return
  }
  ws.onopen = () => ws.send(JSON.stringify({ op: 'subscribe', topic: '/farm/state', type: 'std_msgs/msg/String', throttle_rate: 1000 }))
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    if (m.op !== 'publish') return
    // 訳の表を読むまでは出さない (読めなければ次に届いたときにまた読む)
    if (!catalogs) {
      loadCatalogs().catch(() => {})
      return
    }
    const s = JSON.parse(m.msg.data)
    showState(s)
    // 畑を開いていないときだけ, ステージのクリアとレベルアップを通知で知らせる
    const fresh = s.notices.filter(n => lastNotice !== null && n.id > lastNotice)
    if (s.notices.length) lastNotice = Math.max(lastNotice ?? -1, ...s.notices.map(n => n.id))
    if (!panel?.visible) {
      for (const n of fresh) if (n.kind === 'stage' || n.kind === 'level') vscode.window.showInformationMessage(`${tm(n.title)} ${tm(n.body)}`)
    }
  }
  ws.onclose = () => {
    bar.text = `$(home) ${t('Farm: not connected')}`
    bar.tooltip = t('Start the farm with ros2 launch publish_or_perish farm.launch.xml, and the current task appears here.')
    bar.backgroundColor = undefined
    bar.show()
    showDoctor([])
    timer = setTimeout(connect, 3000)
  }
  ws.onerror = () => {}
}

function activate(context) {
  storage = vscode.Uri.joinPath(context.globalStorageUri, 'guide')
  context.subscriptions.push(
    vscode.commands.registerCommand('publishOrPerish.open', openPanel),
    vscode.commands.registerCommand('publishOrPerish.pip', openPip),
    vscode.commands.registerCommand('publishOrPerish.guide', () => openGuide()),
    bar,
    diagnostics,
    { dispose: () => { stopped = true; clearTimeout(timer); ws?.close() } },
  )
  connect()
}

function deactivate() {}

module.exports = { activate, deactivate }
