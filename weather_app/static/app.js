let lastPayload = null;
let currentUnit = "F";

const cityForm = document.getElementById("city-form");
const cityInput = document.getElementById("city-input");
const toggleButton = document.getElementById("toggle-button");
const panel = document.getElementById("broadcast-panel");

const currentIcon = document.getElementById("current-icon");
const currentTemp = document.getElementById("current-temp");
const currentCity = document.getElementById("current-city");
const currentCondition = document.getElementById("current-condition");
const forecastStrip = document.getElementById("forecast-strip");

function celsiusToDisplay(tempC) {
    if (currentUnit === "F") {
        return { value: (tempC * 9) / 5 + 32, unit: "°F" };
    }
    return { value: tempC, unit: "°C" };
}

function setIcon(imgEl, filename, size) {
    imgEl.className = `icon ${size}`;
    if (filename) {
        imgEl.src = `icons/${filename}`;
        imgEl.hidden = false;
    } else {
        imgEl.hidden = true;
    }
}

function render(payload) {
    const { value, unit } = celsiusToDisplay(payload.temp_c);

    panel.style.setProperty("--accent", payload.color_hex || "#ffffff");
    setIcon(currentIcon, payload.icon, "icon-large");
    currentTemp.textContent = `${value.toFixed(1)}${unit}`;
    currentCity.textContent = `City: ${payload.city}`;
    currentCondition.textContent = `Condition: ${payload.condition}`;

    forecastStrip.innerHTML = "";
    for (const day of payload.forecast) {
        const maxTemp = celsiusToDisplay(day.max_temp_c);
        const minTemp = celsiusToDisplay(day.min_temp_c);

        const dayEl = document.createElement("div");
        dayEl.className = "forecast-day";

        const icon = document.createElement("img");
        setIcon(icon, day.icon, "icon-small");

        dayEl.innerHTML = `
            <div class="date">${day.date}</div>
        `;
        dayEl.prepend(icon);
        dayEl.insertAdjacentHTML(
            "beforeend",
            `<div class="temps">${maxTemp.value.toFixed(0)}${maxTemp.unit} / ${minTemp.value.toFixed(0)}${minTemp.unit}</div>`
        );

        forecastStrip.appendChild(dayEl);
    }
}

function renderError() {
    currentCity.textContent = "City: Error";
    currentTemp.textContent = "--°";
    currentCondition.textContent = "Condition: City not found or connection error";
    currentIcon.hidden = true;
    forecastStrip.innerHTML = "";
}

async function fetchWeather(city) {
    try {
        const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
        if (!response.ok) {
            renderError();
            return;
        }
        lastPayload = await response.json();
        render(lastPayload);
    } catch (err) {
        console.error(err);
        renderError();
    }
}

cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    fetchWeather(cityInput.value.trim());
});

toggleButton.addEventListener("click", () => {
    currentUnit = currentUnit === "F" ? "C" : "F";
    toggleButton.textContent = `Switch to ${currentUnit === "F" ? "°C" : "°F"}`;
    if (lastPayload) {
        render(lastPayload);
    }
});

fetchWeather("");
