(() => {
  'use strict';

  const STORAGE_KEY = 'railway-logistics-mvp1-scenario';
  const $ = (id) => document.getElementById(id);
  const inHouseOperator = 'In-house';
  const operators = [inHouseOperator, 'Transporter', 'Rail operator', 'Hub operator', 'Port operator', 'Shipping line', 'Dealer', 'Other'];

  function scenarioOperator(owner, defaultOwner) {
    if (typeof owner !== 'string' || !owner.trim()) return defaultOwner;
    // The previous operator list had one label that is no longer available.
    return operators.includes(owner) ? owner : inHouseOperator;
  }

  const processDefs = [
    { key: 'nacRelease', group: 'NAC', name: 'Vehicle release / PDI', owner: inHouseOperator, flow: 'all' },
    { key: 'roadTransfer', group: 'NAC → SFT', name: 'Road transfer to SFT', owner: 'Transporter', flow: 'all' },
    { key: 'sftReceiving', group: 'SFT', name: 'Receiving and registration', owner: inHouseOperator, flow: 'all' },
    { key: 'sftInspection', group: 'SFT', name: 'Inspection', owner: inHouseOperator, flow: 'all' },
    { key: 'trainLoad', group: 'SFT', name: 'Train loading and securing', owner: 'Rail operator', flow: 'all' },
    { key: 'rail1', group: 'SFT → Paya Besar', name: 'Rail travel to Paya Besar', owner: 'Rail operator', flow: 'all' },
    { key: 'payaShunting', group: 'Paya Besar', name: 'Shunting / wagon separation', owner: 'Rail operator', flow: 'all' },
    { key: 'payaUnload', group: 'Paya Besar', name: 'East Coast unloading', owner: 'Hub operator', flow: 'ec' },
    { key: 'payaStorage', group: 'Paya Besar', name: 'East Coast storage / staging', owner: 'Hub operator', flow: 'ec' },
    { key: 'payaDealerDelivery', group: 'Paya Besar → East Coast dealer', name: 'East Coast dealer delivery', owner: 'Transporter', flow: 'ec' },
    { key: 'rail2', group: 'Paya Besar → Kuantan', name: 'Rail travel to Kuantan Port', owner: 'Rail operator', flow: 'em' },
    { key: 'portHandling', group: 'Kuantan Port', name: 'Port receiving / yard handling', owner: 'Port operator', flow: 'em' },
    { key: 'vesselLoading', group: 'Kuantan Port', name: 'RORO vessel loading', owner: 'Port operator', flow: 'em' },
    { key: 'voyage', group: 'Kuantan → East Malaysia', name: 'Vessel voyage', owner: 'Shipping line', flow: 'em' },
    { key: 'emReceiving', group: 'East Malaysia hub', name: 'Receiving / storage', owner: 'Hub operator', flow: 'em' },
    { key: 'dealerDelivery', group: 'East Malaysia hub → dealer', name: 'Dealer delivery', owner: 'Transporter', flow: 'em' }
  ];

  const processHelp = 'Hands-on = minutes of active work by one crew for one cycle. Elapsed = clock time from starting to finishing that cycle, including waiting if you include it. Cycle basis says what one cycle handles. Crew size is people working together on one cycle. Parallel teams can work at the same time. Current / shift is the people actually available each shift. Batch size is the CBU handled by one batch cycle. Backlog is extra CBU already waiting at this process, and its deadline is the hours available to clear that backlog. These are separate from daily flow and physical stock.';
  const groups = [...new Set(processDefs.map(p => p.group))];
  const defaultState = {
    horizonDays: 14, demandMode: 'network', ecVolume: 137, emVolume: 221, mixedVolume: 359,
    wagonCount: 22, tripCapacity: 230, wagonTypical: 8, wagonMaximum: 10, sizeFactor: 1,
    dispatchQty: 176, requireFullLoad: true, trainsPerDay: 1, trainSlot: '16:00',
    shiftCount: 2, shiftHours: 8, shiftStart: '00:00', sidingMode: 'length', sidingLength: 500,
    sidingWagonLimit: null, wagonLength: null, locoLength: null, sidingCheckScope:'', vesselDispatchQty: 1500,
    vesselCapacity: null, payaDealerRate: 137, sabahShare: null, sabahDealerRate: null, sarawakDealerRate: null,
    breakMinutes: null, availabilityPct: null, startNacEc: 0, startNacEm: 0, nacTransferCapacity: null, nacTransferMinutes: null,
    startSftEc: 0, startSftEm: 0, startPayaEc: 0, startPortEm: 0, startEmHub: 0, startSabahStock:0, startSarawakStock:0,
    nacCapacity: null,
    sftCapacity: null, payaCapacity: null, portCapacity: null, emCapacity: null, vesselTripsPerWeek: null,
    processes: {}
  };

  function buildProcessInputs() {
    const root = $('processInputs');
    root.innerHTML = '';
    groups.forEach((group, groupIndex) => {
      const details = document.createElement('details');
      details.className = 'process-group';
      details.open = groupIndex < 3;
      const summary = document.createElement('summary');
      summary.textContent = group;
      details.appendChild(summary);
      const body = document.createElement('div');
      body.className = 'process-body';
      processDefs.filter(p => p.group === group).forEach(p => {
        const row = document.createElement('div');
        row.className = 'process-row';
        row.innerHTML = `
          <div class="process-name">${escapeHtml(p.name)}</div>
          <label>Cycle basis<select id="proc-${p.key}-basis" aria-label="${escapeHtml(p.name)} cycle basis"><option value="cbu">Per CBU</option><option value="wagon">Per wagon</option><option value="train">Per train</option><option value="ship">Per vessel dispatch</option><option value="batch">Per entered batch</option><option value="setup">Per setup</option></select></label>
          <label>Hands-on <span class="unit">min / cycle</span><input id="proc-${p.key}-touch" type="number" min="0" step="0.1" placeholder="TBD" aria-label="${escapeHtml(p.name)} hands-on minutes per cycle"></label>
          <label>Elapsed <span class="unit">min / cycle</span><input id="proc-${p.key}-elapsed" type="number" min="0" step="0.1" placeholder="TBD" aria-label="${escapeHtml(p.name)} elapsed minutes per cycle"></label>`;
        body.appendChild(row);
        const extra = document.createElement('div');
        extra.className = 'process-row extra-row';
        extra.innerHTML = `
          <label>Crew size<input id="proc-${p.key}-crew" type="number" min="1" step="1" value="1" aria-label="${escapeHtml(p.name)} crew size"></label>
          <label>Current / shift<input id="proc-${p.key}-current" type="number" min="0" step="1" placeholder="TBD" aria-label="${escapeHtml(p.name)} current headcount per shift"></label>
          <label>Parallel teams<input id="proc-${p.key}-teams" type="number" min="0" step="1" placeholder="TBD" aria-label="${escapeHtml(p.name)} parallel teams"></label>
          <label>Operator<select id="proc-${p.key}-owner" aria-label="${escapeHtml(p.name)} operator">${operators.map(operator => `<option>${operator}</option>`).join('')}</select></label>`;
        body.appendChild(extra);
        const planning = document.createElement('div');
        planning.className = 'process-row process-planning-row';
        planning.innerHTML = `
          <label>Batch size <span class="unit">CBU / cycle</span><input id="proc-${p.key}-batch" type="number" min="1" step="1" placeholder="TBD" aria-label="${escapeHtml(p.name)} CBU per batch"></label>
          <label>Backlog to clear <span class="unit">CBU</span><input id="proc-${p.key}-backlog" type="number" min="0" step="1" placeholder="Not entered" aria-label="${escapeHtml(p.name)} backlog quantity"></label>
          <label>Clearance deadline <span class="unit">hours</span><input id="proc-${p.key}-deadline" type="number" min="0.1" step="0.5" placeholder="Not entered" aria-label="${escapeHtml(p.name)} clearance deadline in hours"></label>`;
        body.appendChild(planning);
        const note = document.createElement('p');
        note.className = 'inline-note';
        note.innerHTML = `${escapeHtml(processHelp)} <span class="help-wrap"><button class="help" aria-label="Help for ${escapeHtml(p.name)}" aria-expanded="false" type="button">?</button><span class="tooltip" role="tooltip">${escapeHtml(processHelp)} If current headcount is entered, the model can compare it with the calculated requirement.</span></span>`;
        body.appendChild(note);
      });
      details.appendChild(body);
      root.appendChild(details);
    });
  }

  function addFieldHelp() {
    const definitions = {
      horizonDays: 'Projection length for the inventory and event timeline. Longer runs reveal growing queues.',
      demandMode: 'Choose which vehicle stream is included in the flow. Network mode uses East Coast plus East Malaysia; the mixed number remains a reconciliation reference.',
      ecVolume: 'East Coast vehicle release rate per day. It feeds the SFT queue and East Coast wagon allocation.',
      emVolume: 'East Malaysia vehicle release rate per day. It feeds the SFT queue and Kuantan Port flow.',
      mixedVolume: 'Reference volume from the earlier discussion. It is not added to the separate East Coast and East Malaysia streams.',
      sftCapacity: 'Maximum vehicles held at SFT. Blank means the model cannot check SFT overflow.',
      wagonCount: 'Number of wagons available on each train trip.',
      tripCapacity: 'Overall maximum vehicle count for one train trip, independent of the wagon-by-wagon calculation.',
      wagonTypical: 'Typical vehicle count per wagon before size adjustment.',
      wagonMaximum: 'Absolute adjustable vehicle count limit per wagon.',
      sizeFactor: 'Vehicle-size multiplier. Values above 1 reduce vehicles that fit; values below 1 increase fit up to the per-wagon maximum.',
      dispatchQty: 'Minimum ready CBU quantity required when the full-load setting is enabled.',
      trainsPerDay: 'Number of editable planning slots available each simulated day.',
      trainSlot: 'Clock time for the daily train slot. With multiple slots, the model spaces additional slots through the day.',
      shiftCount: 'Number of staffed shifts available each day.',
      shiftHours: 'Paid/rostered hours in one shift; used for labor availability calculations.',
      shiftStart: 'Start time for the first shift on the simulation clock.',
      sidingMode: 'Choose whether Paya Besar wagon fit is estimated by length or entered as a direct wagon-count limit.',
      sidingLength: 'Usable Paya Besar siding length. Wagon and locomotive lengths are needed for a length-based fit check.',
      sidingWagonLimit: 'Maximum wagons that can be accommodated for the Paya Besar shunting step.',
      wagonLength: 'Physical length of one wagon; required for the length-based siding check.',
      locoLength: 'Locomotive length to reserve when calculating usable siding fit.',
      payaCapacity: 'Maximum East Coast CBU storage at Paya Besar. Blank means overflow cannot be checked.',
      payaDealerRate: 'Daily quantity delivered from Paya Besar to East Coast dealers. The starting assumption matches the initial East Coast volume of 137 CBU/day; it is not a confirmed dispatch rate, so adjust it if local distribution differs.',
      vesselDispatchQty: 'Quantity that triggers vessel dispatch readiness at Kuantan Port.',
      vesselCapacity: 'Maximum CBU capacity of the selected vessel. Blank means vessel load capacity is not checked.',
      portCapacity: 'Maximum CBU storage at Kuantan Port. Blank means port-yard overflow cannot be checked.',
      emCapacity: 'Maximum CBU storage at the East Malaysia hub. Blank means hub overflow cannot be checked.',
      vesselTripsPerWeek: 'Repeating vessel departure frequency. Blank leaves cargo marked ready at port without simulating a sailing slot.',
      sabahShare: 'Optional share of East Malaysia CBU allocated to Sabah; the remaining quantity is assigned to Sarawak.',
      sabahDealerRate: 'Daily number of vehicles to deliver from the Sabah hub to dealers. Blank means TBD and no Sabah stock is deducted.',
      sarawakDealerRate: 'Daily number of vehicles to deliver from the Sarawak hub to dealers. Blank means TBD and no Sarawak stock is deducted.',
      breakMinutes: 'Breaks and other non-working minutes per person per shift.',
      availabilityPct: 'Share of non-break shift time available for productive work. Blank is treated as a theoretical 100%.',
      backlogQty: 'Optional backlog quantity used for the clearance-by-deadline staffing view.',
      backlogDeadline: 'Elapsed hours available to clear the backlog. Staffing is calculated across the modeled shifts in this window.',
      nacTransferCapacity: 'Maximum CBU that can move from NAC to SFT in one day. Blank means the model cannot release NAC stock to SFT.',
      nacTransferMinutes: 'Elapsed transfer time from NAC to SFT. Blank keeps arrival timing marked as TBD; enter zero only if you want same-time transfer.',
      startNacEc: 'East Coast vehicles already at NAC at the start of Day 1. This is an editable scenario input, not a confirmed stock count.',
      startNacEm: 'East Malaysia vehicles already at NAC at the start of Day 1. This is an editable scenario input, not a confirmed stock count.'
    };
    const processDefinitions={
      basis:'Cycle basis tells the model what one work cycle handles. For other processes, choose an entered batch size if no standard wagon, train or vessel size fits.',
      touch:'Hands-on time is active work minutes used to calculate staff. Enter minutes for one crew to complete one cycle.',
      elapsed:'Elapsed time is clock minutes from the start to end of one cycle. It sets the Gantt bar length and travel arrival timing for rail/vessel legs.',
      crew:'Crew size is the number of people needed together to complete one cycle. The staffing result rounds up to whole crews.',
      current:'People currently assigned to this process on each shift. The model compares this with required people.',
      teams:'Parallel teams are separate crews or workstations that can run cycles at the same time. Gantt duration is divided by this number.',
      batch:'CBU handled in one cycle. Used when cycle basis is Per entered batch. Leave blank when the real batch size is not known.',
      backlog:'Extra CBU already waiting at this process. It affects staffing only, not physical location inventory.',
      deadline:'Hours available to clear this process backlog. This is measured in elapsed clock hours and is not rounded to whole shifts.'
    };
    document.querySelectorAll('.input-panel label').forEach(label => {
      if (label.classList.contains('switch-label')) return;
      const input = label.querySelector('input,select');
      if (!input || label.querySelector('.help-wrap')) return;
      const labelText = [...label.childNodes].filter(node => node !== input).map(node => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      const section = label.closest('.input-section')?.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim() || 'this section';
      const processField=input.id.match(/^proc-.+-(basis|touch|elapsed|crew|current|teams|batch|backlog|deadline)$/)?.[1];
      const copy = definitions[input.id] || (processField?processDefinitions[processField]:null) || `${labelText}. Enter the confirmed or planning value for ${section.toLowerCase()}. It is used in the process staffing or timing results; blank values remain TBD.`;
      const row = document.createElement('span');
      row.className = 'field-label-row';
      const title = document.createElement('span');
      title.textContent = labelText;
      const wrap = document.createElement('span');
      wrap.className = 'help-wrap';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'help'; btn.textContent = '?'; btn.setAttribute('aria-label', `Help: ${labelText}`); btn.setAttribute('aria-expanded', 'false');
      const tip = document.createElement('span');
      tip.className = 'tooltip'; tip.setAttribute('role', 'tooltip'); tip.textContent = copy;
      if (input.id) { tip.id = `tip-${input.id}`; btn.setAttribute('aria-describedby', tip.id); }
      wrap.append(btn, tip); row.append(title, wrap);
      [...label.childNodes].forEach(node => { if (node !== input) label.removeChild(node); });
      label.insertBefore(row, input);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function numberValue(id) {
    const raw = $(id)?.value;
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  function readState() {
    const s = {};
    Object.keys(defaultState).forEach(k => {
      const el = $(k);
      if (!el) return;
      if (el.type === 'checkbox') s[k] = el.checked;
      else if (el.type === 'number') s[k] = numberValue(k);
      else s[k] = el.value;
    });
    s.processes = {};
    processDefs.forEach(p => {
      s.processes[p.key] = {
        basis: $(`proc-${p.key}-basis`).value,
        touch: numberValue(`proc-${p.key}-touch`),
        elapsed: numberValue(`proc-${p.key}-elapsed`),
        crew: numberValue(`proc-${p.key}-crew`) || 1,
        current: numberValue(`proc-${p.key}-current`),
        teams: numberValue(`proc-${p.key}-teams`),
        batch: numberValue(`proc-${p.key}-batch`),
        backlog: numberValue(`proc-${p.key}-backlog`),
        deadline: numberValue(`proc-${p.key}-deadline`),
        owner: $(`proc-${p.key}-owner`).value
      };
    });
    return s;
  }

  function applyState(s) {
    const source = { ...defaultState, ...s };
    Object.keys(defaultState).forEach(k => {
      const el = $(k);
      if (!el || k === 'processes') return;
      const value = source[k];
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else if (value === null || value === undefined) el.value = '';
      else el.value = value;
    });
    processDefs.forEach(p => {
      const value = s.processes?.[p.key] || {};
      $(`proc-${p.key}-basis`).value = value.basis || (['trainLoad','rail1','rail2','payaShunting'].includes(p.key) ? 'train' : ['vesselLoading','voyage'].includes(p.key) ? 'ship' : 'cbu');
      $(`proc-${p.key}-touch`).value = value.touch ?? '';
      $(`proc-${p.key}-elapsed`).value = value.elapsed ?? '';
      $(`proc-${p.key}-crew`).value = value.crew ?? 1;
      $(`proc-${p.key}-current`).value = value.current ?? '';
      $(`proc-${p.key}-teams`).value = value.teams ?? '';
      $(`proc-${p.key}-batch`).value = value.batch ?? '';
      $(`proc-${p.key}-backlog`).value = value.backlog ?? '';
      $(`proc-${p.key}-deadline`).value = value.deadline ?? '';
      $(`proc-${p.key}-owner`).value = scenarioOperator(value.owner, p.owner);
    });
    updateDerived();
  }

  function processDefaults() {
    const p = {};
    processDefs.forEach(def => p[def.key] = { basis: ['trainLoad','rail1','rail2','payaShunting'].includes(def.key) ? 'train' : ['vesselLoading','voyage'].includes(def.key) ? 'ship' : 'cbu', touch: null, elapsed: null, crew: 1, current: null, teams: null, batch: null, backlog: null, deadline: null, owner: def.owner });
    return p;
  }

  function getEffectivePerWagon(s) {
    const typical = Math.max(0, s.wagonTypical ?? 0);
    const sizeFactor = Math.max(.1, s.sizeFactor || 1);
    const maxPer = Math.max(0, s.wagonMaximum ?? 0);
    return Math.max(0, Math.min(maxPer, Math.floor(typical / sizeFactor)));
  }
  function getEffectiveCapacity(s) {
    const wagons = Math.max(0, s.wagonCount || 0);
    const cap = Math.max(0, s.tripCapacity || 0);
    return Math.max(0, Math.min(cap, wagons * getEffectivePerWagon(s)));
  }
  function updateDerived() {
    const s = readState();
    const perWagon = getEffectivePerWagon(s);
    const eff = getEffectiveCapacity(s);
    $('effectiveCapacity').textContent = `${eff.toLocaleString()} CBU`;
    $('effectiveCapacityNote').textContent = `${s.wagonCount || 0} wagons × ${perWagon} usable CBU, limited by ${s.tripCapacity || 0} trip cap`;
    const selectedDaily = s.demandMode === 'east-coast' ? Math.max(0,s.ecVolume||0) : s.demandMode === 'east-malaysia' ? Math.max(0,s.emVolume||0) : Math.max(0,s.ecVolume||0)+Math.max(0,s.emVolume||0);
    const fillEstimate = selectedDaily > 0 && s.dispatchQty !== null ? Math.max(0,s.dispatchQty)/selectedDaily : null;
    $('fillEstimate').textContent = fillEstimate === null ? 'TBD' : `${fmt1(fillEstimate)} day(s)`;
    $('fillEstimateNote').textContent = `Simple estimate using ${fmt(selectedDaily)} CBU/day; excludes NAC transfer limits, queues, wagon packing and schedule waits.`;
    const breakMin = s.breakMinutes;
    const avail = s.availabilityPct;
    if (breakMin === null && avail === null) $('availableMinutes').textContent = `${Math.max(0, (s.shiftHours || 0) * 60)} min · theoretical`;
    else {
      const net = Math.max(0, ((s.shiftHours || 0) * 60 - (breakMin || 0)) * ((avail ?? 100) / 100));
      $('availableMinutes').textContent = `${net.toFixed(0)} min / worker / shift${avail === null ? ' · availability assumed 100%' : ''}`;
    }
    const mode = $('sidingMode').value;
    $('sidingWagonLimit').disabled = mode !== 'count';
    $('sidingLength').disabled = mode !== 'length';
    $('wagonLength').disabled = mode !== 'length';
    $('locoLength').disabled = mode !== 'length';
  }

  function volumeByMode(s) {
    const ec = Math.max(0, Math.round(s.ecVolume || 0));
    const em = Math.max(0, Math.round(s.emVolume || 0));
    if (s.demandMode === 'east-coast') return { ec, em: 0 };
    if (s.demandMode === 'east-malaysia') return { ec: 0, em };
    return { ec, em };
  }

  function packTrain(ecAvailable, emAvailable, s) {
    const wagonCount = Math.max(0, Math.floor(s.wagonCount || 0));
    const wagonCap = getEffectivePerWagon(s);
    const tripCap = Math.max(0, Math.floor(Math.min(s.tripCapacity || 0, wagonCount * wagonCap)));
    let ecLeft = Math.max(0, Math.floor(ecAvailable));
    let emLeft = Math.max(0, Math.floor(emAvailable));
    const wagons = { ec: 0, em: 0 };
    const loaded = { ec: 0, em: 0 };
    if (!wagonCount || !wagonCap || !tripCap) return { wagons, loaded, total: 0, capacity: tripCap };

    // Allocate separate wagons in proportion to the ready destination mix, then use spare wagons for remaining vehicles.
    const ready = ecLeft + emLeft;
    let targetEc = ready ? Math.round(Math.min(tripCap, wagonCount * wagonCap) * ecLeft / ready) : 0;
    let targetEm = Math.min(tripCap, wagonCount * wagonCap) - targetEc;
    let ecWagons = ecLeft > 0 ? Math.min(wagonCount, Math.ceil(targetEc / wagonCap)) : 0;
    let emWagons = emLeft > 0 ? Math.min(wagonCount - ecWagons, Math.ceil(targetEm / wagonCap)) : 0;
    while (ecWagons + emWagons > wagonCount) {
      if (ecWagons >= emWagons && ecWagons > 0) ecWagons--; else if (emWagons > 0) emWagons--; else break;
    }
    wagons.ec = ecWagons; wagons.em = emWagons;
    loaded.ec = Math.min(ecLeft, ecWagons * wagonCap);
    loaded.em = Math.min(emLeft, emWagons * wagonCap);
    let remainingWagons = wagonCount - ecWagons - emWagons;
    while (remainingWagons > 0 && loaded.ec + loaded.em < tripCap) {
      const remainingEc = ecLeft - loaded.ec;
      const remainingEm = emLeft - loaded.em;
      if (remainingEc <= 0 && remainingEm <= 0) break;
      const dest = remainingEc >= remainingEm ? 'ec' : 'em';
      const qty = dest === 'ec' ? remainingEc : remainingEm;
      const put = Math.min(wagonCap, qty, tripCap - loaded.ec - loaded.em);
      if (dest === 'ec') { loaded.ec += put; wagons.ec++; }
      else { loaded.em += put; wagons.em++; }
      remainingWagons--;
    }
    return { wagons, loaded, total: loaded.ec + loaded.em, capacity: tripCap };
  }

  function simulate(s) {
    const horizon = s.horizonDays === null ? 0 : Math.max(1, Math.min(180, Math.floor(s.horizonDays)));
    const daily = volumeByMode(s);
    const effCap = getEffectiveCapacity(s);
    const rows = [];
    const events = [];
    let nacEc = s.startNacEc || 0, nacEm = s.startNacEm || 0, nacTransit=0;
    let sftEc = s.startSftEc || 0, sftEm = s.startSftEm || 0, payaEc = s.startPayaEc || 0, portEm = s.startPortEm || 0, emHubSabah = s.startSabahStock || 0, emHubSarawak = s.startSarawakStock || 0, emHub = (s.startEmHub||0)+emHubSabah+emHubSarawak, emTransit = 0, railTransit = 0, emHubPeak = emHub;
    let trainTrips = 0, vessels = 0, dispatchedEc = 0, dispatchedEm = 0;
    let nacTransferred = 0;
    let payaDealerDemand = 0, payaDealerDelivered = 0;
    let sabahDealerDemand = 0, sarawakDealerDemand = 0, sabahDealerDelivered = 0, sarawakDealerDelivered = 0;
    let activeSidingWagons = 0, activeConsistWagons=0, vesselReadyLogged = false;
    const trainsPerDay = s.trainsPerDay === null || !s.trainSlot ? 0 : Math.max(0, Math.floor(s.trainsPerDay));
    const minLoad = s.dispatchQty === null ? Infinity : Math.max(0, Math.floor(s.dispatchQty));
    const vesselQty = s.vesselDispatchQty === null ? Infinity : Math.max(1, Math.floor(s.vesselDispatchQty));
    const perWagon = getEffectivePerWagon(s);
    const rail1Minutes = s.processes.rail1?.elapsed ?? null;
    const rail2Minutes = s.processes.rail2?.elapsed ?? null;
    const voyageMinutes = s.processes.voyage?.elapsed ?? null;
    const trainTime1 = rail1Minutes === null ? 0 : Math.max(0, rail1Minutes / 1440);
    const trainTime2 = rail2Minutes === null ? 0 : Math.max(0, rail2Minutes / 1440);
    const voyage = voyageMinutes === null ? 0 : Math.max(0, voyageMinutes / 1440);
    const pending = [];
    const deliveries = [];
    let portOverflowPeak = s.startPortEm || 0, nacPeak=(s.startNacEc||0)+(s.startNacEm||0), sftPeak = (s.startSftEc||0)+(s.startSftEm||0), payaPeak = s.startPayaEc || 0;
    let dayFlow = null, dayPeak = null;
    let modeled = { rail: rail1Minutes !== null && rail2Minutes !== null, voyage: voyageMinutes !== null };

    function releaseArrivals(time) {
      pending.sort((a, b) => a.time - b.time);
      while (pending.length && pending[0].time <= time + 1e-8) {
        const item = pending.shift();
        if (item.dest === 'sft') { sftEc += item.ec || 0; sftEm += item.em || 0; if(item.nacTransfer){nacTransit=Math.max(0,nacTransit-(item.ec||0)-(item.em||0));if(dayFlow)dayFlow.roadOut+=(item.ec||0)+(item.em||0);} else {railTransit = Math.max(0, railTransit - (item.ec || 0) - (item.em || 0));if(dayFlow)dayFlow.railOut+=(item.ec||0)+(item.em||0);} if(dayFlow) dayFlow.sftIn += (item.ec || 0)+(item.em||0); if(dayPeak)dayPeak.sft=Math.max(dayPeak.sft,sftEc+sftEm); events.push({ time: item.time, text: `${fmt((item.ec || 0) + (item.em || 0))} CBU arrived at SFT from NAC.` }); }
        if (item.dest === 'paya') { payaEc += item.qty; railTransit=Math.max(0,railTransit-item.qty); if(dayFlow){dayFlow.payaIn += item.qty;dayFlow.railOut+=item.qty;} if(dayPeak)dayPeak.paya=Math.max(dayPeak.paya,payaEc); events.push({ time: item.time, text: `${fmt(item.qty)} East Coast CBU unloaded into Paya Besar storage.` }); }
        if (item.dest === 'port') { portEm += item.qty; railTransit=Math.max(0,railTransit-item.qty); if(dayFlow){dayFlow.portIn += item.qty;dayFlow.railOut+=item.qty;} if(dayPeak)dayPeak.port=Math.max(dayPeak.port,portEm); events.push({ time: item.time, text: `${fmt(item.qty)} East Malaysia CBU arrived at Kuantan Port.` }); }
        if (item.dest === 'em') { emHub += item.qty; if(dayFlow) dayFlow.hubIn += item.qty; events.push({ time: item.time, text: `${fmt(item.qty)} CBU arrived at the East Malaysia hub; destination split remains combined.` }); }
        if (item.dest === 'sabah') { emHub += item.qty; emHubSabah += item.qty; if(dayFlow) dayFlow.hubIn += item.qty; if(dayPeak)dayPeak.sabah=Math.max(dayPeak.sabah,emHubSabah); events.push({ time: item.time, text: `${fmt(item.qty)} CBU arrived at the Sabah hub.` }); }
        if (item.dest === 'sarawak') { emHub += item.qty; emHubSarawak += item.qty; if(dayFlow) dayFlow.hubIn += item.qty; if(dayPeak)dayPeak.sarawak=Math.max(dayPeak.sarawak,emHubSarawak); events.push({ time: item.time, text: `${fmt(item.qty)} CBU arrived at the Sarawak hub.` }); }
        if (['em','sabah','sarawak'].includes(item.dest)) { emHubPeak = Math.max(emHubPeak, emHub); if(dayPeak)dayPeak.hub=Math.max(dayPeak.hub,emHub); }
      }
      deliveries.sort((a, b) => a.time - b.time);
      while (deliveries.length && deliveries[0].time <= time + 1e-8) {
        const item = deliveries.shift();
        emTransit -= item.qty; if(dayFlow)dayFlow.seaOut+=item.qty;
        if (item.dest === 'sabah') { emHub += item.qty; emHubSabah += item.qty; if(dayFlow) dayFlow.hubIn += item.qty; if(dayPeak)dayPeak.sabah=Math.max(dayPeak.sabah,emHubSabah); events.push({ time: item.time, text: `${fmt(item.qty)} CBU completed the voyage to Sabah.` }); }
        else if (item.dest === 'sarawak') { emHub += item.qty; emHubSarawak += item.qty; if(dayFlow) dayFlow.hubIn += item.qty; if(dayPeak)dayPeak.sarawak=Math.max(dayPeak.sarawak,emHubSarawak); events.push({ time: item.time, text: `${fmt(item.qty)} CBU completed the voyage to Sarawak.` }); }
        else { emHub += item.qty; if(dayFlow) dayFlow.hubIn += item.qty; events.push({ time: item.time, text: `${fmt(item.qty)} CBU completed the vessel journey to the East Malaysia hub.` }); }
        emHubPeak = Math.max(emHubPeak, emHub); if(dayPeak)dayPeak.hub=Math.max(dayPeak.hub,emHub);
      }
    }

    for (let day = 0; day < horizon; day++) {
      const opening = { nac: nacEc+nacEm, sft:sftEc+sftEm, paya:payaEc, port:portEm, hub:emHub, sabah:emHubSabah,sarawak:emHubSarawak,road:nacTransit, rail:railTransit, sea:emTransit };
      const peaks = { nac:opening.nac, sft:opening.sft, paya:opening.paya, port:opening.port, hub:opening.hub,sabah:opening.sabah,sarawak:opening.sarawak,road:opening.road,rail:opening.rail,sea:opening.sea };
      dayPeak=peaks;
      let dayTrainTrips=0,dayEmTrainTrips=0,dayVessels=0;
      dayFlow = { production:0, nacOut:0, roadIn:0,roadOut:0,railIn:0,railOut:0,seaIn:0,seaOut:0,sftIn:0, sftOut:0, payaIn:0, payaOut:0, portIn:0, portOut:0, hubIn:0, hubOut:0 };
      releaseArrivals(day);
      const startParts = String(s.shiftStart || '00:00').split(':').map(Number);
      const productionFraction = ((startParts[0] || 0) * 60 + (startParts[1] || 0)) / 1440;
      const actions = [{ time: day + productionFraction, type: 'production', slot: -1 }, { time: day + productionFraction, type:'transfer', slot:-1 }];
      for (let slot = 0; slot < trainsPerDay; slot++) {
        const slotParts = String(s.trainSlot || '16:00').split(':').map(Number);
        const baseFraction = ((slotParts[0] || 0) * 60 + (slotParts[1] || 0)) / 1440;
        const slotTime = day + ((baseFraction + slot / Math.max(1, trainsPerDay)) % 1);
        actions.push({ time: slotTime, type: 'train', slot });
      }
      actions.sort((a,b)=>a.time-b.time || (a.type==='production'?-1:1));
      for (const action of actions) {
        const slotTime = action.time;
        releaseArrivals(slotTime);
        if (action.type === 'production') {
          nacEc += daily.ec; nacEm += daily.em; dayFlow.production = daily.ec + daily.em;
          events.push({ time: slotTime, text: `Day ${day + 1}: ${fmt(daily.ec)} East Coast and ${fmt(daily.em)} East Malaysia CBU produced at NAC.` });
          peaks.nac = Math.max(peaks.nac, nacEc+nacEm);
          continue;
        }
        if (action.type === 'transfer') {
          const limit = s.nacTransferCapacity === null || s.nacTransferMinutes === null ? 0 : Math.max(0,s.nacTransferCapacity);
          const total = Math.min(nacEc+nacEm, limit);
          const ecMove = total === 0 ? 0 : Math.min(nacEc, Math.round(total * nacEc / (nacEc+nacEm)));
          const emMove = total - ecMove;
          nacEc -= ecMove; nacEm -= emMove; dayFlow.nacOut += total;
          nacTransferred += total;
          if (total > 0) {
            const arrival = slotTime + Math.max(0,s.nacTransferMinutes||0)/1440;
            if ((s.nacTransferMinutes || 0) > 0) { nacTransit+=total; dayFlow.roadIn+=total; peaks.road=Math.max(peaks.road,nacTransit); pending.push({time:arrival, ec:ecMove, em:emMove, dest:'sft',nacTransfer:true}); }
            else { sftEc += ecMove; sftEm += emMove; dayFlow.sftIn += total; }
            events.push({time:slotTime, text:`${fmt(total)} CBU transferred from NAC to SFT (${fmt(ecMove)} East Coast, ${fmt(emMove)} East Malaysia).`});
          }
          peaks.nac = Math.max(peaks.nac, nacEc+nacEm); peaks.sft = Math.max(peaks.sft,sftEc+sftEm); sftPeak=Math.max(sftPeak,sftEc+sftEm);
          continue;
        }
        const plan = packTrain(sftEc, sftEm, s);
        const hasLoad = plan.total > 0;
        const meetsLoad = !s.requireFullLoad || plan.total >= minLoad;
        if (!hasLoad || !meetsLoad) {
          events.push({ time: slotTime, text: `Train slot: waiting at SFT (${fmt(sftEc + sftEm)} ready; ${Number.isFinite(minLoad)?fmt(minLoad):'TBD'} minimum).` });
          continue;
        }
        sftEc -= plan.loaded.ec; sftEm -= plan.loaded.em;
        dayFlow.sftOut += plan.total;
        trainTrips++;
        dayTrainTrips++;
        if(plan.loaded.em>0)dayEmTrainTrips++;
        const payaArrival = rail1Minutes === null ? Infinity : slotTime + trainTime1;
        const portArrival = rail1Minutes === null || rail2Minutes === null ? Infinity : payaArrival + trainTime2;
        pending.push({ time: payaArrival, qty: plan.loaded.ec, dest: 'paya' });
        pending.push({ time: portArrival, qty: plan.loaded.em, dest: 'port' });
        railTransit += plan.total;
        dayFlow.railIn += plan.total;
        peaks.rail=Math.max(peaks.rail,railTransit);
        activeSidingWagons = Math.max(activeSidingWagons, plan.wagons.ec);
        activeConsistWagons = Math.max(activeConsistWagons, plan.wagons.ec+plan.wagons.em);
        events.push({ time: slotTime, text: `Train ${trainTrips} departed SFT with ${fmt(plan.total)} CBU: ${fmt(plan.loaded.ec)} East Coast in ${plan.wagons.ec} separate wagon(s), ${fmt(plan.loaded.em)} East Malaysia in ${plan.wagons.em} separate wagon(s).` });
        releaseArrivals(slotTime);
        if (payaArrival <= slotTime) releaseArrivals(payaArrival);
        if (portArrival <= slotTime) releaseArrivals(portArrival);
      }

      releaseArrivals(day + 0.999);
      let payaDeliveredToday = 0;
      if (s.demandMode !== 'east-malaysia' && s.payaDealerRate !== null) {
        const requested = Math.max(0, s.payaDealerRate);
        payaDealerDemand += requested;
        payaPeak = Math.max(payaPeak, payaEc);
        peaks.paya=Math.max(peaks.paya,payaEc);
        payaDeliveredToday = Math.min(payaEc, requested);
        payaEc -= payaDeliveredToday;
        dayFlow.payaOut += payaDeliveredToday;
        payaDealerDelivered += payaDeliveredToday;
        if (requested > 0) events.push({ time: day + 0.9991, text: `Paya Besar East Coast dealer delivery: ${fmt(payaDeliveredToday)} of ${fmt(requested)} CBU sent; ${fmt(Math.max(0, requested - payaDeliveredToday))} not supplied from available stock.` });
      }
      let sabahDeliveredToday = 0, sarawakDeliveredToday = 0;
      if ((s.sabahShare !== null || emHubSabah>0 || emHubSarawak>0) && s.demandMode !== 'east-coast') {
        if (s.sabahDealerRate !== null) {
          const requested = Math.max(0, s.sabahDealerRate);
          sabahDealerDemand += requested;
          sabahDeliveredToday = Math.min(emHubSabah, requested);
          emHubSabah -= sabahDeliveredToday;
          emHub -= sabahDeliveredToday;
          peaks.sabah=Math.max(peaks.sabah,emHubSabah+sabahDeliveredToday);
          dayFlow.hubOut += sabahDeliveredToday;
          sabahDealerDelivered += sabahDeliveredToday;
          if (requested > 0) events.push({ time: day + 0.9992, text: `Sabah dealer delivery: ${fmt(sabahDeliveredToday)} of ${fmt(requested)} CBU sent; ${fmt(Math.max(0, requested - sabahDeliveredToday))} not supplied from available hub stock.` });
        }
        if (s.sarawakDealerRate !== null) {
          const requested = Math.max(0, s.sarawakDealerRate);
          sarawakDealerDemand += requested;
          sarawakDeliveredToday = Math.min(emHubSarawak, requested);
          emHubSarawak -= sarawakDeliveredToday;
          emHub -= sarawakDeliveredToday;
          peaks.sarawak=Math.max(peaks.sarawak,emHubSarawak+sarawakDeliveredToday);
          dayFlow.hubOut += sarawakDeliveredToday;
          sarawakDealerDelivered += sarawakDeliveredToday;
          if (requested > 0) events.push({ time: day + 0.9993, text: `Sarawak dealer delivery: ${fmt(sarawakDeliveredToday)} of ${fmt(requested)} CBU sent; ${fmt(Math.max(0, requested - sarawakDeliveredToday))} not supplied from available hub stock.` });
        }
      }
      portOverflowPeak = Math.max(portOverflowPeak, portEm);
      if (portEm >= vesselQty && (s.vesselTripsPerWeek === null || s.vesselTripsPerWeek <= 0)) {
        if (!vesselReadyLogged) {
          events.push({ time: day + 0.97, text: `${fmt(portEm)} CBU are ready at Kuantan Port for the ${fmt(vesselQty)}-unit vessel dispatch quantity; sailing schedule is TBD.` });
          vesselReadyLogged = true;
        }
      } else if (portEm < vesselQty) vesselReadyLogged = false;
      const vesselIntervalDays = s.vesselTripsPerWeek > 0 ? 7 / s.vesselTripsPerWeek : Infinity;
      const isVesselSlot = Number.isFinite(vesselIntervalDays) && (day % vesselIntervalDays < 1 || Math.abs((day % vesselIntervalDays) - vesselIntervalDays) < 1e-8);
      if (portEm >= vesselQty && s.vesselTripsPerWeek > 0 && !isVesselSlot && !vesselReadyLogged) {
        events.push({ time: day + 0.97, text: `${fmt(portEm)} CBU are ready at Kuantan Port; waiting for the next scheduled vessel slot.` });
        vesselReadyLogged = true;
      }
      if (portEm >= vesselQty && isVesselSlot) {
        const dispatchCount = 1;
        for (let v = 0; v < dispatchCount; v++) {
          const depart = day + 0.98;
          portEm -= vesselQty;
          dayFlow.portOut += vesselQty;
          vessels++;
          dayVessels++;
          dispatchedEm += vesselQty;
          const sabahUnits = s.sabahShare === null ? null : Math.round(vesselQty * s.sabahShare / 100);
          const sarawakUnits = sabahUnits === null ? null : vesselQty - sabahUnits;
          emTransit += vesselQty;
          dayFlow.seaIn += vesselQty;
          peaks.sea=Math.max(peaks.sea,emTransit);
          if (voyageMinutes !== null && sabahUnits === null) deliveries.push({ time: depart + voyage, qty: vesselQty, dest: 'em' });
          else if (voyageMinutes !== null) {
            if (sabahUnits > 0) deliveries.push({ time: depart + voyage, qty: sabahUnits, dest: 'sabah' });
            if (sarawakUnits > 0) deliveries.push({ time: depart + voyage, qty: sarawakUnits, dest: 'sarawak' });
          }
          const split = sabahUnits === null ? '' : `, allocated ${fmt(sabahUnits)} Sabah / ${fmt(sarawakUnits)} Sarawak at Kuantan`;
          events.push({ time: depart, text: `Vessel dispatch ${vessels}: ${fmt(vesselQty)} CBU released from Kuantan Port${split}${voyageMinutes === null ? '; arrival time TBD.' : '.'}` });
        }
        vesselReadyLogged = false;
      }
      portOverflowPeak = Math.max(portOverflowPeak, portEm);
      peaks.port=Math.max(peaks.port,portEm);
      payaPeak = Math.max(payaPeak, payaEc);
      peaks.nac=Math.max(peaks.nac,nacEc+nacEm); peaks.sft=Math.max(peaks.sft,sftEc+sftEm); peaks.paya=Math.max(peaks.paya,payaEc); peaks.port=Math.max(peaks.port,portEm); peaks.hub=Math.max(peaks.hub,emHub);
      nacPeak=Math.max(nacPeak,peaks.nac);
      sftPeak=Math.max(sftPeak,peaks.sft);
      rows.push({ day: day + 1, nac:Math.round(nacEc+nacEm), sft: Math.round(sftEc + sftEm), paya: Math.round(payaEc), payaDelivered: Math.round(payaDeliveredToday), port: Math.round(portEm), emHub: Math.round(emHub), sabah: Math.round(emHubSabah), sarawak: Math.round(emHubSarawak), sabahDelivered: Math.round(sabahDeliveredToday), sarawakDelivered: Math.round(sarawakDeliveredToday), transit: Math.round(emTransit), roadTransit:Math.round(nacTransit), railTransit:Math.round(railTransit), trainTrips:dayTrainTrips,emTrainTrips:dayEmTrainTrips,vessels:dayVessels,sftEc: Math.round(sftEc), sftEm: Math.round(sftEm), opening, peaks, flow:{...dayFlow}, closing:{nac:nacEc+nacEm,sft:sftEc+sftEm,paya:payaEc,port:portEm,hub:emHub,road:nacTransit,rail:railTransit,sea:emTransit} });
    }
    return { rows, events, daily, trainTrips, vessels, dispatchedEc, dispatchedEm, nacTransferred, payaDealerDemand, payaDealerDelivered, payaDealerShortfall: payaDealerDemand - payaDealerDelivered, sabahDealerDemand, sarawakDealerDemand, sabahDealerDelivered, sarawakDealerDelivered, dealerDemandTotal: sabahDealerDemand + sarawakDealerDemand, dealerDeliveredTotal: sabahDealerDelivered + sarawakDealerDelivered, dealerShortfall: (sabahDealerDemand - sabahDealerDelivered) + (sarawakDealerDemand - sarawakDealerDelivered), nacEnd:nacEc+nacEm, sftEnd: sftEc + sftEm, payaEnd: payaEc, portEnd: portEm, emHubEnd: emHub, transitEnd: emTransit, railTransitEnd:railTransit, nacPeak, sftPeak, payaPeak, portPeak: portOverflowPeak, emHubPeak, activeSidingWagons, activeConsistWagons, effCap, minLoad, perWagon, horizon, modelFlags: modeled };
  }

  function netAvailablePerWorker(s) {
    const shiftMins = s.shiftHours === null ? 0 : Math.max(0, s.shiftHours * 60);
    const hasAllowance = s.breakMinutes !== null || s.availabilityPct !== null;
    const breaks = s.breakMinutes ?? 0;
    const pct = s.availabilityPct ?? 100;
    return { minutes: Math.max(0, (shiftMins - breaks) * pct / 100), theoretical: !hasAllowance };
  }

  function processDemand(def, s) {
    const vol = volumeByMode(s);
    const perDay = def.key === 'payaDealerDelivery'
      ? (s.demandMode === 'east-malaysia' ? 0 : (s.payaDealerRate ?? 0))
      : def.key === 'dealerDelivery'
      ? (s.demandMode === 'east-coast' || (s.sabahShare === null && !(s.startSabahStock||0) && !(s.startSarawakStock||0)) ? 0 : (s.sabahDealerRate ?? 0) + (s.sarawakDealerRate ?? 0))
      : def.flow === 'ec' ? vol.ec : def.flow === 'em' ? vol.em : vol.ec + vol.em;
    return { perDay, total: perDay };
  }

  function calculateStaffing(s, sim) {
    const available = netAvailablePerWorker(s);
    const shifts = s.shiftCount === null ? 0 : Math.max(1, Math.floor(s.shiftCount));
    const staffRows = [];
    processDefs.forEach(def => {
      const p = s.processes[def.key] || {};
      const demand = processDemand(def, s);
      const targetPerShift = shifts > 0 ? demand.perDay / shifts : 0;
      const basisQty = p.basis === 'wagon' ? sim.perWagon : p.basis === 'train' ? sim.effCap : p.basis === 'ship' ? (s.vesselDispatchQty || 0) : p.basis === 'batch' ? (p.batch || 0) : 1;
      const missingBasis = ['wagon','train','ship','batch'].includes(p.basis) && basisQty <= 0;
      const cyclesFor = qty => missingBasis ? null : p.basis === 'setup' ? (qty > 0 ? 1 : 0) : ['wagon','train','ship','batch'].includes(p.basis) ? Math.ceil(qty / basisQty) : qty;
      const cycles = cyclesFor(targetPerShift);
      const backlogTarget = p.backlog;
      const hasBacklog = backlogTarget !== null && backlogTarget > 0;
      const deadlineCycles = hasBacklog ? cyclesFor(backlogTarget) : null;
      const deadlineWorkHours=hasBacklog&&p.deadline>0?Math.min(p.deadline,Math.max(.01,s.shiftHours||8)):0;
      const deadlineAvailable = hasBacklog && p.deadline > 0
        ? Math.max(0, (deadlineWorkHours * 60 - (s.breakMinutes || 0) * deadlineWorkHours / Math.max(.01,s.shiftHours||8)) * (s.availabilityPct ?? 100) / 100)
        : 0;
      const crew = Math.max(1, Math.floor(p.crew || 1));
      let required = null, requiredBacklog = null, workMin = null, backlogWorkMin = null, workloadPct = null, currentCap = null;
      if (p.touch !== null && p.touch >= 0 && available.minutes > 0 && shifts > 0 && cycles !== null) {
        workMin = cycles * p.touch;
        required = Math.ceil(workMin / available.minutes) * crew;
        workloadPct = Math.round(workMin / available.minutes * 100);
        if (hasBacklog && p.deadline > 0 && deadlineCycles !== null && deadlineAvailable > 0) {
          backlogWorkMin = deadlineCycles * p.touch;
          requiredBacklog = Math.ceil(backlogWorkMin / deadlineAvailable) * crew;
        }
        const teamsByPeople = p.current === null ? null : Math.floor(p.current / crew);
        const declaredTeams = p.teams === null ? teamsByPeople : Math.max(0, Math.floor(p.teams));
        const teams = teamsByPeople === null ? declaredTeams : p.teams === null ? teamsByPeople : Math.min(teamsByPeople, declaredTeams);
        const unitsPerCycle = p.basis === 'cbu' ? 1 : p.basis === 'wagon' ? sim.perWagon : p.basis === 'train' ? sim.effCap : p.basis === 'ship' ? (s.vesselDispatchQty || 0) : p.basis === 'batch' ? (p.batch || 0) : 0;
        if (teams !== null && p.touch > 0 && unitsPerCycle > 0) currentCap = teams * available.minutes / p.touch * unitsPerCycle;
      }
      const current = p.current, gap = required !== null && current !== null ? Math.max(0, required-current) : null;
      const backlogGap = requiredBacklog !== null && current !== null ? Math.max(0,requiredBacklog-current) : null;
      staffRows.push({ key:def.key,group:def.group,name:def.name,owner:p.owner||def.owner,flow:def.flow,basis:p.basis,touch:p.touch,elapsed:p.elapsed,crew,current,teams:p.teams,batch:p.batch,backlogTarget,deadline:p.deadline,demand:demand.perDay,targetPerShift,cycles,deadlineCycles,required,requiredBacklog,currentCap,gap,backlogGap,workloadPct,workMin,backlogWorkMin,availableMin:available.minutes,theoretical:available.theoretical,missingBasis });
    });
    const activeRows = staffRows.filter(r => r.demand > 0);
    const missingElapsed = activeRows.filter(r => r.elapsed === null).length;
    const knownElapsed = activeRows.reduce((sum,r)=>sum+(r.elapsed===null?0:r.elapsed),0);
    return { rows:staffRows,available,missingElapsed,knownElapsed };
  }

  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }
  function fmt1(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }); }
  function addDayLabel(d) { return `Day ${d}`; }
  function statusItem(status, title, detail, recommendation = '') {
    return `<div class="readiness-item ${status === 'Warning' ? 'warning' : status === 'Checked' ? 'checked' : 'not-checked'}"><div class="readiness-status">${status}</div><div class="readiness-copy"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>${recommendation ? `<p class="recommendation"><b>Suggested next step:</b> ${escapeHtml(recommendation)}</p>` : ''}</div></div>`;
  }

  function evaluateReadiness(s, sim, staffing) {
    const checks = [];
    const missingCore = [['simulation days',s.horizonDays],['East Coast volume',s.ecVolume],['East Malaysia volume',s.emVolume],['train wagon count',s.wagonCount],['trip capacity',s.tripCapacity],['typical per-wagon capacity',s.wagonTypical],['minimum dispatch quantity',s.dispatchQty],['shift count',s.shiftCount],['hours per shift',s.shiftHours]].filter(x=>x[1]===null).map(x=>x[0]);
    if(missingCore.length) checks.push(statusItem('Not checked', 'Core planning inputs are incomplete', `${missingCore.join(', ')} is blank. The run continues, but dependent calculations use no available value and may be partial.`, 'Enter the planning inputs you want included in this scenario.'));
    const sumVolumes = Math.max(0, Math.round(s.ecVolume || 0)) + Math.max(0, Math.round(s.emVolume || 0));
    if (sumVolumes !== Math.round(s.mixedVolume || 0)) checks.push(statusItem('Warning', 'Daily volume figures do not reconcile', `${fmt(s.ecVolume || 0)} + ${fmt(s.emVolume || 0)} = ${fmt(sumVolumes)}, while the mixed reference is ${fmt(s.mixedVolume || 0)}. The mixed value is not added to network flow.`, 'Confirm the planning basis for the mixed volume before using a combined-volume conclusion.'));
    else checks.push(statusItem('Checked', 'Daily volume figures reconcile', 'The entered East Coast and East Malaysia volumes match the mixed reference.'));

    const absoluteWagonCap = Math.max(0, Math.floor((s.wagonMaximum || 0) * (s.wagonCount || 0)));
    if (sim.effCap < (s.tripCapacity || 0)) checks.push(statusItem('Warning', 'Wagon plan is below the trip capacity', `${fmt(sim.perWagon)} usable CBU per wagon gives ${fmt(sim.effCap)} typical trip capacity, below the ${fmt(s.tripCapacity || 0)} trip cap. Maximum ${fmt(absoluteWagonCap)} at ${fmt(s.wagonMaximum || 0)} per wagon is also below the trip cap.`, 'Confirm wagon loading layout and decide whether to change the trip cap, wagon count or per-wagon capacity.'));
    else checks.push(statusItem('Checked', 'Train capacity inputs are internally consistent', `${fmt(sim.effCap)} CBU effective capacity is within the trip cap.`));

    checks.push(statusItem('Warning', 'Accumulation estimates remain unreconciled', 'The historical estimates of 2.24, 1.38 and 0.86 days do not match the entered daily volumes and 230-unit figure. They are not used in this run.', 'Confirm the volume basis and calculation before using historical estimates in a decision.'));

    if (!s.sidingCheckScope) checks.push(statusItem('Not checked','Paya Besar siding check scope is not selected','Choose whether the siding should be checked against the whole consist or only the East Coast wagon cut.'));
    else if (s.sidingMode === 'length') {
      const checkedWagons=s.sidingCheckScope==='consist'?sim.activeConsistWagons:sim.activeSidingWagons;
      const scopeName=s.sidingCheckScope==='consist'?'whole train consist':'East Coast wagon cut';
      if (s.sidingLength === null || s.wagonLength === null || s.locoLength === null || s.wagonLength <= 0) checks.push(statusItem('Not checked', 'Paya Besar length-based siding fit', 'Usable siding, positive wagon length or locomotive length is TBD, so the 500 m siding cannot be converted into a wagon limit.', 'Enter all three lengths, or switch to direct wagon-count mode.'));
      else {
        const loco = s.locoLength || 0;
        const fit = Math.max(0, Math.floor((s.sidingLength - loco) / s.wagonLength));
        checks.push(statusItem(fit < checkedWagons ? 'Warning' : 'Checked', 'Paya Besar siding fit', `Configured siding fits about ${fit} wagons; this run’s largest ${scopeName} is ${checkedWagons} wagon(s).`, fit < checkedWagons ? 'Review the shunting plan, siding length or wagon allocation.' : 'Keep the length assumptions aligned with the final layout.'));
      }
    } else if (s.sidingWagonLimit === null) checks.push(statusItem('Not checked', 'Paya Besar wagon-count limit', 'Direct wagon-count limit is TBD.', 'Enter a limit to evaluate the shunting cut.'));
    else { const checkedWagons=s.sidingCheckScope==='consist'?sim.activeConsistWagons:sim.activeSidingWagons; const scopeName=s.sidingCheckScope==='consist'?'whole train consist':'East Coast wagon cut'; checks.push(statusItem(checkedWagons > s.sidingWagonLimit ? 'Warning' : 'Checked', 'Paya Besar wagon-count limit', `Configured limit is ${fmt(s.sidingWagonLimit)} wagons; run requires up to ${fmt(checkedWagons)} in the ${scopeName}.`, checkedWagons > s.sidingWagonLimit ? 'Review wagon assignment or shunting sequence.' : 'Confirm that the limit reflects usable track and safe operating clearances.')); }

    if (s.demandMode === 'east-malaysia') {
      checks.push(statusItem('Not checked', 'Paya Besar East Coast outflow', 'East Coast is excluded by the selected demand mode, so Paya Besar dealer deliveries are not modeled.'));
    } else if (s.payaDealerRate === null) {
      checks.push(statusItem('Not checked', 'Paya Besar East Coast outflow', 'Dealer delivery rate is blank, so East Coast CBU only accumulates at Paya Besar.', 'Enter an East Coast dealer-delivery rate to model stock leaving Paya Besar.'));
    } else if (sim.payaDealerShortfall > 0) {
      checks.push(statusItem('Warning', 'Paya Besar dealer demand exceeds available stock', `During ${sim.horizon} days, ${fmt(sim.payaDealerDemand)} CBU were requested and ${fmt(sim.payaDealerDelivered)} CBU were supplied; ${fmt(sim.payaDealerShortfall)} requested CBU were not available.`, 'Review train arrivals, the dealer-delivery rate or the upstream East Coast volume.'));
    } else if (s.payaDealerRate < sim.daily.ec) {
      checks.push(statusItem('Warning', 'Paya Besar stock is expected to build', `Dealer delivery is ${fmt(s.payaDealerRate)} CBU/day against ${fmt(sim.daily.ec)} East Coast CBU/day released. The planned difference is about ${fmt(sim.daily.ec - s.payaDealerRate)} CBU/day before train-schedule effects.`, 'Increase the dealer-delivery rate or review the East Coast release plan if inventory should remain level.'));
    } else if (s.payaDealerRate > sim.daily.ec) {
      checks.push(statusItem('Warning', 'Paya Besar delivery rate exceeds incoming volume', `Dealer delivery is ${fmt(s.payaDealerRate)} CBU/day against ${fmt(sim.daily.ec)} East Coast CBU/day released, so deliveries draw down stored stock over time.`, 'Confirm that this higher rate is intended and that a starting backlog is available.'));
    } else {
      checks.push(statusItem('Checked', 'Paya Besar East Coast outflow modeled', `The ${fmt(s.payaDealerRate)} CBU/day dealer-delivery rate matches the entered East Coast volume. ${fmt(sim.payaDealerDelivered)} CBU were supplied during this run.`, 'Confirm the local dispatch rate with the operation owner; the starting rate is a planning assumption.'));
    }

    if (s.vesselCapacity === null) checks.push(statusItem('Not checked', 'Vessel capacity', `Vessel capacity is TBD; the ${fmt(s.vesselDispatchQty || 0)}-unit dispatch setting is shown, but vessel capacity is not applied.`, 'Enter confirmed vessel capacity to check the dispatch quantity.'));
    else if (s.vesselCapacity < s.vesselDispatchQty) checks.push(statusItem('Warning', 'Dispatch quantity exceeds vessel capacity', `The dispatch setting is ${fmt(s.vesselDispatchQty)} CBU and vessel capacity is ${fmt(s.vesselCapacity)} CBU. The run keeps both values and marks the dispatch result conditional.`, 'Confirm which input should govern the operating plan; do not rely on the conditional load result.'));
    else checks.push(statusItem('Checked', 'Vessel capacity covers the dispatch quantity', `${fmt(s.vesselCapacity)} CBU capacity is at or above the ${fmt(s.vesselDispatchQty)} CBU dispatch setting.`));

    if (sim.modelFlags.rail) checks.push(statusItem('Checked', 'Rail travel times entered', 'Both rail-leg durations are included in the timeline.'));
    else checks.push(statusItem('Not checked', 'Rail travel time is incomplete', 'One or both rail durations are blank. CBU stays in rail transit and is not added to Paya Besar or Kuantan Port until its travel time is known.', 'Enter both rail-leg durations before comparing end-to-end timing.'));
    if (sim.modelFlags.voyage) checks.push(statusItem('Checked', 'Vessel journey time entered', 'The configured voyage time is included in East Malaysia arrival.'));
    else checks.push(statusItem('Not checked', 'Vessel arrival time is TBD', 'Vessel dispatches are counted, but units remain in transit and do not appear at the East Malaysia hub.', 'Enter a voyage duration when available.'));
    if (s.vesselTripsPerWeek === null || s.vesselTripsPerWeek <= 0) checks.push(statusItem('Not checked', 'Vessel timetable', 'Departure frequency is TBD or set to zero. The 1,500-unit trigger marks cargo ready, but the sailing slot is not modeled.', 'Enter the confirmed departure frequency when available.'));
    else checks.push(statusItem('Checked', 'Vessel timetable input', `${fmt1(s.vesselTripsPerWeek)} departure(s) per week are used as a repeating schedule.`));
    if (!s.trainSlot) checks.push(statusItem('Not checked', 'Train departure time', 'The daily slot time is blank, so no train departures are simulated.', 'Enter a planning slot to calculate train departures.'));
    if (!s.shiftStart) checks.push(statusItem('Not checked', 'Shift start time', 'Shift start is blank; production timing uses the day-start placeholder.', 'Enter the first shift start time before comparing event timing.'));
    if (s.sabahShare === null) checks.push(statusItem('Not checked', 'Sabah / Sarawak split', 'Destination quantities are kept together because the Sabah share is TBD.', 'Enter a Sabah allocation share to split East Malaysia loads at Kuantan.'));
    else checks.push(statusItem('Checked', 'Sabah / Sarawak split', `${fmt(s.sabahShare)}% is allocated to Sabah at Kuantan; the remaining volume is assigned to Sarawak.`));

    const missingDealerRates = [['Sabah', s.sabahDealerRate], ['Sarawak', s.sarawakDealerRate]].filter(([, rate]) => rate === null).map(([name]) => name);
    if (s.demandMode === 'east-coast') {
      checks.push(statusItem('Not checked', 'East Malaysia dealer outflow', 'East Malaysia is excluded by the selected demand mode, so Sabah and Sarawak hub stock and dealer deliveries are not modeled in this run.'));
    } else if (s.sabahShare === null) {
      checks.push(statusItem(
        (s.sabahDealerRate !== null || s.sarawakDealerRate !== null) ? 'Warning' : 'Not checked',
        'East Malaysia dealer outflow',
        (s.sabahDealerRate !== null || s.sarawakDealerRate !== null)
          ? `Vessel arrivals stay combined because the Sabah / Sarawak allocation share is TBD.${(s.startSabahStock||0)+(s.startSarawakStock||0)>0?' Separate branch starting stocks can still supply the entered dealer rates.':' No branch starting stocks are entered, so dealer rates do not reduce combined stock.'}`
          : 'No dealer-delivery rates are entered, so Sabah and Sarawak hub inventory only accumulates from arrivals.',
        'Enter the Sabah share and daily dealer-delivery rates to model hub stock leaving for dealers.'
      ));
    } else if (missingDealerRates.length) {
      checks.push(statusItem('Not checked', 'East Malaysia dealer outflow is partial', `${missingDealerRates.join(' and ')} dealer-delivery rate is TBD. Entered rates are applied; blank rates do not deduct stock.${sim.dealerShortfall > 0 ? ` ${fmt(sim.dealerShortfall)} requested CBU also could not be supplied from available hub stock.` : ''}`, 'Enter both daily delivery rates or confirm that a blank branch should remain outside this scenario.'));
    } else if (sim.dealerShortfall > 0) {
      checks.push(statusItem('Warning', 'Dealer delivery exceeds available hub stock', `During ${sim.horizon} days, the model requests ${fmt(sim.dealerDemandTotal)} CBU and supplies ${fmt(sim.dealerDeliveredTotal)} CBU from available stock; ${fmt(sim.dealerShortfall)} requested CBU are not supplied.`, 'Review vessel arrivals, destination allocation, delivery rates or hub replenishment timing.'));
    } else {
      checks.push(statusItem('Checked', 'East Malaysia dealer outflow modeled', `Daily rates of ${fmt(s.sabahDealerRate)} Sabah and ${fmt(s.sarawakDealerRate)} Sarawak CBU are applied against available hub stock. Total delivered during this run: ${fmt(sim.dealerDeliveredTotal)} CBU.`, 'Compare the modeled rates and available stock with the dealer dispatch plan.'));
    }
    if(s.sabahShare!==null&&(s.startEmHub||0)>0)checks.push(statusItem('Not checked','Combined East Malaysia starting stock is unallocated',`${fmt(s.startEmHub)} starting CBU are entered as combined hub stock. They are included in total capacity and graphs, but cannot be assigned to Sabah or Sarawak dealer deliveries.`,'Enter separate Sabah and Sarawak starting stocks for any inventory that should serve those branches.'));

    const missingCapacity = [['NAC holding',s.nacCapacity],['SFT holding', s.sftCapacity], ['Paya Besar storage', s.payaCapacity], ['Kuantan Port yard', s.portCapacity], ['East Malaysia hub', s.emCapacity]].filter(x => x[1] === null).map(x => x[0]);
    if (missingCapacity.length) checks.push(statusItem('Not checked', 'Node storage capacity', `${missingCapacity.join(', ')} capacity is TBD; overflow checks are incomplete.`, 'Enter confirmed capacity values to evaluate storage overflow.'));
    else checks.push(statusItem('Checked', 'Node storage capacity', 'All configured storage capacities are included in overflow checks.'));
    [['NAC holding',s.nacCapacity,sim.nacPeak],['SFT holding', s.sftCapacity, sim.sftPeak], ['Paya Besar storage', s.payaCapacity, sim.payaPeak], ['Kuantan Port yard', s.portCapacity, sim.portPeak], ['East Malaysia hub', s.emCapacity, sim.emHubPeak]].forEach(([name, capacity, peak]) => {
      if (capacity !== null && peak > capacity) checks.push(statusItem('Warning', `${name} capacity exceeded`, `Peak modeled inventory is ${fmt(peak)} CBU against configured capacity ${fmt(capacity)} CBU. The run continues and marks the queue conditional.`, 'Review capacity, dispatch timing or the throughput plan with the site owner.'));
    });

    const missingTouch = staffing.rows.filter(r => r.demand > 0 && r.touch === null).length;
    const missingProcessBatch=staffing.rows.filter(r=>r.demand>0&&r.missingBasis);
    if(missingProcessBatch.length)checks.push(statusItem('Not checked','Cycle basis or batch size is missing',`${missingProcessBatch.map(r=>r.name).join(', ')} cannot calculate cycles because the selected wagon/train/vessel/batch capacity is missing or zero.`,'Enter a valid batch size or capacity for each listed process.'));
    if(s.nacTransferCapacity===null||s.nacTransferMinutes===null) checks.push(statusItem('Not checked','NAC to SFT transfer inputs are incomplete',`Daily production remains at NAC until both a transfer limit and transfer time are entered. Current values: limit ${s.nacTransferCapacity===null?'TBD':`${fmt(s.nacTransferCapacity)} CBU/day`}, time ${s.nacTransferMinutes===null?'TBD':`${fmt1(s.nacTransferMinutes)} minutes`}.`,'Enter both inputs. Use 0 minutes only if same-time transfer is the intended planning assumption.'));
    else if(s.nacTransferCapacity < (sim.daily.ec+sim.daily.em)) checks.push(statusItem('Warning','NAC production exceeds transfer capacity',`${fmt(sim.daily.ec+sim.daily.em)} CBU/day are produced against a transfer limit of ${fmt(s.nacTransferCapacity)} CBU/day. NAC stock will build by at least ${fmt(sim.daily.ec+sim.daily.em-s.nacTransferCapacity)} CBU/day before timing effects.`,'Review transfer capacity or the release plan.'));
    if (missingTouch) checks.push(statusItem('Not checked', 'Manpower coverage', `${missingTouch} process(es) have no hands-on cycle time, so network staffing total is partial.`, 'Enter cycle times for each process to calculate a complete staffing requirement.'));
    if (staffing.available.minutes <= 0) checks.push(statusItem('Warning', 'No productive minutes available per shift', 'The entered break and availability settings leave zero time for work. Staffing requirements cannot be calculated for this shift.', 'Review shift hours, break allowance and productive availability.'));
    const backlogRows=staffing.rows.filter(r=>r.backlogTarget!==null&&r.backlogTarget>0);
    if(!backlogRows.length) checks.push(statusItem('Not checked','Backlog clearance staffing','No process-specific backlog quantity has been entered. The backlog staffing view is therefore unavailable.'));
    else if(backlogRows.some(r=>r.deadline===null||r.deadline<=0)) checks.push(statusItem('Not checked','Backlog clearance deadline',`${backlogRows.filter(r=>r.deadline===null||r.deadline<=0).length} process backlog(s) have no valid deadline. Those backlog staffing estimates are unavailable.`,'Enter the hours available to clear each backlog.'));
    const missingElapsed = staffing.rows.filter(r => r.demand > 0 && r.elapsed === null).length;
    if (missingElapsed) checks.push(statusItem('Not checked', 'End-to-end elapsed time', `${missingElapsed} active process(es) have no elapsed cycle time. The entered-time total is partial, not an end-to-end lead-time result.`, 'Enter elapsed time at each active process before using lead-time comparisons.'));
    if(s.processes.rail1?.elapsed===null||s.processes.rail2?.elapsed===null)checks.push(statusItem('Not checked','Rail arrival timing',`${s.processes.rail1?.elapsed===null?'East Coast and East Malaysia CBU remain in rail transit because SFT-to-Paya Besar time is blank. ':''}${s.processes.rail2?.elapsed===null?'East Malaysia CBU remains in rail transit because Paya Besar-to-Kuantan time is blank.':''}`,'Enter the SFT-to-Paya Besar and Paya Besar-to-Kuantan travel times when available.'));
    if(s.processes.voyage?.elapsed===null)checks.push(statusItem('Not checked','Vessel arrival timing','Vessel travel time is blank. Dispatched CBU stays in vessel transit and is not added to East Malaysia hub stock.','Enter the voyage duration when available.'));
    const gaps = staffing.rows.filter(r => r.gap !== null && r.gap > 0);
    if (gaps.length) {
      const totalGap = gaps.reduce((a, r) => a + r.gap, 0);
      checks.push(statusItem('Warning', 'Current staffing is below calculated need', `${fmt(totalGap)} additional people across ${gaps.length} process(es) are needed for the selected shift-throughput view.`, `Review the largest gap at ${gaps.sort((a,b) => b.gap-a.gap)[0].group}: ${gaps.sort((a,b) => b.gap-a.gap)[0].name}.`));
    } else if (staffing.rows.some(r => r.required !== null && r.current !== null)) checks.push(statusItem('Checked', 'Current staffing meets modeled workload', 'For processes with entered cycle times and current headcount, calculated staffing is sufficient for the selected throughput.'));
    else checks.push(statusItem('Not checked', 'Current staffing comparison', 'Enter current headcount and cycle times to compare staffing supply with calculated demand.'));

    const deadlock = s.requireFullLoad && s.dispatchQty > sim.effCap;
    if (deadlock) checks.push(statusItem('Warning', 'Full-load setting is above effective trip capacity', `Minimum dispatch quantity ${fmt(s.dispatchQty)} exceeds effective train capacity ${fmt(sim.effCap)}. Trains will wait under this configuration.`, 'Adjust the dispatch quantity or train/wagon capacity after confirming the operating rule.'));
    else checks.push(statusItem('Checked', 'Train minimum-load setting', `Minimum dispatch quantity is ${fmt(s.dispatchQty || 0)}; effective capacity is ${fmt(sim.effCap)}.`));
    const dailyDemand = sim.daily.ec + sim.daily.em;
    const nominalDailyRailCapacity = sim.effCap * Math.max(0, Math.floor(s.trainsPerDay || 0));
    if (dailyDemand > nominalDailyRailCapacity) checks.push(statusItem('Warning', 'SFT inventory is projected to build', `Daily release is ${fmt(dailyDemand)} CBU versus nominal train slots of ${fmt(nominalDailyRailCapacity)} CBU/day. End-of-horizon SFT inventory is ${fmt(sim.sftEnd)}.`, 'Review train slots, trip capacity or the daily release plan; compare the resulting queue with the confirmed SFT capacity.'));
    else checks.push(statusItem('Checked', 'Nominal rail throughput covers daily release', `${fmt(nominalDailyRailCapacity)} nominal CBU/day versus ${fmt(dailyDemand)} entered CBU/day. Destination-specific wagon allocation can still limit actual loading.`));
    const overloaded = staffing.rows.filter(r => r.currentCap !== null && r.demand > r.currentCap);
    if (overloaded.length) {
      const top = overloaded.slice().sort((a,b)=>(b.demand-b.currentCap)-(a.demand-a.currentCap))[0];
      checks.push(statusItem('Warning', 'Current process capacity is below demand', `${overloaded.length} process(es) have less modeled current-team capacity than daily demand. Largest gap: ${top.name}, ${fmt(top.demand-top.currentCap)} CBU/day.`, 'Review current team size, workstations or cycle time for the listed process.'));
    }
    const invalid = [];
    [['East Coast volume', s.ecVolume], ['East Malaysia volume', s.emVolume], ['mixed volume', s.mixedVolume], ['wagon count', s.wagonCount], ['trip capacity', s.tripCapacity], ['wagon capacity', s.wagonTypical], ['maximum per wagon', s.wagonMaximum], ['vessel dispatch quantity', s.vesselDispatchQty], ['Paya Besar dealer-delivery rate', s.payaDealerRate], ['Sabah dealer-delivery rate', s.sabahDealerRate], ['Sarawak dealer-delivery rate', s.sarawakDealerRate], ['NAC capacity',s.nacCapacity],['NAC transfer capacity',s.nacTransferCapacity],['NAC transfer time',s.nacTransferMinutes],['SFT capacity', s.sftCapacity], ['Paya Besar capacity', s.payaCapacity], ['port capacity', s.portCapacity], ['hub capacity', s.emCapacity], ['vessel capacity', s.vesselCapacity]].forEach(([label,value])=>{if(value!==null&&value<0)invalid.push(label);});
    if (s.horizonDays !== null && (s.horizonDays < 1 || s.horizonDays > 180)) invalid.push('simulation days (allowed 1–180)');
    if (s.shiftCount !== null && s.shiftCount < 1) invalid.push('shift count');
    if (s.shiftHours !== null && s.shiftHours <= 0) invalid.push('hours per shift');
    if (s.trainsPerDay !== null && s.trainsPerDay < 0) invalid.push('train slots per day');
    if (s.vesselTripsPerWeek !== null && (s.vesselTripsPerWeek < 0 || s.vesselTripsPerWeek > 7)) invalid.push('vessel departures per week (allowed 0–7)');
    if (s.sizeFactor !== null && s.sizeFactor <= 0) invalid.push('vehicle size factor');
    if (s.wagonTypical !== null && (s.wagonTypical < 1 || s.wagonTypical > 10)) invalid.push('typical per-wagon capacity (allowed 1–10)');
    if (s.wagonMaximum !== null && (s.wagonMaximum < 1 || s.wagonMaximum > 10)) invalid.push('maximum per-wagon capacity (allowed 1–10)');
    if (s.sabahShare !== null && (s.sabahShare < 0 || s.sabahShare > 100)) invalid.push('Sabah share (allowed 0–100%)');
    if (s.breakMinutes !== null && (s.breakMinutes < 0 || s.breakMinutes > (s.shiftHours || 8) * 60)) invalid.push('break minutes');
    if (s.availabilityPct !== null && (s.availabilityPct <= 0 || s.availabilityPct > 100)) invalid.push('productive availability (allowed 1–100%)');
    processDefs.forEach(def=>{const p=s.processes[def.key]; if(p.touch!==null&&p.touch<0)invalid.push(`${def.name} hands-on time`); if(p.elapsed!==null&&p.elapsed<0)invalid.push(`${def.name} elapsed time`); if(p.current!==null&&p.current<0)invalid.push(`${def.name} current headcount`); if(p.crew!==null&&p.crew<1)invalid.push(`${def.name} crew size`); if(p.teams!==null&&p.teams<0)invalid.push(`${def.name} parallel teams`);if(p.batch!==null&&p.batch<1)invalid.push(`${def.name} batch size`);if(p.backlog!==null&&p.backlog<0)invalid.push(`${def.name} backlog quantity`);if(p.deadline!==null&&p.deadline<=0)invalid.push(`${def.name} backlog deadline`);});
    if(invalid.length) checks.push(statusItem('Warning', 'Invalid input values detected', `${invalid.join(', ')} are outside the model’s allowed range. The run continues and affected outputs may be conditional.`, 'Review those inputs; the model does not silently correct them.'));
    return checks;
  }

  function renderReadiness(items) { $('readinessList').innerHTML = items.join(''); }

  function svgEl(tag, attrs = {}, content = '') {
    const at = Object.entries(attrs).map(([k,v]) => `${k}="${escapeHtml(v)}"`).join(' ');
    return `<${tag} ${at}>${content}</${tag}>`;
  }

  function renderInventoryGraph(rows) {
    const target = $('inventoryChart');
    if (!rows.length) { target.innerHTML = '<div class="chart-empty">Run a scenario to see inventory levels.</div>'; return; }
    const W = Math.max(920, Math.round(target.getBoundingClientRect().width || 1360));
    const H = 390, left = 76, right = 28, top = 64, bottom = 48;
    const plotW = W-left-right, plotH = H-top-bottom;
    const mode = $('inventoryMode')?.value || 'end';
    const peakMode = mode === 'peak';
    const peakKey = key => ({roadTransit:'road',railTransit:'rail',transit:'sea'}[key]||key);
    const value = (r, key) => peakMode && r.peaks?.[peakKey(key)] !== undefined ? r.peaks[peakKey(key)] : r[key];
    const series = [
      { key: 'nac', name: 'NAC', color: '#6b8297' },
      { key: 'sft', name: 'SFT', color: '#2479b5' },
      { key: 'paya', name: 'Paya Besar', color: '#168879' },
      { key: 'railTransit', name: 'Rail transit', color: '#9a6b39' },
      { key: 'port', name: 'Kuantan Port', color: '#cc8a28' },
      { key: 'transit', name: 'Vessel transit', color: '#b46183' },
      ...(window.lastRun?.s?.nacTransferMinutes > 0 ? [{key:'roadTransit',name:'NAC–SFT transit',color:'#7d8b55'}] : []),
      { key:'emHub', name:'East Malaysia hubs total', color:'#8065a8' },
      ...(window.lastRun?.s?.sabahShare == null && !(window.lastRun?.s?.startSabahStock||0) && !(window.lastRun?.s?.startSarawakStock||0) ? [] : [{ key:'sabah',name:'Sabah hub',color:'#6f9b4b' },{key:'sarawak',name:'Sarawak hub',color:'#b46183'}])
    ];
    const rawMax = Math.max(1, ...rows.flatMap(r => series.map(s => value(r,s.key))));
    const rawStep = rawMax / 4;
    const stepPower = 10 ** Math.floor(Math.log10(rawStep));
    const stepRatio = rawStep / stepPower;
    const step = (stepRatio <= 1 ? 1 : stepRatio <= 2 ? 2 : stepRatio <= 5 ? 5 : 10) * stepPower;
    const max = step * 4;
    const yFor = v => top + plotH - (v/max)*plotH;
    const xFor = i => left + (rows.length === 1 ? plotW/2 : i*plotW/(rows.length-1));
    let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vehicle inventory by location over ${rows.length} days">`;
    for (let i=0;i<=4;i++) { const y=top+plotH*i/4, val=Math.round(max*(1-i/4)); svg += `<line class="grid-line${i===4?' baseline':''}" x1="${left}" y1="${y}" x2="${W-right}" y2="${y}"/><text class="axis-label" x="${left-10}" y="${y+5}" text-anchor="end">${fmt(val)}</text>`; }
    const xTicks = Math.min(6, rows.length);
    for (let i=0;i<xTicks;i++) {
      const rowIndex = xTicks === 1 ? 0 : Math.round(i*(rows.length-1)/(xTicks-1));
      svg += `<text class="axis-label" x="${xFor(rowIndex)}" y="${H-12}" text-anchor="middle">Day ${rows[rowIndex].day}</text>`;
    }
    series.forEach(s => {
      const points = rows.map((r,i)=>`${xFor(i)},${yFor(value(r,s.key))}`).join(' ');
      svg += `<polyline class="series-line" stroke="${s.color}" points="${points}"/>`;
      rows.forEach((r,i)=>{ if (rows.length < 20 || i%2===0 || i===rows.length-1) svg += `<circle class="point" cx="${xFor(i)}" cy="${yFor(value(r,s.key))}" r="4" fill="${s.color}"><title>Day ${r.day} · ${s.name}: ${fmt(value(r,s.key))} CBU</title></circle>`; });
    });
    series.forEach((s,i) => { const col=i%4,row=Math.floor(i/4), legendX=left+col*Math.max(175,(W-left-right)/4), legendY=18+row*22; svg += `<line x1="${legendX}" y1="${legendY}" x2="${legendX+18}" y2="${legendY}" stroke="${s.color}" stroke-width="3"/><circle cx="${legendX+9}" cy="${legendY}" r="4" fill="${s.color}"/><text class="chart-legend" x="${legendX+25}" y="${legendY+5}">${escapeHtml(s.name)}</text>`; });
    svg += '</svg>';
    target.innerHTML = svg;
    $('inventoryChartSubtitle').textContent = `${peakMode?'Highest stock/transit reached during':'Closing stock/transit at end of'} each day · CBU`;
    $('inventoryTable').innerHTML = `<table class="chart-table"><thead><tr><th>Day</th>${series.map(x=>`<th>${escapeHtml(x.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r.day}</td>${series.map(x=>`<td>${fmt(value(r,x.key))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderStaffGraph(rows) {
    const filtered = rows.filter(r => r.required !== null);
    const target = $('staffChart');
    if (!filtered.length) { target.innerHTML = '<div class="chart-empty">Add hands-on cycle times to calculate staffing.</div>'; $('staffTable').innerHTML = ''; return; }
    const W=Math.max(1100,Math.round(target.getBoundingClientRect().width || 1360)), rowH=38, H=Math.max(300,filtered.length*rowH+70), labelNeed=Math.max(400,...filtered.map(r=>(`${r.group} · ${r.name}`).length*9)), left=Math.min(820,Math.max(470,labelNeed)), right=48, top=18;
    const max=Math.max(1,...filtered.flatMap(r=>[r.required||0,r.current||0]));
    const plotW=W-left-right;
    let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Required and current manpower by process">`;
    for(let i=0;i<=4;i++){const x=left+plotW*i/4; svg+=`<line class="grid-line" x1="${x}" y1="${top}" x2="${x}" y2="${H-44}"/><text class="axis-label" x="${x}" y="${H-24}" text-anchor="middle">${Math.round(max*i/4)}</text>`;}
    filtered.forEach((r,i)=>{const y=top+i*rowH; const req=Math.max(1,(r.required||0)/max*plotW); const cur=r.current===null?0:Math.max(1,r.current/max*plotW); const fullName=`${r.group} · ${r.name}`; svg+=`<text class="axis-label" x="${left-10}" y="${y+16}" text-anchor="end"><title>${escapeHtml(fullName)}</title>${escapeHtml(fullName)}</text><rect class="chart-bar" x="${left}" y="${y}" width="${req}" height="10" fill="#2479b5"><title>${escapeHtml(fullName)} · required ${fmt(r.required)} people</title></rect>`; if(r.current!==null) svg+=`<rect class="chart-bar" x="${left}" y="${y+14}" width="${cur}" height="10" fill="#32a185"><title>${escapeHtml(fullName)} · current ${fmt(r.current)} people</title></rect>`;});
    svg+=`<text class="chart-legend" x="${W-290}" y="22">Required</text><rect x="${W-365}" y="11" width="12" height="12" fill="#2479b5"/><text class="chart-legend" x="${W-125}" y="22">Current</text><rect x="${W-200}" y="11" width="12" height="12" fill="#32a185"/></svg>`;
    target.innerHTML=svg;
    $('staffTable').innerHTML=`<table class="chart-table"><thead><tr><th>Process</th><th>Required</th><th>Current</th></tr></thead><tbody>${filtered.map(r=>`<tr><td>${escapeHtml(r.group)} · ${escapeHtml(r.name)}</td><td>${fmt(r.required)}</td><td>${r.current===null?'TBD':fmt(r.current)}</td></tr>`).join('')}</tbody></table>`;
  }

  function renderStaffingTable(rows, view='network') {
    const selected=rows.filter(r=>view==='network'||r.owner===inHouseOperator);
    const tbody=$('staffingTable').querySelector('tbody');
    const visible=selected.filter(r=>r.demand>0 || r.touch!==null || r.current!==null);
    if(!visible.length){tbody.innerHTML='<tr><td colspan="8" class="empty-cell">Enter cycle times, then run the scenario.</td></tr>';return;}
    tbody.innerHTML=visible.map(r=>`<tr><td><b>${escapeHtml(r.group)}</b><br>${escapeHtml(r.name)}</td><td>${escapeHtml(r.owner)}</td><td>${r.required===null?'TBD':fmt(r.required)}</td><td>${r.requiredBacklog===null?'—':fmt(r.requiredBacklog)}</td><td>${r.current===null?'TBD':fmt(r.current)}</td><td class="${r.gap>0?'cell-warning':'cell-ok'}">${r.gap===null?'—':r.gap>0?`+${fmt(r.gap)} needed`:'0'}</td><td>${r.touch===null?'TBD':`${fmt1(r.touch)} min / ${escapeHtml(r.basis)}`}</td><td>${r.workloadPct===null?'—':`${fmt(r.workloadPct)}%`}</td></tr>`).join('');
  }

  function renderCalculationDetails(run) {
    const {sim,staffing,s}=run;
    const ledgerRows=[];
    sim.rows.forEach(r=>{
      const places=[
        ['NAC',r.opening.nac,r.flow.production,r.flow.nacOut,r.closing.nac,r.peaks.nac],
        ['SFT',r.opening.sft,r.flow.sftIn,r.flow.sftOut,r.closing.sft,r.peaks.sft],
        ['Paya Besar',r.opening.paya,r.flow.payaIn,r.flow.payaOut,r.closing.paya,r.peaks.paya],
        ['Kuantan Port',r.opening.port,r.flow.portIn,r.flow.portOut,r.closing.port,r.peaks.port],
        ['East Malaysia hubs',r.opening.hub,r.flow.hubIn,r.flow.hubOut,r.closing.hub,r.peaks.hub],
        ['NAC–SFT transit',r.opening.road,r.flow.roadIn,r.flow.roadOut,r.closing.road,r.peaks.road],
        ['Rail transit',r.opening.rail,r.flow.railIn,r.flow.railOut,r.closing.rail,r.peaks.rail],
        ['Vessel transit',r.opening.sea,r.flow.seaIn,r.flow.seaOut,r.closing.sea,r.peaks.sea]
      ];
      places.forEach(x=>ledgerRows.push(`<tr><td>Day ${r.day}</td><td>${escapeHtml(x[0])}</td><td>${fmt(x[1])}</td><td>${fmt(x[2])}</td><td>${fmt(x[3])}</td><td>${fmt(x[4])}</td><td>${fmt(x[5])}</td><td>${fmt(x[1]+x[2]-x[3])}</td></tr>`));
    });
    $('ledgerTable').innerHTML=`<table><thead><tr><th>Day</th><th>Location</th><th>Opening</th><th>In</th><th>Out</th><th>Closing</th><th>Peak</th><th>Balance check</th></tr></thead><tbody>${ledgerRows.join('')}</tbody></table>`;
    const rows=staffing.rows.filter(r=>r.demand>0||r.backlogTarget>0||r.touch!==null);
    $('calcStaffTable').innerHTML=`<table><thead><tr><th>Location / process</th><th>Daily CBU</th><th>CBU / shift</th><th>Cycles / shift</th><th>Hands-on / cycle</th><th>Work min / shift</th><th>Available min / person</th><th>Crew size</th><th>People needed / shift</th><th>Backlog / deadline</th><th>Backlog people</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.group)} · ${escapeHtml(r.name)}</td><td>${fmt(r.demand)}</td><td>${fmt1(r.targetPerShift)}</td><td>${r.cycles===null?'TBD':fmt1(r.cycles)}</td><td>${r.touch===null?'TBD':`${fmt1(r.touch)} min`}</td><td>${r.workMin===null?'TBD':fmt1(r.workMin)}</td><td>${r.availableMin?fmt1(r.availableMin):'TBD'}${r.theoretical?' · theoretical':''}</td><td>${fmt(r.crew)}</td><td>${r.required===null?'TBD':fmt(r.required)}</td><td>${r.backlogTarget==null?'Not entered':`${fmt(r.backlogTarget)} CBU / ${r.deadline?`${fmt1(r.deadline)} h`:'deadline TBD'}`}</td><td>${r.requiredBacklog===null?'TBD':fmt(r.requiredBacklog)}</td></tr>`).join('')}</tbody></table>`;
    $('calcNotes').innerHTML=[
      statusItem('Warning','Daily volume mismatch','137 East Coast + 221 East Malaysia = 358 CBU/day. The stated mixed reference remains 359 CBU/day and is not added into the flow.'),
      statusItem('Warning','Train capacity mismatch','22 × 8 = 176 typical CBU; 22 × 10 = 220 maximum CBU. Both are below the separate 230 CBU trip cap.'),
      statusItem('Warning','Historical accumulation estimates unreconciled','2.24, 1.38 and 0.86 days remain unverified and are excluded from all calculations.'),
      statusItem(s.nacTransferCapacity===null||s.nacTransferMinutes===null?'Not checked':'Checked','NAC to SFT transfer',s.nacTransferCapacity===null||s.nacTransferMinutes===null?'Transfer limit and time are both required before production moves from NAC to SFT.':`${fmt(s.nacTransferCapacity)} CBU/day limit and ${fmt1(s.nacTransferMinutes)} minute transfer time are applied.`),
      statusItem('Not checked','Starting stock values','Starting stock fields default to zero for this scenario. They are editable planning inputs, not verified live counts.')
    ].join('');
    renderGantt(run);
  }

  function renderGantt(run) {
    const target=$('ganttChart');
    if(!target)return;
    const {s,sim,staffing}=run;
    const active=staffing.rows.filter(r=>r.demand>0);
    const needs=active.filter(r=>r.elapsed===null||r.missingBasis||r.teams===null||r.teams<1);
    if(needs.length){
      target.innerHTML=`<div class="gantt-tbd"><strong>Timeline is partial until the missing inputs are entered.</strong><p>Each lane needs elapsed minutes, a cycle basis with a batch size where relevant, and at least one parallel team.</p><ul>${needs.map(r=>`<li>${escapeHtml(r.group)} · ${escapeHtml(r.name)}: ${r.elapsed===null?'elapsed time missing; ':''}${r.missingBasis?'batch size/capacity missing; ':''}${r.teams===null||r.teams<1?'parallel teams missing':''}</li>`).join('')}</ul></div>`;
      return;
    }
    const W=Math.max(980,Math.min(9000,sim.horizon*90+250)), left=310, rowH=34, H=staffing.rows.length*rowH+60;
    if(H>14000){target.innerHTML='<div class="gantt-tbd">The selected horizon creates too many timeline rows to display at once. Reduce simulation days to view this detailed schedule.</div>';return;}
    const maxHours=Math.max(24,sim.horizon*24); const plotW=W-left-25; const xFor=h=>left+h/maxHours*plotW;
    let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Process timeline across ${sim.horizon} simulation days">`;
    const ticks=Math.min(12,sim.horizon); for(let i=0;i<=ticks;i++){const h=maxHours*i/ticks,x=xFor(h);svg+=`<line class="grid-line" x1="${x}" y1="28" x2="${x}" y2="${H-20}"/><text class="axis-label" x="${x}" y="18" text-anchor="middle">${fmt1(h)} h</text>`;}
    const rowByKey=new Map(staffing.rows.map((r,i)=>[r.key,{row:r,y:34+i*rowH}]));
    const bars=[];
    const cyclesFor=(r,qty)=>{const basisQty=r.basis==='cbu'?1:r.basis==='wagon'?sim.perWagon:r.basis==='train'?sim.effCap:r.basis==='ship'?s.vesselDispatchQty:r.basis==='batch'?r.batch:0;if(r.basis==='setup')return qty>0?1:0;if(!basisQty||basisQty<=0)return null;return Math.ceil(qty/basisQty);};
    const startParts=String(s.shiftStart||'00:00').split(':').map(Number), startOffset=(startParts[0]||0)+(startParts[1]||0)/60;
    const addStage=(r,qty,day,cursor,color,cycleOverride=null)=>{
      if(!r||qty<=0)return cursor;
      const cycles=cycleOverride===null?cyclesFor(r,qty):cycleOverride; if(cycles===null)return null;if(cycles<=0)return cursor;
      const duration=(r.elapsed*cycles/Math.max(1,r.teams))/60;
      const start=cursor, end=start+duration;
      bars.push({key:r.key,start,end,day,qty,cycles,teams:r.teams,color});
      return end;
    };
    const allStages=staffing.rows.filter(r=>r.flow==='all'&&r.demand>0);
    const ecStages=staffing.rows.filter(r=>r.flow==='ec'&&r.demand>0);
    const emStages=staffing.rows.filter(r=>r.flow==='em'&&r.demand>0);
    for(let day=0;day<sim.horizon;day++){
      const base=day*24+startOffset; let common=base;
      const dayRow=sim.rows[day];
      for(const r of allStages){const actualCycles=['trainLoad','rail1','payaShunting'].includes(r.key)?dayRow.trainTrips:null;common=addStage(r,sim.daily.ec+sim.daily.em,day,common,'#2479b5',actualCycles);if(common===null)break;}
      if(common===null)continue;
      let ec=common; for(const r of ecStages){ec=addStage(r,sim.daily.ec,day,ec,'#168879');if(ec===null)break;}
      let em=common; for(const r of emStages){let override=null;if(['rail2','portHandling'].includes(r.key))override=dayRow.emTrainTrips;if(['vesselLoading','voyage'].includes(r.key))override=dayRow.vessels;const qty=override===0?0:sim.daily.em;em=addStage(r,qty,day,em,'#8065a8',override);if(em===null)break;}
    }
    for(const [key,{row,y}] of rowByKey){
      if(row.demand<=0)continue;
      svg+=`<text class="axis-label gantt-label" x="${left-10}" y="${y+18}" text-anchor="end"><title>${escapeHtml(row.group)} · ${escapeHtml(row.name)}</title>${escapeHtml(row.group)} · ${escapeHtml(row.name)}</text>`;
      bars.filter(b=>b.key===key).forEach(b=>{const x=xFor(b.start), width=Math.max(2,(b.end-b.start)/maxHours*plotW);const startDay=Math.floor(b.start/24)+1,startHour=b.start%24,endDay=Math.floor(b.end/24)+1,endHour=b.end%24;svg+=`<rect class="gantt-bar" x="${x}" y="${y+4}" width="${Math.min(width,W-x-2)}" height="20" rx="3" fill="${b.color}"><title>Day ${startDay} ${fmt1(startHour)}:00 to Day ${endDay} ${fmt1(endHour)}:00 · ${escapeHtml(row.name)} · ${fmt(b.qty)} CBU · ${fmt(b.cycles)} cycles × ${fmt1(row.elapsed)} elapsed minutes ÷ ${fmt(b.teams)} parallel teams</title></rect>`;});
    }
    svg+='</svg>'; target.innerHTML=svg;
  }

  function renderEvents(events, horizon) {
    const sorted=events.filter(e=>e.time<=horizon+1).sort((a,b)=>a.time-b.time).slice(0,200);
    $('eventCount').textContent=`${events.length} event${events.length===1?'':'s'}`;
    if(!sorted.length){$('eventLog').innerHTML='<li class="empty-cell">No train or vessel events in this run.</li>';return;}
    $('eventLog').innerHTML=sorted.map(e=>{
      const day=Math.floor(e.time)+1, hours=(e.time-Math.floor(e.time))*24;
      const hm=`${String(Math.floor(hours)).padStart(2,'0')}:${String(Math.round((hours%1)*60)).padStart(2,'0')}`;
      return `<li><span class="event-time">D${day} ${hm}</span><span>${escapeHtml(e.text)}</span></li>`;
    }).join('');
  }

  function renderRouteBoard(sim) {
    $('routeNac').textContent = fmt(sim.nacEnd);
    $('routeNacNote').textContent = `${fmt(sim.daily.ec + sim.daily.em)} CBU produced per day · ${fmt(sim.nacTransferred)} transferred to SFT`;
    $('routeSft').textContent = fmt(sim.sftEnd);
    $('routeSftNote').textContent = `${fmt(sim.daily.ec + sim.daily.em)} CBU released per day`;
    $('routePaya').textContent = fmt(sim.payaEnd);
    $('routePayaNote').textContent = `${fmt(sim.payaDealerDelivered)} sent to East Coast dealers`;
    $('routePort').textContent = fmt(sim.portEnd);
    $('routePortNote').textContent = `${fmt(sim.dispatchedEm)} CBU sent by vessel`;
    $('routeEm').textContent = fmt(sim.emHubEnd);
    $('routeEmNote').textContent = `${fmt(sim.dealerDeliveredTotal)} sent to dealers · ${fmt(sim.transitEnd)} in transit`;
  }

  function placeTooltip(wrap) {
    const button = wrap.querySelector('.help');
    const tip = wrap.querySelector('.tooltip');
    if (!button || !tip) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    tip.style.width = `${width}px`;
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';
    const height = tip.getBoundingClientRect().height;
    let top = rect.top - height - 8;
    if (top < 8) top = Math.min(window.innerHeight - height - 8, rect.bottom + 8);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
    tip.style.visibility = '';
    tip.style.display = '';
  }

  function selectPage(pageId) {
    const pageIds = ['resultsPage', 'inputsPage', 'calculationsPage'];
    pageIds.forEach(id => {
      const selected = id === pageId;
      $(id).hidden = !selected;
      const tab = $(id === 'resultsPage' ? 'resultsTab' : id === 'inputsPage' ? 'inputsTab' : 'calculationsTab');
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    if (pageId === 'resultsPage' && window.lastRun) {
      requestAnimationFrame(() => {
        if (!window.lastRun) return;
        renderInventoryGraph(window.lastRun.sim.rows);
        const inHouseOnly = $('staffingTable').dataset.view === 'in-house';
        renderStaffGraph(inHouseOnly ? window.lastRun.staffing.rows.filter(r => r.owner === inHouseOperator) : window.lastRun.staffing.rows);
      });
    }
    if (pageId === 'calculationsPage' && window.lastRun) renderCalculationDetails(window.lastRun);
  }

  function setTheme(theme) {
    const selected=theme==='dark'?'dark':'light';
    document.documentElement.dataset.theme=selected;
    $('themeToggle').textContent=selected==='dark'?'Light mode':'Dark mode';
    $('themeToggle').setAttribute('aria-pressed',String(selected==='dark'));
    try{localStorage.setItem('railway-logistics-theme',selected);}catch{}
  }

  function selectInputPanel(panelId) {
    document.querySelectorAll('.input-tab-bar [role="tab"]').forEach(tab => {
      const selected = tab.dataset.inputTab === panelId;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.input-tab-panel').forEach(panel => {
      const selected = panel.id === panelId;
      panel.hidden = !selected;
      panel.classList.toggle('active', selected);
    });
  }

  function bindTabKeyboard(tabs, select) {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab, index));
      tab.addEventListener('keydown', event => {
        let nextIndex = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        tabs[nextIndex].focus();
        select(tabs[nextIndex], nextIndex);
      });
    });
  }

  function runModel({ showResults = false } = {}) {
    const s=readState();
    const sim=simulate(s);
    const staffing=calculateStaffing(s,sim);
    const checks=evaluateReadiness(s,sim,staffing);
    window.lastRun={s,sim,staffing};
    renderReadiness(checks);
    renderInventoryGraph(sim.rows);
    renderStaffGraph(staffing.rows.filter(r=>r.owner===inHouseOperator || $('staffingTable')?.dataset?.view!=='in-house'));
    renderStaffingTable(staffing.rows, $('staffingTable').dataset.view || 'network');
    renderEvents(sim.events,sim.horizon);
    renderRouteBoard(sim);
    renderCalculationDetails({s,sim,staffing});
    $('kpiSft').textContent=fmt(sim.sftEnd);
    $('kpiSftSub').textContent=`Peak ${fmt(sim.sftPeak)} CBU during ${sim.horizon} days`;
    $('kpiTrains').textContent=fmt(sim.trainTrips);
    $('kpiTrainsSub').textContent=`${fmt(s.trainsPerDay||0)} slot(s) / day · ${s.requireFullLoad?'minimum load required':'partial dispatch allowed'}`;
    $('kpiPort').textContent=fmt(sim.portEnd);
    $('kpiPortSub').textContent=`${fmt(sim.vessels)} vessel dispatch(es) · ${fmt(sim.transitEnd)} in transit`;
    const gapRows=staffing.rows.filter(r=>r.gap!==null&&r.gap>0);
    if(gapRows.length){$('kpiGap').textContent=`+${fmt(gapRows.reduce((a,r)=>a+r.gap,0))}`;$('kpiGapSub').textContent=`people needed across ${gapRows.length} process(es)`;}
    else if(staffing.rows.some(r=>r.required!==null&&r.current!==null)){$('kpiGap').textContent='0';$('kpiGapSub').textContent='No modeled headcount gap';}
    else{$('kpiGap').textContent='TBD';$('kpiGapSub').textContent='Enter cycle times and current headcount';}
    if(staffing.missingElapsed===0){$('kpiLead').textContent=`${fmt1(staffing.knownElapsed/60)} h`;$('kpiLeadSub').textContent='Sum of per-cycle elapsed inputs, not total route time';}
    else if(staffing.knownElapsed>0){$('kpiLead').textContent=`${fmt1(staffing.knownElapsed/60)} h + TBD`;$('kpiLeadSub').textContent=`${staffing.missingElapsed} active process time(s) missing · partial cycle-time sum`;}
    else{$('kpiLead').textContent='TBD';$('kpiLeadSub').textContent='Enter elapsed time for active processes';}
    $('runTitle').textContent=`${s.demandMode==='network'?'East Coast + East Malaysia':s.demandMode==='east-coast'?'East Coast only':'East Malaysia only'} · ${sim.horizon} days`;
    $('runTimestamp').textContent=`Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    const needsReview=checks.some(c=>c.includes('Warning')||c.includes('Not checked'));
    $('resultCompleteness').textContent=needsReview?'Review checks and inputs':'Checks evaluated';
    $('resultCompleteness').className=`status-pill ${needsReview?'status-warn':'status-ok'}`;
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(s)); $('savedState').textContent='Scenario saved in this browser'; }
    catch { $('savedState').textContent='Browser storage unavailable · export scenario to keep it'; }
    if (showResults) selectPage('resultsPage');
  }

  function bind() {
    document.querySelectorAll('.help-wrap').forEach(w=>{
      w.addEventListener('mouseenter',()=>placeTooltip(w));
      w.addEventListener('focusin',()=>placeTooltip(w));
      w.addEventListener('click',()=>placeTooltip(w));
    });
    window.addEventListener('scroll',()=>document.querySelectorAll('.help-wrap:hover,.help-wrap:focus-within,.help-wrap.is-open').forEach(placeTooltip),true);
    document.addEventListener('click',e=>{
      const help=e.target.closest('.help');
      if(help){const wrap=help.closest('.help-wrap');const open=wrap.classList.toggle('is-open');help.setAttribute('aria-expanded',String(open));e.stopPropagation();return;}
      document.querySelectorAll('.help-wrap.is-open').forEach(w=>{w.classList.remove('is-open');w.querySelector('.help')?.setAttribute('aria-expanded','false');});
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.help-wrap.is-open').forEach(w=>{w.classList.remove('is-open');w.querySelector('.help')?.setAttribute('aria-expanded','false');});});
    let chartResizeFrame;
    window.addEventListener('resize',()=>{
      if (!window.lastRun) return;
      cancelAnimationFrame(chartResizeFrame);
      chartResizeFrame = requestAnimationFrame(() => {
        renderInventoryGraph(window.lastRun.sim.rows);
        const inHouseOnly = $('staffingTable').dataset.view === 'in-house';
        renderStaffGraph(inHouseOnly ? window.lastRun.staffing.rows.filter(r => r.owner === inHouseOperator) : window.lastRun.staffing.rows);
      });
    });
    document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{updateDerived();$('savedState').textContent='Unsaved changes · run or export to keep this scenario';$('resultCompleteness').textContent='Inputs changed · run again';$('resultCompleteness').className='status-pill status-info';}));
    bindTabKeyboard([...document.querySelectorAll('.page-tabs [role="tab"]')], tab => selectPage(tab.id === 'resultsTab' ? 'resultsPage' : tab.id === 'inputsTab' ? 'inputsPage' : 'calculationsPage'));
    bindTabKeyboard([...document.querySelectorAll('.input-tab-bar [role="tab"]')], tab => selectInputPanel(tab.dataset.inputTab));
    $('runBtn').addEventListener('click',()=>runModel({showResults:true}));
    $('inventoryMode').addEventListener('change',()=>{if(window.lastRun)renderInventoryGraph(window.lastRun.sim.rows);});
    const savedTheme=(()=>{try{return localStorage.getItem('railway-logistics-theme')||'light';}catch{return 'light';}})();
    setTheme(savedTheme);
    $('themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    $('resetBtn').addEventListener('click',()=>{try{localStorage.removeItem(STORAGE_KEY);}catch{} applyState({ ...defaultState, processes:processDefaults() });$('savedState').textContent='Reset to MVP 1 starting values';runModel();});
    $('toggleProcesses').addEventListener('click',()=>{const details=[...document.querySelectorAll('.process-group')];const open=details.some(d=>!d.open);details.forEach(d=>d.open=open);$('toggleProcesses').textContent=open?'Collapse all':'Expand all';});
    $('sidingMode').addEventListener('change',updateDerived);
    $('exportBtn').addEventListener('click',()=>{
      const data=readState(); const blob=new Blob([JSON.stringify({format:'railway-logistics-mvp1',version:1,exportedAt:new Date().toISOString(),scenario:data},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='railway-simulation-scenario.json'; a.click(); URL.revokeObjectURL(url);
    });
    $('importBtn').addEventListener('click',()=>$('importFile').click());
    $('importFile').addEventListener('change',async e=>{const file=e.target.files?.[0]; if(!file)return; try{const payload=JSON.parse(await file.text()); const scenario=payload.scenario||payload; applyState(scenario); $('savedState').textContent='Scenario imported · run to update results'; $('resultCompleteness').textContent='Imported inputs · run again'; $('resultCompleteness').className='status-pill status-info'; selectPage('inputsPage');}catch{ $('savedState').textContent='Import failed · choose a valid scenario JSON file'; selectPage('inputsPage'); } e.target.value='';});
    document.querySelectorAll('[data-staff-view]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-staff-view]').forEach(b=>b.classList.toggle('active',b===btn));$('staffingTable').dataset.view=btn.dataset.staffView;if(window.lastRun){renderStaffingTable(window.lastRun.staffing.rows,btn.dataset.staffView);renderStaffGraph(btn.dataset.staffView==='in-house'?window.lastRun.staffing.rows.filter(r=>r.owner===inHouseOperator):window.lastRun.staffing.rows);}}));
  }

  buildProcessInputs();
  addFieldHelp();
  let saved=null;
  try { saved=localStorage.getItem(STORAGE_KEY); } catch { /* Some file:// browser contexts disable local storage. */ }
  if(saved){try{applyState(JSON.parse(saved));}catch{applyState({...defaultState,processes:processDefaults()});}}
  else applyState({...defaultState,processes:processDefaults()});
  bind();
  runModel();
})();
