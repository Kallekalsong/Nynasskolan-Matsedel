const DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const grid = document.querySelector("#menu-grid");
const statusBox = document.querySelector("#status");
const weekLabel = document.querySelector("#week-label");
const weekNotice = document.querySelector("#week-notice");
const previousWeek = document.querySelector("#previous-week");
const nextWeek = document.querySelector("#next-week");
const currentWeekButton = document.querySelector("#current-week-button");
const lastUpdated = document.querySelector("#last-updated");
const refreshButton = document.querySelector("#refresh-button");
const printButton = document.querySelector("#print-button");
let availableWeeks = [];
let selectedWeek = 0;

function displayDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
function displayTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeStyle: "short" }).format(date);
}
function showError(message) {
  grid.replaceChildren();
  statusBox.className = "status error";
  statusBox.textContent = message || "Matsedeln kunde inte hämtas just nu. Försök igen lite senare.";
  weekNotice.textContent = "";
  lastUpdated.textContent = "";
  weekLabel.textContent = "Veckans meny är inte tillgänglig";
  previousWeek.disabled = true;
  nextWeek.disabled = true;
  currentWeekButton.hidden = true;
}
function weekKey(week) { return `${week.year}-${week.week}`; }

function render(data) {
  if (data.status !== "ok") {
    showError(data.error || "Det finns ingen matsedel publicerad just nu.");
    return;
  }
  const oldKey = availableWeeks[selectedWeek] ? weekKey(availableWeeks[selectedWeek]) : null;
  availableWeeks = Array.isArray(data.weeks) && data.weeks.length
    ? data.weeks.filter((week) => Array.isArray(week.days) && week.days.length)
    : (Array.isArray(data.days) && data.days.length ? [{ year: data.year || new Date(data.days[0].date).getFullYear(), week: data.week, days: data.days }] : []);
  availableWeeks.sort((a, b) => a.year - b.year || a.week - b.week);
  if (!availableWeeks.length) {
    showError(data.error || "Det finns ingen matsedel publicerad just nu.");
    return;
  }
  const wanted = oldKey ? availableWeeks.findIndex((week) => weekKey(week) === oldKey) : -1;
  const current = availableWeeks.findIndex((week) => week.year === data.year && week.week === data.week);
  selectedWeek = wanted >= 0 ? wanted : Math.max(0, current);
  renderWeek(data);
}
function renderWeek(data) {
  const week = availableWeeks[selectedWeek];
  const days = week.days.map((day) => ({ ...day, dateObject: new Date(`${day.date}T12:00:00`) }));
  const first = days[0].dateObject;
  const last = days[days.length - 1].dateObject;
  weekLabel.textContent = `Vecka ${week.week} · ${displayDate(first)}–${displayDate(last)} ${last.getFullYear()}`;
  previousWeek.disabled = selectedWeek <= 0;
  nextWeek.disabled = selectedWeek >= availableWeeks.length - 1;
  const currentIndex = availableWeeks.findIndex((item) => item.year === data.year && item.week === data.week);
  currentWeekButton.hidden = selectedWeek === currentIndex;
  weekNotice.textContent = selectedWeek === availableWeeks.length - 1
    ? (data.weekFetchWarning || "Fler veckor visas här när Skolmaten publicerar dem.")
    : (data.weekFetchWarning || "");
  statusBox.className = "status success";
  statusBox.textContent = "";
  const today = new Date();
  grid.replaceChildren(...days.map((day) => {
    const card = document.createElement("article");
    card.className = "day-card";
    if (day.date === today.toLocaleDateString("sv-SE")) card.classList.add("today");
    const top = document.createElement("div");
    top.className = "day-top";
    const heading = document.createElement("div");
    const name = document.createElement("div");
    name.className = "day-name";
    name.textContent = DAY_NAMES[day.dateObject.getDay()];
    const date = document.createElement("div");
    date.className = "day-date";
    date.textContent = displayDate(day.dateObject);
    heading.append(name, date);
    top.append(heading);
    if (card.classList.contains("today")) {
      const badge = document.createElement("span");
      badge.className = "today-badge";
      badge.textContent = "DAGENS LUNCH";
      top.append(badge);
    }
    card.append(top);
    if (day.cancelled) {
      const empty = document.createElement("p");
      empty.className = "day-empty";
      empty.textContent = "Lunchserveringen är inställd.";
      card.append(empty);
    } else if (Array.isArray(day.meals) && day.meals.length) {
      const meals = document.createElement("ul");
      meals.className = "meal-list";
      for (const meal of day.meals) {
        const item = document.createElement("li");
        item.textContent = meal.name + (meal.description ? ` – ${meal.description}` : "");
        meals.append(item);
      }
      card.append(meals);
    } else {
      const empty = document.createElement("p");
      empty.className = "day-empty";
      empty.textContent = "Ingen lunchinformation publicerad.";
      card.append(empty);
    }
    return card;
  }));
  lastUpdated.textContent = data.fetchedAt
    ? `Senast hämtad ${displayTimestamp(data.fetchedAt)}${data.stale ? " · Visar senast sparade meny" : ""}`
    : "";
}
async function loadMenu() {
  refreshButton.disabled = true;
  statusBox.className = "status";
  statusBox.replaceChildren(Object.assign(document.createElement("span"), { className: "spinner" }), document.createTextNode(" Hämtar senaste matsedeln…"));
  try {
    const response = await fetch(`data/menu.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Matsedeln kunde inte hämtas. Kontrollera anslutningen och försök igen.");
    render(await response.json());
  } catch (error) {
    showError(error.message);
  } finally {
    refreshButton.disabled = false;
  }
}
previousWeek.addEventListener("click", () => { if (selectedWeek > 0) { selectedWeek--; renderWeek(window.menuData); } });
nextWeek.addEventListener("click", () => { if (selectedWeek < availableWeeks.length - 1) { selectedWeek++; renderWeek(window.menuData); } });
currentWeekButton.addEventListener("click", () => {
  const index = availableWeeks.findIndex((week) => week.year === window.menuData.year && week.week === window.menuData.week);
  if (index >= 0) { selectedWeek = index; renderWeek(window.menuData); }
});
refreshButton.addEventListener("click", () => { loadMenu(); loadWeather(); });
printButton.addEventListener("click", () => window.print());
// Keep the data available for week navigation and preserve the selected week on refresh.
const originalRender = render;
render = function(data) { window.menuData = data; originalRender(data); };
loadMenu();
window.setInterval(loadMenu, 15 * 60 * 1000);

const weatherStatus = document.querySelector("#weather-status");
const weatherCurrent = document.querySelector("#weather-current");
const weatherForecast = document.querySelector("#weather-forecast");

const WEATHER_LABELS = {
  0: "Klart", 1: "Mestadels klart", 2: "Växlande molnighet", 3: "Mulet",
  45: "Dimma", 48: "Rimfrost och dimma", 51: "Lätt duggregn", 53: "Duggregn",
  55: "Kraftigt duggregn", 56: "Underkylt duggregn", 57: "Kraftigt underkylt duggregn",
  61: "Lätt regn", 63: "Regn", 65: "Kraftigt regn", 66: "Underkylt regn",
  67: "Kraftigt underkylt regn", 71: "Lätt snöfall", 73: "Snöfall", 75: "Kraftigt snöfall",
  77: "Snökorn", 80: "Lätta regnskurar", 81: "Regnskurar", 82: "Kraftiga regnskurar",
  85: "Lätta snöbyar", 86: "Kraftiga snöbyar", 95: "Åska", 96: "Åska med hagel",
  99: "Kraftig åska med hagel"
};
const WEATHER_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️", 61: "🌦️",
  63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️", 71: "🌨️", 73: "🌨️",
  75: "❄️", 77: "❄️", 80: "🌦️", 81: "🌧️", 82: "🌧️", 85: "🌨️",
  86: "❄️", 95: "⛈️", 96: "⛈️", 99: "⛈️"
};

function weatherDate(value, options) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", ...options }).format(new Date(value + "T12:00:00"));
}
async function loadWeather() {
  weatherStatus.className = "weather-status";
  weatherStatus.textContent = "Hämtar vädret…";
  try {
    const params = new URLSearchParams({
      latitude: "60.67800", longitude: "17.13183", timezone: "Europe/Stockholm",
      forecast_days: "5",
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Väderprognosen kunde inte hämtas just nu.");
    const data = await response.json();
    const currentCode = data.current.weather_code;
    weatherCurrent.replaceChildren();
    const icon = document.createElement("span");
    icon.className = "current-weather-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = WEATHER_ICONS[currentCode] || "🌡️";
    const detail = document.createElement("div");
    detail.className = "current-weather-detail";
    const temp = document.createElement("strong");
    temp.textContent = `${Math.round(data.current.temperature_2m)}°`;
    const desc = document.createElement("span");
    desc.textContent = WEATHER_LABELS[currentCode] || "Väder";
    const feels = document.createElement("small");
    feels.textContent = `Känns som ${Math.round(data.current.apparent_temperature)}° · Vind ${Math.round(data.current.wind_speed_10m)} km/h`;
    detail.append(temp, desc, feels);
    weatherCurrent.append(icon, detail);

    weatherForecast.replaceChildren(...data.daily.time.map((date, index) => {
      const item = document.createElement("div");
      item.className = "forecast-day";
      const day = document.createElement("span");
      day.textContent = index === 0 ? "Idag" : weatherDate(date, { weekday: "short" });
      const symbol = document.createElement("span");
      symbol.className = "forecast-icon";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = WEATHER_ICONS[data.daily.weather_code[index]] || "🌡️";
      const temps = document.createElement("span");
      temps.className = "forecast-temps";
      temps.textContent = `${Math.round(data.daily.temperature_2m_max[index])}° / ${Math.round(data.daily.temperature_2m_min[index])}°`;
      const rain = document.createElement("span");
      rain.className = "forecast-rain";
      const rainChance = data.daily.precipitation_probability_max[index];
      rain.textContent = rainChance == null ? "Regn –" : `Regn ${rainChance}%`;
      item.append(day, symbol, temps, rain);
      return item;
    }));
    weatherStatus.textContent = `Femdagarsprognos · Uppdaterad ${new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
  } catch (error) {
    weatherCurrent.replaceChildren();
    weatherForecast.replaceChildren();
    weatherStatus.className = "weather-status weather-error";
    weatherStatus.textContent = error.message || "Vädret kunde inte hämtas just nu.";
  }
}
loadWeather();
window.setInterval(loadWeather, 60 * 60 * 1000);
