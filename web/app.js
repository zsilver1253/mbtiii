(function () {
  "use strict";

  const OPTION_KEYS = ["A", "B", "C", "D"];
  const ADVANCE_DELAY = 220;
  // evolution.svg(가로 1200) 각 단계 라벨의 x 좌표를 %로 환산
  const EVOLUTION_STAGE_X = [115, 335, 565, 795, 1010].map((x) => (x / 1200) * 100);

  const $ = (id) => document.getElementById(id);

  let current = 0;
  let answers = new Array(QUESTIONS.length).fill(null);
  let locked = false;

  // 축별 최대 점수 = 각 문항에서 그 축이 받을 수 있는 최고점의 합
  const AXIS_MAX = AXES.reduce((acc, { code }) => {
    acc[code] = QUESTIONS.reduce((sum, q) => {
      const best = Math.max(0, ...q.options.map((o) => o.scores[code] ?? 0));
      return sum + best;
    }, 0);
    return acc;
  }, {});

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("is-active", el.id === `screen-${name}`);
    });
    window.scrollTo(0, 0);
  }

  function renderIntro() {
    $("axis-chips").innerHTML = AXES.map((a) => `<li>${a.name}</li>`).join("");
  }

  function renderQuestion() {
    const q = QUESTIONS[current];
    const total = QUESTIONS.length;

    $("progress-fill").style.width = `${(current / total) * 100}%`;
    $("progress").setAttribute("aria-valuenow", String(current));
    $("progress-count").textContent = `${current + 1}/${total}`;
    $("btn-back").disabled = current === 0;
    $("section-label").textContent = SECTIONS[q.section];
    $("q-num").textContent = `Q${current + 1}`;
    $("q-text").textContent = q.text;

    const box = $("options");
    box.classList.remove("is-locked");
    box.innerHTML = "";
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option" + (answers[current] === i ? " is-selected" : "");
      btn.innerHTML = `<span class="option-key">${OPTION_KEYS[i]}</span><span></span>`;
      btn.lastChild.textContent = opt.text;
      btn.addEventListener("click", () => choose(i, btn));
      box.appendChild(btn);
    });
    locked = false;
  }

  function choose(index, btn) {
    if (locked) return;
    locked = true;
    answers[current] = index;
    $("options").classList.add("is-locked");
    document.querySelectorAll(".option").forEach((el) => el.classList.remove("is-selected"));
    btn.classList.add("is-selected");

    setTimeout(() => {
      if (current < QUESTIONS.length - 1) {
        current += 1;
        renderQuestion();
      } else {
        $("progress-fill").style.width = "100%";
        renderResult();
        showScreen("result");
      }
    }, ADVANCE_DELAY);
  }

  function computeResult() {
    const earned = Object.fromEntries(AXES.map((a) => [a.code, 0]));
    answers.forEach((optIndex, qi) => {
      const scores = QUESTIONS[qi].options[optIndex].scores;
      for (const code in scores) earned[code] += scores[code];
    });

    const axisScores = AXES.map((a) => ({
      ...a,
      score: Math.round((earned[a.code] / AXIS_MAX[a.code]) * 100),
    }));
    const total = Math.round(axisScores.reduce((s, a) => s + a.score, 0) / axisScores.length);
    const grade = GRADES.find((g) => total >= g.min);

    // 가장 낮은 축 기준. 동점이면 축 표기 순서(O→P→C→T→B)상 앞선 축
    const weakest = axisScores.reduce((low, a) => (a.score < low.score ? a : low));
    const isMaster = axisScores.every((a) => a.score >= MASTER_THRESHOLD);
    const type = isMaster ? MASTER_TYPE : TYPES[weakest.code];

    return { axisScores, total, grade, type, weakCode: isMaster ? null : weakest.code };
  }

  function radarSvg(axisScores, weakCode) {
    const size = 300;
    const c = size / 2;
    const r = 100;
    const n = axisScores.length;
    const point = (i, ratio) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [c + Math.cos(angle) * r * ratio, c + Math.sin(angle) * r * ratio];
    };
    const poly = (ratio) => axisScores.map((_, i) => point(i, ratio).join(",")).join(" ");

    const grid = [0.25, 0.5, 0.75, 1].map((t) => `<polygon class="grid" points="${poly(t)}"/>`).join("");
    const spokes = axisScores.map((_, i) => {
      const [x, y] = point(i, 1);
      return `<line class="spoke" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`;
    }).join("");
    const areaPts = axisScores.map((a, i) => point(i, a.score / 100).join(",")).join(" ");
    const dots = axisScores.map((a, i) => {
      const [x, y] = point(i, a.score / 100);
      return `<circle class="dot${a.code === weakCode ? " is-weak" : ""}" cx="${x}" cy="${y}" r="4.5"/>`;
    }).join("");
    const labels = axisScores.map((a, i) => {
      const [x, y] = point(i, 1.28);
      const anchor = Math.abs(x - c) < 4 ? "middle" : x > c ? "start" : "end";
      const dx = anchor === "start" ? -14 : anchor === "end" ? 14 : 0;
      return `<text class="label" x="${x + dx}" y="${y}" text-anchor="${anchor}">${a.name}</text>` +
        `<text class="value" x="${x + dx}" y="${y + 16}" text-anchor="${anchor}">${a.score}점</text>`;
    }).join("");

    return `<svg viewBox="-20 -10 ${size + 40} ${size + 30}" role="img" aria-label="5축 레이더 차트: ${
      axisScores.map((a) => `${a.name} ${a.score}점`).join(", ")
    }">${grid}${spokes}<polygon class="area" points="${areaPts}"/>${dots}${labels}</svg>`;
  }

  function renderResult() {
    const { axisScores, total, grade, type, weakCode } = computeResult();

    $("result-grade").textContent = grade.name;
    $("result-score").textContent = total;
    $("result-grade-comment").textContent = grade.comment;
    $("grade-img").src = grade.image;
    $("grade-img").alt = `${grade.name} 캐릭터`;
    $("evolution-marker").style.left = `${EVOLUTION_STAGE_X[grade.stage]}%`;
    $("evolution-caption").textContent = `5단계 중 ${grade.stage + 1}단계 · ${grade.name}`;

    $("result-type-weak").textContent = type.weak ? `나의 유형 · ${type.weak}` : "나의 유형";
    $("result-type").textContent = type.name;
    $("result-type-headline").textContent = `"${type.headline}"`;
    $("result-type-body").textContent = type.body;
    const tips = $("result-type-tips");
    tips.innerHTML = "";
    type.tips.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      tips.appendChild(li);
    });

    $("radar").innerHTML = radarSvg(axisScores, weakCode);
    const bars = $("axis-bars");
    bars.innerHTML = "";
    axisScores.forEach((a) => {
      const li = document.createElement("li");
      li.className = "axis-bar" + (a.code === weakCode ? " is-weak" : "");
      li.innerHTML = `<span class="axis-bar-name"></span>
        <span class="axis-bar-track"><span class="axis-bar-fill" style="width:${a.score}%"></span></span>
        <span class="axis-bar-val">${a.score}</span>`;
      li.firstElementChild.textContent = a.name;
      li.title = a.desc;
      bars.appendChild(li);
    });

    $("template-steps").innerHTML = TEMPLATE_STEPS.map((s) => `<li>${s}</li>`).join("");
    const hasBA = Boolean(type.before && type.after);
    $("before-after").hidden = !hasBA;
    if (hasBA) {
      $("ba-before").textContent = type.before;
      $("ba-after").textContent = type.after;
    }
  }

  function start() {
    current = 0;
    answers = new Array(QUESTIONS.length).fill(null);
    renderQuestion();
    showScreen("quiz");
  }

  $("btn-start").addEventListener("click", start);
  $("btn-restart").addEventListener("click", start);
  $("btn-back").addEventListener("click", () => {
    if (current > 0 && !locked) {
      current -= 1;
      renderQuestion();
    }
  });

  renderIntro();
})();
