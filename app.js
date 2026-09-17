const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value).replace('₪', 'Sh ');
const units = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const number = (id) => Number($(id).value) || 0;

const scenarios = [
  { id: 'a', title: 'Option A', label: 'Conservative allocation plan', premise: 'D', machineActive: true, production: 50000, milk: 2.5, request: 50000, allocation: 40000, marketing: 1000, rent: 17000, transportRate: 0.1, maintenance: 1800, newMachine: 0, loan: 0, term: 4 },
  { id: 'b', title: 'Option B', label: 'Higher-volume allocation plan', premise: 'D', machineActive: true, production: 60000, milk: 3, request: 60000, allocation: 48000, marketing: 1500, rent: 17000, transportRate: 0.1, maintenance: 1800, newMachine: 0, loan: 0, term: 4 },
];

function scenarioMarkup(scenario) {
  const field = (label, key, unit, step = '1') => `<label>${label}<span>${unit}</span><input data-scenario="${scenario.id}" data-key="${key}" type="number" value="${scenario[key]}" step="${step}" /></label>`;
  const textField = (label, key) => `<label>${label}<span>editable label</span><input data-scenario="${scenario.id}" data-key="${key}" type="text" value="${scenario[key]}" /></label>`;
  const checkbox = (label, key) => `<label class="check-label"><span>${label}</span><input data-scenario="${scenario.id}" data-key="${key}" type="checkbox" ${scenario[key] ? 'checked' : ''} /></label>`;
  return `<article class="panel scenario scenario-${scenario.id}">
    <div class="scenario-title"><h3>${scenario.title}</h3><span>${scenario.label}</span></div>
    <p class="scenario-note">Actual allocation is a scenario input. Change it when the trainer announces the market result.</p>
    <div class="fields two-columns">
      ${textField('Premise', 'premise')}
      ${checkbox('Use owned machine for production', 'machineActive')}
      ${field('Planned production', 'production', 'units', '1000')}
      ${field('Milk purchased', 'milk', 'tons', '0.1')}
      ${field('Sales request', 'request', 'units', '1000')}
      ${field('Possible actual sales', 'allocation', 'units', '1000')}
      ${field('Market investment', 'marketing', 'Sh', '1')}
      ${field('Premise rent', 'rent', 'Sh', '1')}
      ${field('Transport rate', 'transportRate', 'Sh / sold unit', '0.01')}
      ${field('Machine maintenance', 'maintenance', 'Sh', '1')}
      ${field('New machine purchase', 'newMachine', 'Sh', '1')}
      ${field('New borrowing', 'loan', 'Sh', '1')}
      ${field('New loan term', 'term', 'seasons', '1')}
    </div>
    <p class="subheading">Projected results</p>
    <div id="results-${scenario.id}" class="result-grid"></div>
    <details class="calc-sheet" open><summary>Projected P&L</summary><div id="pl-${scenario.id}" class="line-list"></div></details>
    <details class="calc-sheet"><summary>Projected Cash Flow</summary><div id="cf-${scenario.id}" class="line-list"></div></details>
    <div id="alerts-${scenario.id}" class="alert-list"></div>
  </article>`;
}

$('scenarioGrid').innerHTML = scenarios.map(scenarioMarkup).join('');

function globalInputs() {
  return {
    openingCash: number('openingCash'), year1Profit: number('year1Profit'), lossPool: number('lossPool'),
    existingDebt: number('existingDebt'), existingPrincipal: number('existingPrincipal'), existingRate: number('existingRate') / 100,
    ownedMachineCost: number('ownedMachineCost'), remainingLife: Math.max(1, number('remainingLife')),
    machineCapacity: number('machineCapacity'), machineMaintenance: number('machineMaintenance'),
    unitPrice: number('unitPrice'), milkPrice: number('milkPrice'), taxRate: number('taxRate') / 100,
    bonusRate: number('bonusRate') / 100, newLoanRate: number('newLoanRate') / 100,
    newMachineLife: Math.max(1, number('newMachineLife')),
    hasRequiredBaseline: ['openingCash', 'ownedMachineCost', 'remainingLife', 'machineCapacity', 'machineMaintenance'].every((id) => $(id).value !== ''),
  };
}

function valuesFor(scenario) {
  const values = { ...scenario };
  document.querySelectorAll(`[data-scenario="${scenario.id}"]`).forEach((input) => {
    values[input.dataset.key] = input.type === 'checkbox' ? input.checked : input.type === 'text' ? input.value : Number(input.value) || 0;
  });
  return values;
}

function calculate(s, g) {
  const maxMilkUnits = s.milk * 20000;
  const usableCapacity = s.machineActive ? g.machineCapacity : 0;
  const sales = Math.max(0, s.allocation);
  const depreciation = (g.ownedMachineCost / g.remainingLife) + (s.newMachine / g.newMachineLife);
  const revenue = sales * g.unitPrice;
  const milkCost = s.milk * g.milkPrice;
  const grossProfit = revenue - milkCost - s.maintenance - depreciation;
  const bonus = Math.max(0, grossProfit * g.bonusRate);
  const transport = sales * s.transportRate;
  const newLoanInterest = s.loan * g.newLoanRate;
  const existingInterest = g.existingDebt * g.existingRate;
  const interest = newLoanInterest + existingInterest;
  const pbt = grossProfit - transport - s.marketing - bonus - 10000 - s.rent - interest;
  const lossUsed = Math.min(g.lossPool, Math.max(0, pbt));
  const taxableProfit = Math.max(0, pbt - lossUsed);
  const tax = taxableProfit * g.taxRate;
  const netProfit = pbt - tax;
  const newPrincipal = s.loan / Math.max(1, s.term);
  const cashBeforeAdvance = g.openingCash + s.loan - s.newMachine - milkCost - s.marketing;
  const closingCash = g.openingCash + s.loan + revenue - s.newMachine - milkCost - s.marketing - s.rent - s.maintenance - transport - 10000 - bonus - g.existingPrincipal - newPrincipal - interest - tax;
  const closingLossPool = Math.max(0, g.lossPool - lossUsed) + Math.max(0, -pbt);
  const remainingDebt = Math.max(0, g.existingDebt + s.loan - g.existingPrincipal - newPrincipal);
  return { maxMilkUnits, usableCapacity, sales, depreciation, revenue, milkCost, grossProfit, bonus, transport, interest, pbt, lossUsed, taxableProfit, tax, netProfit, cashBeforeAdvance, closingCash, closingLossPool, remainingDebt };
}

function metric(label, value, emphasis = false, wide = false) { return `<div class="metric ${emphasis ? 'emphasis' : ''} ${wide ? 'wide' : ''}"><span>${label}</span><strong>${value}</strong></div>`; }

function renderScenario(scenario, result, input, g) {
  $(`results-${scenario.id}`).innerHTML = [
    metric('Revenue', money(result.revenue)), metric('Milk cost', money(result.milkCost)),
    metric('Depreciation', money(result.depreciation)), metric('Gross profit', money(result.grossProfit)),
    metric('Profit before tax', money(result.pbt)), metric('Tax', money(result.tax)),
    metric('Net profit', money(result.netProfit), true), metric('Closing cash', money(result.closingCash), true),
    metric('Spoilage', `${units(Math.max(0, input.production - result.sales))} units`, false, true),
    metric('Closing debt', money(result.remainingDebt), false, true),
  ].join('');
  const line = (label, value, total = false) => `<div class="line-item ${total ? 'total' : ''}"><span>${label}</span><strong>${money(value)}</strong></div>`;
  $(`pl-${scenario.id}`).innerHTML = [
    line('Revenue', result.revenue), line('Milk cost', -result.milkCost), line('Maintenance', -input.maintenance), line('Depreciation', -result.depreciation), line('Gross profit', result.grossProfit, true),
    line('Transport', -result.transport), line('Market investment', -input.marketing), line('Bonus', -result.bonus), line('Fixed salaries', -10000), line(`Premise ${input.premise || 'not named'} rent`, -input.rent), line('Interest', -result.interest),
    line('Profit before tax', result.pbt, true), line('Tax loss used', -result.lossUsed), line('Taxable profit', result.taxableProfit), line('Game tax', -result.tax), line('Net profit', result.netProfit, true),
  ].join('');
  $(`cf-${scenario.id}`).innerHTML = [
    line('Opening cash', g.openingCash), line('New loan received', input.loan), line('Sales receipt', result.revenue), line('Total cash available', g.openingCash + input.loan + result.revenue, true),
    line('Machine purchase', -input.newMachine), line('Milk purchase', -result.milkCost), line('Market investment', -input.marketing), line('Rent', -input.rent), line('Maintenance', -input.maintenance), line('Transport', -result.transport), line('Fixed salaries', -10000), line('Bonus', -result.bonus), line('Existing principal repaid', -g.existingPrincipal), line('New-loan principal repaid', -(input.loan / Math.max(1, input.term))), line('Interest', -result.interest), line('Tax', -result.tax), line('Closing cash', result.closingCash, true),
  ].join('');
  const alerts = [];
  if (!g.hasRequiredBaseline) {
    alerts.push('Enter the actual Year 1 autumn cash and owned-machine values before treating this projection as a decision.');
  } else {
    if (input.production > result.usableCapacity) alerts.push(`Production exceeds usable machine capacity by ${units(input.production - result.usableCapacity)} units.`);
    if (input.production > result.maxMilkUnits) alerts.push(`Production exceeds available milk capacity by ${units(input.production - result.maxMilkUnits)} units.`);
    if (input.request > input.production) alerts.push('Sales request exceeds planned production.');
    if (result.sales > input.request) alerts.push('Actual sales allocation exceeds the sales request.');
    if (result.cashBeforeAdvance < 0) alerts.push(`Cash is negative before advance payments by ${money(Math.abs(result.cashBeforeAdvance))}.`);
    if (result.closingCash < 0) alerts.push(`Closing cash is negative by ${money(Math.abs(result.closingCash))}.`);
    if (!alerts.length) alerts.push('Plan passes capacity, milk and cash checks for these inputs.');
  }
  $(`alerts-${scenario.id}`).innerHTML = alerts.map((message) => `<div class="alert ${message.includes('passes') ? 'good' : message.includes('Enter the actual') ? 'warn' : 'bad'}">${message}</div>`).join('');
}

function renderRecommendation(results) {
  const [a, b] = results;
  const g = globalInputs();
  if (!g.hasRequiredBaseline) {
    $('recommendationText').innerHTML = '<p><strong>Recommendation pending.</strong> Enter the actual Year 1 autumn cash and machine schedule first. The two options remain editable, but their current results are not yet a valid Year 2 decision.</p>';
    return;
  }
  const winner = a.result.netProfit >= b.result.netProfit ? a : b;
  const difference = Math.abs(a.result.netProfit - b.result.netProfit);
  const risks = [a, b].filter(({ result }) => result.cashBeforeAdvance < 0 || result.closingCash < 0);
  const volumeDifference = a.input.allocation - b.input.allocation;
  const spoilageDifference = Math.max(0, a.input.production - a.result.sales) - Math.max(0, b.input.production - b.result.sales);
  $('recommendationText').innerHTML = `<p><strong>${winner.scenario.title}</strong> has the higher projected net profit by ${money(difference)} under the entered allocation assumptions.</p>
    <p>The two plans differ mainly in possible sales (${units(Math.abs(volumeDifference))} units), milk purchased, market spending and spoilage (${units(Math.abs(spoilageDifference))} units). The most important assumption is the trainer's actual allocation: lower allocations reduce revenue while milk, rent, salaries and market spending remain. ${risks.length ? `<strong>Cash warning:</strong> ${risks.map(({ scenario }) => scenario.title).join(' and ')} needs financing or lower advance payments.` : 'Neither entered plan makes cash negative.'}</p>`;
}

function renderYear1Check() {
  const revenue = 50000 * 2;
  const milk = 2.5 * 20000;
  const depreciation = 35000 / 8;
  const maintenance = 1800;
  const transport = 50000 * 0.1;
  const gross = revenue - milk - depreciation - maintenance;
  const bonus = gross * 0.05;
  const pbt = gross - transport - 1000 - bonus - 10000 - 17000;
  const tax = Math.max(0, pbt) * 0.1;
  const net = pbt - tax;
  const cash = 100000 + revenue - 35000 - milk - 1000 - 17000 - maintenance - transport - 10000 - bonus - tax;
  const classNet = $('classroomNetProfit').value === '' ? null : number('classroomNetProfit');
  const classCash = $('classroomClosingCash').value === '' ? null : number('classroomClosingCash');
  const profitCheck = classNet === null ? 'Enter class result' : Math.abs(classNet - net) < 0.5 ? 'Matches class model' : `Difference ${money(net - classNet)}`;
  const cashCheck = classCash === null ? 'Enter class result' : Math.abs(classCash - cash) < 0.5 ? 'Matches class model' : `Difference ${money(cash - classCash)}`;
  $('year1Check').innerHTML = [metric('Revenue', money(revenue)), metric('Calculated net profit', money(net)), metric('Calculated closing cash', money(cash)), metric('P&L check', profitCheck), metric('Cash check', cashCheck)].join('');
}

function update() {
  const g = globalInputs();
  const results = scenarios.map((scenario) => {
    const input = valuesFor(scenario);
    const result = calculate(input, g);
    renderScenario(scenario, result, input, g);
    return { scenario, input, result };
  });
  renderRecommendation(results);
  renderYear1Check();
}

document.querySelectorAll('input').forEach((input) => input.addEventListener('input', update));
update();
