const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const WEEKDAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];
const grid = document.querySelector("#month-grid");
const monthTitle = document.querySelector("#month-title");
const eventList = document.querySelector("#event-list");
const statusBox = document.querySelector("#status");
const downloadButton = document.querySelector("#download-calendar");
const filter = document.querySelector("#category-filter");
const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let events = [];

function localDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(date, options = { day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("sv-SE", options).format(date);
}

function renderMonth() {
  monthTitle.textContent = `${MONTHS[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`;
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayOffset);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const dayEvents = events.filter((event) => event.date === iso);
    const cell = document.createElement("div");
    cell.className = "day-cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${WEEKDAYS[(date.getDay() + 6) % 7]} ${formatDate(date)}${dayEvents.length ? `, ${dayEvents.length} händelser` : ""}`);
    if (date.getMonth() !== visibleMonth.getMonth()) cell.classList.add("outside");
    if (sameDay(date, today)) cell.classList.add("is-today");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = date.getDate();
    cell.append(number);

    if (dayEvents.length) {
      const dots = document.createElement("div");
      dots.className = "day-events";
      dots.setAttribute("aria-hidden", "true");
      for (const event of dayEvents.slice(0, 4)) {
        const dot = document.createElement("i");
        dot.className = `event-dot${event.category === "prov" ? " prov" : ""}`;
        dots.append(dot);
      }
      cell.append(dots);
      if (dayEvents.length > 1) {
        const count = document.createElement("span");
        count.className = "event-count";
        count.textContent = `${dayEvents.length} händelser`;
        cell.append(count);
      }
    }
    cells.push(cell);
  }
  grid.replaceChildren(...cells);
}

function renderEvents() {
  const selected = filter.value;
  const upcoming = events
    .map((event) => ({ ...event, dateObject: localDate(event.date) }))
    .filter((event) => event.dateObject >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .filter((event) => selected === "alla" || event.category === selected)
    .sort((a, b) => a.dateObject - b.dateObject);

  if (!upcoming.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = "✳";
    const title = document.createElement("strong");
    title.textContent = events.length ? "Inga fler datum i den här kategorin" : "Kalendern är redo att fyllas på";
    const text = document.createElement("p");
    text.textContent = events.length ? "Välj en annan kategori eller kom tillbaka senare." : "Det finns inga publicerade aktiviteter ännu. Nya datum visas här när kalendern har uppdaterats.";
    empty.append(icon, title, text);
    eventList.replaceChildren(empty);
    return;
  }

  eventList.replaceChildren(...upcoming.map((event) => {
    const card = document.createElement("article");
    card.className = "event-card";
    const dateBox = document.createElement("div");
    dateBox.className = "event-date";
    const day = document.createElement("strong");
    day.textContent = event.dateObject.getDate();
    const month = document.createElement("span");
    month.textContent = MONTHS[event.dateObject.getMonth()].slice(0, 3);
    dateBox.append(day, month);

    const info = document.createElement("div");
    info.className = "event-info";
    const title = document.createElement("h3");
    title.textContent = event.title;
    info.append(title);
    const details = [formatDate(event.dateObject, { weekday: "long" }), event.time, event.location].filter(Boolean).join(" · ");
    if (details || event.description) {
      const description = document.createElement("p");
      description.textContent = [details, event.description].filter(Boolean).join(" — ");
      info.append(description);
    }
    const meta = document.createElement("div");
    meta.className = "event-meta";
    const tag = document.createElement("span");
    tag.className = `event-tag${event.category === "prov" ? " prov" : ""}`;
    tag.textContent = event.category === "prov" ? "Prov / deadline" : "Aktivitet";
    meta.append(tag);
    if (event.url) {
      const link = document.createElement("a");
      link.className = "event-link";
      link.href = event.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Mer information ↗";
      meta.append(link);
    }
    info.append(meta);
    card.append(dateBox, info);
    return card;
  }));
}

function escapeIcs(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function downloadIcs() {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nynasskolan//Skolkalender//SV", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Nynässkolans kalender", "X-WR-TIMEZONE:Europe/Stockholm"];
  for (const event of events) {
    const date = event.date.replaceAll("-", "");
    const timeMatch = typeof event.time === "string" ? event.time.match(/^(\d{1,2}):([0-5]\d)$/) : null;
    const start = timeMatch
      ? `DTSTART;TZID=Europe/Stockholm:${date}T${timeMatch[1].padStart(2, "0")}${timeMatch[2]}00`
      : `DTSTART;VALUE=DATE:${date}`;
    lines.push("BEGIN:VEVENT", `UID:${escapeIcs(event.id || `${event.date}-${event.title}`)}@nynasskolan`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`, start, `SUMMARY:${escapeIcs(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    if (event.url) lines.push(`URL:${escapeIcs(event.url)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "nynasskolans-kalender.ics";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function loadEvents() {
  try {
    const response = await fetch(`events.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Kalendern kunde inte hämtas. Försök igen lite senare.");
    const data = await response.json();
    if (data.status !== "ok" || !Array.isArray(data.events)) throw new Error(data.error || "Kalenderinformationen har ett oväntat format.");
    events = data.events.filter((event) => event.date && event.title && /^\d{4}-\d{2}-\d{2}$/.test(event.date));
    statusBox.className = "status success";
    statusBox.textContent = "";
    downloadButton.disabled = events.length === 0;
    renderMonth();
    renderEvents();
  } catch (error) {
    statusBox.className = "status error";
    statusBox.textContent = error.message;
    eventList.replaceChildren();
    downloadButton.disabled = true;
  }
}

document.querySelector("#previous-month").addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderMonth();
});
document.querySelector("#next-month").addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderMonth();
});
document.querySelector("#today-button").addEventListener("click", () => {
  visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  renderMonth();
});
filter.addEventListener("change", renderEvents);
downloadButton.addEventListener("click", downloadIcs);
renderMonth();
loadEvents();
window.setInterval(loadEvents, 15 * 60 * 1000);
