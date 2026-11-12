/**
 * スケボー連絡帳 — 既読・メッセージ受け取り用 Google Apps Script
 * Googleスプレッドシートの「拡張機能 → Apps Script」に貼り付けて使います。
 * 「プロジェクトの設定 → スクリプト プロパティ」に ADMIN_KEY（好きな合言葉）を登録してください。
 */
const SHEETS = {
  entry:   { name: "連絡帳",     head: ["作成日時", "ID", "生徒", "レッスン日", "回"] },
  read:    { name: "既読",       head: ["既読日時", "ID", "生徒", "レッスン日", "回"] },
  message: { name: "メッセージ", head: ["受信日時", "ID", "生徒", "レッスン日", "回", "差出人", "内容"] },
};

function sheet_(type) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const def = SHEETS[type];
  let sh = ss.getSheetByName(def.name);
  if (!sh) { sh = ss.insertSheet(def.name); sh.appendRow(def.head); sh.setFrozenRows(1); }
  return sh;
}
function adminKey_() { return PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || ""; }
function clip_(v, n) { return String(v == null ? "" : v).slice(0, n); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const p = JSON.parse(e.postData.contents);
    const base = [new Date(), clip_(p.id, 40), clip_(p.name, 50), clip_(p.date, 20), clip_(p.count, 5)];
    if (p.type === "read") {
      sheet_("read").appendRow(base);
    } else if (p.type === "message") {
      sheet_("message").appendRow(base.concat([clip_(p.from, 50), clip_(p.text, 2000)]));
    } else if (p.type === "entry") {
      if (!adminKey_() || p.key !== adminKey_()) return json_({ ok: false, error: "bad_key" });
      sheet_("entry").appendRow(base);
    }
    return json_({ ok: true });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  if (!adminKey_() || e.parameter.key !== adminKey_()) return json_({ ok: false, error: "bad_key" });
  const rows = (type, keys) => {
    const v = sheet_(type).getDataRange().getValues().slice(1);
    return v.map(r => { const o = {}; keys.forEach((k, i) => o[k] = r[i] instanceof Date ? r[i].toISOString() : r[i]); return o; });
  };
  return json_({
    ok: true,
    entries: rows("entry", ["at", "id", "name", "date", "count"]),
    reads: rows("read", ["at", "id", "name", "date", "count"]),
    messages: rows("message", ["at", "id", "name", "date", "count", "from", "text"]),
  });
}
