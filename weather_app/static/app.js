const TARGET_VOLUME = 0.35;
const FADE_STEP_MS = 30;
const FADE_DURATION_MS = 1500;
const POWER_ON_FALLBACK_MS = 800;
const PREFS_KEY = "wx1.prefs";

let lastPayload = null;
let currentUnit = "F";
let fadeTimer = null;
let reflectionStream = null;

const cityForm = document.getElementById("city-form");
const cityInput = document.getElementById("city-input");
const toggleButton = document.getElementById("toggle-button");
const muteButton = document.getElementById("mute-button");
const reflectionButton = document.getElementById("reflection-button");
const panel = document.getElementById("broadcast-panel");

const tuneInOverlay = document.getElementById("tune-in");
const channelAudio = document.getElementById("channel-audio");
const reflectionLayer = document.getElementById("reflection");
const reflectionVideo = document.getElementById("reflection-video");

const currentIcon = document.getElementById("current-icon");
const currentTemp = document.getElementById("current-temp");
const currentCity = document.getElementById("current-city");
const currentCondition = document.getElementById("current-condition");
const forecastStrip = document.getElementById("forecast-strip");

/* All user preferences live under one localStorage key as a single JSON object.
   Both accessors swallow errors because localStorage throws outright in some
   private-browsing modes, and a lost preference should never break the page. */
function loadPrefs() {
    try {
        return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch (err) {
        return {};
    }
}

function savePref(key, value) {
    prefs[key] = value;
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (err) {
        console.warn("Preferences cannot be saved, settings will reset on reload.");
    }
}

const prefs = loadPrefs();

/* Every toggle below routes through one of these setters, whether it was driven
   by a click or restored from a saved preference on load. Sharing the path is
   what keeps the restored button labels from drifting out of step with the
   state they describe. */
function setUnit(unit) {
    currentUnit = unit;
    toggleButton.textContent = `Switch to ${currentUnit === "F" ? "°C" : "°F"}`;
    savePref("unit", currentUnit);
    if (lastPayload) {
        render(lastPayload);
    }
}

function setMuted(muted) {
    channelAudio.muted = muted;
    muteButton.textContent = muted ? "♪ Off" : "♪ On";
    muteButton.setAttribute("aria-pressed", String(muted));
    muteButton.classList.toggle("is-off", muted);
    muteButton.title = muted ? "Unmute music" : "Mute music";
    savePref("muted", muted);
}

function showReflectionState(on) {
    reflectionButton.setAttribute("aria-pressed", String(on));
    reflectionButton.classList.toggle("is-off", !on);
    reflectionButton.title = on
        ? "Turn off screen reflection"
        : "Show the room reflected in the screen";
}

/* Only a deliberate press, or a camera that refused to start after one, should
   be written down. Suppressing the reflection for reduced motion updates the
   button without recording a choice the viewer never made, so the effect comes
   back on its own if they later turn reduced motion off. */
function setReflection(on) {
    showReflectionState(on);
    savePref("reflection", on);
}

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

/* Feeds the front camera into the reflection overlay. Resolves to whether the
   stream actually started, so the caller can show the true state rather than
   assuming success. */
async function startReflection() {
    // getUserMedia only exists on secure origins. localhost counts as one, but
    // reaching this server over a LAN address does not, and the API is simply
    // absent there rather than failing loudly.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Screen reflection needs a secure origin such as localhost.");
        return false;
    }

    try {
        reflectionStream = await navigator.mediaDevices.getUserMedia({
            // A low capture size on purpose: the overlay blurs the image down to
            // vague shapes anyway, so anything sharper is wasted work.
            video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
        });
        reflectionVideo.srcObject = reflectionStream;
        await reflectionVideo.play();
    } catch (err) {
        console.warn("Screen reflection unavailable:", err);
        stopReflection();
        return false;
    }

    reflectionLayer.classList.add("live");
    return true;
}

function stopReflection() {
    reflectionLayer.classList.remove("live");
    if (reflectionStream) {
        // Releasing every track is what actually puts the camera indicator light
        // out. Without this the hardware stays live while the overlay reads as
        // switched off.
        reflectionStream.getTracks().forEach((track) => track.stop());
        reflectionStream = null;
    }
    reflectionVideo.srcObject = null;
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

    // The camera is requested on this same click for the same reason the music
    // is: it is the one user gesture the browser will accept. Skipped when the
    // viewer has asked for reduced motion, which also spares them the permission
    // prompt, and skipped when they previously switched the reflection off.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefs.reflection !== false && !reduceMotion) {
        // A denied prompt records the off state, since that was a real answer.
        startReflection().then(setReflection);
    } else {
        showReflectionState(false);
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
    currentCity.textContent = payload.city;
    currentCondition.textContent = payload.condition;

    forecastStrip.innerHTML = "";
    for (const day of payload.forecast) {
        const maxTemp = celsiusToDisplay(day.max_temp_c);
        const minTemp = celsiusToDisplay(day.min_temp_c);

        const dayEl = document.createElement("div");
        dayEl.className = "forecast-day";

        const icon = document.createElement("img");
        setIcon(icon, day.icon, "icon-small");

        dayEl.innerHTML = `
            <div class="day-name" title="${day.date || ""}">${day.day_label || day.date}</div>
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
    currentCity.textContent = "Error";
    currentTemp.textContent = "--°";
    currentCondition.textContent = "City not found or connection error";
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
    setUnit(currentUnit === "F" ? "C" : "F");
});

muteButton.addEventListener("click", () => {
    setMuted(!channelAudio.muted);
});

reflectionButton.addEventListener("click", async () => {
    if (reflectionStream) {
        stopReflection();
        setReflection(false);
        return;
    }
    setReflection(await startReflection());
});

tuneInOverlay.addEventListener("click", powerOn, { once: true });

// No theme.mp3 in the folder is a supported state -- the channel just runs silent.
channelAudio.addEventListener("error", () => {
    console.warn("No channel music found at music/theme.mp3 -- running silent.");
}, { once: true });

/* Restore saved preferences before the first fetch. The reflection is not
   restored here because the camera cannot start without the power-on click, so
   powerOn() handles it instead. */
setUnit(prefs.unit === "C" ? "C" : "F");
setMuted(prefs.muted === true);
showReflectionState(prefs.reflection !== false);

fetchWeather("");
