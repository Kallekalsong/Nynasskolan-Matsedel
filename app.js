const DAY_NAMES = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

const grid = document.querySelector("#menu-grid");
const statusBox = document.querySelector("#status");
const weekLabel = document.querySelector("#week-label");
const lastUpdated = document.querySelector("#last-updated");
const refreshButton = document.querySelector("#refresh-button");

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
  lastUpdated.textContent = "";
  weekLabel.textContent = "Veckans meny är inte tillgänglig";
}

function render(data) {
  if (data.status !== "ok" || !Array.isArray(data.days) || data.days.length === 0) {
    showError(data.error || "Det finns ingen matsedel publicerad just nu.");
    return;
  }

  const days = data.days.map((day) => ({ ...day, dateObject: new Date(`${day.date}T12:00:00`) }));
  const first = days[0].dateObject;
  weekLabel.textContent = `Vecka ${data.week} · ${displayDate(first)}–${displayDate(days[days.length - 1].dateObject)}`;
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
      badge.textContent = "IDAG";
      top.append(badge);
    }
    card.append(top);

    if (Array.isArray(day.meals) && day.meals.length) {
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

refreshButton.addEventListener("click", loadMenu);
loadMenu();
