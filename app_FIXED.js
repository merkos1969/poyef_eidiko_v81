document.addEventListener("DOMContentLoaded", function(){

const tabCalcBtn=document.getElementById("tabCalcBtn");
const tabCalBtn=document.getElementById("tabCalBtn");
const tabCalc=document.getElementById("tabCalc");
const tabCal=document.getElementById("tabCal");

tabCalcBtn.onclick=()=>{tabCalc.style.display="block";tabCal.style.display="none";};
tabCalBtn.onclick=()=>{tabCalc.style.display="none";tabCal.style.display="block";renderCal();};

let activeShift="PR";
document.querySelectorAll(".shiftBtn").forEach(b=>{
  b.onclick=()=>activeShift=b.dataset.s;
});

const grid=document.getElementById("calGrid");
let view=new Date(); view.setDate(1);

function key(d){return d.toISOString().slice(0,10);}

function renderCal(){
  const y=view.getFullYear(),m=view.getMonth();
  const first=new Date(y,m,1);
  const start=new Date(first);
  start.setDate(first.getDate()-((first.getDay()+6)%7));

  let html='<div class="calRow">';
  ["Δε","Τρ","Τε","Πε","Πα","Σα","Κυ"].forEach(d=>html+=`<div class="calDow">${d}</div>`);
  html+='</div>';

  let data=JSON.parse(localStorage.getItem("calData")||"{}");

  for(let r=0;r<6;r++){
    html+='<div class="calRow">';
    for(let c=0;c<7;c++){
      const d=new Date(start); d.setDate(start.getDate()+r*7+c);
      const k=key(d);
      const shifts=data[k]||[];
      html+=`<div class="calCell" data-k="${k}">
      <div class="dnum">${d.getDate()}</div>
      ${shifts.map(s=>'<div class="badge">'+s+'</div>').join("")}
      </div>`;
    }
    html+='</div>';
  }

  grid.innerHTML=html;

  document.querySelectorAll(".calCell").forEach(cell=>{
    cell.onclick=()=>{
      const k=cell.dataset.k;
      let data=JSON.parse(localStorage.getItem("calData")||"{}");
      if(!data[k]) data[k]=[];

      if(data[k].includes(activeShift))
        data[k]=data[k].filter(s=>s!==activeShift);
      else
        data[k].push(activeShift);

      localStorage.setItem("calData",JSON.stringify(data));
      updateTotals();
      renderCal();
    };
  });

  updateTotals();
}

function updateTotals(){
  let data=JSON.parse(localStorage.getItem("calData")||"{}");
  let nights=0,fives=0;

  Object.keys(data).forEach(k=>{
    const d=new Date(k);
    const dow=d.getDay();
    const shifts=data[k];

    if(shifts.includes("NY")){
      if(dow===5) fives++;   // Παρασκευή ΝΥ = μόνο 5Μ
      else nights++;
    }
    if(dow===6||dow===0){
      if(shifts.includes("PR")||shifts.includes("AP")||shifts.includes("NY"))
        fives++;
    }
  });

  const nightInput=document.getElementById("nightHours");
  const fiveInput=document.getElementById("fiveDays");
  if(nightInput) nightInput.value=nights;
  if(fiveInput) fiveInput.value=fives;

  if(typeof calc==="function") calc();
}

document.getElementById("clearMonth").onclick=()=>{
  localStorage.removeItem("calData");
  renderCal();
};

});
