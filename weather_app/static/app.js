const TARGET_VOLUME = 0.35;
const FADE_STEP_MS = 30;
const FADE_DURATION_MS = 1500;
const POWER_ON_FALLBACK_MS = 800;
const PREFS_KEY = "wx1.prefs";
const SCREEN_DURATION_MS = 10000;
const MAGNET_MAX_SCALE = 46;
const MAGNET_RAMP_MS = 120;
const MAGNET_IDLE_MS = 120;
// Sized for the trail's 1500ms fade (see .magnet-trail.is-fading in
// style.css): too small a pool and a fast swipe starts reusing -- and
// visibly cutting short -- copies that are still mid-fade.
const MAGNET_TRAIL_COUNT = 24;
const MAGNET_TRAIL_MIN_DIST = 26;

const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let lastPayload = null;
let currentUnit = "F";
let fadeTimer = null;
let reflectionStream = null;
let isEditingCity = false;
let rotationPaused = false;
let rotationTimeout = null;
let activeScreenIndex = 0;

const muteButton = document.getElementById("mute-button");
const reflectionButton = document.getElementById("reflection-button");
const stage = document.getElementById("screen-stage");
const screenTitleEl = document.getElementById("screen-title");
const broadcastTimeEl = document.getElementById("broadcast-time");
const broadcastDateEl = document.getElementById("broadcast-date");
const broadcastFooter = document.getElementById("broadcast-footer");

const tuneInOverlay = document.getElementById("tune-in");
const channelAudio = document.getElementById("channel-audio");
const reflectionLayer = document.getElementById("reflection");
const reflectionVideo = document.getElementById("reflection-video");

const currentIcon = document.getElementById("current-icon");
const currentTemp = document.getElementById("current-temp");
const currentCity = document.getElementById("current-city");
const citySearchInput = document.getElementById("city-search-input");
const currentCondition = document.getElementById("current-condition");
const forecastStrip = document.getElementById("forecast-strip");

const almanacSun = document.getElementById("almanac-sun");
const almanacMoonRow = document.getElementById("almanac-moon-row");

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
   what keeps the restored control state from drifting out of step with what it
   describes. */
function setUnit(unit) {
    currentUnit = unit;
    currentTemp.title = `Click to switch to °${unit === "F" ? "C" : "F"}`;
    savePref("unit", currentUnit);
    if (lastPayload) {
        render(lastPayload);
    }
}

function setMuted(muted) {
    channelAudio.muted = muted;
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
    // The standby screen was the one thing blocking rotation, so let it begin
    // now that the set is actually on.
    scheduleRotation();
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

function formatShortDate(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    return `${MONTH_NAMES_SHORT[month - 1]} ${day}`;
}

/* ---- Screen: Current Conditions ---- */

function renderCurrent(payload) {
    const { value, unit } = celsiusToDisplay(payload.temp_c);

    setIcon(currentIcon, payload.icon, "icon-large");
    currentTemp.textContent = `${value.toFixed(1)}${unit}`;
    if (!isEditingCity) {
        currentCity.textContent = payload.city;
    }
    currentCondition.textContent = payload.condition;

    forecastStrip.innerHTML = "";
    for (const day of payload.forecast) {
        const maxTemp = celsiusToDisplay(day.max_temp_c);
        const minTemp = celsiusToDisplay(day.min_temp_c);

        const dayEl = document.createElement("div");
        dayEl.className = "forecast-day";

        const icon = document.createElement("img");
        setIcon(icon, day.icon, "icon-small");
        dayEl.appendChild(icon);

        const nameEl = document.createElement("div");
        nameEl.className = "day-name";
        nameEl.title = day.date || "";
        nameEl.textContent = day.day_label || day.date;
        dayEl.appendChild(nameEl);

        const tempsEl = document.createElement("div");
        tempsEl.className = "temps";
        tempsEl.textContent = `${maxTemp.value.toFixed(0)}${maxTemp.unit} / ${minTemp.value.toFixed(0)}${minTemp.unit}`;
        dayEl.appendChild(tempsEl);

        forecastStrip.appendChild(dayEl);
    }
}

function renderCurrentError() {
    if (!isEditingCity) {
        currentCity.textContent = "Error";
    }
    currentTemp.textContent = "--°";
    currentCondition.textContent = "City not found or connection error";
    currentIcon.hidden = true;
    forecastStrip.innerHTML = "";
}

/* ---- Screen: Almanac ---- */

function renderAlmanac(payload) {
    const almanac = payload.almanac || { days: [], upcoming_phases: [] };
    renderAlmanacSun(almanac.days || []);
    renderAlmanacMoon(almanac.upcoming_phases || []);
}

function renderAlmanacSun(days) {
    almanacSun.innerHTML = "";

    if (days.length === 0) {
        const empty = document.createElement("div");
        empty.className = "almanac-empty";
        empty.textContent = "Sunrise/sunset data unavailable";
        almanacSun.appendChild(empty);
        return;
    }

    const grid = document.createElement("div");
    grid.className = "almanac-grid";
    grid.style.setProperty("--almanac-cols", String(days.length));

    const addCell = (text, className) => {
        const cell = document.createElement("div");
        cell.className = className;
        cell.textContent = text;
        grid.appendChild(cell);
    };

    addCell("", "almanac-cell almanac-cell--corner");
    for (const day of days) {
        addCell(day.day_label, "almanac-cell almanac-cell--day");
    }

    addCell("Sunrise:", "almanac-cell almanac-cell--label");
    for (const day of days) {
        addCell(day.sunrise, "almanac-cell almanac-cell--value");
    }

    addCell("Sunset:", "almanac-cell almanac-cell--label");
    for (const day of days) {
        addCell(day.sunset, "almanac-cell almanac-cell--value");
    }

    almanacSun.appendChild(grid);
}

function renderAlmanacMoon(phases) {
    almanacMoonRow.innerHTML = "";

    for (const phase of phases) {
        const col = document.createElement("div");
        col.className = "moon-col";

        const nameEl = document.createElement("div");
        nameEl.className = "moon-name";
        nameEl.textContent = phase.name;
        col.appendChild(nameEl);

        const disc = document.createElement("div");
        disc.className = `moon-disc moon-disc--${phase.name.toLowerCase()}`;
        col.appendChild(disc);

        const dateEl = document.createElement("div");
        dateEl.className = "moon-date";
        dateEl.textContent = formatShortDate(phase.date);
        col.appendChild(dateEl);

        almanacMoonRow.appendChild(col);
    }
}

/* ---- Footer data bar ---- */

function renderFooter(payload) {
    const obs = payload.observations || {};
    broadcastFooter.innerHTML = "";

    const items = [
        `VISIB: ${obs.visibility_miles} MI`,
        `PRESSURE: ${obs.pressure_inches} IN`,
        `WIND: ${obs.wind_dir} ${obs.wind_mph} MPH`,
    ];
    for (const text of items) {
        const span = document.createElement("span");
        span.className = "footer-item";
        span.textContent = text;
        broadcastFooter.appendChild(span);
    }
}

function renderFooterError() {
    broadcastFooter.innerHTML = "";
}

/* ---- Screen framework ----
   Screens are just sections that get shown or hidden together; each one owns
   its own render function so adding a screen later is one registry entry plus
   one render function, with nothing else in this file to touch. */
const SCREENS = [
    { title: "Current Conditions", el: document.getElementById("screen-current"), render: renderCurrent },
    { title: "Almanac", el: document.getElementById("screen-almanac"), render: renderAlmanac },
];

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---- Hover/touch degauss smear ----
   .magnet-lens is the live head of the effect: it sits exactly at the
   pointer with no lag, on every qualifying "pointermove". A pool of
   .magnet-trail copies gets dropped behind it as the pointer covers ground,
   each fading out on its own -- that combination is what reads as a smear
   trailing the cursor, rather than either a fixed spot or a delayed blob. A
   click was tried first, but a mouse-down that drifts even a pixel while
   clicking text reads to the browser as a selection drag, so hover is both
   the more authentic gesture and the one that does not fight native text
   selection. */

const magnetLens = document.getElementById("magnet-lens");
const magnetDisplacement = document.querySelector("#magnet-ripple feDisplacementMap");
let magnetActive = false;
let magnetIdleTimeout = null;
let magnetRampFrame = null;
let magnetLastTrailX = null;
let magnetLastTrailY = null;

// A small pool of reused elements rather than creating and destroying one per
// drop, so a fast, sustained swipe cannot leak nodes.
const magnetTrailPool = [];
let magnetTrailCursor = 0;
for (let i = 0; i < MAGNET_TRAIL_COUNT; i++) {
    const trail = document.createElement("div");
    trail.className = "magnet-trail";
    trail.setAttribute("aria-hidden", "true");
    document.body.appendChild(trail);
    magnetTrailPool.push(trail);
}

// The displacement amount is an SVG filter primitive attribute, which CSS
// cannot transition, so it is ramped by hand toward a target over a short
// window -- shared by every activate/deactivate call, so a new call smoothly
// retargets whatever ramp was already in flight instead of layering on top.
function rampMagnetScale(target) {
    cancelAnimationFrame(magnetRampFrame);
    const start = performance.now();
    const startScale = parseFloat(magnetDisplacement.getAttribute("scale")) || 0;
    function step(now) {
        const t = Math.min((now - start) / MAGNET_RAMP_MS, 1);
        magnetDisplacement.setAttribute("scale", String(startScale + (target - startScale) * t));
        if (t < 1) {
            magnetRampFrame = requestAnimationFrame(step);
        }
    }
    magnetRampFrame = requestAnimationFrame(step);
}

// Drops the next pooled trail element at (x, y) and (re)starts its fade.
// Removing the class, forcing a reflow, then re-adding it is the standard way
// to restart a CSS animation on an element whose previous run may still be
// mid-flight, which matters here since the pool reuses each element often.
function dropMagnetTrail(x, y) {
    const trail = magnetTrailPool[magnetTrailCursor];
    magnetTrailCursor = (magnetTrailCursor + 1) % magnetTrailPool.length;

    trail.classList.remove("is-fading");
    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;
    void trail.offsetWidth;
    trail.classList.add("is-fading");
}

function deactivateMagnetLens() {
    magnetActive = false;
    magnetLens.classList.remove("is-active");
    rampMagnetScale(0);
    magnetLastTrailX = null;
    magnetLastTrailY = null;
}

// Called on every qualifying pointermove: the live head snaps straight to the
// pointer (no lag), and a trail copy drops every time the pointer has covered
// MAGNET_TRAIL_MIN_DIST since the last drop -- covering more ground faster
// drops copies closer together in time, which is what makes a fast swipe read
// as a continuous smear and a slow one read as barely any trail at all.
// Idles back off automatically a short beat after movement stops.
function activateMagnetLens(x, y) {
    magnetLens.style.left = `${x}px`;
    magnetLens.style.top = `${y}px`;

    if (magnetLastTrailX === null) {
        magnetLastTrailX = x;
        magnetLastTrailY = y;
    } else if (Math.hypot(x - magnetLastTrailX, y - magnetLastTrailY) >= MAGNET_TRAIL_MIN_DIST) {
        dropMagnetTrail(x, y);
        magnetLastTrailX = x;
        magnetLastTrailY = y;
    }

    if (!magnetActive) {
        magnetActive = true;
        magnetLens.classList.add("is-active");
        rampMagnetScale(MAGNET_MAX_SCALE);
    }
    clearTimeout(magnetIdleTimeout);
    magnetIdleTimeout = setTimeout(deactivateMagnetLens, MAGNET_IDLE_MS);
}

/* Auto-advance is suspended, never abandoned, while the standby screen is up,
   the city search is open, or the viewer has reduced motion set -- each of
   those callers re-checks this same gate rather than owning their own timer. */
function scheduleRotation() {
    clearTimeout(rotationTimeout);
    rotationTimeout = null;
    if (rotationPaused || !tuneInOverlay.hidden || prefersReducedMotion()) {
        return;
    }
    rotationTimeout = setTimeout(() => showScreen(activeScreenIndex + 1), SCREEN_DURATION_MS);
}

function showScreen(index) {
    activeScreenIndex = ((index % SCREENS.length) + SCREENS.length) % SCREENS.length;
    SCREENS.forEach((screen, i) => {
        screen.el.hidden = i !== activeScreenIndex;
    });
    screenTitleEl.textContent = SCREENS[activeScreenIndex].title;
    // A manual step and an automatic one both land here, so either kind of
    // change gives the viewer a full, undiminished interval before the next.
    scheduleRotation();
}

function render(payload) {
    stage.style.setProperty("--accent", payload.color_hex || "#ffffff");
    for (const screen of SCREENS) {
        screen.render(payload);
    }
    renderFooter(payload);
}

function renderError() {
    renderCurrentError();
    renderFooterError();
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

/* ---- Inline city search: click the city name to replace it with an input ---- */

function openCitySearch() {
    isEditingCity = true;
    currentCity.hidden = true;
    citySearchInput.hidden = false;
    citySearchInput.value = lastPayload ? lastPayload.city : "";
    citySearchInput.focus();
    citySearchInput.select();
    rotationPaused = true;
    scheduleRotation();
}

function closeCitySearch() {
    isEditingCity = false;
    rotationPaused = false;
    citySearchInput.hidden = true;
    currentCity.hidden = false;
    scheduleRotation();
}

currentCity.addEventListener("click", openCitySearch);

citySearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        const value = citySearchInput.value.trim();
        closeCitySearch();
        if (value) {
            fetchWeather(value);
        }
    } else if (event.key === "Escape") {
        event.preventDefault();
        closeCitySearch();
    }
});

// Clicking away from the input is as much a cancel as pressing Escape.
citySearchInput.addEventListener("blur", () => {
    if (isEditingCity) {
        closeCitySearch();
    }
});

currentTemp.addEventListener("click", () => {
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

// Skips the OSD bezel (it stays crisp and interactive, never a visual gag),
// the standby screen, and the picture's own interactive elements, so hovering
// a real control is never also a ripple.
document.addEventListener("pointermove", (event) => {
    if (prefersReducedMotion() || !tuneInOverlay.hidden) {
        return;
    }
    if (event.target.closest(".channel-controls, .tune-in, .current-temp, .current-city, .city-search-input")) {
        clearTimeout(magnetIdleTimeout);
        deactivateMagnetLens();
        return;
    }
    activateMagnetLens(event.clientX, event.clientY);
});

// The pointer or finger leaving the page entirely -- pointerleave covers the
// mouse, touchend/touchcancel cover a lifted finger, which does not reliably
// fire pointerleave on its own.
["pointerleave", "touchend", "touchcancel"].forEach((eventName) => {
    document.addEventListener(eventName, () => {
        clearTimeout(magnetIdleTimeout);
        deactivateMagnetLens();
    });
});

document.addEventListener("keydown", (event) => {
    if (event.target === citySearchInput) {
        return;
    }
    if (event.key === "ArrowRight") {
        showScreen(activeScreenIndex + 1);
    } else if (event.key === "ArrowLeft") {
        showScreen(activeScreenIndex - 1);
    }
});

// No theme.mp3 in the folder is a supported state -- the channel just runs silent.
channelAudio.addEventListener("error", () => {
    console.warn("No channel music found at music/theme.mp3 -- running silent.");
}, { once: true });

function tickClock() {
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    broadcastTimeEl.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
    broadcastDateEl.textContent = `${WEEKDAY_NAMES[now.getDay()]} ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
}
setInterval(tickClock, 1000);
tickClock();

/* Restore saved preferences before the first fetch. The reflection is not
   restored here because the camera cannot start without the power-on click, so
   powerOn() handles it instead. */
setUnit(prefs.unit === "C" ? "C" : "F");
setMuted(prefs.muted === true);
showReflectionState(prefs.reflection !== false);

showScreen(0);
fetchWeather("");
