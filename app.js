// Simple Calendar + Auto Calculator (offline-friendly)
// Stores shifts in localStorage per month (YYYY-MM): day -> ["PR","NY",...]
// Shifts: PR, AP, NY, AD, RP

(function(){
  const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
  const SHIFT_LABEL = {

};
  const SHIFT_BADGE_CLASS = {

};
  const PAY_NIGHT = 26.5;
  const PAY_5M = 46.0;
  const DED_MTPY = 0.02;
  const DED_UNEMP = 0.02;
  const DED_TAX = 0.20;

  const $ = (id)=>document.getElementById(id);

  // tabs
  const tabCalc = $('tabCalc');
  const tabCal = $('tabCal');
  const viewCalc = $('viewCalc');
  const viewCal = $('viewCal');

  function show(which){
    if(which==='calc'){
      tabCalc.classList.add('active'); tabCal.classList.remove('active');
      viewCalc.classList.remove('hidden'); viewCal.classList.add('hidden');
    }else{
      tabCal.classList.add('active'); tabCalc.classList.remove('active');
      viewCal.classList.remove('hidden'); viewCalc.classList.add('hidden');
    }
  }
  tabCalc.addEventListener('click', ()=>show('calc'));
  tabCal.addEventListener('click', ()=>show('cal'));

  // month state (shared)
  let cur = new Date();
  cur.setDate(1);

  // shift selection
  let activeShift = 'PR';
  const shiftButtons = Array.from(document.querySelectorAll('.shift[data-shift]'));
  function setActiveShift(s){
    activeShift = s;
    shiftButtons.forEach(b=>{
      b.classList.toggle('active', b.dataset.shift === s);
    });
  }
  shiftButtons.forEach(b=> b.addEventListener('click', ()=>setActiveShift(b.dataset.shift)));
  setActiveShift('PR');

  // storage
  function ymKey(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `${y}-${m}`;
  }
  function loadMonth(d){
    const k = 'cal_' + ymKey(d);
    try{
      return JSON.parse(localStorage.getItem(k) || '{}') || {};
    }catch(e){
      return {};
    }
  }
  function saveMonth(d, data){
    const k = 'cal_' + ymKey(d);
    localStorage.setItem(k, JSON.stringify(data));
  }

  // helpers
  function fmtEuro(n){
    const x = Number(n)||0;
    return x.toLocaleString('el-GR',{minimumFractionDigits:2, maximumFractionDigits:2}) + '€';
  }
  function labelMonth(d){
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  // calendar render
  const calEl = $('calendar');
  function render(){
    $('labelMonth').textContent = labelMonth(cur);
    $('labelMonthCalc').textContent = labelMonth(cur);

    const data = loadMonth(cur);

    // build days
    calEl.innerHTML = '';
    const year = cur.getFullYear();
    const month = cur.getMonth();

    const first = new Date(year, month, 1);
    const startDow = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const daysInMonth = new Date(year, month+1, 0).getDate();

    // leading blanks
    for(let i=0;i<startDow;i++){
      const blank = document.createElement('div');
      blank.className = 'day off';
      blank.innerHTML = '<div class="num"></div>';
      calEl.appendChild(blank);
    }

    for(let day=1; day<=daysInMonth; day++){
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.dataset.day = String(day);

      const date = new Date(year, month, day);
      const dow = ['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'][(date.getDay()+6)%7];
      const items = Array.isArray(data[day]) ? data[day] : [];

      const badges = document.createElement('div');
      badges.className = 'badges';
      items.forEach(s=>{
        const sp = document.createElement('span');
        sp.className = 'badge ' + (SHIFT_BADGE_CLASS[s] || '');
        sp.textContent = SHIFT_LABEL[s] || s;
        badges.appendChild(sp);
      });

      cell.innerHTML = `<div class="num">${day}</div><div class="lbl">${dow}</div>`;
      cell.appendChild(badges);

      cell.addEventListener('click', ()=>{
        toggleShift(day);
      });

      calEl.appendChild(cell);
    }

    // trailing blanks (keep grid tidy)
    const totalCells = startDow + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for(let i=0;i<trailing;i++){
      const blank = document.createElement('div');
      blank.className = 'day off';
      blank.innerHTML = '<div class="num"></div>';
      calEl.appendChild(blank);
    }

    // update numbers everywhere
    updateTotals();
  }

  function toggleShift(day){
    const data = loadMonth(cur);
    const list = Array.isArray(data[day]) ? data[day].slice() : [];
    const idx = list.indexOf(activeShift);
    if(idx >= 0){
      list.splice(idx,1);
    }else{
      // allow multi-shift same day (e.g. PR + NY)
      list.push(activeShift);
    }
    if(list.length) data[day] = list;
    else delete data[day];
    saveMonth(cur, data);
    render();
  }

  // clear month
  $('btnClearMonth').addEventListener('click', ()=>{
    const ok = confirm('Καθαρισμός όλων των καταχωρήσεων του μήνα;');
    if(!ok) return;
    saveMonth(cur, {});
    render();
  });

  // month nav (calendar)
  $('btnPrevMonth').addEventListener('click', ()=>{
    cur = new Date(cur.getFullYear(), cur.getMonth()-1, 1);
    render();
  });
  $('btnNextMonth').addEventListener('click', ()=>{
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
    render();
  });

  // month nav (calc)
  $('btnPrevMonthCalc').addEventListener('click', ()=>{
    cur = new Date(cur.getFullYear(), cur.getMonth()-1, 1);
    render();
    show('calc');
  });
  $('btnNextMonthCalc').addEventListener('click', ()=>{
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
    render();
    show('calc');
  });

  // pdf
  $('btnPDF').addEventListener('click', ()=>{
    // print current view (calendar). On mobile choose "Save as PDF"
    show('cal');
    setTimeout(()=>window.print(), 150);
  });

  function updateTotals(){
    const data = loadMonth(cur);
    const year = cur.getFullYear();
    const month = cur.getMonth();

    // Υπολογισμός με κανόνες πληρωμής (σύμφωνα με ό,τι ζήτησες)
    // - Παρασκευή ΝΥ: πληρώνεται ως 1×5Μ (όχι νύχτα)
    // - Σάββατο ΝΥ: πληρώνεται ως 1×5Μ (όχι νύχτα)
    // - Σάββατο ΠΡ + ΝΥ: πληρώνεται 1×5Μ ΚΑΙ η νύχτα (δηλ. +1 νύχτα)
    // - Όλες οι άλλες ΝΥ: πληρώνονται ως νύχτα
    // - Χειροκίνητο 5Μ: αν βάλεις 5Μ σε ημέρα, μετράει επιπλέον

    const nightsDays = [];     // ημερομηνίες που πληρώνονται ως νύχτα
    const fiveDays = [];       // ημερομηνίες που πληρώνονται ως 5Μ (κανόνες)

    for (const k of Object.keys(data)) {
      const day = Number(k);
      if (!Number.isFinite(day)) continue;

      // sanitize παλιών δεδομένων (αν υπήρχε 5Μ/ΚΥ)
      const raw = Array.isArray(data[k]) ? data[k] : [];
      const list = raw.filter(s => s !== '5M' && s !== 'KY' && s !== 'ΚΥ');

      const d = new Date(year, month, day);
      const dow = d.getDay(); // 0 Κυ, 5 Πα, 6 Σα

      const hasPR = list.includes('PR');
      const hasAP = list.includes('AP');
      const hasNY = list.includes('NY');
      const hasAD = list.includes('AD');
      const hasRP = list.includes('RP');

      const hasAnyService = hasPR || hasAP || hasNY || hasAD || hasRP;

      // 5Μ για Σάββατο/Κυριακή με υπηρεσία (οποιαδήποτε βάρδια)
      if (hasAnyService && (dow === 6 || dow === 0)) {
        fiveDays.push(day);
      }

      // Κανόνες για NY (σύμφωνα με ό,τι ζήτησες)
      // - Παρασκευή ΝΥ: πληρώνεται ως 1×5Μ (όχι νύχτα)
      // - Σάββατο ΝΥ: πληρώνεται ως 1×5Μ (όχι νύχτα)
      // - Σάββατο ΠΡ + ΝΥ: πληρώνεται 1×5Μ ΚΑΙ η νύχτα (δηλ. +1 νύχτα)
      // - Όλες οι άλλες ΝΥ: πληρώνονται ως νύχτα

      if (hasNY) {
        if (dow === 5) { // Παρασκευή
          fiveDays.push(day);
        } else if (dow === 6) { // Σάββατο
          // (το 5Μ έχει ήδη προστεθεί από τον κανόνα Σαβ/Κυ, αλλά δεν πειράζει — θα γίνει uniq)
          if (hasPR) {
            nightsDays.push(day);
          }
        } else {
          nightsDays.push(day);
        }
      }
    }

const uniq = (arr) => Array.from(new Set(arr)).sort((a,b)=>a-b);
    const nightsUnique = uniq(nightsDays);
    const fiveUnique = uniq(fiveDays);

    const nights = nightsUnique.length;
    const five = fiveUnique.length;

    const gross = (nights * PAY_NIGHT) + (five * PAY_5M);
    const mtpy = gross * DED_MTPY;
    const unemp = gross * DED_UNEMP;
    const tax = gross * DED_TAX;
    const ded = mtpy + unemp + tax;
    const net = gross - ded;

    // calculator outputs
    $('outNights').textContent = String(nights);
    $('out5m').textContent = String(five);
    $('outGross').textContent = fmtEuro(gross);
    $('outMTPY').textContent = fmtEuro(mtpy);
    $('outUnemp').textContent = fmtEuro(unemp);
    $('outTax').textContent = fmtEuro(tax);
    $('outTotalDed').textContent = fmtEuro(ded);
    $('outNet').textContent = fmtEuro(net);

    const dFmt = (arr)=> arr.length ? arr.map(d=>String(d).padStart(2,'0') + '/' + String(month+1).padStart(2,'0')).join(', ') : '—';
    $('outNightsDates').textContent = dFmt(nightsDays);
    $('out5mDates').textContent = dFmt(fiveDays);

    // calendar summary
    $('sumNights').textContent = String(nights);
    $('sum5m').textContent = String(five);
    $('sumGross').textContent = fmtEuro(gross);
    $('sumDed').textContent = fmtEuro(ded);
    $('sumNet').textContent = fmtEuro(net);
  }

  // first render
  render();

  // show calculator by default
  show('calc');
})();
