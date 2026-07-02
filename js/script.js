document.addEventListener('DOMContentLoaded', function () {
    // 비밀번호 보기/숨기기 토글
    const toggleBtn = document.getElementById('togglePw');
    const passwordInput = document.getElementById('password');

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function () {
            this.classList.toggle('active');
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.focus();
        });
    }
});

function go(id) {
    const current = document.querySelector('.screen.active');
    if (current) current.classList.remove('active');   // 있을 때만 떼기
    document.getElementById(id).classList.add('active');
}


/* ===== 초반 설문 → 화면 전환 시 뜨는 하단 시트 (02/03, 03/03) ===== */
function openSurveySheet(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
}
function closeSurveySheet(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
}
// 시트 닫고 다음 화면으로 이동
function surveyNext(sheetId, nextScreen) {
    closeSurveySheet(sheetId);
    go(nextScreen);
}


/* ===== AI 비서 설문 상담 ===== */

// 단일 선택 문항(Q1~Q3): 누르면 선택 이펙트 → 잠깐 뒤 다음 화면으로
function aiPick(el, nextId) {
    const group = el.parentElement;
    if (group.dataset.locked) return;          // 중복 클릭 방지
    group.dataset.locked = '1';

    group.querySelectorAll('.ai-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');

    setTimeout(() => {
        go(nextId);
        group.querySelectorAll('.ai-option').forEach(o => o.classList.remove('selected'));
        delete group.dataset.locked;           // 다시 들어와도 선택 가능하게
    }, 320);
}

// 다중 선택 문항(Q4 명소): 누를 때마다 선택 토글 (회전 그라데이션)
function aiToggle(el) {
    el.classList.toggle('selected');
}


/* ===== AI 비서 대화 (채팅) ===== */
(function () {
    const screen = document.getElementById('ai-chat');
    if (!screen) return;

    const AVATAR = 'img/ai-survey/ai-avatar.png';
    const scrollEl = screen.querySelector('#ai-chat-scroll');
    const listEl = screen.querySelector('#ai-chat-messages');
    const field = screen.querySelector('#ai-chat-field');
    const sendBtn = screen.querySelector('#ai-chat-send');

    let busy = false;   // AI가 답하는 동안 입력 잠금

    // 인삿말 / 추천 칩
    const GREETING = {
        parts: [{ type: 'text', value: '안녕하세요! 이코카 여행 비서예요 🐾\n오사카·도쿄 등 일본 여행이라면 무엇이든 편하게 물어보세요.' }],
        chips: ['오사카 3박 4일 코스 추천', '기념품 어디서 사?', '근처 맛집 알려줘']
    };

    // 설문 결과 진입 시 보여줄 맞춤 플랜
    const SURVEY_PLAN = {
        loading: '설문을 바탕으로 계획을 짜는 중입니다',
        parts: [
            { type: 'text', value: '설문 내용을 바탕으로 오사카 여행 플랜을 정리했어요!' },
            { type: 'list', ordered: true, items: [
                'Day 1 — 도착 후 도톤보리·신사이바시 야경과 먹방',
                'Day 2 — 오사카성 → 우메다 공중정원 → 한큐 쇼핑',
                'Day 3 — 유니버설 스튜디오 재팬 하루 코스',
                'Day 4 — 구로몬 시장 아침 → 기념품 쇼핑 후 출국'
            ] },
            { type: 'text', value: '마음에 드시나요? 일정 조정이나 맛집·교통편이 궁금하면 언제든 말씀해주세요.' }
        ]
    };

    // 키워드 기반 지식베이스 (여행 관련)
    const KB = [
        { match: ['기념품', '선물', '쇼핑', '사면', '면세', '돈키'], parts: [
            { type: 'text', value: '오사카 여행 기념품 구매처를 핵심만 요약해 드릴게요!' },
            { type: 'list', ordered: false, items: [
                '돈키호테: 과자, 동전파스, 화장품 등 가성비 종합 쇼핑',
                '드럭스토어: 의약품·뷰티 용품을 집중적으로 살 때 추천',
                '간사이공항 면세점: 로이스 초콜릿, 도쿄바나나 등 선물용 디저트와 주류',
                '우메다·난바 백화점: 명품 손수건 등 고급 브랜드'
            ] },
            { type: 'text', value: '주로 찾으시는 품목(과자·화장품·주류 등)이 있다면 더 자세히 안내해 드릴까요?' }
        ] },
        { match: ['맛집', '먹', '음식', '식당', '밥', '메뉴'], parts: [
            { type: 'text', value: '오사카는 먹방의 도시죠! 지역별 대표 맛집을 추천드려요.' },
            { type: 'list', ordered: false, items: [
                '도톤보리: 타코야키(아카오니), 오코노미야키(미즈노)',
                '난바: 쿠시카츠 다루마, 이치란 라멘 본점',
                '구로몬 시장: 신선한 해산물 구이·초밥',
                '우메다: 츠루통탄 우동, 백화점 디저트 골목'
            ] },
            { type: 'text', value: '예산이나 분위기(가성비/뷰 좋은 곳)를 알려주시면 더 콕 집어 드릴게요.' }
        ] },
        { match: ['코스', '일정', '계획', '며칠', '루트', '3박', '2박', '동선'], parts: [
            { type: 'text', value: '오사카 3박 4일 알찬 코스를 짜봤어요.' },
            { type: 'list', ordered: true, items: [
                'Day 1 — 도착 후 도톤보리·신사이바시 야경과 먹방',
                'Day 2 — 오사카성 → 우메다 공중정원 → 한큐 쇼핑',
                'Day 3 — 유니버설 스튜디오 재팬 하루 코스',
                'Day 4 — 구로몬 시장 아침 → 기념품 쇼핑 후 출국'
            ] },
            { type: 'text', value: '동선을 더 여유롭게 바꾸거나 교토 당일치기를 넣어드릴 수도 있어요!' }
        ] },
        { match: ['교통', '지하철', '전철', '이동', '패스', '버스', '열차', 'jr'], parts: [
            { type: 'text', value: '오사카 교통은 이렇게 준비하면 편해요.' },
            { type: 'list', ordered: false, items: [
                '오사카 메트로 1일권: 시내 관광에 가성비 최고',
                'ICOCA 카드: 충전식 교통카드, 편의점 결제도 가능',
                '간사이공항 ↔ 시내: 난카이 라피트 또는 JR 하루카',
                '교토·나라 당일치기: JR 간사이 미니 패스 추천'
            ] },
            { type: 'text', value: '출발 공항이나 숙소 위치를 알려주시면 최적 노선을 찾아드릴게요.' }
        ] },
        { match: ['날씨', '기온', '옷', '더워', '추워', '계절'], parts: [
            { type: 'text', value: '오사카는 한국과 기후가 비슷하지만 여름엔 더 덥고 습해요. 여행하실 시기를 알려주시면 옷차림까지 챙겨드릴게요! 참고로 6월은 장마철이라 우산을 꼭 챙기시는 걸 추천드려요 ☔' }
        ] },
        { match: ['환전', '엔화', '현금', '카드', '돈'], parts: [
            { type: 'text', value: '요즘 오사카는 카드·교통카드 결제가 잘 되지만, 소규모 식당이나 시장은 현금만 받는 곳도 많아요. 4박 기준 1인 3~5만 엔 정도 현금을 준비하고, 나머지는 트래블카드를 쓰시면 환율도 아끼고 편해요 💴' }
        ] },
        { match: ['안녕', '하이', '반가', 'ㅎㅇ', 'hello'], parts: [
            { type: 'text', value: '안녕하세요! 오늘도 즐거운 여행 준비 도와드릴게요 🐾 무엇이 궁금하신가요?' }
        ] }
    ];

    const FALLBACK = { parts: [
        { type: 'text', value: '여행 관련해서 조금만 더 구체적으로 알려주시면 도와드릴게요 🐾\n예: "오사카 3박 4일 코스", "기념품 어디서 사?", "근처 맛집 추천", "공항에서 시내 가는 법"처럼 물어보실 수 있어요.' }
    ] };

    function matchResponse(text) {
        const t = text.toLowerCase();
        for (const item of KB) {
            if (item.match.some(k => t.includes(k))) return item;
        }
        return FALLBACK;
    }

    function scrollToBottom() {
        scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    function makeAvatar() {
        const a = document.createElement('div');
        a.className = 'ai-avatar';
        a.innerHTML = '<img src="' + AVATAR + '" alt="이코카 비서">';
        return a;
    }

    // 사용자 말풍선
    function appendUser(text) {
        const row = document.createElement('div');
        row.className = 'ai-msg user';
        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble';
        bubble.textContent = text;
        row.appendChild(bubble);
        listEl.appendChild(row);
        scrollToBottom();
    }

    // 타이핑(로딩) 인디케이터
    function showTyping(label) {
        const row = document.createElement('div');
        row.className = 'ai-msg bot ai-typing';
        row.appendChild(makeAvatar());
        const bub = document.createElement('div');
        bub.className = 'ai-typing-bubble';
        bub.innerHTML = (label ? '<span class="ai-typing-label">' + label + '</span>' : '') +
            '<span class="ai-typing-dots"><span></span><span></span><span></span></span>';
        row.appendChild(bub);
        listEl.appendChild(row);
        scrollToBottom();
        return row;
    }

    // 텍스트 한 글자씩 스트리밍
    function streamText(el, text, done) {
        let i = 0;
        el.classList.add('is-typing');
        (function tick() {
            el.textContent = text.slice(0, i);
            scrollToBottom();
            if (i < text.length) {
                i++;
                setTimeout(tick, 16);
            } else {
                el.classList.remove('is-typing');
                if (done) done();
            }
        })();
    }

    function buildList(part) {
        const wrap = document.createElement('div');
        wrap.className = 'ai-bot-list';
        const list = document.createElement(part.ordered ? 'ol' : 'ul');
        part.items.forEach(it => {
            const li = document.createElement('li');
            li.textContent = it;
            list.appendChild(li);
        });
        wrap.appendChild(list);
        return wrap;
    }

    // AI 응답: parts를 순서대로 렌더 (텍스트는 스트리밍, 리스트는 페이드 인)
    function renderBot(resp, onComplete) {
        const row = document.createElement('div');
        row.className = 'ai-msg bot';
        row.appendChild(makeAvatar());
        const content = document.createElement('div');
        content.className = 'ai-bot-content';
        row.appendChild(content);
        listEl.appendChild(row);
        scrollToBottom();

        const parts = resp.parts.slice();
        (function next() {
            if (!parts.length) {
                if (resp.chips) appendChips(resp.chips);
                if (onComplete) onComplete();
                return;
            }
            const part = parts.shift();
            if (part.type === 'text') {
                const p = document.createElement('p');
                p.className = 'ai-bot-text';
                content.appendChild(p);
                streamText(p, part.value, () => setTimeout(next, 120));
            } else if (part.type === 'list') {
                content.appendChild(buildList(part));
                scrollToBottom();
                setTimeout(next, 220);
            }
        })();
    }

    // 추천 질문 칩
    function appendChips(chips) {
        const wrap = document.createElement('div');
        wrap.className = 'ai-chat-chips';
        chips.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'ai-chat-chip';
            b.textContent = c;
            b.addEventListener('click', () => {
                if (busy) return;
                wrap.remove();
                handleSend(c);
            });
            wrap.appendChild(b);
        });
        listEl.appendChild(wrap);
        scrollToBottom();
    }

    // 메시지 전송 → 타이핑 → 응답
    function handleSend(text) {
        if (busy) return;
        const msg = (text != null ? text : field.value).trim();
        if (!msg) return;
        busy = true;
        appendUser(msg);
        field.value = '';
        updateSendState();

        const typing = showTyping();
        const resp = matchResponse(msg);
        setTimeout(() => {
            typing.remove();
            renderBot(resp, () => { busy = false; });
        }, 650 + Math.random() * 500);
    }

    function updateSendState() {
        sendBtn.classList.toggle('active', field.value.trim().length > 0);
    }

    field.addEventListener('input', updateSendState);
    field.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); handleSend(); }
    });
    sendBtn.addEventListener('click', () => handleSend());

    // 외부에서 채팅 열기 (자율 대화='free' / 설문 결과='survey')
    window.openAiChat = function (mode) {
        go('ai-chat');
        listEl.innerHTML = '';
        field.value = '';
        updateSendState();
        busy = true;

        if (mode === 'survey') {
            const typing = showTyping(SURVEY_PLAN.loading);
            setTimeout(() => {
                typing.remove();
                renderBot(SURVEY_PLAN, () => { busy = false; });
            }, 1700);
        } else {
            const typing = showTyping();
            setTimeout(() => {
                typing.remove();
                renderBot(GREETING, () => { busy = false; });
            }, 600);
        }
        setTimeout(() => field.focus(), 100);
    };
})();

// splash가 2초 보였다가 자동으로 login으로
setTimeout(() => {
    go('login');
}, 2000);


const choiceWraps = document.querySelectorAll('.ai-choice-wrap');
const nextBtn = document.querySelector('#survey .btn');


choiceWraps.forEach(wrap => {
    wrap.addEventListener('click', function () {
        // 같은 화면(.screen) 안의 카드들만 selected 정리
        const screen = this.closest('.screen');
        screen.querySelectorAll('.ai-choice-wrap').forEach(w => w.classList.remove('selected'));
        this.classList.add('selected');

        // 같은 화면 안의 버튼을 찾아서 풀기
        const btn = screen.querySelector('.btn');
        if (btn) btn.disabled = false;
    });
});


/*칩 그룹 선택*/

// 동반자 그룹: 단일 선택
document.querySelectorAll('#tag-survey .Question-1 .tag').forEach(tag => {
    tag.addEventListener('click', function () {
        // 같은 그룹에서 다 떼고 나만 켜기
        this.closest('.tag-wrap').querySelectorAll('.tag').forEach(t => t.classList.remove('selected'));
        this.classList.add('selected');
        checkTagSurvey();
    });
});

// 테마 그룹: 다중 선택
document.querySelectorAll('#tag-survey .Question-2 .tag').forEach(tag => {
    tag.addEventListener('click', function () {
        this.classList.toggle('selected');   // 나만 on/off
        checkTagSurvey();
    });
});

// 버튼 활성화 조건 체크
function checkTagSurvey() {
    const q1 = document.querySelector('#tag-survey .Question-1 .tag.selected');
    const q2 = document.querySelector('#tag-survey .Question-2 .tag.selected');
    const btn = document.querySelector('#tag-survey .btn');
    btn.disabled = !(q1 && q2);   // 양쪽 그룹 다 하나 이상 골라야 활성화
}

const mapEl = document.getElementById('map');
if (mapEl) {
    const map = L.map('map').setView([34.6937, 135.5023], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

document.addEventListener('DOMContentLoaded', () => {
    const mapImg = document.querySelector('.map-img');
    const pins = mapImg.querySelectorAll('.number-pin');
    const card = mapImg.querySelector('.pin-line-wrap');

    // 핀 2번 = 인덱스 1 (0부터 셈)
    const targetPin = pins[1];

    // 핀 클릭 → 카드 토글
    targetPin.addEventListener('click', (e) => {
        e.stopPropagation();              // 바깥 클릭으로 안 새게 막기
        card.classList.toggle('show');
        targetPin.classList.toggle('active');
    });

    // 카드 내부 클릭은 닫힘 방지
    card.addEventListener('click', (e) => e.stopPropagation());

    // 카드 바깥(지도 다른 곳 등) 클릭 시 닫기
    document.addEventListener('click', () => {
        card.classList.remove('show');
        targetPin.classList.remove('active');
    });
});


// 지도 화면: 칩으로 루트 모드 ↔ 관광지 모드 전환
// (화면 스코프 관습: .map-and-pin / 칩바 단위로만 동작)
document.querySelectorAll('.map-and-pin .search-chips').forEach(chipBar => {
    const mapWrap = chipBar.closest('.map-and-pin');

    chipBar.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', function () {
            // 같은 칩바 안에서 단일 선택
            chipBar.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
            this.classList.add('is-active');

            // '관광지' 칩이면 관광지 모드 ON, 나머지 칩이면 루트 모드로 복귀
            mapWrap.classList.toggle('is-tourist-mode', this.dataset.chip === 'tourist');
        });
    });
});


// 지도 화면: 관광지 핀/추천 리스트 → 상세 팝업 (데이터는 한 곳에서 관리)
const spotData = {
    osaka: {
        img: 'img/main-scrin/social/osaka-castle-bg.png',
        title: '오오사카 성',
        sub: '일본의 역사 관광지',
        desc: '오사카 성은 일본 오사카의 핵심 랜드마크로서, 도요토미 히데요시가 세운 성곽과 천수각의 위용을 직접 느낄 수 있는 대표 명소입니다.'
    },
    dotonbori: {
        img: 'img/main-scrin/social/dotonbori-bg.png',
        title: '도톤보리',
        sub: '오사카 대표 먹자골목·야경',
        desc: '글리코 간판과 운하를 따라 먹거리가 늘어선 오사카 최대 번화가. 밤이 되면 화려한 네온사인으로 또 다른 매력을 보여주는 곳입니다.'
    },
    kuromon: {
        img: 'img/main-scrin/social/kuromon-market-bg.png',
        title: '구로몬 시장',
        sub: '신선한 해산물·길거리 음식',
        desc: "'오사카의 부엌'으로 불리는 전통 시장. 갓 잡은 해산물 구이부터 제철 과일까지 현장에서 바로 맛볼 수 있는 미식 명소입니다."
    }
};

document.querySelectorAll('.map-and-pin').forEach(mapWrap => {
    const popup = mapWrap.querySelector('.spot-popup');
    if (!popup) return;

    const imgEl = popup.querySelector('.spot-popup-img');
    const titleEl = popup.querySelector('.spot-popup-title');
    const subEl = popup.querySelector('.spot-popup-sub');
    const descEl = popup.querySelector('.spot-popup-desc');

    function openSpot(key, pinEl) {
        const d = spotData[key];
        if (!d) return;
        imgEl.src = d.img;
        imgEl.alt = d.title;
        titleEl.textContent = d.title;
        subEl.textContent = d.sub;
        descEl.textContent = d.desc;

        // 선택 핀 강조
        mapWrap.querySelectorAll('.spot-pin.active').forEach(p => p.classList.remove('active'));
        if (pinEl) pinEl.classList.add('active');
        popup.classList.add('show');
    }
    function closeSpot() {
        popup.classList.remove('show');
        mapWrap.querySelectorAll('.spot-pin.active').forEach(p => p.classList.remove('active'));
    }

    // 이미지 핀 탭
    mapWrap.querySelectorAll('.spot-pin').forEach(pin => {
        pin.addEventListener('click', e => {
            e.stopPropagation();              // 바깥 클릭 닫힘 방지
            openSpot(pin.dataset.spot, pin);
        });
    });

    // 추천 리스트 항목 탭 → 같은 팝업 + 해당 핀 강조
    mapWrap.querySelectorAll('.spot-list li').forEach(li => {
        li.addEventListener('click', e => {
            e.stopPropagation();
            const pin = mapWrap.querySelector('.spot-pin[data-spot="' + li.dataset.spot + '"]');
            openSpot(li.dataset.spot, pin);
        });
    });

    // 팝업 내부 클릭은 닫힘 방지, 바깥 클릭(지도 다른 곳/칩 등)은 닫기
    popup.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeSpot);
});


// 전체 지도 화면: 드래그 3단 시트 + 장소 상세
(function () {
    const screen = document.getElementById('map-full');
    if (!screen) return;

    const sheet = screen.querySelector('.map-sheet');
    const grabber = screen.querySelector('.map-sheet-grabber');
    const STATES = ['peek', 'mid', 'full'];
    const HEIGHTS = { peek: 132, mid: 420, full: 760 };
    const setState = s => { sheet.dataset.state = s; };

    /* --- 시트 드래그 (그래버를 잡고 위/아래) --- */
    let dragging = false, startY = 0, startH = 0, moved = false;

    function pointY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

    function onDown(e) {
        dragging = true; moved = false;
        startY = pointY(e);
        startH = sheet.getBoundingClientRect().height;
        sheet.classList.add('dragging');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }
    function onMove(e) {
        if (!dragging) return;
        const dy = startY - pointY(e);          // 위로 끌면 +
        if (Math.abs(dy) > 6) moved = true;
        let h = Math.max(100, Math.min(800, startH + dy));
        sheet.style.height = h + 'px';
        if (e.cancelable) e.preventDefault();
    }
    function onUp() {
        if (!dragging) return;
        dragging = false;
        const cur = sheet.getBoundingClientRect().height;   // 인라인 높이 지우기 전에 먼저 측정
        sheet.classList.remove('dragging');
        if (!moved) {
            // 탭 → 다음 단계로 순환
            const i = STATES.indexOf(sheet.dataset.state || 'mid');
            setState(STATES[(i + 1) % STATES.length]);
        } else {
            // 드래그 → 가장 가까운 스냅 지점
            let best = 'mid', bd = Infinity;
            STATES.forEach(s => { const d = Math.abs(HEIGHTS[s] - cur); if (d < bd) { bd = d; best = s; } });
            setState(best);
        }
        sheet.style.height = '';                             // 스냅 높이로 부드럽게 전환
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
    }
    grabber.addEventListener('mousedown', onDown);
    grabber.addEventListener('touchstart', onDown, { passive: true });

    /* --- 장소 데이터 + 상세 시트 --- */
    const places = {
        osaka:     { name: '오사카 성',   rating: '4.7', cat: '명소 · 사적',     walk: '18분', open: '영업 중',   closed: false, hours: '09:00 - 17:00', addr: '오사카 주오구 오사카성 1-1',    phone: '+81 6-6941-3044' },
        dotonbori: { name: '도톤보리',     rating: '4.6', cat: '관광 명소 · 거리', walk: '12분', open: '영업 중',   closed: false, hours: '00:00 - 24:00', addr: '오사카 주오구 도톤보리 1',      phone: '+81 6-6211-4542' },
        kuromon:   { name: '구로몬 시장',  rating: '4.4', cat: '시장 · 먹거리',   walk: '9분',  open: '영업 종료', closed: true,  hours: '09:00 - 18:00', addr: '오사카 주오구 닛폰바시 2-4-1',  phone: '+81 6-6631-0007' },
        hotel:     { name: '예약한 숙소',  rating: '',    cat: '호텔',            walk: '12분', open: '체크인 15:00', closed: false, hours: '체크인 15:00 / 체크아웃 11:00', addr: '오사카 기타구 우메다 3-1', phone: '+81 6-0000-0000' }
    };

    function q(sel) { return screen.querySelector(sel); }

    function openDetail(key) {
        const p = places[key];
        if (!p) return;
        q('.mf-d-name').textContent = p.name;
        q('.mf-d-sub').innerHTML = (p.rating ? '<span class="mf-d-rating">★ ' + p.rating + '</span> · ' : '') + '<span class="mf-d-cat">' + p.cat + '</span>';
        q('.mf-d-walk').textContent = p.walk;
        const openEl = q('.mf-d-open');
        openEl.textContent = p.open;
        openEl.classList.toggle('is-closed', !!p.closed);
        q('.mf-d-hours').textContent = p.hours;
        q('.mf-d-addr').textContent = p.addr;
        q('.mf-d-phone').textContent = p.phone;

        // 지도 핀 강조
        screen.querySelectorAll('.mf-marker').forEach(m => m.classList.toggle('is-active', m.dataset.place === key));

        sheet.classList.add('show-detail');
        if (sheet.dataset.state === 'peek') setState('mid');
        sheet.querySelector('.sheet-detail').scrollTop = 0;
    }
    function closeDetail() {
        sheet.classList.remove('show-detail');
        screen.querySelectorAll('.mf-marker.is-active').forEach(m => m.classList.remove('is-active'));
    }

    // 마커 탭 → 상세 (+ 시트 펼치기)
    screen.querySelectorAll('.mf-marker').forEach(m => {
        m.addEventListener('click', () => openDetail(m.dataset.place));
    });
    // 추천/최근 등 data-place 항목 탭 → 상세
    screen.querySelectorAll('[data-place]').forEach(el => {
        if (el.classList.contains('mf-marker')) return;
        el.addEventListener('click', () => openDetail(el.dataset.place));
    });
    q('.mf-detail-close').addEventListener('click', closeDetail);

    setState('mid');
})();


// 오늘 일정: Day 전환 + 오늘(Day-2) 강조 + 클릭 시 현재 진행 일정으로 이동
(function () {
    const screen = document.getElementById('today-schedule');
    if (!screen) return;

    const tabsEl = screen.querySelector('.day-tabs');
    const timelineEl = screen.querySelector('.timeline');
    const scrollEl = screen.querySelector('.today-scroll');

    const TODAY = 2;       // Day-2가 '오늘'
    const TOTAL = 3;
    let currentDay = TODAY;

    // 아이콘 (CSS가 currentColor로 카드 상태에 맞춰 색을 입힘)
    const icoKebab = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';
    const icoPin = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 21S19 14.5 19 9.5C19 5.63 15.87 2.5 12 2.5C8.13 2.5 5 5.63 5 9.5C5 14.5 12 21 12 21Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.2" stroke="currentColor" stroke-width="1.6"/></svg>';
    const icoUsers = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 11a3 3 0 0 0 0-6M17.5 14.2c2.2.4 3.5 2.2 3.5 4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const chevL = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 19L8 12L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const chevR = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const todayTag = '<em class="day-today-tag">오늘</em>';

    // 일자별 일정 데이터 (Day-1·Day-3는 데모용 placeholder)
    const dayData = {
        1: [
            { start: '09:00', end: '11:30', title: '간사이공항 도착', sub: '입국 수속 및 짐 찾기', place: '간사이 국제공항', people: '동행인 2명' },
            { start: '12:00', end: '13:30', title: '점심 식사', sub: '공항 근처 우동 맛집', place: '린쿠타운', people: '동행인 2명', variant: 'meal' },
            { start: '15:00', end: '17:00', title: '호텔 체크인', sub: '짐 풀고 잠시 휴식', place: '오사카 호텔', people: '동행인 2명' },
            { start: '18:30', end: '20:00', title: '저녁 식사', sub: '도톤보리 거리 먹방', place: '도톤보리', people: '동행인 2명', variant: 'meal' },
            { start: '20:30', end: '22:00', title: '야경 산책', sub: '도톤보리 운하 야경 감상', place: '도톤보리', people: '동행인 2명' }
        ],
        2: [
            { start: '11:30', end: '12:20', title: '신칸센 탑승', sub: '마쓰야마 이동을 위해 신칸센 탑승', place: '도쿄 162-11', people: '동행인 2명', variant: 'now' },
            { start: '12:20', end: '14:40', title: '신칸센 이동중', sub: '신칸센에서 오벤토 먹기', place: '신칸센 좌석', people: '동행인 2명' },
            { start: '14:00', end: '19:30', title: '마쓰야마 체크인', sub: '여권 미리 준비해놓고 체크인', place: '마쓰야마 222-87', people: '동행인 2명' },
            { start: '20:00', end: '21:30', title: '저녁 식사', sub: '현지 맛집에서 특선 요리 즐기기', place: '마쓰야마 중심가', people: '동행인 2명', variant: 'meal' },
            { start: '22:00', end: '23:00', title: '야경 산책', sub: '마쓰야마 성 주변 야경 감상', place: '마쓰야마 성', people: '동행인 2명' },
            { start: '23:30', end: '07:00', title: '휴식', sub: '호텔에서 휴식 및 숙면', place: '마쓰야마 호텔 301호', people: '동행인 2명' }
        ],
        3: [
            { start: '08:00', end: '09:00', title: '조식', sub: '호텔 조식 뷔페', place: '마쓰야마 호텔', people: '동행인 2명', variant: 'meal' },
            { start: '10:00', end: '12:00', title: '마쓰야마 성 관광', sub: '천수각과 정원 둘러보기', place: '마쓰야마 성', people: '동행인 2명' },
            { start: '12:30', end: '14:00', title: '점심 식사', sub: '향토 요리로 마지막 식사', place: '마쓰야마 중심가', people: '동행인 2명', variant: 'meal' },
            { start: '15:00', end: '17:00', title: '기념품 쇼핑', sub: '공항 가기 전 마지막 쇼핑', place: '마쓰야마 시내', people: '동행인 2명' },
            { start: '18:00', end: '20:00', title: '귀국', sub: '간사이공항에서 귀국', place: '간사이 국제공항', people: '동행인 2명' }
        ]
    };

    function rowHTML(it) {
        const v = it.variant ? ' is-' + it.variant : '';
        return '<li class="tl-row' + v + '">' +
            '<div class="tl-time"><span class="tl-start">' + it.start + '</span><span class="tl-end">' + it.end + '</span></div>' +
            '<div class="tl-line"><span class="tl-dot"></span></div>' +
            '<div class="tl-card' + v + '">' +
                '<div class="tl-card-head">' +
                    '<div class="tl-card-title"><h3>' + it.title + '</h3>' +
                        '<button type="button" class="tl-kebab" aria-label="더보기">' + icoKebab + '</button></div>' +
                    '<p class="tl-sub">' + it.sub + '</p>' +
                '</div>' +
                '<div class="tl-meta">' +
                    '<div class="tl-meta-row"><span class="tl-ico">' + icoPin + '</span><span>' + it.place + '</span></div>' +
                    '<div class="tl-meta-row"><span class="tl-ico">' + icoUsers + '</span><span>' + it.people + '</span></div>' +
                '</div>' +
            '</div></li>';
    }

    function renderTimeline(day) {
        timelineEl.innerHTML = dayData[day].map(rowHTML).join('');
    }

    function sideBtn(day, dir) {
        const t = day === TODAY ? ' is-today' : '';
        const tag = day === TODAY ? todayTag : '';
        const label = '<span>Day-' + day + '</span>';
        const inner = dir === 'prev' ? (chevL + label + tag) : (tag + label + chevR);
        return '<button type="button" class="day-tab-side day-step' + t + '" data-day="' + day + '">' + inner + '</button>';
    }

    function renderTabs() {
        const prev = currentDay > 1 ? currentDay - 1 : null;
        const next = currentDay < TOTAL ? currentDay + 1 : null;
        const t = currentDay === TODAY ? ' is-today' : '';
        const tag = currentDay === TODAY ? todayTag : '';
        tabsEl.innerHTML =
            (prev ? sideBtn(prev, 'prev') : '<span class="day-tab-side day-empty"></span>') +
            '<button type="button" class="day-tab-now' + t + '" data-day="' + currentDay + '">' + tag + '<span>Day-' + currentDay + '</span></button>' +
            (next ? sideBtn(next, 'next') : '<span class="day-tab-side day-empty"></span>');
    }

    function selectDay(day, scrollToNow) {
        currentDay = day;
        renderTabs();
        renderTimeline(day);
        if (scrollToNow) {
            const now = timelineEl.querySelector('.tl-row.is-now');
            if (now) { now.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        }
        scrollEl.scrollTop = 0;
    }

    // 탭 클릭(위임): 다른 날이면 그 날로, 오늘(Day-2)이면 현재 진행 일정으로 스크롤
    tabsEl.addEventListener('click', e => {
        const el = e.target.closest('[data-day]');
        if (!el) return;
        const d = +el.dataset.day;
        selectDay(d, d === TODAY);
    });

    // --- 일정 등록 모달 (FAB로 열기, 생성 시 현재 날짜 타임라인에 추가) ---
    const fab = screen.querySelector('.today-fab');
    const modal = screen.querySelector('.add-modal');
    if (fab && modal) {
        const backdrop = modal.querySelector('.add-backdrop');
        const chips = modal.querySelectorAll('.add-chip');
        const f = {
            name: modal.querySelector('#add-name'),
            desc: modal.querySelector('#add-desc'),
            date: modal.querySelector('#add-date'),
            start: modal.querySelector('#add-start'),
            end: modal.querySelector('#add-end')
        };

        const openModal = () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); };
        const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
        const resetForm = () => {
            Object.values(f).forEach(el => el.value = '');
            chips.forEach((c, i) => c.classList.toggle('is-selected', i === 0));
            modal.querySelector('#add-ai').checked = true;
        };

        fab.addEventListener('click', openModal);
        backdrop.addEventListener('click', closeModal);

        // 카테고리 단일 선택
        chips.forEach(chip => chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('is-selected'));
            chip.classList.add('is-selected');
        }));

        // 일정 생성 → 현재 날짜 타임라인에 추가하고 그 항목으로 스크롤
        modal.querySelector('.add-submit').addEventListener('click', () => {
            const sel = modal.querySelector('.add-chip.is-selected');
            dayData[currentDay].push({
                start: f.start.value.trim() || '00:00',
                end: f.end.value.trim() || '00:00',
                title: f.name.value.trim() || '새 일정',
                sub: f.desc.value.trim() || '직접 추가한 일정',
                place: '위치 미정',
                people: '동행인 2명',
                variant: sel ? sel.dataset.variant : ''
            });
            renderTimeline(currentDay);
            closeModal();
            resetForm();
            const rows = timelineEl.querySelectorAll('.tl-row');
            if (rows.length) rows[rows.length - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
    }

    // 외부(여행 루트 리스트 등)에서 특정 날짜의 일정 화면 열기
    window.openTodaySchedule = function (day) {
        go('today-schedule');
        selectDay(day, day === TODAY);
    };

    selectDay(TODAY, false);   // 초기 진입은 오늘
})();


/* ===== 결제(지갑) ===== */

// 숫자 카운트업 (은행처럼 값이 르륵 올라가는 효과)
function payCountUp(el) {
    const target = parseFloat(el.dataset.countup);
    const decimals = el.dataset.decimals ? +el.dataset.decimals : 0;
    const duration = 1000;
    const start = performance.now();
    const fmt = n => n.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);   // easeOutCubic → 감속하며 멈춤
        el.textContent = fmt(target * eased);
        if (t < 1) requestAnimationFrame(frame);
        else el.textContent = fmt(target);
    }
    requestAnimationFrame(frame);
}

// 결제 화면 진입: 전환 + 화면 내 숫자 롤링 재생
function goPay(id) {
    go(id);
    const scope = document.getElementById(id);
    if (scope) {
        requestAnimationFrame(() => {
            scope.querySelectorAll('.js-countup').forEach(payCountUp);
        });
    }
}

(function () {
    // 카드 캐러셀: 마우스 드래그로도 넘기기 (터치는 기본 스크롤)
    document.querySelectorAll('.pay-card-carousel').forEach(track => {
        let down = false, startX = 0, startLeft = 0, moved = false;
        track.addEventListener('mousedown', e => {
            down = true; moved = false;
            startX = e.pageX; startLeft = track.scrollLeft;
            track.classList.add('dragging');
        });
        window.addEventListener('mousemove', e => {
            if (!down) return;
            const dx = e.pageX - startX;
            if (Math.abs(dx) > 4) moved = true;
            track.scrollLeft = startLeft - dx;
        });
        window.addEventListener('mouseup', () => {
            if (!down) return;
            down = false;
            track.classList.remove('dragging');
        });
        // 드래그였으면 카드 클릭(이동) 막기
        track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    });

    // 주등록 카드 탭 → 결제 완료 연출 (애플페이 느낌)
    const mainCard = document.getElementById('pay-maincard');
    const success = document.getElementById('pay-success');
    if (mainCard && success) {
        mainCard.addEventListener('click', () => {
            if (success.classList.contains('show')) return;
            success.classList.add('show');
            setTimeout(() => success.classList.remove('show'), 1800);
        });
    }

    // 커뮤니티 카테고리 칩 필터
    const cmtyScreen = document.getElementById('community');
    if (cmtyScreen) {
        const chips = cmtyScreen.querySelectorAll('.cmty-chip');
        const posts = cmtyScreen.querySelectorAll('.cmty-post');
        chips.forEach(chip => {
            chip.addEventListener('click', function () {
                chips.forEach(c => c.classList.remove('is-active'));
                this.classList.add('is-active');
                const filter = this.dataset.filter;
                posts.forEach(post => {
                    const match = filter === '전체' || post.dataset.category === filter;
                    post.classList.toggle('is-hidden', !match);
                });
            });
        });
    }
})();


/* ===== 커뮤니티 ===== */

const _cmtyComments = {
    'post-1': [
        { avatar: 'img/SNS/user04.png', name: '도쿄살이5년',  text: '이치란은 관광객 트랩... 동의합니다ㅋㅋ 다이호 라멘 진짜 맛있죠.', time: '3분 전' },
        { avatar: 'img/SNS/user06.jpg', name: '오사카덕후',   text: '신신라멘 웨이팅이 생각보다 있어요. 오픈 시간에 맞춰 가시는 걸 추천!', time: '5분 전' },
        { avatar: 'img/SNS/user05.jpg', name: '혼자여행남',   text: '텐진 골목 투어는 저도 완전 동의! 구글맵 별점 적은 데가 진짜 맛집인 경우 많더라고요.', time: '11분 전' }
    ],
    'post-2': [
        { avatar: 'img/SNS/user03.png', name: '오사카10년',   text: '신사이바시 비즈니스 호텔 가성비 최강이죠. 저는 7만원대로 7박 했어요ㅋㅋ', time: '8분 전' },
        { avatar: 'img/SNS/user06.jpg', name: '료칸피치',     text: '캡슐호텔도 짐이 작으면 나쁘지 않아요. 니혼바시 쪽에 괜찮은 캡슐 있어요!', time: '20분 전' }
    ],
    'post-3': [
        { avatar: 'img/SNS/user04.png', name: '김카마우치',   text: '나카노시마 공원 저도 완전 추천이에요. 강변 야경도 예뻐요.', time: '2분 전' },
        { avatar: 'img/SNS/user03.png', name: '고독여행',     text: '유니버설 익스프레스 패스 진짜 중요... 없으면 줄 2~3시간은 기본이에요.', time: '14분 전' },
        { avatar: 'img/SNS/user05.jpg', name: '존버여행단',   text: '나카노시마 맞아요, 공원 분위기 진짜 좋음. 현지인 감성으로 즐길 수 있어요.', time: '18분 전' }
    ]
};

let _cmtyCurrentPost = null;

function _cmtyRenderComments(postId) {
    const list = document.getElementById('cmty-comment-list');
    if (!list) return;
    list.innerHTML = '';
    (_cmtyComments[postId] || []).forEach(c => {
        const el = document.createElement('div');
        el.className = 'cmty-comment-item';
        el.innerHTML =
            '<img src="' + c.avatar + '" class="cmty-comment-avatar" alt="' + c.name + '">' +
            '<div class="cmty-comment-body">' +
                '<span class="cmty-comment-name">' + c.name + '</span>' +
                '<p>' + c.text + '</p>' +
                '<span class="cmty-comment-time">' + c.time + '</span>' +
            '</div>';
        list.appendChild(el);
    });
}

function cmtyLike(btn) {
    const wasLiked = btn.classList.contains('is-liked');
    btn.classList.toggle('is-liked');
    btn.classList.remove('is-popping');
    void btn.offsetWidth;
    btn.classList.add('is-popping');
    btn.addEventListener('animationend', () => btn.classList.remove('is-popping'), { once: true });
    const span = btn.querySelector('span');
    const base = parseInt(btn.dataset.count, 10);
    span.textContent = (wasLiked ? base : base + 1).toLocaleString();
}

function cmtyOpenComment(btn, postId) {
    _cmtyCurrentPost = postId;
    _cmtyRenderComments(postId);
    const screen = document.getElementById('community');
    screen.querySelector('#cmty-overlay').classList.add('is-open');
    screen.querySelector('#cmty-sheet').classList.add('is-open');
    setTimeout(() => {
        const input = screen.querySelector('#cmty-reply-input');
        if (input) input.focus();
    }, 350);
}

function cmtyCloseComment() {
    const screen = document.getElementById('community');
    if (!screen) return;
    screen.querySelector('#cmty-overlay').classList.remove('is-open');
    screen.querySelector('#cmty-sheet').classList.remove('is-open');
    _cmtyCurrentPost = null;
}

function cmtySendComment() {
    const screen = document.getElementById('community');
    const input = screen.querySelector('#cmty-reply-input');
    const text = (input.value || '').trim();
    if (!text || !_cmtyCurrentPost) return;

    if (!_cmtyComments[_cmtyCurrentPost]) _cmtyComments[_cmtyCurrentPost] = [];
    _cmtyComments[_cmtyCurrentPost].unshift({ avatar: 'img/SNS/user01.png', name: '나', text: text, time: '방금' });
    _cmtyRenderComments(_cmtyCurrentPost);
    input.value = '';

    // 댓글 수 카운트 업
    const btns = screen.querySelectorAll('.cmty-comment-btn[onclick*="' + _cmtyCurrentPost + '"]');
    btns.forEach(b => {
        const s = b.querySelector('span');
        if (s) s.textContent = parseInt(s.textContent, 10) + 1;
    });
    document.getElementById('cmty-comment-list').scrollTop = 0;
}


/* ===== 하단 홈바: 진입한(활성) 탭 아이콘을 '꽉 찬(흰색)' 아이콘으로 표시 ===== */
(function () {
    // aria-label 기준 활성 상태용 채워진 SVG (커뮤니티는 변동 없음 → 제외)
    const FILLED_ICONS = {
        '홈': '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="20" viewBox="0 0 19 20" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.65722 18.7714V15.7047C6.6572 14.9246 7.29312 14.2908 8.08101 14.2856H10.9671C11.7587 14.2856 12.4005 14.9209 12.4005 15.7047V18.7809C12.4003 19.4432 12.9343 19.9845 13.603 20H15.5271C17.4451 20 19 18.4607 19 16.5618V7.83784C18.9898 7.09083 18.6355 6.38935 18.038 5.93303L11.4577 0.685301C10.3049 -0.228434 8.6662 -0.228434 7.51342 0.685301L0.962025 5.94256C0.362259 6.39702 0.00738669 7.09967 0 7.84736V16.5618C0 18.4607 1.55488 20 3.47291 20H5.39696C6.08235 20 6.63797 19.4499 6.63797 18.7714" fill="currentColor"/></svg>',
        '일정': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M14 15L10 10H17" stroke="#FF8E8E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        'AI 비서': '<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 19 19" fill="none"><path d="M3.44152 5.77025C4.22882 4.95609 4.22882 3.63606 3.44152 2.82189C2.65422 2.00773 1.37777 2.00773 0.590471 2.82189C-0.196824 3.63606 -0.196824 4.95609 0.590472 5.77025C1.37777 6.58442 2.65422 6.58442 3.44152 5.77025Z" fill="currentColor"/><path d="M11.2819 3.55898C12.0692 2.74482 12.0692 1.42479 11.2819 0.610625C10.4946 -0.203542 9.21815 -0.203542 8.43086 0.610625C7.64356 1.42479 7.64356 2.74482 8.43086 3.55898C9.21815 4.37315 10.4946 4.37315 11.2819 3.55898Z" fill="currentColor"/><path d="M18.4095 7.98152C19.1968 7.16736 19.1968 5.84733 18.4095 5.03316C17.6222 4.219 16.3458 4.219 15.5585 5.03316C14.7712 5.84733 14.7712 7.16736 15.5585 7.98152C16.3458 8.79569 17.6222 8.79569 18.4095 7.98152Z" fill="currentColor"/><path d="M4.86704 10.1928C5.33505 9.70882 5.89065 9.3249 6.50213 9.06297C7.11361 8.80105 7.76899 8.66623 8.43085 8.66623C9.09271 8.66623 9.74809 8.80105 10.3596 9.06297C10.9711 9.3249 11.5267 9.70882 11.9947 10.1928L14.4893 12.7726C15.0853 13.3894 15.448 14.2064 15.5118 15.0759C15.5755 15.9453 15.336 16.8096 14.8367 17.5122C14.3373 18.2148 13.6112 18.7092 12.7898 18.9059C11.9684 19.1026 11.106 18.9886 10.3589 18.5846C9.07352 17.8843 7.78937 17.8831 6.50639 18.5809C5.75963 18.9848 4.89774 19.0989 4.07668 18.9025C3.25562 18.7062 2.52963 18.2125 2.03008 17.5106C1.53053 16.8088 1.29042 15.9452 1.35321 15.0761C1.41599 14.207 1.77752 13.3899 2.37237 12.7726L4.86704 10.1928Z" fill="currentColor"/></svg>',
        '결제': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 12V17C22 20 20 22 17 22H7C4 22 2 20 2 17V12C2 9.28 3.64 7.38 6.19 7.06C6.45 7.02 6.72 7 7 7H17C17.26 7 17.51 7.00999 17.75 7.04999C20.33 7.34999 22 9.26 22 12Z" fill="currentColor"/><path d="M17.7514 7.05C17.5114 7.01 17.2614 7.00001 17.0014 7.00001H7.00141C6.72141 7.00001 6.45141 7.02001 6.19141 7.06001C6.33141 6.78001 6.53141 6.52001 6.77141 6.28001L10.0214 3.02C11.3914 1.66 13.6114 1.66 14.9814 3.02L16.7314 4.79002C17.3714 5.42002 17.7114 6.22 17.7514 7.05Z" fill="currentColor"/><path d="M22 12.5H19C17.9 12.5 17 13.4 17 14.5C17 15.6 17.9 16.5 19 16.5H22" stroke="#FF8E8E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    // 모든 홈바의 활성 탭 아이콘을 채워진 버전으로 교체
    document.querySelectorAll('.homebar .hb-item.is-active').forEach(item => {
        const label = item.getAttribute('aria-label');
        const ico = item.querySelector('.hb-ico');
        if (ico && FILLED_ICONS[label]) ico.innerHTML = FILLED_ICONS[label];
    });
})();


/* ===== 프로필 화면: 프론트 셸 동작 ===== */
// 닉네임 변경
function profileEditName() {
    const el = document.getElementById('profile-nickname');
    if (!el) return;
    const next = prompt('새 닉네임을 입력하세요', el.textContent.trim());
    if (next && next.trim()) el.textContent = next.trim();
}

// 프로필 이미지 변경(파일 선택 트리거)
function profileChangeImage() {
    const input = document.getElementById('profile-file');
    if (input) input.click();
}
function profilePickFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = document.getElementById('profile-avatar-img');
    if (img) img.src = URL.createObjectURL(file);
}

// AI 비서 선택 토글
function profilePickAI(btn) {
    document.querySelectorAll('.profile-ai-pick .profile-ai-card').forEach(c => {
        c.classList.remove('is-selected');
        const img = c.querySelector('img');
        const ai = c.dataset.ai;
        if (img) img.src = ai === 'dog' ? 'img/char/dog-pick.png' : 'img/char/cat-pick.png';
    });
    btn.classList.add('is-selected');
    const img = btn.querySelector('img');
    if (img) img.src = btn.dataset.ai === 'dog' ? 'img/char/dog-pick-on.png' : 'img/char/cat-pick-on.png';
}


/* ===== 가로 스크롤: 데스크톱 마우스 드래그 스와이프 (모바일 터치는 네이티브) ===== */
(function () {
    const SELECTORS = '.cmty-chips, .cmty-stories, .cmty-videos, .cmty-tags, .search-chips';
    function enableDrag(el) {
        if (el.dataset.dragScroll) return;
        el.dataset.dragScroll = '1';
        let down = false, moved = false, startX = 0, startScroll = 0;
        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;  // 터치는 네이티브 스크롤
            down = true; moved = false;
            startX = e.clientX; startScroll = el.scrollLeft;
        });
        el.addEventListener('pointermove', (e) => {
            if (!down) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 4) { moved = true; el.classList.add('is-dragging'); }
            if (moved) { el.scrollLeft = startScroll - dx; e.preventDefault(); }
        });
        const end = () => { down = false; el.classList.remove('is-dragging'); };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointerleave', end);
        // 드래그한 직후의 클릭은 무시(칩 선택/재생 등 오작동 방지)
        el.addEventListener('click', (e) => {
            if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
        }, true);
    }
    function initAll() { document.querySelectorAll(SELECTORS).forEach(enableDrag); }
    initAll();
    window.addEventListener('load', initAll);
})();


/* ===== 메인 더보기: 숨김 카드 펼치기/접기 ===== */
function toggleMore(btn) {
    const wrap = btn.previousElementSibling;
    if (!wrap || !wrap.classList.contains('more-wrap')) return;
    const open = wrap.classList.toggle('is-open');
    btn.classList.toggle('is-open', open);
    const span = btn.querySelector('span');
    if (span) span.textContent = open ? '접기' : '더보기';
}


/* ===== 커뮤니티 게시글 전체보기 + 팔로우 ===== */
function cmtyOpenPost(el, ev) {
    // 좋아요/댓글 버튼 클릭은 상세 진입 제외
    if (ev && ev.target.closest('.cmty-post-actions, .cmty-like-btn, .cmty-comment-btn')) return;
    const d = document.getElementById('cmty-post-detail');
    if (!d) return;
    const pick = (s) => el.querySelector(s);

    d.querySelector('.cpd-avatar').src = pick('.cmty-post-avatar').src;
    d.querySelector('.cpd-name').textContent = pick('.cmty-post-name').textContent;
    const meta = [...el.querySelectorAll('.cmty-post-meta span')].map(s => s.textContent);
    d.querySelector('.cpd-meta').textContent = meta.join(' · ');

    // 이미지(0~여러 장)
    const imgWrap = d.querySelector('.cpd-images');
    imgWrap.innerHTML = '';
    el.querySelectorAll('.cmty-post-img, .cmty-post-img-sm').forEach(img => {
        const i = document.createElement('img');
        i.src = img.src; i.className = 'cpd-img'; i.alt = '';
        imgWrap.appendChild(i);
    });
    imgWrap.style.display = imgWrap.children.length ? '' : 'none';

    d.querySelector('.cpd-text').textContent = pick('.cmty-post-text').textContent;

    // 태그
    const tagWrap = d.querySelector('.cpd-tags');
    tagWrap.innerHTML = '';
    el.querySelectorAll('.cmty-tag').forEach(t => {
        const s = document.createElement('span');
        s.className = 'cmty-tag'; s.textContent = t.textContent;
        tagWrap.appendChild(s);
    });

    d.querySelector('.cpd-like-count').textContent = pick('.cmty-like-btn span').textContent;
    d.querySelector('.cpd-comment-count').textContent = pick('.cmty-comment-btn span').textContent;

    // 팔로우 버튼 초기화
    const fb = d.querySelector('.cpd-follow');
    fb.classList.remove('is-following');
    fb.textContent = '팔로우';

    go('cmty-post-detail');
    const ly = d.querySelector('.layout');
    if (ly) ly.scrollTop = 0;
}

function cmtyToggleFollow(btn) {
    const on = btn.classList.toggle('is-following');
    btn.textContent = on ? '팔로잉' : '팔로우';
}