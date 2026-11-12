// 共通の処理（連絡帳データの変換・送信など）
(function () {
  const SKILLS = [
    "プッシュ（こぐ）", "ストップ", "ターン（チックタック）", "キックターン",
    "オーリー", "ドロップイン", "マニュアル", "ランプ（ポンピング）",
  ];
  const SKILL_STATUS = {
    done: { label: "できた！", cls: "done" },
    try: { label: "練習中", cls: "try" },
    new: { label: "はじめて", cls: "new" },
  };

  // JSON → URL に入れられる文字列（日本語OK）
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  // Google Apps Script に送る（Content-Type を text/plain にして CORS の事前確認を回避）
  async function post(payload) {
    const url = (window.SK8_CONFIG || {}).gasUrl;
    if (!url) throw new Error("no_gas");
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    const w = "日月火水木金土"[d.getDay()];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${w}）`;
  }

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  const ICONS = {
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    line: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.6 14.1 22 12.6 22 11c0-4.4-4.5-8-10-8Z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  };

  window.SK8 = { SKILLS, SKILL_STATUS, encode, decode, post, formatDate, store, ICONS };
})();
