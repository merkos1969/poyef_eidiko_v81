(() => {
  const $ = (id) => document.getElementById(id);

  // Storage
  const LS_KEY = 'poyef_simple_calendar_v1';
  /** @type {Record<string, string[]>} */
  let schedule = {};

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) schedule = JSON.parse(raw) || {};
    } catch { schedule = {}; }
  }
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(schedule));
  }

  // Date helpers
  function pad2(n){return String(n).padStart(2,'0');}
  function ymd(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;}
  function parseYMD(s){
    const [y,m,dd]=s.split('-').map(Number);
    return new Date(y, m-1, dd);
  }
  function monthKey(d){return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;}

  const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];

  // Tabs
  const tabCalcBtn = $('tabCalcBtn');
  const tabCalBtn = $('tabCalBtn');
  const tabCalc = $('tabCalc');
  const tabCal = $('tabCal');

  function showTab(which){
    const isCalc = which === 'calc';
    tabCalcBtn.classList.toggle('active', isCalc);
    tabCalBtn.classList.toggle('active', !isCalc);
    tabCalc.classList.toggle('hidden', !isCalc);
    tabCal.classList.toggle('hidden', isCalc);
    tabCalcBtn.setAttribute('aria-selected', String(isCalc));
    tabCalBtn.setAttribute('aria-selected', String(!isCalc));
  }

  // Current view month
  let view = new Date();
  view.setDate(1);

  // Shift selection
  let activeShift = null; // 'PR' | 'AP' | 'NY' | 'AD' | 'RP'

  function setActiveShift(s){
    activeShift = s;
    document.querySelectorAll('.shift[data-shift]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.shift === s);
    });
  }

  // Rules: compute NY & 5M from a day entry
  function dayDow(d){ // 0 Sun ... 6 Sat
    return d.getDay();
  }

  function hasShift(ymdKey, code){
    const arr = schedule[ymdKey] || [];
    return arr.includes(code);
  }

  function computeDayExtras(dateObj){
    const key = ymd(dateObj);
    const arr = schedule[key] || [];
    const hasNY = arr.includes('NY');
    const hasPR = arr.includes('PR');
    const hasAP = arr.includes('AP');
    const hasService = hasPR || hasAP || hasNY; // απλοποιημένο

    const dow = dayDow(dateObj);
    const isFri = dow === 5;
    const isSat = dow === 6;
    const isSun = dow === 0;

    let nights = 0;
    let fiveM = 0;
    let flags = {fiveMReason: null};

    // Weekend service => 5M
    if ((isSat || isSun) && hasService) {
      fiveM += 1;
      flags.fiveMReason = isSat ? 'Σάββατο υπηρεσία' : 'Κυριακή υπηρεσία';
    }

    // Friday/Saturday night converts to 5M (unless we already gave 5M by weekend? still 5M stays 1)
    if (hasNY && isFri) {
      // Friday night counts as 5M, not night
      // ensure 5M at least 1
      fiveM = Math.max(fiveM, 1);
      flags.fiveMReason = 'Παρασκευή ΝΥ → 5Μ';
      nights += 0;
    } else if (hasNY && isSat) {
      // Saturday NY only: 5M not night. BUT if also PR same day => count night too (user rule)
      fiveM = Math.max(fiveM, 1);
      flags.fiveMReason = 'Σάββατο ΝΥ → 5Μ';
      if (hasPR) nights += 1; // Σάββατο ΠΡ + ΝΥ
    } else {
      // Normal nights count
      if (hasNY) nights += 1;
    }

    // Sunday PR + NY => 5M + night (already gives 5M via weekend rule; night should count)
    if (isSun && hasPR && hasNY) {
      // if our earlier logic converted night? it won't; so ensure night counted
      nights = 1;
      fiveM = Math.max(fiveM, 1);
      flags.fiveMReason = 'Κυριακή ΠΡ + ΝΥ';
    }

    return { nights, fiveM, flags };
  }

  function computeMonthTotals(monthDate){
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m+1, 0);
    let nights = 0, fiveM = 0;
    /** @type {string[]} */
    const nightDates = [];
    /** @type {string[]} */
    const fiveMDates = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      const ex = computeDayExtras(d);
      if (ex.nights){
        nights += ex.nights;
        nightDates.push(pad2(d.getDate())+'/'+pad2(m+1));
      }
      if (ex.fiveM){
        fiveM += ex.fiveM;
        fiveMDates.push(pad2(d.getDate())+'/'+pad2(m+1));
      }
    }

    const gross = nights*26.5 + fiveM*46;
    const ded = gross*0.24;
    const net = gross - ded;
    return { nights, fiveM, gross, ded, net, nightDates, fiveMDates };
  }

  function euro(n){
    return (Number(n)||0).toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2}) + '€';
  }

  function setMonthLabels(){
    const label = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
    $('calMonth').textContent = label;
    $('calcMonth').textContent = label;
  }

  function renderCalendar(){
    setMonthLabels();
    const cal = $('calendar');
    cal.innerHTML = '';

    const y=view.getFullYear();
    const m=view.getMonth();
    const first = new Date(y,m,1);
    const last = new Date(y,m+1,0);

    // Monday-first index: 0..6 where 0=Mon
    const mondayIndex = (first.getDay()+6)%7;

    // Fill leading blanks
    for (let i=0;i<mondayIndex;i++){
      const div=document.createElement('div');
      div.className='day muted';
      cal.appendChild(div);
    }

    for (let day=1; day<=last.getDate(); day++){
      const d=new Date(y,m,day);
      const key=ymd(d);
      const div=document.createElement('div');
      div.className='day';
      div.dataset.ymd=key;

      const num=document.createElement('div');
      num.className='num';
      num.textContent=String(day);
      div.appendChild(num);

      // Γέμισμα κελιού με χρώμα (όπως εφαρμογή βαρδιών)
      const colorMap = {
        PR: '#2e6eea',  // Πρωί
        AP: '#f08a24',  // Απόγευμα
        NY: '#1f4fbf',  // Νύχτα
        AD: '#46b5ff',  // Αδιάθετο
        RP: '#e13b3b',  // Ρεπό
      };
      const labelMap = { PR:'ΠΡ', AP:'ΑΠ', NY:'ΝΥ', AD:'ΑΔ', RP:'ΡΠ' };

      const arr = schedule[key] ? [...schedule[key]] : [];
      if(arr && arr.length){
        div.classList.add('filled');

        // background
        const colors = arr.map(s=>colorMap[s]).filter(Boolean);
        if(colors.length===1){
          div.style.background = colors[0];
        } else if(colors.length>=2){
          div.style.background = `linear-gradient(135deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)`;
        }

        // μεγάλα γράμματα μέσα στο κελί
        const lab = document.createElement('div');
        lab.className = 'shiftLabel';
        lab.innerHTML = arr.slice(0,2).map(s=>labelMap[s]||s).join('<br>');
        div.appendChild(lab);
      }

      div.addEventListener('click', () => onDayClick(key));
      cal.appendChild(div);
    }

    updateTotals();
  }

  function onDayClick(key){
    if (!activeShift) {
      // quick hint
      return;
    }
    const arr = schedule[key] ? [...schedule[key]] : [];
    const idx = arr.indexOf(activeShift);
    if (idx >= 0) arr.splice(idx,1);
    else arr.push(activeShift);
    schedule[key] = arr;
    save();
    renderCalendar();
  }

  function updateTotals(){
    const t=computeMonthTotals(view);

    $('tNights').textContent=String(t.nights);
    $('t5m').textContent=String(t.fiveM);
    $('tGross').textContent=euro(t.gross);
    $('tDed').textContent=euro(t.ded);
    $('tNet').textContent=euro(t.net);

    $('calcNights').textContent=String(t.nights);
    $('calc5m').textContent=String(t.fiveM);
    $('net').textContent=euro(t.net);
    $('breakdown').textContent=`Μικτό: ${euro(t.gross)} • Κρατήσεις 24%: ${euro(t.ded)} • Καθαρό: ${euro(t.net)}`;

    $('calcNightsDates').textContent = t.nightDates.length ? t.nightDates.join(', ') : '—';
    $('calc5mDates').textContent = t.fiveMDates.length ? t.fiveMDates.join(', ') : '—';
  }

  function gotoMonth(delta){
    view = new Date(view.getFullYear(), view.getMonth()+delta, 1);
    renderCalendar();
  }

  function clearMonth(){
    const y=view.getFullYear();
    const m=view.getMonth();
    const last=new Date(y,m+1,0).getDate();
    for (let day=1; day<=last; day++){
      const key=ymd(new Date(y,m,day));
      delete schedule[key];
    }
    save();
    renderCalendar();
  }

  // Cycle fill (5-day pattern)
  function fillCycle(){
    const startStr = $('cycleStart').value;
    if (!startStr) return alert('Βάλε ημερομηνία έναρξης κύκλου.');

    const months = Number($('cycleMonths').value || 1);
    const start = parseYMD(startStr);

    // read 5-day pattern from existing schedule
    const pattern = [];
    for (let i=0;i<5;i++){
      const d = new Date(start);
      d.setDate(d.getDate()+i);
      const key = ymd(d);
      const arr = schedule[key];
      if (!arr || arr.length===0) {
        return alert('Ο κύκλος πρέπει να είναι ήδη συμπληρωμένος για 5 συνεχόμενες ημέρες (έναρξη + 4).');
      }
      pattern.push([...arr]);
    }

    const end = new Date(view.getFullYear(), view.getMonth()+months, 1);
    // fill from start onward by repeating pattern
    let cursor = new Date(start);
    // don't overwrite the first 5 days - start after them
    cursor.setDate(cursor.getDate()+5);

    while (cursor < end){
      for (let i=0;i<5;i++){
        const d = new Date(cursor);
        d.setDate(d.getDate()+i);
        if (d >= end) break;
        const key = ymd(d);
        const existing = schedule[key];
        if (!existing || existing.length===0){
          schedule[key] = [...pattern[i]];
        }
      }
      cursor.setDate(cursor.getDate()+5);
    }

    save();
    renderCalendar();
    alert('Έτοιμο! Γέμισε ο κύκλος.');
  }

  function init(){
    load();

    tabCalcBtn.addEventListener('click', ()=>{showTab('calc'); updateTotals();});
    tabCalBtn.addEventListener('click', ()=>{showTab('cal'); renderCalendar();});

    $('calPrev').addEventListener('click', ()=>gotoMonth(-1));
    $('calNext').addEventListener('click', ()=>gotoMonth(1));
    $('calcPrev').addEventListener('click', ()=>gotoMonth(-1));
    $('calcNext').addEventListener('click', ()=>gotoMonth(1));

    document.querySelectorAll('.shift[data-shift]').forEach(btn=>{
      btn.addEventListener('click', ()=> setActiveShift(btn.dataset.shift));
    });

    $('clearMonth').addEventListener('click', ()=>{
      if (confirm('Να διαγραφούν όλες οι βάρδιες του μήνα;')) clearMonth();
    });

    $('fillCycle').addEventListener('click', fillCycle);

    // default date for cycle start: first day of current month
    const today = new Date();
    $('cycleStart').value = ymd(new Date(today.getFullYear(), today.getMonth(), 1));

    setActiveShift('NY');
    renderCalendar();
    showTab('calc');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
