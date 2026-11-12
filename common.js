// 共通の処理（スプレッドシートとのやりとりなど）
(function () {
  const SKILLS = [
    "プッシュ（こぐ）", "ストップ", "ターン（チックタック）", "キックターン",
    "オーリー", "ドロップイン", "マニュアル", "ランプ（ポンピング）",
  ];
  // スプレッドシートには「オーリー：練習中／ドロップイン：できた！」の形で保存します
  const STATUS = { "はじめて": "new", "練習中": "try", "できた！": "done" };

  function parseSkills(text) {
    return String(text || "").split("／").map((s) => s.split("：")).filter((a) => a[0] && a[1])
      .map(([name, label]) => ({ name: name.trim(), label: label.trim(), cls: STATUS[label.trim()] || "new" }));
  }
  function joinSkills(list) { return list.map((s) => s.name + "：" + s.label).join("／"); }

  function gasUrl() {
    const u = (window.SK8_CONFIG || {}).gasUrl;
    if (!u) throw Object.assign(new Error("no_gas"), { code: "no_gas" });
    return u;
  }
  async function readJson(res) {
    const j = await res.json();
    if (!j.ok) throw Object.assign(new Error(j.error || "error"), { code: j.error || "error" });
    return j;
  }
  async function get(params) {
    const url = gasUrl() + "?" + new URLSearchParams(params).toString();
    return readJson(await fetch(url));
  }
  // Content-Type を text/plain にして、Apps Script でも答えを受け取れるようにしています
  async function post(payload) {
    return readJson(await fetch(gasUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }));
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    if (isNaN(d)) return iso;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${"日月火水木金土"[d.getDay()]}）`;
  }
  function shortDate(iso) {
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    return isNaN(d) ? (iso || "") : `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    });
    kids.flat().forEach((c) => c != null && n.append(c));
    return n;
  }

  const ICONS = {
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    line: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.6 14.1 22 12.6 22 11c0-4.4-4.5-8-10-8Z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  };

  window.SK8 = { SKILLS, STATUS, parseSkills, joinSkills, get, post, formatDate, shortDate, store, el, ICONS };
})();
