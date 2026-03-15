# Master Project Context: Machine Learning Prognostics for Space COTS Power Management

## 1. Project Overview & Business Impact
* **The Problem:** The NewSpace industry relies on Commercial Off-The-Shelf (COTS) parts to reduce costs, but Lot-to-Lot Variation makes radiation reliability unpredictable. Current Radiation Lot Acceptance Testing (RLAT) is destructive, slow, and costs upwards of $50k.
* **The Solution:** A Non-Destructive Electrical Screening Protocol. By identifying "Precursor Signatures" in fresh parts using machine learning, we can predict Total Ionizing Dose (TID) failure before the part leaves the ground.
* **The Goal:** Build an automated software and hardware screening pipeline that allows aerospace manufacturers like General Dynamics to use $2.50 Automotive LDOs (like the TPS7A53-Q1) with the reliability confidence of $150.00 Space-Grade parts.
* **Financial Impact:** Projected savings of ~$148,000 per 1,000 boards, scaling to over $9.3 Million per 1,000-satellite constellation.

## 2. Core Physics & The "Bias Cliff" Hypothesis
This research hypothesizes that the magnitude of gate drive required (the "Overdrive Voltage") is a direct proxy for the density of Oxide Trapped Charge ($N_{ot}$).

* **Charge Pump Vulnerability:** Internal charge pumps in NMOS LDOs are the weakest link. By starving the external bias ($V_{BIAS}$), we force the internal pump to reveal its strength.
* **The Prognostic:** A unit that requires more Bias voltage to maintain regulation (a "Bias Cliff" closer to the datasheet limit) pre-radiation has less "Drive Strength Reserve" and will fail first post-radiation.
* **Triangulation:** We will validate this by showing an inverse correlation ($R^2 > 0.8$) between the Bias Cliff Voltage and 1/f Noise Density (the gold standard for measuring pre-existing oxide trap density, $D_{it}$).

## 3. The 15-Point Fingerprint (Feature Vector)
The application must manage data collection for a 15-point feature vector across 100 Device Under Test (DUT) units, utilizing a "Rule of 5" protocol (discard first run, average the next four to capture Mean and Sigma).

**Category A: The "Canary" Stress Tests**
1. **Bias Headroom Cliff:** Sweep $V_{BIAS}$ from 5.0V to 2.0V; record where $V_{OUT}$ drops 2%.
2. **Start-Up Rise Time ($T_{Rise}$):** Time for $V_{OUT}$ to rise 10% to 90%.
3. **Ground Current Slope ($dI_{GND}/dV_{IN}$):** Sweep $V_{IN}$ 1.4V to 6.0V; measures STI leakage.
4. **Start-Up Overshoot ($V_{Over}$):** Peak voltage during startup (Phase margin proxy).
5. **Thermal Drift ($dV_{OUT}/dT$):** $V_{OUT}$ shift at 100°C.

**Category B: Baseline Health Tests**
6. **Output Voltage Accuracy ($V_{OUT\_ACC}$):** Measure $V_{OUT}$ at nominal conditions.
7. **Dropout Voltage ($V_{DO}$):** $V_{IN}$ drop required for a 3% $V_{OUT}$ drop at 3A load.
8. **Line Regulation ($\Delta V_{OUT} / \Delta V_{IN}$):** $V_{OUT}$ shift during $V_{IN}$ sweep.
9. **Load Regulation ($\Delta V_{OUT} / \Delta I_{OUT}$):** $V_{OUT}$ droop during 10mA to 3A step.
10. **Nominal Ground Current ($I_{GND}$):** Baseline for radiation-induced leakage.
11. **Shutdown Leakage Current ($I_{SD}$):** $V_{IN}$ current when Enable = 0V.
12. **Enable Rising Threshold ($V_{EN\_Rise}$):** Voltage where $V_{OUT}$ turns ON.
13. **Enable Hysteresis ($V_{Hyst}$):** Difference between Turn On and Turn Off thresholds.
14. **Power Supply Rejection Ratio (PSRR):** 10kHz, 200mVpp sine wave attenuation.
15. **Output Noise Density ($V_{Noise}$):** AC RMS voltage (10Hz–100kHz).

## 4. Hardware Architecture
* **Instrumentation:** Precision DC Sourcing (Keithley 4200-SCS or Keysight B1505A) at ASU Macro Technology Works / NanoFab.
* **Test Matrix:** 100 total units divided across TI TPS7A53-Q1 (Primary), LT3071 (Rival), TPS7A54-Q1 (Binning), and TPS7B7701-Q1 (Control).
* **Disposable Carrier Boards:** All DUTs are permanently soldered to individual breakout boards featuring an onboard GaN FET (EPC2001) for transient loading. This eliminates socket contact resistance variance and minimizes loop inductance for clean Slew Rate testing.

## 5. How This Application Enables The Research
The software app being built in this repository serves as the central command center for this research, directly supporting the 3-paper publication path:

* **Historical Data Ingestion (RAG/FTS):** The app must parse decades of legacy PDF radiation data to establish historical baselines for NMOS LDO failures, helping define the parameter thresholds for the test protocol.
* **Test Bed Management:** The app's database will track the serial numbers, silicon revisions, and "Rule of 5" run data for all 100 soldered DUT carriers.
* **Simulation Integration:** The app allows headless LTspice/PySpice execution to simulate how $V_{th}$ shifts (found in the legacy PDFs) will specifically impact the Bias Cliff transient response on the GaN carrier board.
* **Machine Learning Prep:** The app will ultimately format and export the 15-Point Fingerprint data into clean CSV arrays, prepped for the XGBoost Regressor algorithm to determine feature importance and predict the TID failure dose.