// 사장님 화면: 인재상·질문 고르기 → 미리보기 → 설문 링크 만들기
(function () {
  const { TEAMS, DDK_TRAITS, DDK_LABEL, DDK_CUSTOM, LIMITS, el, toast } = window.HIRE;
  const TRAITS = window.TRAITS;
  const KEY = 'ddk-hire-builder-v1';
  const $ = (id) => document.getElementById(id);
  const KIND = (q) => (q < 10 ? '실제 경험' : q < 20 ? '상황 대응' : '업무 태도');

  const fresh = () => ({
    team: '',
    traits: DDK_TRAITS.map((n) => TRAITS.findIndex((t) => t.name === n)).filter((i) => i >= 0),
    base: [], // [인재상 번호, 질문 번호]
    custom: DDK_CUSTOM.slice(),
  });
  let st = window.HIRE.local.get(KEY) || fresh();
  if (!TEAMS.includes(st.team)) st.team = ''; // 채용팀 이름이 바뀌었을 때 예전 값 버리기
  let lastLink = '';

  const save = () => window.HIRE.local.set(KEY, st);
  const hasBase = (t, q) => st.base.some(([a, b]) => a === t && b === q);

  // ---------- 0. 채용팀 ----------
  TEAMS.forEach((t) => $('team').append(el('option', { value: t }, t)));
  $('team').value = st.team;
  $('team').addEventListener('change', (e) => { st.team = e.target.value; changed(); });

  // ---------- 1. 인재상 ----------
  function renderChips() {
    const box = $('chips');
    box.replaceChildren();
    TRAITS.forEach((t, i) => {
      const on = st.traits.includes(i);
      const ddk = DDK_TRAITS.includes(t.name);
      box.append(el('button', {
        type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false',
        title: ddk ? `떡기리 인재상 '${DDK_LABEL[t.name]}'` : '',
        onclick: () => toggleTrait(i),
      }, t.name, ddk ? el('span', { class: 'ddk' }, '떡기리') : null));
    });
    $('traitCount').textContent = `${st.traits.length} / ${LIMITS.traits}`;
    $('traitCount').classList.toggle('full', st.traits.length === LIMITS.traits);
  }

  function toggleTrait(i) {
    if (st.traits.includes(i)) {
      const lost = st.base.filter(([t]) => t === i).length;
      st.traits = st.traits.filter((x) => x !== i);
      st.base = st.base.filter(([t]) => t !== i);
      if (lost) toast(`${TRAITS[i].name}에서 고른 질문 ${lost}개도 빠졌어요`);
    } else {
      if (st.traits.length >= LIMITS.traits) return toast('인재상은 3개까지 고를 수 있어요');
      st.traits.push(i);
      changed();
      const g = document.querySelector(`[data-trait="${i}"]`);
      if (g) { g.open = true; g.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      toast(`아래 '2. 질문 선택'에서 ${TRAITS[i].name} 질문을 골라 주세요`);
      return;
    }
    changed();
  }

  // ---------- 2. 질문 ----------
  const openState = {};
  function renderGroups() {
    const box = $('groups');
    box.replaceChildren();
    if (!st.traits.length) {
      box.append(el('div', { class: 'empty' }, '인재상을 먼저 골라 주세요. 고르면 그 인재상의 질문 30개가 여기에 바로 나와요.'));
    }
    const full = st.base.length >= LIMITS.base;
    st.traits.forEach((ti) => {
      const t = TRAITS[ti];
      const picked = st.base.filter(([a]) => a === ti).length;
      const list = el('div', { class: 'qlist' });
      t.questions.forEach((q, qi) => {
        const on = hasBase(ti, qi);
        const dis = !on && full;
        list.append(el('label', { class: 'qitem' + (dis ? ' dis' : '') },
          el('input', { type: 'checkbox', checked: on, disabled: dis, onchange: () => toggleQ(ti, qi) }),
          el('span', {}, el('span', { class: 'kind' }, `${KIND(qi)} · 질문 ${qi + 1}번`), q)));
      });
      const det = el('details', { class: 'qgroup', 'data-trait': ti, open: openState[ti] !== false },
        el('summary', {}, el('span', {}, `${t.name} 질문 30개`, picked ? ` · ${picked}개 고름` : '')), list);
      det.addEventListener('toggle', () => { openState[ti] = det.open; });
      box.append(det);
    });
    $('baseCount').textContent = `${st.base.length} / ${LIMITS.base}`;
    $('baseCount').classList.toggle('full', full);
  }

  function toggleQ(t, q) {
    if (hasBase(t, q)) st.base = st.base.filter(([a, b]) => !(a === t && b === q));
    else if (st.base.length < LIMITS.base) st.base.push([t, q]);
    else toast('기본 질문은 10개까지예요');
    const scroll = document.querySelector(`[data-trait="${t}"] .qlist`);
    const top = scroll ? scroll.scrollTop : 0;
    changed();
    const again = document.querySelector(`[data-trait="${t}"] .qlist`);
    if (again) again.scrollTop = top;
  }

  // ---------- 3. 직접 질문 ----------
  function renderCustom() {
    const ul = $('customList');
    ul.replaceChildren();
    st.custom.forEach((c, i) => {
      const ddk = DDK_CUSTOM.includes(c);
      ul.append(el('li', {},
        el('span', {}, ddk ? el('span', { class: 'tag' }, '떡기리') : null, c),
        el('button', { type: 'button', class: 'btn small danger', onclick: () => { st.custom.splice(i, 1); changed(); } }, '삭제')));
    });
    $('customCount').textContent = `${st.custom.length} / ${LIMITS.custom}`;
    $('customCount').classList.toggle('full', st.custom.length === LIMITS.custom);
    $('customAdd').disabled = st.custom.length >= LIMITS.custom;
  }
  $('customInput').addEventListener('input', (e) => { $('customLen').textContent = `${e.target.value.length} / 500`; });
  $('customAdd').addEventListener('click', () => {
    const v = $('customInput').value.trim();
    if (!v) return toast('질문 내용을 적어 주세요');
    if (v.length > LIMITS.customLen) return toast('질문은 500자까지예요');
    if (st.custom.length >= LIMITS.custom) return toast('직접 질문은 20개까지예요');
    if (st.custom.includes(v)) return toast('이미 들어 있는 질문이에요');
    st.custom.push(v);
    $('customInput').value = '';
    $('customLen').textContent = '0 / 500';
    changed();
  });
  $('customReset').addEventListener('click', () => {
    let n = 0;
    DDK_CUSTOM.forEach((c) => { if (!st.custom.includes(c) && st.custom.length < LIMITS.custom) { st.custom.push(c); n++; } });
    toast(n ? `떡기리 대표 질문 ${n}개를 넣었어요` : '이미 다 들어 있어요');
    changed();
  });

  // ---------- 미리보기 ----------
  function surveyObj() {
    return { v: 1, team: st.team, base: st.base.map((p) => p.slice()), custom: st.custom.slice() };
  }
  function renderPreview() {
    const paper = $('paper');
    paper.replaceChildren(
      el('p', { class: 'eyebrow' }, 'DDEOKGIRI RECRUIT'),
      el('h3', {}, '떡기리 신규 채용 설문지'),
      el('p', { class: 'meta' }, (st.team ? `지원 분야: ${st.team} · ` : ''), '정답은 없어요. 본인의 경험과 생각을 편하게 적어 주세요.'));
    const total = st.base.length + st.custom.length;
    if (!total) paper.append(el('div', { class: 'empty' }, '질문을 고르면 설문지가 완성돼요.'));
    let n = 0;
    st.base.forEach(([t, q]) => {
      n++;
      paper.append(el('div', { class: 'pq' }, el('span', { class: 'lbl' }, TRAITS[t].name),
        el('p', {}, `${n}. ${TRAITS[t].questions[q]}`), el('textarea', { disabled: true, placeholder: '답변을 입력해 주세요' })));
    });
    st.custom.forEach((c) => {
      n++;
      paper.append(el('div', { class: 'pq' }, el('span', { class: 'lbl' }, '떡기리 질문'),
        el('p', {}, `${n}. ${c}`), el('textarea', { disabled: true, placeholder: '답변을 입력해 주세요' })));
    });
    $('pvCount').textContent = `${total}개 문항`;

    const need = [];
    if (!st.team) need.push('채용팀을 골라 주세요');
    if (st.base.length !== LIMITS.base) need.push(`기본 질문을 ${LIMITS.base - st.base.length}개 더 골라 주세요`);
    $('makeLink').disabled = need.length > 0;
    $('linkHint').textContent = need.length ? need.join(' · ') : '준비 완료! 링크를 만들어 지원자에게 카톡으로 보내 주세요.';
    $('linkHint').classList.toggle('warn', need.length > 0);

    // 고른 내용이 바뀌면 예전 링크는 숨긴다(다른 설문이 되므로)
    const now = JSON.stringify(surveyObj());
    if (lastLink && lastLink !== now) { $('linkBox').classList.remove('show'); lastLink = ''; }
  }

  $('makeLink').addEventListener('click', () => {
    const s = surveyObj();
    if (!window.HIRE.expandSurvey(s)) return toast('설문 내용을 다시 확인해 주세요');
    const url = new URL('apply.html', location.href);
    url.hash = 's=' + window.HIRE.toB64Url(s);
    $('linkOut').value = url.href;
    $('openLink').href = url.href;
    $('linkBox').classList.add('show');
    lastLink = JSON.stringify(s);
  });
  $('copyLink').addEventListener('click', async () => {
    const v = $('linkOut').value;
    try { await navigator.clipboard.writeText(v); toast('링크를 복사했어요. 카톡에 붙여 넣어 보내 주세요'); }
    catch (e) { $('linkOut').select(); document.execCommand('copy'); toast('링크를 복사했어요'); }
  });

  function changed() { save(); renderChips(); renderGroups(); renderCustom(); renderPreview(); }
  if (!window.HIRE.local.set(KEY + '-test', 1)) toast('이 브라우저에서는 고른 내용이 저장되지 않아요');
  changed();
})();
