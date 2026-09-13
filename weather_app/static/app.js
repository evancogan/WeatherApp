const TARGET_VOLUME = 0.35;
// The power-on effect sits above the music because it plays against a track
// that is still fading up from silence, and it is the sound of the set itself
// rather than something coming out of it.
const POWER_ON_VOLUME = 0.7;
const FADE_STEP_MS = 30;
const FADE_DURATION_MS = 1500;
const POWER_ON_FALLBACK_MS = 800;
const PREFS_KEY = "wx1.prefs";
const SCREEN_DURATION_MS = 10000;
// Per character, and per card before the next one starts printing. Both are
// deliberately quick: all twelve readings finish inside the first couple of
// seconds of a ten-second screen, so the effect is the arrival of the text
// rather than something the viewer has to sit through.
const HOROSCOPE_TYPE_MS = 9;
const HOROSCOPE_CARD_STAGGER_MS = 80;
// The horoscope screen overrides SCREEN_DURATION_MS: twelve readings is far
// more text than any other screen carries, and the typing eats the first
// seconds of it, so the standard interval left no time to actually read.
const HOROSCOPE_DURATION_MS = 24000;
// The footer types slower than the horoscope cards: one line at a time is meant
// to be watched arriving, where twelve readings at once only had to land fast.
const FOOTER_TYPE_MS = 32;
// How long a finished reading sits before the next one replaces it. Deliberately
// not a divisor of SCREEN_DURATION_MS, so the bar does not fall into step with
// the screen rotation and show the same reading on the same screen every time.
const FOOTER_HOLD_MS = 4300;
const MAGNET_MAX_SCALE = 46;
const MAGNET_RAMP_MS = 120;
const MAGNET_IDLE_MS = 120;
// Sized for the trail's 1500ms fade (see .magnet-trail.is-fading in
// style.css): too small a pool and a fast swipe starts reusing -- and
// visibly cutting short -- copies that are still mid-fade.
const MAGNET_TRAIL_COUNT = 24;
const MAGNET_TRAIL_MIN_DIST = 26;
// How small the lens renders at rest/slow movement (a fraction of its full
// 14vmin footprint) and the speed, in pixels per millisecond, at which it
// reaches full size. Below MAGNET_SPEED_FOR_FULL_SIZE it scales linearly
// between the two.
const MAGNET_MIN_SIZE_SCALE = 0.03;
const MAGNET_SPEED_FOR_FULL_SIZE = 1.6;

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
let lastSeenDay = null;
// The footer's cycle survives re-renders: a °F/°C toggle rebuilds the lines but
// footerIndex stays put, so the bar carries on from the reading it was showing
// rather than snapping back to the first one.
let footerLines = [];
let footerIndex = 0;
let footerTimer = null;

const muteButton = document.getElementById("mute-button");
const reflectionButton = document.getElementById("reflection-button");
const stage = document.getElementById("screen-stage");
const screenTitleEl = document.getElementById("screen-title");
const broadcastTimeEl = document.getElementById("broadcast-time");
const broadcastDateEl = document.getElementById("broadcast-date");
const broadcastFooter = document.getElementById("broadcast-footer");

const tuneInOverlay = document.getElementById("tune-in");
const channelAudio = document.getElementById("channel-audio");
const powerOnAudio = document.getElementById("power-on-audio");
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

const mapFrame = document.getElementById("map-frame");
const mapMarkers = document.getElementById("map-markers");

const regionalTable = document.getElementById("regional-table");

const horoscopeGrid = document.getElementById("horoscope-grid");

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
    // The power-on effect answers to the same switch. Muting the channel and
    // then being startled by the set switching on would read as a broken
    // control rather than two separate sounds.
    powerOnAudio.muted = muted;
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

/* Dismiss the standby screen, play the power-on effect and start the channel
   music. The click itself is what satisfies the browser's autoplay policy, so
   playback must start here. */
function powerOn() {
    tuneInOverlay.classList.add("powered-on");
    tuneInOverlay.addEventListener("animationend", hideOverlay, { once: true });
    // Reduced-motion (and any dropped animationend) still needs the overlay gone.
    setTimeout(hideOverlay, POWER_ON_FALLBACK_MS);

    // Straight in at full volume and never faded: this one is meant to land on
    // the same beat as the picture, alongside the music rather than ahead of it.
    powerOnAudio.volume = POWER_ON_VOLUME;
    powerOnAudio.currentTime = 0;
    const effect = powerOnAudio.play();
    if (effect) {
        effect.catch((err) => {
            console.warn("Power-on sound unavailable:", err);
        });
    }

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

/* ---- Screen: Regional Forecast ----
   The same roster the observations table prints, plotted instead of listed. The
   server already projected each city to a percentage of the frame (see
   regional.py), so there is no map library and no geography in this file --
   just absolute positioning over a basemap that never moves.

   The basemap is injected rather than used as an <img> because inline SVG is
   the only form whose land, water and borders the stylesheet can still reach,
   which is what lets the map tint with the rest of the picture. */

let basemapRequest = null;

function ensureBasemap() {
    // Fetched once and cached by the promise itself, so the twenty renders a
    // long session triggers cost exactly one request.
    if (!basemapRequest) {
        basemapRequest = fetch("basemap.svg")
            .then((response) => (response.ok ? response.text() : ""))
            .then((markup) => {
                if (markup) {
                    mapFrame.insertAdjacentHTML("afterbegin", markup);
                }
            })
            .catch(() => {
                // A missing basemap leaves the markers on a bare panel, which
                // still reads as a map of temperatures. Nothing to recover.
            });
    }
    return basemapRequest;
}

function renderMap(payload) {
    ensureBasemap();

    const rows = (payload.regional || []).filter(
        (row) => typeof row.map_x === "number" && typeof row.map_y === "number"
    );
    mapMarkers.innerHTML = "";

    if (rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "regional-empty";
        empty.textContent = "Observations unavailable";
        mapMarkers.appendChild(empty);
        return;
    }

    for (const row of rows) {
        const marker = document.createElement("div");
        marker.className = "map-marker";
        marker.style.left = `${row.map_x}%`;
        marker.style.top = `${row.map_y}%`;

        const name = document.createElement("div");
        name.className = "map-marker-city";
        name.textContent = row.city;

        // Temperature and icon share a row under the name, the way the
        // broadcast maps set them, so the pair reads as one label.
        const reading = document.createElement("div");
        reading.className = "map-marker-reading";

        const temp = document.createElement("span");
        temp.className = "map-marker-temp";
        temp.textContent = celsiusToDisplay(row.temp_c).value.toFixed(0);

        const icon = document.createElement("img");
        setIcon(icon, row.icon, "icon-pin");
        icon.alt = "";

        reading.append(temp, icon);
        marker.append(name, reading);
        mapMarkers.appendChild(marker);
    }
}

/* ---- Screen: Latest Observations ----
   One grid rather than a table element, so the columns of every row line up on
   the same track sizes: city, temperature, condition, then the wind's direction
   and speed as separate cells so the speed can sit right-aligned under its own
   heading the way the broadcast tables did. */

function renderRegional(payload) {
    const rows = payload.regional || [];
    regionalTable.innerHTML = "";

    if (rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "regional-empty";
        empty.textContent = "Observations unavailable";
        regionalTable.appendChild(empty);
        return;
    }

    const addCell = (text, className) => {
        const cell = document.createElement("div");
        cell.className = className;
        cell.textContent = text;
        regionalTable.appendChild(cell);
    };

    // The temperature heading follows the °F/°C toggle, since the readings in
    // the column below it do.
    addCell("CITY", "regional-cell regional-cell--head");
    addCell(currentUnit === "F" ? "°F" : "°C", "regional-cell regional-cell--head regional-cell--temp");
    addCell("WEATHER", "regional-cell regional-cell--head");
    addCell("WIND", "regional-cell regional-cell--head regional-cell--wind-head");

    for (const row of rows) {
        const temp = celsiusToDisplay(row.temp_c);
        addCell(row.city, "regional-cell regional-cell--city");
        addCell(temp.value.toFixed(0), "regional-cell regional-cell--temp");
        addCell(row.condition, "regional-cell");
        addCell(row.wind_dir, "regional-cell regional-cell--wind-dir");
        addCell(row.wind_mph, "regional-cell regional-cell--wind-speed");
    }
}

/* ---- Screen: Horoscope ----
   The cards are built once per payload but left blank, because the readings are
   typed in by typeHoroscope() every time the screen comes around rather than
   appearing all at once. */

// One pending timer per card, so a restart can cancel whatever was still
// printing without tracking a timer per character.
let horoscopeTypers = [];

function stopHoroscopeTyping() {
    horoscopeTypers.forEach(clearTimeout);
    horoscopeTypers = [];
}

function renderHoroscope(payload) {
    stopHoroscopeTyping();
    horoscopeGrid.innerHTML = "";

    for (const sign of payload.horoscope || []) {
        const card = document.createElement("div");
        card.className = "horoscope-card";

        const nameEl = document.createElement("div");
        nameEl.className = "horoscope-sign";
        nameEl.textContent = sign.name;
        card.appendChild(nameEl);

        const datesEl = document.createElement("div");
        datesEl.className = "horoscope-dates";
        datesEl.textContent = sign.dates;
        card.appendChild(datesEl);

        // The reading itself is carried on the element so a retype does not
        // need the payload again.
        const readingEl = document.createElement("div");
        readingEl.className = "horoscope-reading";
        readingEl.dataset.reading = sign.reading;
        card.appendChild(readingEl);

        horoscopeGrid.appendChild(card);
    }

    // A payload that lands while the screen is already up still has to fill
    // itself in; every other case is handled by the screen's onShow.
    if (!horoscopeScreen.hidden) {
        typeHoroscope();
    }
}

function typeCard(readingEl, index) {
    const text = readingEl.dataset.reading || "";
    readingEl.textContent = "";
    readingEl.classList.add("is-typing");

    let typed = 0;
    const step = () => {
        typed += 1;
        readingEl.textContent = text.slice(0, typed);
        if (typed < text.length) {
            horoscopeTypers[index] = setTimeout(step, HOROSCOPE_TYPE_MS);
            return;
        }
        readingEl.classList.remove("is-typing");
    };
    horoscopeTypers[index] = setTimeout(step, index * HOROSCOPE_CARD_STAGGER_MS);
}

function typeHoroscope() {
    stopHoroscopeTyping();
    const readings = horoscopeGrid.querySelectorAll(".horoscope-reading");
    readings.forEach((readingEl, index) => {
        // Text that assembles itself is motion like any other, so reduced
        // motion gets the finished readings with no animation at all.
        if (prefersReducedMotion()) {
            readingEl.classList.remove("is-typing");
            readingEl.textContent = readingEl.dataset.reading || "";
            return;
        }
        typeCard(readingEl, index);
    });
}

/* ---- Footer data bar ----
   One reading at a time, typed in and then replaced, rather than a fixed row of
   three. The row was the same three fields under every screen, which read as
   stale next to a map or an almanac; a bar that cycles can carry sunrise, the
   moon and the day's range as well, and each line gets the whole width instead
   of a third of it.

   Readings that came back as "--" are dropped rather than printed blank, so the
   cycle is only ever as long as the data actually supports. */

function footerFacts(payload) {
    const obs = payload.observations || {};
    const almanac = payload.almanac || {};
    const today = (payload.forecast || [])[0];
    const sun = (almanac.days || [])[0];
    const facts = [];

    const add = (value, text) => {
        if (value !== undefined && value !== null && value !== "" && value !== "--") {
            facts.push(text);
        }
    };

    add(obs.wind_dir, `WIND: ${obs.wind_dir} AT ${obs.wind_mph} MPH`);
    if (obs.feels_like_c !== undefined && obs.feels_like_c !== "--") {
        const feels = celsiusToDisplay(Number(obs.feels_like_c));
        add(obs.feels_like_c, `FEELS LIKE: ${feels.value.toFixed(0)}${feels.unit}`);
    }
    add(obs.humidity, `HUMIDITY: ${obs.humidity}%`);
    add(obs.pressure_inches, `PRESSURE: ${obs.pressure_inches} IN`);
    add(obs.visibility_miles, `VISIBILITY: ${obs.visibility_miles} MI`);
    add(obs.cloud_cover, `CLOUD COVER: ${obs.cloud_cover}%`);
    add(obs.precip_inches, `PRECIP TODAY: ${obs.precip_inches} IN`);
    add(obs.uv_index, `UV INDEX: ${obs.uv_index}`);

    if (today) {
        const high = celsiusToDisplay(today.max_temp_c);
        const low = celsiusToDisplay(today.min_temp_c);
        facts.push(
            `TODAY: HIGH ${high.value.toFixed(0)}${high.unit} / LOW ${low.value.toFixed(0)}${low.unit}`
        );
    }
    if (sun) {
        add(sun.sunrise, `SUNRISE: ${sun.sunrise}`);
        add(sun.sunset, `SUNSET: ${sun.sunset}`);
    }
    add(almanac.moon_phase, `MOON: ${String(almanac.moon_phase).toUpperCase()}, ${almanac.moon_illumination}% LIT`);

    return facts;
}

function stopFooterCycle() {
    clearTimeout(footerTimer);
    footerTimer = null;
}

function typeFooterFact() {
    if (footerLines.length === 0) {
        return;
    }
    footerIndex = ((footerIndex % footerLines.length) + footerLines.length) % footerLines.length;
    const text = footerLines[footerIndex];

    const item = document.createElement("span");
    item.className = "footer-item is-typing";
    broadcastFooter.innerHTML = "";
    broadcastFooter.appendChild(item);

    let typed = 0;
    const step = () => {
        typed += 1;
        item.textContent = text.slice(0, typed);
        if (typed < text.length) {
            footerTimer = setTimeout(step, FOOTER_TYPE_MS);
            return;
        }
        // The caret stops blinking once the line is finished, then the line
        // sits long enough to actually be read before the next one replaces it.
        item.classList.remove("is-typing");
        footerTimer = setTimeout(() => {
            footerIndex += 1;
            typeFooterFact();
        }, FOOTER_HOLD_MS);
    };
    footerTimer = setTimeout(step, FOOTER_TYPE_MS);
}

function renderFooter(payload) {
    stopFooterCycle();
    footerLines = footerFacts(payload);
    broadcastFooter.innerHTML = "";

    if (footerLines.length === 0) {
        return;
    }

    // Text that assembles itself is motion like any other, so reduced motion
    // gets a plain row of the first few readings and no cycle at all -- the
    // same bar this footer used to be.
    if (prefersReducedMotion()) {
        broadcastFooter.classList.remove("is-cycling");
        for (const text of footerLines.slice(0, 3)) {
            const item = document.createElement("span");
            item.className = "footer-item";
            item.textContent = text;
            broadcastFooter.appendChild(item);
        }
        return;
    }

    broadcastFooter.classList.add("is-cycling");
    typeFooterFact();
}

function renderFooterError() {
    stopFooterCycle();
    footerLines = [];
    broadcastFooter.classList.remove("is-cycling");
    broadcastFooter.innerHTML = "";
}

/* ---- Screen framework ----
   Screens are just sections that get shown or hidden together; each one owns
   its own render function so adding a screen later is one registry entry plus
   one render function, with nothing else in this file to touch. */
const horoscopeScreen = document.getElementById("screen-horoscope");

const SCREENS = [
    { title: "Current Conditions", el: document.getElementById("screen-current"), render: renderCurrent },
    { title: "Almanac", el: document.getElementById("screen-almanac"), render: renderAlmanac },
    { title: "Regional Forecast", el: document.getElementById("screen-map"), render: renderMap },
    { title: "Latest Observations", el: document.getElementById("screen-regional"), render: renderRegional },
    // Two optional fields, both used only here: onShow, because the readings
    // type themselves in on arrival rather than when the payload was rendered,
    // and duration, because twelve readings need longer on screen than a
    // four-row table does.
    {
        title: "Horoscope",
        el: horoscopeScreen,
        render: renderHoroscope,
        onShow: typeHoroscope,
        duration: HOROSCOPE_DURATION_MS,
    },
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
let magnetLastMoveTime = null;
let magnetLastMoveX = null;
let magnetLastMoveY = null;

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
function dropMagnetTrail(x, y, sizeScale) {
    const trail = magnetTrailPool[magnetTrailCursor];
    magnetTrailCursor = (magnetTrailCursor + 1) % magnetTrailPool.length;

    trail.classList.remove("is-fading");
    trail.style.left = `${x}px`;
    trail.style.top = `${y}px`;
    trail.style.setProperty("--magnet-scale", sizeScale);
    void trail.offsetWidth;
    trail.classList.add("is-fading");
}

// Pointer speed, in pixels per millisecond, since the last call -- this is
// what a slight movement stays small and only a sustained, faster movement
// grows toward full size, rather than the lens jumping to full size the
// instant it starts moving at all. The very first call after a period of no
// movement (including right after the lens went idle, since that resets
// these) always reads as slow, because there is no prior sample yet to
// compare against -- which is exactly the "starts small" behavior wanted.
function magnetSizeScale(x, y) {
    const now = performance.now();
    if (magnetLastMoveTime === null) {
        magnetLastMoveTime = now;
        magnetLastMoveX = x;
        magnetLastMoveY = y;
        return MAGNET_MIN_SIZE_SCALE;
    }

    const dt = Math.max(now - magnetLastMoveTime, 1);
    const distance = Math.hypot(x - magnetLastMoveX, y - magnetLastMoveY);
    const speed = distance / dt;
    magnetLastMoveTime = now;
    magnetLastMoveX = x;
    magnetLastMoveY = y;

    const grown = Math.min(speed / MAGNET_SPEED_FOR_FULL_SIZE, 1);
    return MAGNET_MIN_SIZE_SCALE + (1 - MAGNET_MIN_SIZE_SCALE) * grown;
}

function deactivateMagnetLens() {
    magnetActive = false;
    magnetLens.classList.remove("is-active");
    rampMagnetScale(0);
    magnetLastTrailX = null;
    magnetLastTrailY = null;
    magnetLastMoveTime = null;
    magnetLastMoveX = null;
    magnetLastMoveY = null;
}

// Called on every qualifying pointermove: the live head snaps straight to the
// pointer (no lag), sized by current speed, and a trail copy drops every time
// the pointer has covered MAGNET_TRAIL_MIN_DIST since the last drop --
// covering more ground faster drops copies closer together in time, which is
// what makes a fast swipe read as a continuous smear and a slow one read as
// barely any trail at all. Idles back off automatically a short beat after
// movement stops.
function activateMagnetLens(x, y) {
    const sizeScale = magnetSizeScale(x, y);

    magnetLens.style.left = `${x}px`;
    magnetLens.style.top = `${y}px`;
    magnetLens.style.setProperty("--magnet-scale", sizeScale);

    if (magnetLastTrailX === null) {
        magnetLastTrailX = x;
        magnetLastTrailY = y;
    } else if (Math.hypot(x - magnetLastTrailX, y - magnetLastTrailY) >= MAGNET_TRAIL_MIN_DIST) {
        dropMagnetTrail(x, y, sizeScale);
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
    const duration = SCREENS[activeScreenIndex].duration || SCREEN_DURATION_MS;
    rotationTimeout = setTimeout(() => showScreen(activeScreenIndex + 1), duration);
}

function showScreen(index) {
    activeScreenIndex = ((index % SCREENS.length) + SCREENS.length) % SCREENS.length;
    SCREENS.forEach((screen, i) => {
        screen.el.hidden = i !== activeScreenIndex;
    });
    screenTitleEl.textContent = SCREENS[activeScreenIndex].title;
    if (SCREENS[activeScreenIndex].onShow) {
        SCREENS[activeScreenIndex].onShow();
    }
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

// Likewise for the effect: the set still switches on, just without the sound.
powerOnAudio.addEventListener("error", () => {
    console.warn("No power-on sound found at music/soundeffect.mp3 -- powering on quietly.");
}, { once: true });

/* The clock already visits every second, so it is also where the date rolling
   over gets noticed. Nothing else would: the channel fetches once at power-on
   and then runs indefinitely, which on a set left on overnight meant yesterday's
   horoscope still on screen this morning. Refetching brings today's readings
   down with the rest of the payload. */
function checkDayRollover(now) {
    const today = now.toDateString();
    if (lastSeenDay === null) {
        lastSeenDay = today;
        return;
    }
    if (today === lastSeenDay) {
        return;
    }
    lastSeenDay = today;
    // Nothing fetched yet means the first fetch is still in flight or failed,
    // and it will bring the current day's data with it regardless.
    if (lastPayload) {
        fetchWeather(lastPayload.city);
    }
}

function tickClock() {
    const now = new Date();
    checkDayRollover(now);
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
