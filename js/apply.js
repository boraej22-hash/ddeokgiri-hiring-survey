// 지원자 화면: 링크 속 설문을 펼쳐 답을 받고 Supabase(hire_submit)로 보낸다
(function () {
  const { el, LIMITS, session } = window.HIRE;
  const cfg = window.HIRE_CONFIG || {};
  const app = document.getElementById('app');
  const code = new URLSearchParams(location.hash.slice(1)).get('s') || '';

  let survey = null;
  try { survey = window.HIRE.expandSurvey(window.HIRE.fromB64Url(code)); } catch (e) { survey = null; }
  if (!survey) {
    app.replaceChildren(el('div', { class: 'card done' },
      el('div', { class: 'big' }, '🔗'), el('h2', {}, '설문 링크가 올바르지 않아요'),
      el('p', { class: 'hint' }, '받은 링크 전체를 다시 눌러 주세요. 계속 안 되면 매장에 문의해 주세요.')));
    return;
  }

  const DRAFT = 'ddk-hire-draft-' + code.slice(-40);
  const draft = session.get(DRAFT) || { id: window.HIRE.uuid(), name: '', birth: '', phone: '', answers: {} };
  const keep = () => session.set(DRAFT, draft);
  keep();

  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
  const errs = {};
  const errBox = (k) => (errs[k] = el('p', { class: 'err', id: 'err-' + k }));

  const name = el('input', { type: 'text', id: 'f-name', maxlength: 60, autocomplete: 'name', value: draft.name });
  const birth = el('input', { type: 'date', id: 'f-birth', max: today, min: '1900-01-02', value: draft.birth });
  const phone = el('input', { type: 'tel', id: 'f-phone', maxlength: 25, autocomplete: 'tel', placeholder: '010-1234-5678', value: draft.phone });
  name.addEventListener('input', () => { draft.name = name.value; keep(); });
  birth.addEventListener('input', () => { draft.birth = birth.value; keep(); });
  phone.addEventListener('input', () => { draft.phone = phone.value; keep(); });

  const boxes = survey.questions.map((q, i) => {
    const ta = el('textarea', { id: 'q-' + i, maxlength: LIMITS.answer, placeholder: '답변을 입력해 주세요' });
    ta.value = draft.answers[i] || '';
    const cc = el('div', { class: 'charcount' }, `${ta.value.length} / 5,000`);
    ta.addEventListener('input', () => { draft.answers[i] = ta.value; keep(); cc.textContent = `${ta.value.length.toLocaleString()} / 5,000`; });
    return { q, ta, cc };
  });

  const submit = el('button', { class: 'btn primary', type: 'submit', style: 'width:100%;padding:14px;font-size:16px' }, '제출하기');
  const status = el('p', { class: 'status', role: 'alert' });

  const form = el('form', { class: 'stack', novalidate: true, onsubmit: onSubmit },
    el('section', { class: 'card' },
      el('p', { class: 'eyebrow' }, 'DDEOKGIRI RECRUIT'),
      el('h1', { style: 'margin:4px 0;font-size:24px' }, '떡기리 신규 채용 설문지'),
      el('p', { class: 'hint', style: 'font-size:14px' }, `지원 분야: ${survey.team}`),
      el('p', { class: 'hint', style: 'font-size:14px' }, '정답은 없어요. 본인의 경험과 생각을 편하게 적어 주세요. 외식업 경험이 없다면 학교·아르바이트·동아리 등 비슷한 경험으로 답해도 괜찮아요.')),
    el('section', { class: 'card' },
      el('h2', { style: 'margin:0 0 12px;font-size:17px' }, '지원자 정보'),
      el('label', { class: 'field req', for: 'f-name' }, '이름'), name, errBox('name'),
      el('div', { class: 'grid2', style: 'margin-top:12px' },
        el('div', {}, el('label', { class: 'field req', for: 'f-birth' }, '생년월일'), birth, errBox('birth')),
        el('div', {}, el('label', { class: 'field req', for: 'f-phone' }, '전화번호'), phone, errBox('phone')))),
    el('section', { class: 'card' },
      el('h2', { style: 'margin:0;font-size:17px' }, `질문 (${boxes.length}개)`),
      el('p', { class: 'hint' }, '모든 질문에 답해 주세요. 쓰는 중인 답은 이 창을 닫기 전까지 자동으로 보관돼요.'),
      boxes.map(({ q, ta, cc }, i) => el('div', { class: 'pq' },
        el('label', { for: 'q-' + i }, el('span', { class: 'lbl' }, q.kind === 'base' ? q.trait : '떡기리 질문'), el('p', {}, `${i + 1}. ${q.question}`)),
        ta, cc, errBox('q' + i)))),
    el('section', { class: 'card stack' },
      el('div', { class: 'notice' }, '제출하면 이름·생년월일·전화번호와 답변이 떡기리 채용 담당자가 확인할 수 있도록 저장돼요. 채용 확인 외의 목적으로는 쓰지 않아요.'),
      submit, status));
  app.replaceChildren(form);

  function check() {
    Object.values(errs).forEach((e) => (e.textContent = ''));
    let first = null;
    const bad = (k, msg, input) => { errs[k].textContent = msg; if (!first) first = input; };
    const n = name.value.trim();
    if (!n) bad('name', '이름을 적어 주세요.', name);
    else if (n.length > 60) bad('name', '이름은 60자까지예요.', name);
    const b = birth.value;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(b) ? new Date(b + 'T00:00:00Z') : null;
    if (!d || isNaN(d) || d.toISOString().slice(0, 10) !== b) bad('birth', '생년월일을 골라 주세요.', birth);
    else if (b > today) bad('birth', '생년월일은 오늘 이후일 수 없어요.', birth);
    else if (b <= '1900-01-01') bad('birth', '생년월일을 다시 확인해 주세요.', birth);
    const digits = phone.value.replace(/[\s()-]/g, '');
    if (!phone.value.trim()) bad('phone', '전화번호를 적어 주세요.', phone);
    else if (!/^\d{9,15}$/.test(digits) || phone.value.length > 25) bad('phone', '전화번호는 숫자 9~15자리로 적어 주세요. 예) 010-1234-5678', phone);
    boxes.forEach(({ ta }, i) => {
      if (!ta.value.trim()) bad('q' + i, '답변을 적어 주세요.', ta);
      else if (ta.value.length > LIMITS.answer) bad('q' + i, '답변은 5,000자까지예요.', ta);
    });
    if (first) { first.focus(); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return !first;
  }

  async function onSubmit(e) {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('warn');
    if (!check()) { status.textContent = '빠진 칸이 있어요. 빨간 글씨를 확인해 주세요.'; status.classList.add('warn'); return; }
    submit.disabled = true;
    submit.textContent = '보내는 중이에요…';
    const body = {
      p: {
        id: draft.id, team: survey.team, name: name.value.trim(), birth: birth.value, phone: phone.value.trim(),
        questions: boxes.map(({ q, ta }) => ({ kind: q.kind, trait: q.trait, question: q.question, answer: ta.value })),
      },
    };
    try {
      if (!cfg.url || !cfg.key) throw new Error('저장소 연결 설정이 없어요.');
      const res = await fetch(cfg.url + '/rest/v1/rpc/hire_submit', {
        method: 'POST',
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = '';
        try { msg = (await res.json()).message || ''; } catch (x) { /* 무시 */ }
        throw new Error(msg && /[가-힣]/.test(msg) ? msg : `저장하지 못했어요. (서버 응답 ${res.status})`);
      }
      session.del(DRAFT);
      app.replaceChildren(el('div', { class: 'card done' },
        el('div', { class: 'big' }, '✅'), el('h2', {}, '제출이 완료됐어요'),
        el('p', {}, '지원자 정보와 답변이 담당자에게 전달됐어요.'),
        el('p', { class: 'hint' }, '떡기리에 지원해 주셔서 고마워요.')));
      window.scrollTo(0, 0);
    } catch (err) {
      const offline = err instanceof TypeError;
      status.textContent = (offline ? '인터넷 연결을 확인한 뒤 다시 눌러 주세요.' : err.message) + ' 적은 내용은 그대로 있어요.';
      status.classList.add('warn');
      submit.disabled = false;
      submit.textContent = '다시 제출하기';
    }
  }
})();
