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

// splash가 2초 보였다가 자동으로 login으로
//일단 코딩 중에는 off 해두기!!
//배포하면 on!! 🍘
// setTimeout(() => {
//     go('login');
// }, 2000);


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


const map = L.map('map').setView([34.6937, 135.5023], 13);
// [위도, 경도] = 오사카 중심, 13 = 확대 레벨

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);
