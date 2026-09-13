const TARGET_VOLUME = 0.35;
const FADE_STEP_MS = 30;
const FADE_DURATION_MS = 1500;
const POWER_ON_FALLBACK_MS = 800;

let lastPayload = null;
let currentUnit = "F";
let fadeTimer = null;

const cityForm = document.getElementById("city-form");
const cityInput = document.getElementById("city-input");
const toggleButton = document.getElementById("toggle-button");
const muteButton = document.getElementById("mute-button");
const panel = document.getElementById("broadcast-panel");

const tuneInOverlay = document.getElementById("tune-in");
const channelAudio = document.getElementById("channel-audio");

const currentIcon = document.getElementById("current-icon");
const currentTemp = document.getElementById("current-temp");
const currentCity = document.getElementById("current-city");
const currentCondition = document.getElementById("current-condition");
const forecastStrip = document.getElementById("forecast-strip");

function fadeInAudio() {
    const stepCount = Math.round(FADE_DURATION_MS / FADE_STEP_MS);
    const increment = TARGET_VOLUME / stepCount;

    clearInterval(fadeTimer);
    channelAudio.volume = 0;
    fadeTimer = setInterval(() => {
        const next = channelAudio.volume + increment;
        if (next >= TARGET_VOLUME) {
            channelAudio.volume = TARGET_VOLUME;
            clearInterval(fadeTimer);
            fadeTimer = null;
            return;
        }
        channelAudio.volume = next;
    }, FADE_STEP_MS);
}

function hideOverlay() {
    tuneInOverlay.hidden = true;
}

/* Dismiss the standby screen and start the channel music. The click itself is
   what satisfies the browser's autoplay policy, so playback must start here. */
function powerOn() {
    tuneInOverlay.classList.add("powered-on");
    tuneInOverlay.addEventListener("animationend", hideOverlay, { once: true });
    // Reduced-motion (and any dropped animationend) still needs the overlay gone.
    setTimeout(hideOverlay, POWER_ON_FALLBACK_MS);

    channelAudio.volume = 0;
    const playback = channelAudio.play();
    if (playback) {
        playback.then(fadeInAudio).catch((err) => {
            console.error("Channel music unavailable:", err);
        });
    }
}

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

muteButton.addEventListener("click", () => {
    channelAudio.muted = !channelAudio.muted;
    muteButton.textContent = channelAudio.muted ? "Unmute Music" : "Mute Music";
});

tuneInOverlay.addEventListener("click", powerOn, { once: true });

// No theme.mp3 in the folder is a supported state -- the channel just runs silent.
channelAudio.addEventListener("error", () => {
    console.warn("No channel music found at music/theme.mp3 -- running silent.");
}, { once: true });

fetchWeather("");
