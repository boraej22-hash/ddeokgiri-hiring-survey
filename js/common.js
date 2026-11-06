// 세 화면이 같이 쓰는 것: 떡기리 기본값, 설문 링크 암호화/해독, 화면 도우미
(function () {
  const TEAMS = ['음료제조 및 떡', '매니저'];
  // 떡기리 인재상 진단 결과(주도성·적응력·민첩성)를 900문항의 인재상 이름으로 연결
  const DDK_TRAITS = ['자기주도성', '적응력', '우선순위 판단'];
  const DDK_LABEL = { '자기주도성': '주도성', '적응력': '적응력', '우선순위 판단': '민첩성' };
  // 진단 결과에 있던 떡기리 대표 면접 질문
  const DDK_CUSTOM = [
    '시키지 않았지만 먼저 개선한 경험이 있나요? 어떻게 했는지 알려 주세요.',
    '예상하지 못한 변화에 적응했던 경험을 알려 주세요.',
    '여러 일이 한꺼번에 몰렸을 때 어떤 순서로 처리했나요?',
  ];
  const LIMITS = { traits: 3, base: 10, custom: 20, customLen: 500, answer: 5000 };

  function toB64Url(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64Url(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  // 설문 묶음 → 실제 질문 목록. 문제가 있으면 null
  function expandSurvey(s) {
    if (!s || s.v !== 1 || !TEAMS.includes(s.team)) return null;
    if (!Array.isArray(s.base) || s.base.length !== LIMITS.base) return null;
    const custom = Array.isArray(s.custom) ? s.custom : [];
    if (custom.length > LIMITS.custom) return null;
    const seen = new Set();
    const out = [];
    for (const pair of s.base) {
      if (!Array.isArray(pair)) return null;
      const [t, q] = pair;
      const trait = window.TRAITS[t];
      if (!trait || typeof q !== 'number' || !trait.questions[q]) return null;
      const k = t + ':' + q;
      if (seen.has(k)) return null;
      seen.add(k);
      out.push({ kind: 'base', trait: trait.name, question: trait.questions[q] });
    }
    for (const c of custom) {
      const text = String(c || '').trim();
      if (!text || text.length > LIMITS.customLen) return null;
      out.push({ kind: 'custom', trait: '', question: text });
    }
    return { team: s.team, questions: out };
  }

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : String(kid));
    return n;
  }

  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = el('div', { id: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // 저장 공간이 막힌 브라우저에서도 멈추지 않게
  const store = (kind) => ({
    get(k) { try { return JSON.parse(window[kind].getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { window[kind].setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { window[kind].removeItem(k); } catch (e) { /* 무시 */ } },
  });

  window.HIRE = {
    TEAMS, DDK_TRAITS, DDK_LABEL, DDK_CUSTOM, LIMITS,
    toB64Url, fromB64Url, expandSurvey, el, toast, uuid,
    local: store('localStorage'), session: store('sessionStorage'),
  };
})();
