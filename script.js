document.addEventListener('DOMContentLoaded', () => {

    // --- DOM-Elemente ---
    const dom = {
        // Design Results
        etaDesign: document.getElementById('res-eta-design'),
        waterDesign: document.getElementById('res-water-design'),
        powerDesign: document.getElementById('res-power-design'),
        // Live Inputs
        volumenstrom: document.getElementById('volumenstrom'),
        tempIn: document.getElementById('tempIn'),
        rhIn: document.getElementById('rhIn'),
        // Vis Inputs
        visT_in: document.getElementById('vis-t-in'),
        visRh_in: document.getElementById('vis-rh-in'),
        visX_in: document.getElementById('vis-x-in'),
        visH_in: document.getElementById('vis-h-in'),
        visTwb_in: document.getElementById('vis-twb-in'),
        // Vis Component
        visEta: document.getElementById('vis-eta'),
        visWater: document.getElementById('vis-water'),
        visPower: document.getElementById('vis-power'),
        // Vis Outputs
        visT_out: document.getElementById('vis-t-out'),
        visRh_out: document.getElementById('vis-rh-out'),
        visX_out: document.getElementById('vis-x-out'),
        visH_out: document.getElementById('vis-h-out'),
    };

    // --- Konstanten & globale Variablen ---
    const RHO_LUFT = 1.2; // kg/m³
    const DRUCK = 101325; // Pa
    let designEfficiency = 0;

    // --- Psychrometrische Funktionen ---
    const getPs = T => 611.2 * Math.exp((17.62 * T) / (243.12 + T));
    const getX = (T, rH, p) => (622 * (rH / 100 * getPs(T))) / (p - (rH / 100 * getPs(T)));
    const getRh = (T, x, p) => (100 * (p * x) / (622 + x)) / getPs(T);
    const getH = (T, x) => 1.006 * T + (x / 1000) * (2501 + 1.86 * T);
    const getTd = (x, p) => (243.12 * Math.log(((p * x) / (622 + x)) / 611.2)) / (17.62 - Math.log(((p * x) / (622 + x)) / 611.2));
    const getTwb = (T, x, p) => {
        const h_target = getH(T, x);
        let low = getTd(x, p), high = T;
        if (high - low < 0.01) return T;
        for (let i = 0; i < 15; i++) {
            let mid = (low + high) / 2;
            let h_mid = getH(mid, getX(mid, 100, p));
            if (h_mid < h_target) { low = mid; } else { high = mid; }
        }
        return (low + high) / 2;
    };

    /**
     * Berechnet alle relevanten Leistungsdaten für einen gegebenen Betriebspunkt.
     * @param {object} params - { vol, T_in, RH_in, T_out (optional) }
     * @returns {object} - Ein Objekt mit allen berechneten Ergebnissen.
     */
    function calculatePerformance(params) {
        const p = DRUCK;
        const massenstrom = (params.vol / 3600) * RHO_LUFT;

        // Zustand 1: Eintritt
        const state_in = {};
        state_in.T = params.T_in;
        state_in.RH = params.RH_in;
        state_in.x = getX(state_in.T, state_in.RH, p);
        state_in.h = getH(state_in.T, state_in.x);
        state_in.Twb = getTwb(state_in.T, state_in.x, p);

        // Zustand 2: Austritt
        const state_out = {};
        let T_out_actual;
        if (params.T_out !== undefined) {
            // Für Auslegungsberechnung, wo T_out bekannt ist
            T_out_actual = params.T_out;
        } else {
            // Für Simulation, wo T_out mit dem Design-Wirkungsgrad berechnet wird
            T_out_actual = state_in.T - designEfficiency * (state_in.T - state_in.Twb);
        }
        state_out.T = T_out_actual;
        state_out.h = state_in.h; // Isenthalper Prozess
        state_out.x = 1000 * (state_out.h - 1.006 * state_out.T) / (2501 + 1.86 * state_out.T);
        state_out.RH = getRh(state_out.T, state_out.x, p);

        // Leistungsdaten
        const wirkungsgrad = (state_in.T - state_out.T) / (state_in.T - state_in.Twb);
        const wasser_l_h = massenstrom * (state_out.x - state_in.x) / 1000 * 3600;
        const cp_moist = 1.006 + 1.86 * (state_in.x / 1000);
        const leistung_kW = massenstrom * cp_moist * (state_in.T - state_out.T);

        return { state_in, state_out, wirkungsgrad, wasser_l_h, leistung_kW };
    }

    /**
     * Aktualisiert die Anzeige mit den berechneten Daten.
     */
    function render(data) {
        const f = (num, dec) => isNaN(num) ? '--' : num.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        
        // Vis: Zustand VOR
        dom.visT_in.textContent = `${f(data.state_in.T, 1)} °C`;
        dom.visRh_in.textContent = `${f(data.state_in.RH, 1)} %`;
        dom.visX_in.textContent = `${f(data.state_in.x, 2)} g/kg`;
        dom.visH_in.textContent = `${f(data.state_in.h, 2)} kJ/kg`;
        dom.visTwb_in.textContent = `${f(data.state_in.Twb, 1)} °C`;
        // Vis: Komponente
        dom.visEta.textContent = `${f(data.wirkungsgrad * 100, 1)} %`;
        dom.visWater.textContent = `${f(data.wasser_l_h, 2)} l/h`;
        dom.visPower.textContent = `${f(data.leistung_kW, 1)} kW`;
        // Vis: Zustand NACH
        dom.visT_out.textContent = `${f(data.state_out.T, 1)} °C`;
        dom.visRh_out.textContent = `${f(data.state_out.RH, 1)} %`;
        dom.visX_out.textContent = `${f(data.state_out.x, 2)} g/kg`;
        dom.visH_out.textContent = `${f(data.state_out.h, 2)} kJ/kg`;
    }

    /**
     * Führt die Live-Berechnung basierend auf den aktuellen Usereingaben durch.
     */
    function runLiveCalculation() {
        const liveParams = {
            vol: parseFloat(dom.volumenstrom.value),
            T_in: parseFloat(dom.tempIn.value),
            RH_in: parseFloat(dom.rhIn.value)
        };
        const results = calculatePerformance(liveParams);
        render(results);
    }
    
    /**
     * Führt die einmalige Berechnung für die Auslegungsdaten durch.
     */
    function calculateAndDisplayDesignData() {
        const designParams = {
            vol: 13210, T_in: 26.0, RH_in: 50.0, T_out: 19.0
        };
        const results = calculatePerformance(designParams);
        designEfficiency = results.wirkungsgrad; // Speichern für die Simulation

        const f = (num, dec) => num.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        dom.etaDesign.textContent = f(results.wirkungsgrad * 100, 1);
        dom.waterDesign.textContent = f(results.wasser_l_h, 2);
        dom.powerDesign.textContent = f(results.leistung_kW, 1);
    }
    
    // --- Initialisierung & Event Listeners ---
    calculateAndDisplayDesignData();
    runLiveCalculation(); // Erster Lauf mit den Default-Werten
    
    [dom.volumenstrom, dom.tempIn, dom.rhIn].forEach(input => {
        input.addEventListener('input', runLiveCalculation);
    });
});
