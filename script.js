document.addEventListener('DOMContentLoaded', () => {

    // --- DOM-Elemente ---
    const dom = {
        // Design Inputs
        designTempIn: document.getElementById('design-temp-in'),
        designRhIn: document.getElementById('design-rh-in'),
        designTempOut: document.getElementById('design-temp-out'),
        designRhOut: document.getElementById('design-rh-out'),
        // Performance Results
        etaDesign: document.getElementById('res-eta-design'),
        waterDesign: document.getElementById('res-water-design'),
        powerDesign: document.getElementById('res-power-design'),
        // Live Input
        volumenstrom: document.getElementById('volumenstrom'),
        // Total Input & Outputs
        totalVolumenstrom: document.getElementById('total-volumenstrom'),
        totalWater: document.getElementById('total-water'),
        totalPower: document.getElementById('total-power'),
        // Visualization Nodes
        in: { T: dom_qs('#vis-t-in'), RH: dom_qs('#vis-rh-in'), x: dom_qs('#vis-x-in'), h: dom_qs('#vis-h-in'), Tdp: dom_qs('#vis-tdp-in') },
        out: { T: dom_qs('#vis-t-out'), RH: dom_qs('#vis-rh-out'), x: dom_qs('#vis-x-out'), h: dom_qs('#vis-h-out'), Tdp: dom_qs('#vis-tdp-out') },
    };
    function dom_qs(selector) { return document.querySelector(selector); }

    // --- Konstanten & globale Variablen ---
    const RHO_LUFT = 1.2;
    const DRUCK = 101325;

    // --- Psychrometrische Funktionen ---
    const getPs = T => 611.2 * Math.exp((17.62 * T) / (243.12 + T));
    const getX = (T, rH, p) => (622 * (rH / 100 * getPs(T))) / (p - (rH / 100 * getPs(T)));
    const getRh = (T, x, p) => (100 * (p * x) / (622 + x)) / getPs(T);
    const getH = (T, x) => 1.006 * T + (x / 1000) * (2501 + 1.86 * T);
    const getTd = (x, p) => (243.12 * Math.log(((p * x) / (622 + x)) / 611.2)) / (17.62 - Math.log(((p * x) / (622 + x)) / 611.2));
    const getTwb = (T, x, p) => {
        const h_target = getH(T, x); let low = getTd(x, p), high = T;
        if (high - low < 0.01) return T;
        for (let i = 0; i < 15; i++) {
            let mid = (low + high) / 2; let h_mid = getH(mid, getX(mid, 100, p));
            if (h_mid < h_target) { low = mid; } else { high = mid; }
        }
        return (low + high) / 2;
    };

    /**
     * Berechnet alle relevanten Leistungsdaten für einen gegebenen Betriebspunkt.
     */
    function calculatePerformance(params) {
        const p = DRUCK;
        const massenstrom = (params.vol / 3600) * RHO_LUFT;

        const state_in = { T: params.T_in, RH: params.RH_in };
        state_in.x = getX(state_in.T, state_in.RH, p);
        state_in.h = getH(state_in.T, state_in.x);
        state_in.Twb = getTwb(state_in.T, state_in.x, p);
        state_in.Tdp = getTd(state_in.x, p);

        const state_out = { T: params.T_out, RH: params.RH_out };
        state_out.h = getH(state_out.T, state_out.RH, p);
        state_out.x = getX(state_out.T, state_out.RH, p);
        state_out.Tdp = getTd(state_out.x, p);
        
        const wirkungsgrad = (state_in.T - state_out.T) / (state_in.T - state_in.Twb);
        const wasser_l_h = massenstrom * (state_out.x - state_in.x) / 1000 * 3600;
        const cp_moist = 1.006 + 1.86 * (state_in.x / 1000);
        const leistung_kW = massenstrom * cp_moist * (state_in.T - state_out.T);

        return { state_in, state_out, wirkungsgrad, wasser_l_h, leistung_kW };
    }

    /**
     * Führt alle Berechnungen aus und aktualisiert die gesamte UI.
     */
    function runAllCalculations() {
        // 1. Parameter aus den Eingabefeldern lesen
        const designParams = {
            vol: parseFloat(dom.volumenstrom.value),
            T_in: parseFloat(dom.designTempIn.value),
            RH_in: parseFloat(dom.designRhIn.value),
            T_out: parseFloat(dom.designTempOut.value),
            RH_out: parseFloat(dom.designRhOut.value),
        };

        // 2. Performance für Einzelanlage berechnen
        const results = calculatePerformance(designParams);

        // 3. UI für Einzelanlage aktualisieren
        const f = (num, dec) => isNaN(num) ? '--' : num.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        
        dom.etaDesign.textContent = f(results.wirkungsgrad * 100, 1);
        dom.waterDesign.textContent = f(results.wasser_l_h, 2);
        dom.powerDesign.textContent = f(results.leistung_kW, 1);

        dom.in.T.textContent = `${f(results.state_in.T, 1)} °C`;
        dom.in.RH.textContent = `${f(results.state_in.RH, 1)} %`;
        dom.in.x.textContent = `${f(results.state_in.x, 2)} g/kg`;
        dom.in.h.textContent = `${f(results.state_in.h, 2)} kJ/kg`;
        dom.in.Tdp.textContent = `${f(results.state_in.Tdp, 1)} °C`;

        dom.out.T.textContent = `${f(results.state_out.T, 1)} °C`;
        dom.out.RH.textContent = `${f(results.state_out.RH, 1)} %`;
        dom.out.x.textContent = `${f(results.state_out.x, 2)} g/kg`;
        dom.out.h.textContent = `${f(results.state_out.h, 2)} kJ/kg`;
        dom.out.Tdp.textContent = `${f(results.state_out.Tdp, 1)} °C`;

        // 4. Gesamtanlagen-Simulation berechnen
        const singleVol = designParams.vol;
        if (singleVol > 0) {
            const totalVol = parseFloat(dom.totalVolumenstrom.value);
            const ratio = totalVol / singleVol;
            dom.totalWater.textContent = f(results.wasser_l_h * ratio, 2) + ' l/h';
            dom.totalPower.textContent = f(results.leistung_kW * ratio, 1) + ' kW';
        } else {
            dom.totalWater.textContent = '-- l/h';
            dom.totalPower.textContent = '-- kW';
        }
    }
    
    // --- Initialisierung & Event Listeners ---
    const allInputs = document.querySelectorAll('input');
    allInputs.forEach(input => {
        input.addEventListener('input', runAllCalculations);
    });

    runAllCalculations(); // Erster Lauf bei Seitenaufruf
});
