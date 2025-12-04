/* script.js - upgraded Healthcare Companion
   - 15 MC questions
   - collects answers, shows feedback & risk explanations AFTER completing quiz
   - mood/habits/journal, charts (Chart.js), localStorage persistence
   - purple theme and modes
*/

// ----------------- Helpers -----------------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayKey = () => new Date().toISOString().split('T')[0];

function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function loadJSON(k, def){ try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch(e){ return def; } }

// ----------------- Quiz Data (15 questions) -----------------
const questions = [
  { text:"How many hours of sleep should an adult get?", options:["4-5 hours","6-7 hours","7-9 hours","10+ hours"], correct:"7-9 hours", key:"sleep", warning:"Chronic sleep loss increases risk of fatigue, poor memory and mood problems." },
  { text:"How much water is typically recommended per day for an adult?", options:["0.5 L","1 L","2 L","5 L"], correct:"2 L", key:"water", warning:"Low water intake can cause headaches, dizziness and poor concentration." },
  { text:"Which food is a strong source of protein?", options:["Chips","Eggs","Candy","Soda"], correct:"Eggs", key:"protein", warning:"Low protein intake may reduce muscle repair and energy." },
  { text:"Recommended weekly moderate exercise amount?", options:["30 mins","60 mins","150 mins","10 mins"], correct:"150 mins", key:"exercise", warning:"Too little exercise increases risk of heart disease and low stamina." },
  { text:"Which vitamin helps bone health (with sunlight & diet)?", options:["Vitamin A","Vitamin C","Vitamin D","Vitamin B12"], correct:"Vitamin D", key:"vitD", warning:"Low vitamin D can cause weak bones and low energy." },
  { text:"Which habit lowers stress quickly?", options:["Procrastination","Mindful breathing","Overeating","Skipping sleep"], correct:"Mindful breathing", key:"stress", warning:"Poor stress management can lead to anxiety and sleep problems." },
  { text:"Best source of healthy fats?", options:["Chips","Avocado","Candy","Soda"], correct:"Avocado", key:"fats", warning:"Missing healthy fats affects brain function and vitamin absorption." },
  { text:"Which is a common sign of dehydration?", options:["Clear urine","Dry mouth","High energy","Good focus"], correct:"Dry mouth", key:"dehydration", warning:"Severe dehydration may cause dizziness and low blood pressure." },
  { text:"Daily fruit/veg servings recommended?", options:["0","1-2","3-5","8+"], correct:"3-5", key:"produce", warning:"Low fruit/veg can cause vitamin deficiencies and weaker immunity." },
  { text:"Which sleep environment is ideal?", options:["Bright room","Noisy room","Dark & quiet","Overheated room"], correct:"Dark & quiet", key:"sleepEnv", warning:"Poor sleep environment reduces sleep quality and recovery." },
  { text:"Which habit strongly helps heart health?", options:["Smoking","Regular exercise","Excess sugar","Sedentary lifestyle"], correct:"Regular exercise", key:"heart", warning:"Poor habits increase risk of heart disease and obesity." },
  { text:"Which indicates high stress?", options:["Calmness","Headache","Relaxed muscles","Good focus"], correct:"Headache", key:"highStress", warning:"Ongoing stress can harm mental and physical health." },
  { text:"Recommended daily water intake for children (approx)?", options:["0.5 L","1 L","1.5-2 L","3 L"], correct:"1.5-2 L", key:"kidsWater", warning:"Children who drink too little may experience concentration problems." },
  { text:"A healthy quick snack for steady energy?", options:["Soda","Chips","Apple","Chocolate bar"], correct:"Apple", key:"snack", warning:"High sugar snacks cause energy crashes and may harm long-term health." },
  { text:"Which activity improves flexibility mostly?", options:["Running","Yoga","Weightlifting","Cycling"], correct:"Yoga", key:"flex", warning:"Skipping flexibility increases injury risk and mobility loss over time." }
];

// ----------------- DOM elements -----------------
const questionModal = $('#questionModal');
const questionTitle = $('#questionTitle');
const answerOptions = $('#answerOptions');
const quizProgress = $('#quizProgress');
const nextBtn = $('#nextBtn');

const mainApp = $('#mainApp');
const tabs = $$('.tab');
const panels = $$('.panel');

const dashboardSummary = $('#dashboardSummary');
const quizResultArea = $('#quizResultArea');

const moodButtons = $$('.moodBtn');
const selectedMoodEl = $('#selectedMood');
const journalEntry = $('#journalEntry');
const saveJournalBtn = $('#saveJournalBtn');
const journalList = $('#journalList');
const saveHabitsBtn = $('#saveHabitsBtn');
const habitCheckboxes = $$('.habit');

const resetBtn = $('#resetData');
const darkModeToggle = $('#darkModeToggle');
const pastelModeToggle = $('#pastelModeToggle');

// charts
let moodChart = null, habitChart = null;

// ----------------- Quiz state -----------------
let currentQuestion = 0;
let selectedAnswers = {};   // key -> chosen option
let wrongs = [];            // store wrong answers with warnings and risk explanation

// ----------------- Build and show question -----------------
function buildOptions(q){
  answerOptions.innerHTML = '';
  // shuffle a copy
  const opts = q.options.slice().sort(()=>Math.random()-0.5);
  opts.forEach(opt=>{
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.width = '100%';
    b.style.textAlign = 'left';
    b.style.padding = '12px';
    b.textContent = opt;
    b.onclick = () => {
      // mark selected visually
      $$('#answerOptions button').forEach(x => x.style.boxShadow = '');
      b.style.boxShadow = '0 8px 20px rgba(0,0,0,0.6)';
      // temporarily store selection in element attribute
      b.dataset.selected = '1';
      // store selection in memory
      selectedAnswers[q.key] = opt;
    };
    answerOptions.appendChild(b);
  });
}

function showQuestion(i){
  const q = questions[i];
  questionTitle.textContent = q.text;
  buildOptions(q);
  quizProgress.textContent = `${i+1} / ${questions.length}`;
  // clear any previous selection for this question
  delete selectedAnswers[q.key];
}

// Next button behavior: record selection and move on
nextBtn.addEventListener('click', ()=>{
  const q = questions[currentQuestion];
  const chosen = selectedAnswers[q.key];
  if(!chosen){
    alert('Please select an option before continuing.');
    return;
  }
  // record wrongs for later feedback
  if(chosen !== q.correct){
    wrongs.push({
      question: q.text,
      selected: chosen,
      correct: q.correct,
      warning: q.warning,
      risk: mapRisk(chosen)
    });
  }
  currentQuestion++;
  if(currentQuestion < questions.length){
    showQuestion(currentQuestion);
  } else {
    finishQuiz();
  }
});

// ----------------- Risk mapping (explanations for chosen wrong answers) -----------------
function mapRisk(choice){
  // map common wrong options to a risk phrase; extend as needed
  const map = {
    "4-5 hours":"Chronic fatigue and reduced immunity",
    "6-7 hours":"Mild tiredness and lower concentration",
    "10+ hours":"Oversleeping can be linked with lethargy",
    "0.5 L":"Severe dehydration risk (dizziness, headaches)",
    "1 L":"Mild dehydration (headache, tiredness)",
    "5 L":"Risk of overhydration (electrolyte imbalance)",
    "Chips":"High salt and unhealthy fats — heart risk",
    "Candy":"High sugar spikes; long-term weight gain risk",
    "Soda":"High sugar + acid—teeth and energy impact",
    "30 mins":"Below recommended weekly activity",
    "60 mins":"May be insufficient weekly for many adults",
    "Procrastination":"Higher stress & missed healthy behaviors",
    "Overeating":"Weight gain, digestive issues",
    "Skipping sleep":"Acute sleep deprivation risks",
    "Smoking":"High long-term risk for lungs and heart",
    "Sedentary lifestyle":"Weak muscles and poor cardiovascular health",
    "Chocolate bar":"High sugar snack — energy crash possible",
    "Chips":"Unhealthy snack (repeated mapping)",
    "Running":"While good, less focused on flexibility than yoga"
  };
  return map[choice] || "May negatively affect health over time";
}

// ----------------- Finish quiz and show results -----------------
function finishQuiz(){
  // hide modal, show main app
  questionModal.style.display = 'none';
  mainApp.style.display = 'block';
  // save results locally
  saveJSON('hc_quiz_answers', selectedAnswers);
  saveJSON('hc_quiz_wrongs', wrongs);
  // render dashboard & quiz summary
  renderDashboard();
  renderQuizSummary();
  // init other data and charts
  loadJournalList();
  loadHabits();
  buildCharts();
}

// ----------------- Render dashboard -----------------
function renderDashboard(){
  const quiz = loadJSON('hc_quiz_answers', {});
  const habits = loadJSON('hc_habits', {});
  const mood = loadJSON('hc_mood', []);
  const latestMood = mood.length ? mood[mood.length -1].mood : '—';

  let html = `<p><strong>Top goal / first answer (example):</strong> ${quiz.sleep ?? '—'}</p>`;
  html += `<p><strong>Latest mood:</strong> ${latestMood}</p>`;
  html += `<p><strong>Habits:</strong></p><ul>`;
  ['Exercise','Sleep','Water'].forEach(h=>{
    html += `<li>${h}: ${habits[h] ? 'Done' : 'Pending'} (streak: ${habits[h+'-streak'] || 0})</li>`;
  });
  html += `</ul>`;
  dashboardSummary.innerHTML = html;
}

// ----------------- Render Quiz Summary (show wrongs & warnings) -----------------
function renderQuizSummary(){
  const q = loadJSON('hc_quiz_answers', {});
  const wrongList = loadJSON('hc_quiz_wrongs', []);
  let html = '<div>';
  html += '<h3>Your answers (all questions)</h3><ul>';
  questions.forEach(qq=>{
    const ans = q[qq.key] ?? '—';
    html += `<li><strong>${qq.text}</strong><br>Answer: <em>${ans}</em></li>`;
  });
  html += '</ul></div>';

  if(wrongList.length){
    html += '<div style="margin-top:12px;"><h3 style="color:#ffdd57">Potential concerns (based on inaccurate answers)</h3><ul>';
    wrongList.forEach(w=>{
      html += `<li><strong>${w.question}</strong><br>
                Your choice: ${w.selected} — Correct: ${w.correct}<br>
                ⚠ Warning: ${w.warning}<br>
                🔎 Potential risk/explanation: ${w.risk}</li><hr style="opacity:0.06">`;
    });
    html += '</ul></div>';
  } else {
    html += '<p class="card">✅ All answers look correct — nice!</p>';
  }
  quizResultArea.innerHTML = html;
}

// ----------------- Tabs -----------------
tabs.forEach(t=>{
  t.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active'));
    panels.forEach(p=>p.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.target).classList.add('active');
  });
});

// ----------------- Mood & Journal -----------------
moodButtons.forEach(b=>{
  b.addEventListener('click', ()=>{
    const mood = b.dataset.mood;
    const arr = loadJSON('hc_mood', []);
    arr.push({mood, date: new Date().toLocaleDateString()});
    saveJSON('hc_mood', arr);
    selectedMoodEl.textContent = `Selected Mood: ${mood}`;
    renderDashboard();
    buildCharts();
  });
});

saveJournalBtn.addEventListener('click', ()=>{
  const txt = journalEntry.value.trim();
  if(!txt) return alert('Write something first.');
  const j = loadJSON('hc_journal', []);
  j.push({id:uid(), date: new Date().toLocaleDateString(), entry: txt});
  saveJSON('hc_journal', j);
  journalEntry.value = '';
  loadJournalList();
  renderDashboard();
});

function loadJournalList(){
  const j = loadJSON('hc_journal', []);
  journalList.innerHTML = '';
  j.slice().reverse().forEach(e=>{
    const li = document.createElement('li');
    li.textContent = `${e.date} — ${e.entry}`;
    journalList.appendChild(li);
  });
}

// ----------------- Habits (streak logic) -----------------
function loadHabits(){
  const obj = loadJSON('hc_habits', {});
  habitCheckboxes.forEach(cb=>{
    const k = cb.dataset.habit;
    cb.checked = obj[k] || false;
  });
}

saveHabitsBtn.addEventListener('click', ()=>{
  const obj = loadJSON('hc_habits', {});
  habitCheckboxes.forEach(cb=>{
    const k = cb.dataset.habit;
    const prev = obj[k] || false;
    if(cb.checked && prev) obj[k+'-streak'] = (obj[k+'-streak']||0) + 1;
    else if(cb.checked && !prev) obj[k+'-streak'] = 1;
    else if(!cb.checked) obj[k+'-streak'] = 0;
    obj[k] = cb.checked;
  });
  saveJSON('hc_habits', obj);
  loadHabits();
  renderDashboard();
  buildCharts();
});

// ----------------- Charts -----------------
function buildCharts(){
  const moodData = loadJSON('hc_mood', []);
  const moodLabels = moodData.map(m=>m.date);
  const moodVals = moodData.map(m=> m.mood === 'happy' ? 2 : (m.mood === 'neutral' ? 1 : 0));

  const habits = loadJSON('hc_habits', {});
  const habitLabels = ['Exercise','Sleep','Water'];
  const habitVals = habitLabels.map(h => habits[h+'-streak'] || 0);

  // mood chart
  const mCtx = document.getElementById('moodChart').getContext('2d');
  if(moodChart) moodChart.destroy();
  moodChart = new Chart(mCtx, {
    type:'line',
    data:{ labels: moodLabels, datasets:[{ label:'Mood', data:moodVals, tension:0.3, borderColor:'#ffd6f0', backgroundColor:'rgba(255,214,240,0.08)' }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });

  // habit chart
  const hCtx = document.getElementById('habitChart').getContext('2d');
  if(habitChart) habitChart.destroy();
  habitChart = new Chart(hCtx, {
    type:'bar',
    data:{ labels: habitLabels, datasets:[{ label:'Streaks', data: habitVals, backgroundColor:['#b266ff','#9b5cff','#6b2bff'] }] },
    options:{ responsive:true, maintainAspectRatio:false }
  });
}

// ----------------- Reset Data -----------------
resetBtn.addEventListener('click', ()=>{
  if(!confirm('This will clear saved data. Continue?')) return;
  localStorage.clear();
  location.reload();
});

// ----------------- Dark & Pastel modes -----------------
function loadModes(){
  if(localStorage.getItem('hc_dark') === 'on') document.body.classList.add('dark-mode');
  if(localStorage.getItem('hc_pastel') === 'on') document.body.classList.add('pastel-mode');
}
darkModeToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('dark-mode');
  document.body.classList.remove('pastel-mode');
  localStorage.setItem('hc_dark', document.body.classList.contains('dark-mode') ? 'on' : 'off');
});
pastelModeToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('pastel-mode');
  document.body.classList.remove('dark-mode');
  localStorage.setItem('hc_pastel', document.body.classList.contains('pastel-mode') ? 'on' : 'off');
});
loadModes();

// ----------------- Initialize on load -----------------
function init(){
  // if quiz already answered show app; else start quiz
  const stored = loadJSON('hc_quiz_answers', null);
  if(stored && Object.keys(stored).length >= questions.length){
    // load previously completed quiz
    selectedAnswers = stored;
    wrongs = loadJSON('hc_quiz_wrongs', []);
    questionModal.style.display = 'none';
    mainApp.style.display = 'block';
    renderDashboard();
    renderQuizSummary();
    loadJournalList();
    loadHabits();
    buildCharts();
  } else {
    questionModal.style.display = 'flex';
    mainApp.style.display = 'none';
    currentQuestion = 0;
    selectedAnswers = {};
    wrongs = [];
    showQuestion(0);
  }
}

init();
