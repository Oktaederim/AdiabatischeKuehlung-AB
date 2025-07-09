document.addEventListener('DOMContentLoaded', () => {

    const dom = {
        // Design Inputs
        designTempIn: document.getElementById('design-temp-in'),
        designRhIn: document.getElementById('design-rh-in'),
        designTempOut: document.getElementById('design-temp-out'),
        // Live Inputs
        volumenstrom: document.getElementById('volumenstrom'),
        liveTempIn: document.getElementById('live-temp-in'),
        liveRhIn: document.getElementById('live-rh-in'),
        // Performance Results
        etaSystem: document.getElementById('res-eta-system'),
        waterLive: document.getElementById('res-water-live'),
        powerLive: document.getElementById('res-power-live'),
        // Visualization Nodes
        in: { T: qs('#vis-t-in'), RH: qs('#vis-rh-in'), x: qs('#vis-x-in'), h: qs('#vis-h-in'), Twb: qs('#vis-twb-in') },
        out: { T: qs('#vis-t-out'), RH: qs('#vis-rh-out'), x: qs('#vis-x-out'), h: qs('#vis-h-out'), Twb: qs('#vis-twb-out') },
    };
    function qs(selector) { return document.querySelector(selector); }

    const RHO_LUFT = 1.2, DRUCK = 101325;

    const getPs = T => 611.2 * Math.exp((17.62 * T) / (243.12 + T));
    const getX = (T, rH, p) => (622 * (rH / 100 * getPs(T))) / (p - (rH / 100 * getPs(T)));
    const getH = (T, x) => 1.006 * T + (x / 1000) * (2501 + 1.86 * T);
    const getTd = (x, p) => (243.12 * Math.log(((p * x) / (622 + x)) / 611.2)) / (17.62 - Math.log(((p * x) / (622 + x)) / 611.2));
    const getTwb = (T, x, p) => {
        const h_target = getH(T, x); let low = getTd(x, p), high = T;
        if (high - low < 0.01) return T;
        for (let i = 0; i < 15; i++) {
            let mid = (low + high) / 2; let h_mid = getH(mid, getX(mid, 100, p));
            if (h_mid < h_target) low = mid; else high = mid;
        }
        return (low + high) / 2;
    };
    const getRh = (T, x, p) => (100 * (p * x) / (622 + x)) / getPs(T);
    
    function runAllCalculations() {
        // --- 1. System-Wirkungsgrad aus Auslegungsdaten ermitteln ---
        const design_T_in = parseFloat(dom.designTempIn.value);
        const design_RH_in = parseFloat(dom.designRhIn.value);
        const design_T_out = parseFloat(dom.designTempOut.value);
        
        const design_x_in = getX(design_T_in, design_RH_in, DRUCK);
        const design_Twb_in = getTwb(design_T_in, design_x_in, DRUCK);
        
        const systemEta = (design_T_in - design_T_out) / (design_T_in - design_Twb_in);
        dom.etaSystem.textContent = (systemEta * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 });

        // --- 2. Live-Performance basierend auf dem Wirkungsgrad simulieren ---
        const live_vol = parseFloat(dom.volumenstrom.value);
        const live_T_in = parseFloat(dom.liveTempIn.value);
        const live_RH_in = parseFloat(dom.liveRhIn.value);
        const massenstrom = (live_vol / 3600) * RHO_LUFT;

        // Zustand VOR Befeuchter
        const state_in = {};
        state_in.T = live_T_in;
        state_in.RH = live_RH_in;
        state_in.x = getX(state_in.T, state_in.RH, DRUCK);
        state_in.h = getH(state_in.T, state_in.x);
        state_in.Twb = getTwb(state_in.T, state_in.x, DRUCK);

        // Zustand NACH Befeuchter (hier wird die Austritts-T berechnet!)
        const state_out = {};
        state_out.T = state_in.T - systemEta * (state_in.T - state_in.Twb);
        state_out.h = state_in.h; // Isenthalper Prozess
        state_out.x = 1000 * (state_out.h - 1.006 * state_out.T) / (2501 + 1.86 * state_out.T);
        state_out.RH = getRh(state_out.T, state_out.x, DRUCK);
        state_out.Twb = getTwb(state_out.T, state_out.x, DRUCK);

        // Leistungswerte berechnen
        const wasser_l_h = massenstrom * (state_out.x - state_in.x) / 1000 * 3600;
        const cp_moist = 1.006 + 1.86 * (state_in.x / 1000);
        const leistung_kW = massenstrom * cp_moist * (state_in.T - state_out.T);

        // --- 3. Alle Ergebnisse in die UI schreiben ---
        const f = (num, dec=1) => isNaN(num) ? '--' : num.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        
        dom.waterLive.textContent = f(wasser_l_h, 2);
        dom.powerLive.textContent = f(leistung_kW, 1);

        dom.in.T.textContent = `${f(state_in.T)} °C`;
        dom.in.RH.textContent = `${f(state_in.RH)} %`;
        dom.in.x.textContent = `${f(state_in.x, 2)} g/kg`;
        dom.in.h.textContent = `${f(state_in.h, 2)} kJ/kg`;
        dom.in.Twb.textContent = `${f(state_in.Twb)} °C`;

        dom.out.T.textContent = `${f(state_out.T)} °C`;
        dom.out.RH.textContent = `${f(state_out.RH, 0)} %`;
        dom.out.x.textContent = `${f(state_out.x, 2)} g/kg`;
        dom.out.h.textContent = `${f(state_out.h, 2)} kJ/kg`;
        dom.out.Twb.textContent = `${f(state_out.Twb)} °C`;
    }
    
    // --- Initialisierung & Event Listeners ---
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', runAllCalculations);
    });

    runAllCalculations(); // Erster Lauf bei Seitenaufruf
});
