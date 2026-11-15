const ICONS = {
  green: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 9"></path></svg>',
  yellow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.6"></circle></svg>',
  blue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 6-6 4 3 6-8"></path><path d="M14 5h6v6"></path></svg>',
  red: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 16.5h.01"></path></svg>'
};
const PHASES = {
  'NORMAL': { color: 'green', label: 'GRÜN', title: 'NORMAL', description: 'Der Markt befindet sich außerhalb einer erkannten Stressphase. Keine historische Referenzanzeige.' },
  'WARNUNG': { color: 'yellow', label: 'GELB', title: 'WARNUNG', description: 'Erhöhte Aufmerksamkeit ist angebracht. Eine historische Referenz wird in diesem Zustand nicht allein wegen der gelben Farbe angezeigt.' },
  'STABILISIERUNG': { color: 'yellow', label: 'GELB', title: 'STABILISIERUNG', description: 'Der Markt zeigt erste Anzeichen einer Stabilisierung. Ein vergleichbarer historischer Verlauf dient als Orientierung, sofern vorhanden.' },
  'ERSTE VERBESSERUNG': { color: 'yellow', label: 'GELB', title: 'ERSTE VERBESSERUNG', description: 'Die Entwicklung verbessert sich, die Erholung ist aber noch nicht bestätigt.' },
  'STRUKTURELLE VERBESSERUNG': { color: 'yellow', label: 'GELB', title: 'STRUKTURELLE VERBESSERUNG', description: 'Die Verbesserung ist struktureller; die bestätigte Erholung ist noch nicht erreicht.' },
  'ERHOLUNG BESTÄTIGT': { color: 'blue', label: 'BLAU', title: 'ERHOLUNG BESTÄTIGT', description: 'Die vereinbarten Kriterien für eine bestätigte Erholung sind erfüllt.' },
  'STRESS': { color: 'red', label: 'ROT', title: 'STRESS', description: 'Erkannte Stressphase. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' },
  'STRESS HOCH': { color: 'red', label: 'ROT', title: 'STRESS HOCH', description: 'Erhöhte Stressintensität. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' },
  'STRESS EXTREM': { color: 'red', label: 'ROT', title: 'STRESS EXTREM', description: 'Extreme Stressintensität. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' },
  'AUSSERGEWÖHNLICHER STRESS': { color: 'red', label: 'ROT', title: 'AUSSERGEWÖHNLICHER STRESS', description: 'Außergewöhnliche Stressintensität. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' }
};
const REFERENCE_STATES = new Set(['STABILISIERUNG','ERSTE VERBESSERUNG','STRUKTURELLE VERBESSERUNG','ERHOLUNG BESTÄTIGT','STRESS','STRESS HOCH','STRESS EXTREM','AUSSERGEWÖHNLICHER STRESS']);


const INTRADAY_WORKER = "https://marktkompass-intraday-test.24crfnm2vk.workers.dev";

async function loadTrendData() {
  const worker = INTRADAY_WORKER;
  const urls = [
    `${worker}/chart-history?t=${Date.now()}`,
    `${worker}/intraday-candidate?t=${Date.now()}`
  ];
  const requests = await Promise.allSettled(urls.map(url =>
    fetch(url, { cache: "no-store" }).then(async response => ({
      ok: response.ok,
      status: response.status,
      data: await response.json().catch(() => null)
    }))
  ));
  const unpack = result => result.status === "fulfilled"
    ? result.value
    : { ok: false, status: "Netzwerk/CORS", error: String(result.reason) };
  const historyResult = unpack(requests[0]);
  const candidateResult = unpack(requests[1]);
  return {
    history: historyResult.data || null,
    candidate: candidateResult.data || null,
    diagnostics: {
      history: historyResult.ok ? "OK" : `${historyResult.status}: ${historyResult.error || historyResult.data?.error || historyResult.data?.message || "keine gültige Antwort"}`,
      candidate: candidateResult.ok ? "OK" : `${candidateResult.status}: ${candidateResult.error || candidateResult.data?.error || candidateResult.data?.message || "keine gültige Antwort"}`
    }
  };
}

function formatIntradayTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })
    : "Zeitstempel nicht verfügbar";
}

function renderMarketTrendChart(history, candidate, regularVix, statusDate) {
  if (history?.available !== true || !Array.isArray(history.points)) {
    const reason = trendDataCache.diagnostics?.history || history?.error || history?.message || "Worker-Antwort ohne verfügbare Verlaufsdaten";
    return '<div class="card"><b>Marktverlauf</b><p class="note">Die gemeinsame Trenddarstellung ist derzeit nicht verfügbar.</p><small>Technische Prüfung: '+String(reason).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</small></div>';
  }

  const points = history.points.map(item => ({
    time: Date.parse(item.date + "T12:00:00Z"),
    date: item.date,
    acwi: Number(item.acwi),
    sma200: Number(item.sma200),
    vix: Number(item.vix)
  })).filter(p => Number.isFinite(p.time) && [p.acwi,p.sma200,p.vix].every(Number.isFinite));

  if (points.length < 30) {
    return '<div class="card"><b>Marktverlauf</b><p class="note">Für die Trenddarstellung liegen weniger als 30 gemeinsame Handelstage vor.</p></div>';
  }

  const candidateTime = Date.parse(candidate?.timestamp);
  const intradayValid = candidate?.available === true &&
    Number.isFinite(Number(candidate.vix)) && Number(candidate.vix) > 0 &&
    Number.isFinite(candidateTime) &&
    candidate.acwiDate === history.latestDate &&
    candidate.acwiDate === statusDate;
  const intraday = intradayValid ? { time: candidateTime, vix: Number(candidate.vix) } : null;

  const width = 760, height = 330, left = 64, right = 54, top = 24, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const minTime = points[0].time;
  const maxTime = Math.max(points[points.length - 1].time, intraday?.time || 0);
  const acwiValues = points.flatMap(p => [p.acwi,p.sma200]);
  const acwiMinRaw = Math.min(...acwiValues), acwiMaxRaw = Math.max(...acwiValues);
  const acwiPad = Math.max((acwiMaxRaw - acwiMinRaw) * 0.12, 1);
  const acwiMin = acwiMinRaw - acwiPad, acwiMax = acwiMaxRaw + acwiPad;
  const vixValues = points.map(p => p.vix).concat(intraday ? [intraday.vix] : []);
  const vixMinRaw = Math.min(...vixValues), vixMaxRaw = Math.max(...vixValues);
  const vixPad = Math.max((vixMaxRaw - vixMinRaw) * 0.12, 1);
  const vixMin = Math.max(0, vixMinRaw - vixPad), vixMax = vixMaxRaw + vixPad;
  const x = t => left + (maxTime === minTime ? 0.5 : (t-minTime)/(maxTime-minTime))*plotWidth;
  const yAcwi = v => top + (acwiMax-v)/(acwiMax-acwiMin)*plotHeight;
  const yVix = v => top + (vixMax-v)/(vixMax-vixMin)*plotHeight;
  const path = (key, yFn) => points.map((p,i) => (i ? "L" : "M") + x(p.time).toFixed(1) + " " + yFn(p[key]).toFixed(1)).join(" ");

  const grid = Array.from({length:5},(_,i)=>{
    const f=i/4, py=top+f*plotHeight;
    const av=acwiMax-(acwiMax-acwiMin)*f, vv=vixMax-(vixMax-vixMin)*f;
    return '<line x1="'+left+'" y1="'+py.toFixed(1)+'" x2="'+(width-right)+'" y2="'+py.toFixed(1)+'" stroke="#e5e5e5"/>'+
      '<text x="'+(left-8)+'" y="'+(py+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="#555">'+av.toFixed(1)+'</text>'+
      '<text x="'+(width-right+8)+'" y="'+(py+4).toFixed(1)+'" font-size="11" fill="#555">'+vv.toFixed(1)+'</text>';
  }).join("");

  const week = 7 * 24 * 60 * 60 * 1000;
  const weeklyMarkers = [];
  for (let t=minTime+week; t<maxTime; t+=week) {
    const px=x(t);
    weeklyMarkers.push('<line x1="'+px.toFixed(1)+'" y1="'+top+'" x2="'+px.toFixed(1)+'" y2="'+(top+plotHeight)+'" stroke="#d7dce2" stroke-dasharray="2 5"/>');
  }

  const intradayMark = intraday
    ? '<line x1="'+x(intraday.time).toFixed(1)+'" y1="'+top+'" x2="'+x(intraday.time).toFixed(1)+'" y2="'+(top+plotHeight)+'" stroke="#7652a5" stroke-dasharray="4 4"/>'+
      '<circle cx="'+x(intraday.time).toFixed(1)+'" cy="'+yVix(intraday.vix).toFixed(1)+'" r="5.5" fill="#7652a5" stroke="#fff" stroke-width="2"><title>Intraday-VIX '+intraday.vix.toFixed(2)+'</title></circle>'
    : "";
  const fmtDate = t => new Date(t).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"});
  const latest = points[points.length-1];
  const endLabel = intraday ? fmtDate(intraday.time) : fmtDate(latest.time);

  return '<div class="card market-trend-card"><b>Marktverlauf – letzte '+points.length+' gemeinsame Handelstage</b>'+
    '<svg class="vix-chart market-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Gemeinsame Zeitachse für MSCI ACWI, SMA200 und VIX mit getrennten Werteskalen">'+
    grid+weeklyMarkers.join("")+
    '<path d="'+path("acwi",yAcwi)+'" fill="none" stroke="#2878b5" stroke-width="2.6" stroke-linejoin="round"/>'+
    '<path d="'+path("sma200",yAcwi)+'" fill="none" stroke="#d28b22" stroke-width="2.2" stroke-dasharray="6 4" stroke-linejoin="round"/>'+
    '<path d="'+path("vix",yVix)+'" fill="none" stroke="#555" stroke-width="2.2" stroke-linejoin="round"/>'+
    intradayMark+
    '<text x="'+left+'" y="'+(height-14)+'" font-size="11" fill="#555">'+fmtDate(minTime)+'</text>'+
    '<text x="'+(width-right)+'" y="'+(height-14)+'" text-anchor="end" font-size="11" fill="#555">'+endLabel+'</text>'+
    '<text x="14" y="'+(top+plotHeight/2)+'" transform="rotate(-90 14 '+(top+plotHeight/2)+')" font-size="11" fill="#2878b5">ACWI / SMA200 – Punkte</text>'+
    '<text x="'+(width-10)+'" y="'+(top+plotHeight/2)+'" transform="rotate(90 '+(width-10)+' '+(top+plotHeight/2)+')" font-size="11" fill="#555">VIX – Punkte</text>'+
    '</svg>'+
    '<div class="chart-legend"><span><i style="background:#2878b5"></i>MSCI ACWI</span><span><i style="background:#d28b22"></i>SMA200</span><span><i style="background:#555"></i>VIX regulär</span><span><i class="legend-intraday"></i>VIX Intraday</span></div>'+
    '<small>ACWI und SMA200 verwenden dieselbe linke Skala. Der VIX verwendet eine eigene rechte Skala. Die senkrechten Markierungen gliedern die Zeitachse in 7-Tage-Abschnitte.</small></div>';
}

let trendDataCache = { history: null, candidate: null };

async function refreshTrendData(){
  trendDataCache = await loadTrendData();
  await loadStatus();
}

async function loadStatus(){
  const root=document.getElementById('app');
  try{
    const r=await fetch('status.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('Statusdatei nicht verfügbar.');
    const s=await r.json();
    const trendData=trendDataCache;
    const trendHtml=renderMarketTrendChart(trendData.history,trendData.candidate,s.vix,s.date);
    const phase=PHASES[s.state]||{color:'gray',label:s.trafficLight||'UNBEKANNT',title:`Status – ${s.state||'unbekannt'}`,description:'Für diesen Zustand ist keine spezielle Darstellung definiert.'};
    const showReference=REFERENCE_STATES.has(s.state);
    const formatPercent=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'–':`${Number(value)>0?'+':''}${Number(value).toFixed(2)} %`;
    const formatNumber=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'–':Number(value).toFixed(2);
    const candidate=trendData.candidate;
    const candidateTime=Date.parse(candidate?.timestamp);
    const intradayValid=candidate?.available===true&&Number.isFinite(Number(candidate.vix))&&Number(candidate.vix)>0&&Number.isFinite(candidateTime)&&Number(s.vix)>0&&candidate.acwiDate===trendData.history?.latestDate&&candidate.acwiDate===s.date;
    const intradayValue=intradayValid?Number(candidate.vix):null;
    const intradayChange=intradayValid?((intradayValue/Number(s.vix))-1)*100:null;
    const intradayHtml=intradayValid
      ? '<div class="intraday-panel"><div class="intraday-heading">Ergänzende Intraday-Information</div><div class="intraday-row"><span>Intraday-VIX</span><strong>'+formatNumber(intradayValue)+' Punkte</strong></div><div class="intraday-row"><span>Abweichung zum letzten VIX-Schlusskurs</span><strong>'+formatPercent(intradayChange)+'</strong></div><div class="intraday-time">Anbieter-Zeitstempel: '+formatIntradayTime(candidate.timestamp)+'</div></div>'
      : '<div class="intraday-panel intraday-unavailable"><div class="intraday-heading">Ergänzende Intraday-Information</div><div>Derzeit kein gültiger Intraday-Messpunkt verfügbar.</div><small>Technische Prüfung: '+String(trendData.diagnostics?.candidate || candidate?.message || candidate?.error || "Keine gültige Worker-Antwort").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</small></div>';
    let reference='';
    const h=s.historicalReference;
    if(showReference&&h&&h.found===true){
      reference=`<div class="card"><div class="label">Historischer Referenzverlauf</div>
        <div class="row">Vergleichbarer Zeitpunkt: <b>${h.date||'–'}</b></div>
        <div class="row">Stressereignis begann: ${h.stressStart||'–'}</div>
        <div class="row">Stressniveau damals: ${formatPercent(h.stressLevel)}</div>
        <div class="row">ACWI seit Stressbeginn: ${formatPercent(h.acwiChangeSinceStart)}</div>
        <div class="row">Abstand zur SMA200: ${formatPercent(h.distanceToSma200)}</div>
        <div class="row">VIX: ${formatNumber(h.vix)} Punkte</div>
        <small>Zusatzinformation zur historischen Einordnung – keine Prognose und kein Kauf- oder Verkaufssignal.</small></div>`;
    } else if(showReference){
      reference='<div class="card"><div class="label">Historischer Referenzverlauf</div><div class="row">Kein vergleichbarer Fall für diese Situation gefunden.</div></div>';
    }
    const distance=Number(s.distance);
    const distanceText=Number.isFinite(distance)?`${distance>0?'+':''}${distance.toFixed(2)} %`:'–';
    const distanceStyle=Number.isFinite(distance)&&distance<0?' style="color:red"':'';
    root.innerHTML=`
      <div class="card">
        <div class="phase-banner">
          <div class="phase-icon phase-${phase.color}">${ICONS[phase.color]||''}</div>
          <div><div class="phase-title">${phase.title}</div><p class="phase-description">${phase.description}</p></div>
        </div>
        <div><b>Version:</b> ${s.version||'–'}</div>
        <div><b>Datenstand:</b> ${s.date||'–'}</div>
      </div>
      <div class="card">
        <div class="row"><span class="label">MSCI ACWI:</span> ${formatNumber(s.acwi)} Punkte</div>
        <div class="row"><span class="label">SMA200:</span> ${formatNumber(s.sma200)} Punkte</div>
        <div class="row"><span class="label">Abstand zur SMA200:</span> <span${distanceStyle}>${distanceText}</span></div>
        <div class="row"><span class="label">VIX:</span> ${formatNumber(s.vix)} Punkte</div>
        <div class="row"><span class="label">VIX Tagesveränderung:</span> ${formatPercent(s.vixChange)}</div>
        ${intradayHtml}
      </div>${trendHtml}${reference}`;
  }catch(e){root.innerHTML='<div class="card error">Aktueller Marktstatus konnte nicht geladen werden.</div>';}
}
// Der Status wird alle 5 Sekunden aktualisiert. Die Worker-Abfrage für
// Intraday/Verlauf erfolgt separat beim Öffnen und danach höchstens alle 15 Minuten.
loadStatus();
refreshTrendData();
setInterval(loadStatus, 5000);
setInterval(refreshTrendData, 15 * 60 * 1000);
