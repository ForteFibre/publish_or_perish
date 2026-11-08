// Publish or Perish の VSCode 拡張.
//   畑を開く      : ゲームの画面 (http://localhost:8765) をエディタのタブに開く
//   畑を小窓で開く : そのタブを浮動ウィンドウに移し, 常に手前・タイトルなしの表示にする (コードを書きながら隅で見る)
//   ステータスバー : rosbridge から /farm/state を 1 秒ごとに読み, 今の課題と進み具合を出す
//   問題パネル     : 農場の点検 (ワークスペース・package.xml・ビルドの間違い) を, ファイルと行に付けて出す
const vscode = require('vscode')

const cfg = key => vscode.workspace.getConfiguration('publishOrPerish').get(key)

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
window.addEventListener('message', e => { if (e.data && e.data.type === 'open') api.postMessage(e.data) })
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
  panel = vscode.window.createWebviewPanel('publishOrPerish.farm', '畑', { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
    { enableScripts: true, retainContextWhenHidden: true })
  panel.iconPath = new vscode.ThemeIcon('home')
  panel.webview.html = html(cfg('url'))
  panel.webview.onDidReceiveMessage(m => { if (m.type === 'open' && m.file) openFile(m.file, m.line) })
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
    const d = new vscode.Diagnostic(new vscode.Range(line, 0, line, 1000), `${f.title}\n${f.detail}${f.fix ? '\n直し方: ' + f.fix : ''}`, severity[f.level])
    d.source = '農場の点検'
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
  const stage = s.stage ? s.stage.title.split(':')[0] : 'すべてクリア'
  const prog = cur && cur.goal > 1 ? ` ${cur.unit === 'm' ? cur.value.toFixed(1) : Math.floor(cur.value)}/${cur.goal}${cur.unit ? ' ' + cur.unit : ''}` : ''
  bar.text = `$(home) ${stage}${cur ? ' ・ ' + cur.title + prog : ''}${errors ? `  $(error) 点検 ${errors}` : warns ? `  $(warning) 点検 ${warns}` : ''}${warn ? '  $(warning) 配線' : ''}`
  bar.backgroundColor = errors ? new vscode.ThemeColor('statusBarItem.errorBackground')
    : warn || warns ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
  const md = new vscode.MarkdownString()
  for (const f of doctor.filter(f => f.level !== 'info')) {
    md.appendMarkdown(`**${f.level === 'error' ? 'エラー' : '注意'}: ${f.title}**\n\n`)
    md.appendText(f.detail + '\n\n')
    if (f.fix) md.appendCodeblock(f.fix, 'text')
  }
  md.appendMarkdown(`**${s.stage?.title ?? '今あるステージをすべてクリアした'}**\n\n`)
  if (cur) {
    md.appendText(cur.desc + '\n\n')
    md.appendCodeblock(cur.hint, 'text')
  }
  md.appendMarkdown(`\n\nLv ${s.level} ・ ${s.money.toLocaleString()} G ・ クリックで畑を小窓で開く`)
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
    const s = JSON.parse(m.msg.data)
    showState(s)
    // 畑を開いていないときだけ, ステージのクリアとレベルアップを通知で知らせる
    const fresh = s.notices.filter(n => lastNotice !== null && n.id > lastNotice)
    if (s.notices.length) lastNotice = Math.max(lastNotice ?? -1, ...s.notices.map(n => n.id))
    if (!panel?.visible) {
      for (const n of fresh) if (n.kind === 'stage' || n.kind === 'level') vscode.window.showInformationMessage(`${n.title} ${n.body}`)
    }
  }
  ws.onclose = () => {
    bar.text = '$(home) 農場: 未接続'
    bar.tooltip = 'ros2 launch publish_or_perish farm.launch.xml で農場を起動すると, ここに今の課題が出る'
    bar.backgroundColor = undefined
    bar.show()
    showDoctor([])
    timer = setTimeout(connect, 3000)
  }
  ws.onerror = () => {}
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('publishOrPerish.open', openPanel),
    vscode.commands.registerCommand('publishOrPerish.pip', openPip),
    bar,
    diagnostics,
    { dispose: () => { stopped = true; clearTimeout(timer); ws?.close() } },
  )
  connect()
}

function deactivate() {}

module.exports = { activate, deactivate }
