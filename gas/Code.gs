/**
 * スケボー連絡帳 — Google Apps Script（データの保存係）
 *
 * Googleスプレッドシートの「拡張機能 → Apps Script」に、このファイルの中身を全部貼り付けて使います。
 * 「プロジェクトの設定 → スクリプト プロパティ」に ADMIN_KEY（コーチ用の合言葉）を登録してください。
 *
 * スプレッドシートには次の3つのシートが自動でできます。
 *   生徒       … 生徒さんの一覧と、保護者さま用の専用ID
 *   連絡帳     … 書いた連絡帳がすべて残ります（ここで直接修正してもOK）
 *   メッセージ … 保護者さまからの質問・連絡
 *
 * 各シートは1行目の見出し（「何回目」「既読日時」など）を見て読み書きします。
 * 列を削除したり並べ替えたりしても動きますが、見出しの文字は変えないでください。
 *
 * 保護者さまからメッセージが届くと、このスプレッドシートの持ち主のGmailに通知メールが届きます。
 * 別のアドレスに送りたいときは、スクリプト プロパティに NOTIFY_EMAIL を追加してください。
 */

// コーチ用ページのURL（通知メールに載せます）
const COACH_URL = "https://tomozosan314-png.github.io/sk8/coach.html";

// 新しくシートを作るときの見出し
const SHEETS = {
  students: {
    name: "生徒",
    head: ["生徒ID", "名前", "学年・年齢", "登録日"],
  },
  entries: {
    name: "連絡帳",
    head: ["連絡帳ID", "生徒ID", "名前", "日付", "何回目",
           "フィードバック", "よかったところ", "次回の目標", "おうちでできる練習",
           "おしらせ・持ち物", "既読日時", "作成日時"],
  },
  messages: {
    name: "メッセージ",
    head: ["受信日時", "生徒ID", "名前", "連絡帳ID", "差出人", "内容", "通知"],
  },
};

// ---------- 共通 ----------
function sheet_(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const def = SHEETS[key];
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    sh.appendRow(def.head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, def.head.length).setFontWeight("bold");
    // 日付や回数が勝手に変換されないよう、文字として保存
    sh.getRange("A:Z").setNumberFormat("@");
  }
  return sh;
}

// シートを読み込み、見出しの名前で各行の値を取り出せる形にする
function table_(key) {
  const sh = sheet_(key);
  const v = sh.getDataRange().getDisplayValues();
  const head = (v[0] || []).map(h => String(h).trim());
  const col = {};
  head.forEach((h, i) => { if (h && col[h] === undefined) col[h] = i; });
  const rows = v.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    Object.keys(col).forEach(h => { o[h] = r[col[h]]; });
    return o;
  });
  return { sh: sh, head: head, col: col, rows: rows };
}

// 見出しが無ければ、いちばん右に足す（前からあるシートに新しい項目を増やすため）
function ensureHeader_(key, name) {
  const t = table_(key);
  if (t.col[name] === undefined) t.sh.getRange(1, t.head.length + 1).setValue(name);
}

// 見出しの名前で値を指定して1行追加（シートにない見出しの値は捨てる）
function append_(key, values) {
  const t = table_(key);
  t.sh.appendRow(t.head.map(h => (values[h] === undefined ? "" : values[h])));
}

function adminKey_() { return PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || ""; }
function isAdmin_(k) { return !!adminKey_() && k === adminKey_(); }
function s_(v, n) { return String(v == null ? "" : v).slice(0, n || 3000); }
function now_() { return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm"); }
function newId_() { return Utilities.getUuid().replace(/-/g, ""); }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function v_(x) { return x === undefined ? "" : x; }

function entryObj_(o) {
  return {
    id: v_(o["連絡帳ID"]), student: v_(o["生徒ID"]), name: v_(o["名前"]),
    date: v_(o["日付"]), count: v_(o["何回目"]),
    feedback: v_(o["フィードバック"]), good: v_(o["よかったところ"]), next: v_(o["次回の目標"]),
    home: v_(o["おうちでできる練習"]), notice: v_(o["おしらせ・持ち物"]),
    readAt: v_(o["既読日時"]), createdAt: v_(o["作成日時"]),
  };
}
function studentObj_(o) {
  return { id: v_(o["生徒ID"]), name: v_(o["名前"]), grade: v_(o["学年・年齢"]), createdAt: v_(o["登録日"]) };
}
function findStudent_(id) {
  if (!id) return null;
  const hit = table_("students").rows.find(o => o["生徒ID"] === id);
  return hit ? studentObj_(hit) : null;
}

// ---------- 通知メール ----------
function notifyEmail_() {
  return PropertiesService.getScriptProperties().getProperty("NOTIFY_EMAIL")
      || Session.getEffectiveUser().getEmail();
}
function notifyMessage_(studentName, from, text) {
  // 戻り値：送れたら "送信済み (宛先)"、送れなかったら "失敗: 理由"
  try {
    const to = notifyEmail_();
    if (!to) return "失敗: 送り先のメールアドレスがわかりません";
    MailApp.sendEmail({
      to: to,
      subject: "【スケボー連絡帳】" + studentName + "さんの保護者さまからメッセージ",
      body: [
        studentName + "さんの保護者さまから、メッセージが届きました。",
        "",
        "差出人：" + (from || "（お名前なし）"),
        "受信日時：" + now_(),
        "",
        "―――― 内容 ――――",
        text,
        "――――――――――――",
        "",
        "コーチ用ページ：" + COACH_URL,
        "スプレッドシート：" + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
      ].join("\n"),
    });
    return "送信済み (" + to + ")";
  } catch (err) {
    // 通知に失敗しても、メッセージの保存はそのまま成功させる
    console.error(err);
    return "失敗: " + String(err && err.message || err).slice(0, 200);
  }
}

// Apps Script の画面で実行して、通知メールの許可とテストをするための関数
// 失敗したときは、画面下に赤い文字で理由が出ます
function testNotify() {
  const result = notifyMessage_("テスト", "スケボー連絡帳", "これはテストです。このメールが届けば、通知の設定は完了です。");
  console.log(result);
  if (result.indexOf("失敗") === 0) throw new Error(result);
}

// ---------- 読み出し ----------
function doGet(e) {
  const p = e.parameter || {};

  // 保護者さま：自分の子の連絡帳だけ
  if (p.s) {
    const st = findStudent_(p.s);
    if (!st) return out_({ ok: false, error: "not_found" });
    const entries = table_("entries").rows.map(entryObj_).filter(x => x.student === st.id);
    return out_({ ok: true, student: { id: st.id, name: st.name, grade: st.grade }, entries: entries });
  }

  // コーチ：全部
  if (isAdmin_(p.key)) {
    return out_({
      ok: true,
      students: table_("students").rows.map(studentObj_),
      entries: table_("entries").rows.map(entryObj_),
      messages: table_("messages").rows.map(o => ({
        at: v_(o["受信日時"]), student: v_(o["生徒ID"]), name: v_(o["名前"]),
        entry: v_(o["連絡帳ID"]), from: v_(o["差出人"]), text: v_(o["内容"]),
      })),
    });
  }
  return out_({ ok: false, error: "bad_key" });
}

// ---------- 書き込み ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = JSON.parse(e.postData.contents);

    // コーチ：生徒を登録
    if (p.type === "student") {
      if (!isAdmin_(p.key)) return out_({ ok: false, error: "bad_key" });
      const id = newId_();
      append_("students", { "生徒ID": id, "名前": s_(p.name, 50), "学年・年齢": s_(p.grade, 30), "登録日": now_() });
      return out_({ ok: true, id: id });
    }

    // コーチ：連絡帳を保存
    if (p.type === "entry") {
      if (!isAdmin_(p.key)) return out_({ ok: false, error: "bad_key" });
      const st = findStudent_(p.student);
      if (!st) return out_({ ok: false, error: "not_found" });
      const id = newId_().slice(0, 12);
      append_("entries", {
        "連絡帳ID": id, "生徒ID": st.id, "名前": st.name,
        "日付": s_(p.date, 20), "何回目": s_(p.count, 5),
        "フィードバック": s_(p.feedback), "よかったところ": s_(p.good), "次回の目標": s_(p.next, 300),
        "おうちでできる練習": s_(p.home), "おしらせ・持ち物": s_(p.notice),
        "既読日時": "", "作成日時": now_(),
      });
      return out_({ ok: true, id: id });
    }

    // 保護者さま：既読
    if (p.type === "read") {
      const t = table_("entries");
      const c = t.col["既読日時"];
      if (c === undefined) return out_({ ok: false, error: "no_read_column" });
      const hit = t.rows.find(o => o["連絡帳ID"] === p.entry && o["生徒ID"] === p.s);
      if (!hit) return out_({ ok: false, error: "not_found" });
      const at = hit["既読日時"] || now_();
      if (!hit["既読日時"]) t.sh.getRange(hit._row, c + 1).setValue(at);
      return out_({ ok: true, readAt: at });
    }

    // 保護者さま：メッセージ
    if (p.type === "message") {
      const st = findStudent_(p.s);
      if (!st) return out_({ ok: false, error: "not_found" });
      ensureHeader_("messages", "通知");
      const notified = notifyMessage_(st.name, s_(p.from, 50), s_(p.text, 2000));
      append_("messages", {
        "受信日時": now_(), "生徒ID": st.id, "名前": st.name,
        "連絡帳ID": s_(p.entry, 20), "差出人": s_(p.from, 50), "内容": s_(p.text, 2000),
        "通知": notified,
      });
      return out_({ ok: true });
    }

    return out_({ ok: false, error: "bad_request" });
  } finally {
    lock.releaseLock();
  }
}
