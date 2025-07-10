document.addEventListener('DOMContentLoaded', () => {

    const dom = {
        wirkungsgrad: document.getElementById('wirkungsgrad'),
        volumenstrom: document.getElementById('volumenstrom'),
        liveTempIn: document.getElementById('live-temp-in'),
        liveRhIn: document.getElementById('live-rh-in'),
        waterLive: document.getElementById('res-water-live'),
        powerLive: document.getElementById('res-power-live'),
        tempOut: document.getElementById('res-temp-out'),
        rhOut: document.getElementById('res-rh-out'),
        in: { T: qs('#vis-t-in'), RH: qs('#vis-rh-in'), x: qs('#vis-x-in'), h: qs('#vis-h-in'), Twb: qs('#vis-twb-in') },
        out: { T: qs('#vis-t-out'), RH: qs('#vis-rh-out'), x: qs('#vis-x-out'), h: qs('#vis-h-out'), Twb: qs('#vis-twb-out') },
    };
    function qs(selector) { return document.querySelector(selector); }

    const RHO_LUFT = 1.2, DRUCK = 101325;

    const getPs = T => 611.2 * Math.exp((17.62 * T) / (243.12 + T));
    const getX = (T, rH, p) => (622 * (rH / 100 * getPs(T))) / (p - (rH / 100 * getPs(T)));
    const getH = (T, x) => 1.006 * T + (x / 1000) * (2501 + 1.86 * T);
    const getTwb = (T, x, p) => {
        const h_target = getH(T, x);
        const getTd = (x_Td, p_Td) => (243.12 * Math.log(((p_Td * x_Td) / (622 + x_Td)) / 611.2)) / (17.62 - Math.log(((p_Td * x_Td) / (622 + x_Td)) / 611.2));
        let low = getTd(x, p), high = T;
        if (high - low < 0.01) return T;
        for (let i = 0; i < 15; i++) {
            let mid = (low + high) / 2; let h_mid = getH(mid, getX(mid, 100, p));
            if (h_mid < h_target) low = mid; else high = mid;
        }
        return (low + high) / 2;
    };
    const getRh = (T, x, p) => Math.min(100, (100 * (p * x) / (622 + x)) / getPs(T));
    
    function runAllCalculations() {
        const eta = parseFloat(dom.wirkungsgrad.value) / 100;
        const vol = parseFloat(dom.volumenstrom.value);
        const T_in = parseFloat(dom.liveTempIn.value);
        const RH_in = parseFloat(dom.liveRhIn.value);
        const massenstrom = (vol / 3600) * RHO_LUFT;

        if (isNaN(eta) || isNaN(vol) || isNaN(T_in) || isNaN(RH_in)) return;

        // Zustand VOR Befeuchter
        const state_in = {};
        state_in.T = T_in;
        state_in.RH = RH_in;
        state_in.x = getX(state_in.T, state_in.RH, DRUCK);
        state_in.h = getH(state_in.T, state_in.x);
        state_in.Twb = getTwb(state_in.T, state_in.x, DRUCK);

        // Zustand NACH Befeuchter (Austritts-T wird hier berechnet!)
        const state_out = {};
        state_out.T = state_in.T - eta * (state_in.T - state_in.Twb);
        state_out.h = state_in.h; // Isenthalper Prozess
        state_out.x = 1000 * (state_out.h - 1.006 * state_out.T) / (2501 + 1.86 * state_out.T);
        state_out.RH = getRh(state_out.T, state_out.x, DRUCK);
        state_out.Twb = getTwb(state_out.T, state_out.x, DRUCK);

        // Leistungswerte berechnen
        const wasser_l_h = massenstrom * (state_out.x - state_in.x) / 1000 * 3600;
        const cp_moist = 1.006 + 1.86 * (state_in.x / 1000);
        const leistung_kW = massenstrom * cp_moist * (state_in.T - state_out.T);

        // Alle Ergebnisse in die UI schreiben
        render({ state_in, state_out, wasser_l_h, leistung_kW });
    }

    function render(data) {
        const f = (num, dec=1) => isNaN(num) ? '--' : num.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        
        // Ergebnisse
        dom.waterLive.textContent = f(data.wasser_l_h, 2);
        dom.powerLive.textContent = f(data.leistung_kW, 1);
        dom.tempOut.textContent = f(data.state_out.T, 1);
        dom.rhOut.textContent = f(data.state_out.RH, 1);

        // Visualisierung
        dom.in.T.textContent = `${f(data.state_in.T)} °C`;
        dom.in.RH.textContent = `${f(data.state_in.RH)} %`;
        dom.in.x.textContent = `${f(data.state_in.x, 2)} g/kg`;
        dom.in.h.textContent = `${f(data.state_in.h, 2)} kJ/kg`;
        dom.in.Twb.textContent = `${f(data.state_in.Twb)} °C`;

        dom.out.T.textContent = `${f(data.state_out.T)} °C`;
        dom.out.RH.textContent = `${f(data.state_out.RH, 1)} %`;
        dom.out.x.textContent = `${f(data.state_out.x, 2)} g/kg`;
        dom.out.h.textContent = `${f(data.state_out.h, 2)} kJ/kg`;
        dom.out.Twb.textContent = `${f(data.state_out.Twb)} °C`;
    }
    
    // --- Initialisierung & Event Listeners ---
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', runAllCalculations);
    });

    runAllCalculations();
});
