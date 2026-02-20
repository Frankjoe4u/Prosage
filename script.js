let cycleLength = 28;
let periodDur = 5;

const cycleLengthVal = document.getElementById("cycleLengthVal");
const periodDurVal = document.getElementById("periodDurVal");

document.getElementById("decreaseLen").addEventListener("click", () => {
  if (cycleLength > 21) {
    cycleLength--;
    cycleLengthVal.textContent = cycleLength;
  }
});
document.getElementById("increaseLen").addEventListener("click", () => {
  if (cycleLength < 40) {
    cycleLength++;
    cycleLengthVal.textContent = cycleLength;
  }
});
document.getElementById("decreaseDur").addEventListener("click", () => {
  if (periodDur > 2) {
    periodDur--;
    periodDurVal.textContent = periodDur;
  }
});
document.getElementById("increaseDur").addEventListener("click", () => {
  if (periodDur < 10) {
    periodDur++;
    periodDurVal.textContent = periodDur;
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateInSet(date, set) {
  return set.some((d) => isSameDay(d, date));
}

function dateRange(start, end) {
  const days = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Calculate ──────────────────────────────────────────────────────────────
document.getElementById("calcBtn").addEventListener("click", calculate);

function calculate() {
  const lastPeriodInput = document.getElementById("lastPeriod").value;
  if (!lastPeriodInput) {
    alert("Please select the first day of your last period.");
    return;
  }

  const lastPeriod = new Date(lastPeriodInput);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Next period
  const nextPeriodStart = addDays(lastPeriod, cycleLength);
  const nextPeriodEnd = addDays(nextPeriodStart, periodDur - 1);
  const periodDates = dateRange(nextPeriodStart, nextPeriodEnd);

  // ── Ovulation (14 days before next period start)
  const ovulationDay = addDays(nextPeriodStart, -14);

  // ── Fertile window (5 days before ovulation + ovulation day + 1 day after)
  const fertileStart = addDays(ovulationDay, -5);
  const fertileEnd = addDays(ovulationDay, 1);
  const fertileDates = dateRange(fertileStart, fertileEnd);

  // ── Safe days in the current cycle window
  const cycleStart = addDays(lastPeriod, periodDur); // day after last period ends
  const cycleEnd = addDays(nextPeriodStart, -1); // day before next period
  const allCycleDays = dateRange(cycleStart, cycleEnd);
  const safeDates = allCycleDays.filter((d) => !dateInSet(d, fertileDates));

  // ── Safe day windows (group contiguous days)
  const safeWindows = groupContiguous(safeDates);
  const fertileWindows = groupContiguous(fertileDates);

  // ── Update mini cards
  document.getElementById("nextPeriodDate").textContent =
    formatDateShort(nextPeriodStart);
  document.getElementById("ovulationDate").textContent =
    formatDateShort(ovulationDay);

  // ── Populate date bands
  populateBands("safeDays", safeWindows, "safe-band");
  populateBands("fertileDays", fertileWindows, "fertile-band");
  populateBands(
    "periodDays",
    [[nextPeriodStart, nextPeriodEnd]],
    "period-band",
  );

  // ── Gender likelihood (Shettles Method)
  // Boy:  conceive ON ovulation day or 1 day before  → Y-sperm (fast, short-lived)
  // Girl: conceive 3–5 days BEFORE ovulation          → X-sperm (slower, longer-lived)
  const boyOptimalStart = addDays(ovulationDay, -1);
  const boyOptimalEnd = new Date(ovulationDay);
  const girlOptimalStart = addDays(ovulationDay, -5);
  const girlOptimalEnd = addDays(ovulationDay, -3);

  // Scores based on days-from-ovulation within fertile window
  // For each fertile day compute a "boy score" and "girl score"
  let boyScore = 0,
    girlScore = 0;
  fertileDates.forEach((d) => {
    const daysFromOv = Math.round((d - ovulationDay) / (1000 * 60 * 60 * 24));
    // Boy: maximised at 0 (ovulation), falls off quickly
    const b = Math.max(0, 1 - Math.abs(daysFromOv) * 0.35);
    // Girl: maximised at -4 days before ovulation, falls off
    const g = Math.max(0, 1 - Math.abs(daysFromOv + 4) * 0.25);
    boyScore += b;
    girlScore += g;
  });
  const total = boyScore + girlScore || 1;
  const boyPct = Math.round((boyScore / total) * 100);
  const girlPct = Math.round((girlScore / total) * 100);

  // Update gauge + percentage
  document.getElementById("boyPct").textContent = boyPct + "%";
  document.getElementById("girlPct").textContent = girlPct + "%";
  // Arc: dashoffset maps 100% → 0, 0% → 157
  setTimeout(() => {
    document.getElementById("boyArc").style.strokeDashoffset =
      157 - (boyPct / 100) * 157;
    document.getElementById("girlArc").style.strokeDashoffset =
      157 - (girlPct / 100) * 157;
  }, 300);

  // Optimal day bands
  populateBands("boyDays", [[boyOptimalStart, boyOptimalEnd]], "fertile-band");
  populateBands("girlDays", [[girlOptimalStart, girlOptimalEnd]], "safe-band");

  renderCalendar(lastPeriod, 2, periodDates, fertileDates, safeDates, today);

  // ── Show results
  const resultsEl = document.getElementById("results");
  resultsEl.classList.remove("hidden");
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Group contiguous dates into [start, end] pairs ─────────────────────────
function groupContiguous(dates) {
  if (!dates.length) return [];
  const sorted = [...dates].sort((a, b) => a - b);
  const groups = [];
  let start = sorted[0],
    end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i] - end) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      end = sorted[i];
    } else {
      groups.push([new Date(start), new Date(end)]);
      start = sorted[i];
      end = sorted[i];
    }
  }
  groups.push([new Date(start), new Date(end)]);
  return groups;
}

// ─── Populate bands ──────────────────────────────────────────────────────────
function populateBands(containerId, windows, cssClass) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  if (!windows.length) {
    el.innerHTML =
      '<p style="color:var(--text-muted);font-size:.8rem;">No days in this window</p>';
    return;
  }
  windows.forEach(([s, e]) => {
    const band = document.createElement("div");
    band.className = `date-band ${cssClass}`;
    const sameDay = isSameDay(s, e);
    band.innerHTML = `
      <span class="range">${formatDateShort(s)}${sameDay ? "" : " — " + formatDateShort(e)}</span>
      <span class="label">${sameDay ? "1 day" : dayDiff(s, e) + " days"}</span>
    `;
    el.appendChild(band);
  });
}

function dayDiff(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

// ─── Gender Tab Switching ────────────────────────────────────────────────────
document.querySelectorAll(".gtab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".gtab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document
      .getElementById("panel-boy")
      .classList.toggle("hidden", tab !== "boy");
    document
      .getElementById("panel-girl")
      .classList.toggle("hidden", tab !== "girl");
  });
});

// ─── Calendar renderer ───────────────────────────────────────────────────────
function renderCalendar(
  fromDate,
  months,
  periodDates,
  fertileDates,
  safeDates,
  today,
) {
  const container = document.getElementById("calendar");
  container.innerHTML = "";
  const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  for (let m = 0; m < months; m++) {
    const year = fromDate.getFullYear();
    const month = fromDate.getMonth() + m;
    const d = new Date(year, month, 1);

    const monthDiv = document.createElement("div");
    monthDiv.className = "cal-month";

    const monthName = document.createElement("div");
    monthName.className = "cal-month-name";
    monthName.textContent = new Date(year, month).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    monthDiv.appendChild(monthName);

    const grid = document.createElement("div");
    grid.className = "cal-grid";

    // Day headers
    DAY_NAMES.forEach((n) => {
      const h = document.createElement("div");
      h.className = "cal-day-name";
      h.textContent = n;
      grid.appendChild(h);
    });

    // Empty cells before first day
    const firstDow = new Date(year, month, 1).getDay();
    for (let e = 0; e < firstDow; e++) {
      const empty = document.createElement("div");
      empty.className = "cal-day empty";
      grid.appendChild(empty);
    }

    // Days
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const cell = document.createElement("div");
      cell.className = "cal-day";

      if (dateInSet(date, periodDates)) cell.classList.add("period-day");
      else if (dateInSet(date, fertileDates)) cell.classList.add("fertile-day");
      else if (dateInSet(date, safeDates)) cell.classList.add("safe-day");
      else cell.classList.add("normal");

      if (isSameDay(date, today)) cell.classList.add("today");

      cell.textContent = day;
      grid.appendChild(cell);
    }

    monthDiv.appendChild(grid);
    container.appendChild(monthDiv);
  }
}
