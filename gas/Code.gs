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
 */

const SHEETS = {
  students: {
    name: "生徒",
    head: ["生徒ID", "名前", "学年・年齢", "登録日"],
  },
  entries: {
    name: "連絡帳",
    head: ["連絡帳ID", "生徒ID", "名前", "日付", "時間", "何回目",
           "フィードバック", "よかったところ", "次回の目標", "おうちでできる練習",
           "おしらせ・持ち物", "既読日時", "作成日時"],
  },
  messages: {
    name: "メッセージ",
    head: ["受信日時", "生徒ID", "名前", "連絡帳ID", "差出人", "内容"],
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
function rows_(key) {
  const v = sheet_(key).getDataRange().getDisplayValues();
  return v.slice(1).map((r, i) => ({ r: r, row: i + 2 }));
}
function adminKey_() { return PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || ""; }
function isAdmin_(k) { return !!adminKey_() && k === adminKey_(); }
function s_(v, n) { return String(v == null ? "" : v).slice(0, n || 3000); }
function now_() { return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm"); }
function newId_() { return Utilities.getUuid().replace(/-/g, ""); }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function entryObj_(r) {
  return {
    id: r[0], student: r[1], name: r[2], date: r[3], time: r[4], count: r[5],
    feedback: r[6], good: r[7], next: r[8], home: r[9], notice: r[10],
    readAt: r[11], createdAt: r[12],
  };
}
function findStudent_(id) {
  if (!id) return null;
  const hit = rows_("students").find(x => x.r[0] === id);
  return hit ? { id: hit.r[0], name: hit.r[1], grade: hit.r[2] } : null;
}

// ---------- 読み出し ----------
function doGet(e) {
  const p = e.parameter || {};

  // 保護者さま：自分の子の連絡帳だけ
  if (p.s) {
    const st = findStudent_(p.s);
    if (!st) return out_({ ok: false, error: "not_found" });
    const entries = rows_("entries").map(x => entryObj_(x.r)).filter(x => x.student === st.id);
    return out_({ ok: true, student: st, entries: entries });
  }

  // コーチ：全部
  if (isAdmin_(p.key)) {
    return out_({
      ok: true,
      students: rows_("students").map(x => ({ id: x.r[0], name: x.r[1], grade: x.r[2], createdAt: x.r[3] })),
      entries: rows_("entries").map(x => entryObj_(x.r)),
      messages: rows_("messages").map(x => ({ at: x.r[0], student: x.r[1], name: x.r[2], entry: x.r[3], from: x.r[4], text: x.r[5] })),
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
      sheet_("students").appendRow([id, s_(p.name, 50), s_(p.grade, 30), now_()]);
      return out_({ ok: true, id: id });
    }

    // コーチ：連絡帳を保存
    if (p.type === "entry") {
      if (!isAdmin_(p.key)) return out_({ ok: false, error: "bad_key" });
      const st = findStudent_(p.student);
      if (!st) return out_({ ok: false, error: "not_found" });
      const id = newId_().slice(0, 12);
      sheet_("entries").appendRow([
        id, st.id, st.name, s_(p.date, 20), s_(p.time, 30), s_(p.count, 5),
        s_(p.feedback), s_(p.good), s_(p.next, 300), s_(p.home), s_(p.notice),
        "", now_(),
      ]);
      return out_({ ok: true, id: id });
    }

    // 保護者さま：既読
    if (p.type === "read") {
      const hit = rows_("entries").find(x => x.r[0] === p.entry && x.r[1] === p.s);
      if (!hit) return out_({ ok: false, error: "not_found" });
      const at = hit.r[11] || now_();
      if (!hit.r[11]) sheet_("entries").getRange(hit.row, 12).setValue(at);
      return out_({ ok: true, readAt: at });
    }

    // 保護者さま：メッセージ
    if (p.type === "message") {
      const st = findStudent_(p.s);
      if (!st) return out_({ ok: false, error: "not_found" });
      sheet_("messages").appendRow([now_(), st.id, st.name, s_(p.entry, 20), s_(p.from, 50), s_(p.text, 2000)]);
      return out_({ ok: true });
    }

    return out_({ ok: false, error: "bad_request" });
  } finally {
    lock.releaseLock();
  }
}
