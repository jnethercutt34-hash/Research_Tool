Master Research Plan

Project Title: Machine Learning Prognostics for COTS Power Management in Space
Subtitle: Deep Electrical Characterization of NMOS LDOs to Predict Total Ionizing Dose (TID) Failure

1. Executive Summary

The Problem: The "NewSpace" industry is rapidly shifting to Commercial Off-The-Shelf (COTS) parts to reduce mission costs. However, COTS parts suffer from "Lot-to-Lot Variation," meaning a part purchased today may exhibit drastically different radiation hardness than one purchased six months later. Current screening methods (Radiation Lot Acceptance Testing - RLAT) are destructive, expensive ($50k+), and slow.

The Solution: This research proposes a Non-Destructive Electrical Screening Protocol. By identifying novel "Precursor Signatures" (specifically Bias Headroom Margin and Slew Rate Degradation) in fresh parts, we aim to train a Machine Learning model that can predict a specific unit's radiation performance before it leaves the ground.

The Goal: Deliver a Python-automated screening tool that allows General Dynamics to use $2.50 Automotive LDOs with the reliability confidence of $150.00 Space-Grade parts, potentially saving ~$148,000 per 1,000 boards.

2. Research Hypothesis (The "Bias Cliff" Theory)

Core Physics: Modern high-performance LDOs (like the TPS7A53-Q1) use an NMOS Pass Element driven by an internal Charge Pump or Bias Rail.

2.1 The Literature Basis (Why We Chose These Metrics)

This hypothesis builds upon two established pillars of radiation physics:

Electric Field Dependence of $V_{th}$ Shifts:

Established Science: Literature extensively documents that Oxide Trapped Charge ($N_{ot}$) buildup is accelerated by the electric field across the oxide (Bias ON vs. OFF).

The Connection: While foundational papers

$$e.g., Fleetwood et al., IEEE TNS$$

characterize this as a static "Bias Dependency," we hypothesize that the magnitude of the gate drive required (the "Overdrive Voltage") is a direct proxy for the density of these traps. A part starting with low overdrive margin will succumb to field-enhanced trapping sooner.

Charge Pump Vulnerability:

Established Science: Research on non-volatile memory and PMICs

$$e.g., Scheick et al., NASA GSFC$$

consistently identifies internal charge pumps as the "Weakest Link," often failing before the main power transistors due to oscillator frequency degradation and gain stage erosion.

The Connection: Our "Bias Cliff" test specifically targets this weakness by starving the external bias, forcing the internal pump to reveal its strength (or lack thereof) before radiation is even applied.

2.2 The Proposed Prognostic

The Novelty: Current literature treats Bias as a binary test condition (Static ON vs. OFF). This research introduces "Bias Headroom Margin" as a continuous, prognostic analog sweep.

Hypothesis: A unit that requires more Bias voltage to maintain regulation (i.e., has a "Bias Cliff" closer to the datasheet limit) in its pre-radiation state will be the first to fail post-radiation due to a lack of "Drive Strength Reserve."

2.3 Validation Strategy (Triangulation)

To defend against the criticism that the "Bias Cliff" is merely a circuit artifact, we will validate the physics of the defect by correlating it with classical oxide quality measurements included in the protocol:

The Correlation: We hypothesize a strong inverse correlation ($R^2 > 0.8$) between Test #1 (Bias Cliff Voltage) and Test #15 (1/f Noise Density).

The Logic: Since 1/f noise is the "gold standard" for measuring pre-existing oxide trap density ($D_{it}$), a high-noise part should physically correspond to a weak-drive part. This triangulation proves we are detecting material defects, not just design margin.

3. The Test Matrix (Component Selection)

We will test 4 distinct groups to isolate the physics of failure.

|

| Group | Part Number | Role in Research | Key Scientific Question |
| A (Primary) | TPS7A53-Q1 (TI) | Main Subject | Can we predict failure in standard NMOS COTS LDOs? |
| B (Rival) | LT3071 (Analog) | Universal Validation | Is the "Bias Cliff" a fundamental physics mode or just a TI quirk? |
| C (Binning) | TPS7A54-Q1 (TI) | Binning Study | Does the higher-current (4A) bin offer "free" radiation margin? |
| D (Control) | TPS7B7701-Q1 (TI) | Negative Control | Does a PMOS architecture (No Bias Pin) ignore this failure mode? |

3.1 Technical Validation: The Analog Devices Counterpart

To ensure the "Bias Cliff" signature is not unique to Texas Instruments' process technology, the Analog Devices LT3071 was selected as the comparative "Rival" (Group B). It serves as the perfect architectural twin for validation.

| Feature | TI TPS7A53-Q1 (Primary) | Analog Devices LT3071 (Rival) | Scientific Relevance |
| Architecture | NMOS + Charge Pump | NMOS + Bias Rail | Both require boosted gate drive. |
| Bias Pin | Yes ($V_{BIAS}$) | Yes ($V_{BIAS}$) | Allows identical "Headroom Sweep" protocols. |
| Max Current | 3.0 A | 5.0 A | Both represent High-Power / Low-Voltage cores. |
| Dropout | 180 mV | 85 mV | Both operate on ultra-thin margins (High Sensitivity). |
| Vendor | Texas Instruments | Analog Devices | Separates "Physics" from "Fabrication." |

Validation Logic: If the "Bias Cliff" hypothesis holds for both the TI and Analog Devices parts, we prove that the prognostic is based on fundamental NMOS oxide physics, validating the methodology for industry-wide adoption.

4. Detailed Test Protocol: The "15-Point Fingerprint"

A Python script will extract a high-dimensional feature vector for every unit. This section details the physics behind each test.

Category A: The "Canary" Stress Tests (Primary Predictors)

These are the novel tests designed to "tickle" the radiation failure modes.

1. Bias Headroom Cliff ($V_{Bias\_Min}$)

The Physics: Measures the "Gate Drive Reserve." As radiation increases the $V_{th}$ of the pass FET, the chip needs more voltage to keep it ON.

The Test: Set $V_{OUT}=1.0V$, Load=3A. Sweep $V_{BIAS}$ from 5.0V down to 2.0V. Record the voltage where $V_{OUT}$ drops by 2%.

Radiation Relevance: A part with a "Cliff" at 2.4V has 0.6V of margin. A part with a Cliff at 2.9V has almost zero margin and will fail immediately.

2. Start-Up Rise Time ($T_{Rise}$)

The Physics: Measures the bandwidth of the Error Amplifier and the slew rate of the internal current sources.

The Test: Toggle the ENABLE pin. Measure time for $V_{OUT}$ to go from 10% to 90%.

Radiation Relevance: Radiation slows down internal transistors. If a fresh part is already "slow" (e.g., 200µs vs 100µs), its internal gain stages are likely weak.

3. Ground Current Slope ($dI_{GND}/dV_{IN}$)

The Physics: Measures "STI Leakage." In deep-submicron processes, leakage often happens between components through the Shallow Trench Isolation (STI) oxides.

The Test: Sweep $V_{IN}$ from 1.4V to 6.0V. Measure the slope of the ground current increase.

Radiation Relevance: A steep slope indicates "leaky" oxide isolation, which is a prime target for radiation-induced leakage paths.

4. Start-Up Overshoot ($V_{Over}$)

The Physics: Measures "Loop Stability." Overshoot happens when the Error Amp is too slow to catch the rising voltage.

The Test: Capture the peak voltage during startup.

Radiation Relevance: High overshoot indicates phase margin erosion, which radiation often worsens (leading to oscillations).

5. Thermal Drift ($dV_{OUT}/dT$) - Optional

The Physics: Measures the temperature coefficient of the Bandgap Reference.

The Test: Heat to 100°C. Measure $V_{OUT}$ shift.

Radiation Relevance: High thermal drift often correlates with poor process control in the reference circuit.

Category B: The "Baseline Health" Tests (Standard)

These ensure we aren't testing factory defects, but we analyze them for radiation physics.

6. Output Voltage Accuracy ($V_{OUT\_ACC}$)

The Test: Measure $V_{OUT}$ at nominal conditions ($V_{IN}=1.4V$, $I_{Load}=10mA$).

Radiation Relevance: TID causes Bandgap voltage drift. A pre-rad unit that is already "off-center" (e.g., 1.008V vs 1.000V) indicates poor trimming and is statistically more likely to drift out of spec sooner.

7. Dropout Voltage ($V_{DO}$)

The Test: Force $V_{OUT}$ to drop by 3% by lowering $V_{IN}$ while pulling full 3A load.

Radiation Relevance: Radiation generates interface traps that reduce carrier mobility, causing $R_{DS(ON)}$ to rise. A unit with "low margin" dropout pre-rad will overheat and fail faster in orbit.

8. Line Regulation ($\Delta V_{OUT} / \Delta V_{IN}$)

The Test: Sweep $V_{IN}$ from 1.4V to 6.0V. Measure the tiny shift in $V_{OUT}$ (in µV).

Radiation Relevance: Radiation lowers the Open-Loop Gain ($A_{OL}$) of the amplifier. Poor line regulation pre-rad is a direct proxy for "Low Loop Gain," predicting early regulation failure.

9. Load Regulation ($\Delta V_{OUT} / \Delta I_{OUT}$)

The Test: Step load from 10mA to 3.0A. Measure the $V_{OUT}$ droop.

Radiation Relevance: Tests the "stiffness" of the control loop. A loop that sags heavily under load pre-rad has weak internal drive and will collapse under radiation.

10. Nominal Ground Current ($I_{GND}$)

The Test: Measure current into the GND pin at No Load.

Radiation Relevance: This is the baseline for detecting "RINCE" (Radiation-Induced Narrow Channel Effects). We need a precise baseline to detect the micro-amp increases caused by radiation leakage later.

11. Shutdown Leakage Current ($I_{SD}$)

The Test: Set Enable = 0V. Measure current into $V_{IN}$.

Radiation Relevance: Total Dose often causes "Leakage Runaway." A part that leaks 1µA pre-rad (vs a typically 10nA) contains defects that will turn into a massive short circuit after dosing.

12. Enable Rising Threshold ($V_{EN\_Rise}$)

The Test: Sweep Enable pin from 0V to 1.4V. Find the voltage where $V_{OUT}$ turns ON.

Radiation Relevance: Logic thresholds shift with radiation ($V_{TH}$ shift). If this drifts too high, the 1.8V GPIO from your FPGA might fail to turn on the LDO in space.

13. Enable Hysteresis ($V_{Hyst}$)

The Test: Sweep Enable Up (Turn On) and Down (Turn Off). Calculate the difference.

Radiation Relevance: Radiation erodes this margin. A part with tiny hysteresis pre-rad is susceptible to "chattering" (turning on/off rapidly) as the thresholds drift.

14. Power Supply Rejection Ratio (PSRR)

The Test: Inject a 10kHz, 200mVpp sine wave on $V_{IN}$. Measure the amplitude at $V_{OUT}$.

Radiation Relevance: This is a "Health Check" for the frequency compensation network. A drop in PSRR indicates the amplifier is getting slower/weaker, even if DC regulation looks fine.

15. Output Noise Density ($V_{Noise}$)

The Test: Measure AC RMS voltage at $V_{OUT}$ (10Hz–100kHz) with no input noise.

Radiation Relevance: High "1/f noise" pre-rad is a direct measurement of "Pre-existing Oxide Traps." A noisy part is physically guaranteed to degrade faster than a quiet one.

5. Hardware Architecture: The Facility-Integrated Platform

By leveraging the world-class characterization facilities available at ASU (Macro Technology Works / NanoFab), we eliminate the risk of custom instrumentation errors. The hardware strategy shifts to a "Hybrid Model": precise commercial instrumentation driving a custom thermal fixture.

5.1 The Instrumentation (Facility Provided)

We will utilize the Keithley 4200-SCS (Semiconductor Characterization System) or Keysight B1505A available in the ASU labs.

Role: Precision DC Sourcing (SMUs) and C-V measurement.

Why: These instruments provide femto-amp (fA) leakage resolution and micro-volt (µV) sourcing accuracy. This ensures our "Bias Cliff" data is legally defensible.

5.2 The Disposable Daughtercard ("The Carrier")

To eliminate the significant measurement uncertainty introduced by socket contact resistance (which can vary by 50mΩ per insertion and degrade Slew Rate tests), we will utilize a "Soldered-Down" strategy.

The Strategy: Each of the 100 Test Units (DUTs) will be permanently soldered to its own low-cost, disposable carrier board.

Why this is better:

Zero Contact Resistance Variance: Soldering ensures the $R_{contact}$ is stable and negligible (<1mΩ), which is critical for measuring 10mV dropouts at 3A.

Minimized Inductance: Removing the socket pins reduces loop inductance by ~10nH, dramatically improving the accuracy of the 1A/µs Slew Rate test.

Thermal Coupling: The VQFN thermal pad is soldered directly to copper vias, ensuring the 100°C heater temp actually reaches the die (sockets often have air gaps).

5.3 PCB Layout Strategy: The "Precision-Thermal" Compromise

Each disposable carrier board follows a strict "Zonal Architecture" to balance heat, speed, and precision.

1. Zone A: The "Direct Solder" Interface (Center)

Component: VQFN Footprint (Soldered).

Layout Rule: Thermal vias in the central pad connect directly to a copper plane on the bottom side, which acts as the mating surface for the external heater block.

Benefit: Efficient heat transfer without an expensive integrated heater on every board.

2. Zone B: The "Transient Loop" (Immediate Periphery < 5mm)

Component: GaN FET (EPC2001) + Non-Inductive Load Resistor.

Layout Rule: The GaN switch is placed <5mm from the $V_{OUT}$ pin on every carrier board.

Why: By putting the transient load on the disposable board, we ensure every unit sees the exact same inductive path.

3. Zone C: The "Interposer" Connector (Edge)

Component: High-Density Samtec Connector (e.g., MECF or SEAM series).

Role: Plugs into a reusable "Motherboard" that routes signals to the Keithley instrument.

Kelvin Routing: Force and Sense lines are routed independently from the connector pin all the way to the solder pads.

5.4 Bill of Materials (BOM) & Budget

| Item | Description | Source | Est. Cost |
| Lab Time | Hourly rate for Keithley 4200-SCS / Keysight B1505A | ASU Core Facilities | $50/hr (Internal) |
| Carrier PCBs | 100x Small Breakout Boards (4-Layer) | JLCPCB / PCBWay | $200.00 (Total) |
| GaN FETs | EPC2001 (1 per carrier) | DigiKey | $5.00 ea ($\times$100 = $500) |
| Connectors | Samtec Edge Card / Mezzanine (1 per carrier) | Samtec / DigiKey | $2.00 ea ($\times$100 = $200) |
| Motherboard | Reusable Interface Board (Adapter) | JLCPCB | $50.00 |
| DUTs | TPS7A53-Q1 (100 Units) | TI Direct / Mouser | $250.00 |
| Total | Hardware + 40 Hours Lab Time | -- | ~$3,200 |

6. Software Protocol: The "Rule of 5" Collection Strategy

To ensure the Machine Learning dataset is robust against measurement noise, the Python script will utilize the "Rule of 5" data collection protocol.

The Burst: For every metric (Bias Cliff, Slew Rate, etc.), the script will trigger 5 consecutive measurement sweeps.

The Filtering:

Run 1: Discarded (Warm-up / Capacitor charging artifact).

Runs 2–5: Used for analysis.

The Data Features:

_MEAN: The average of runs 2–5 (The Feature Value).

_SIGMA: The standard deviation of runs 2–5 (The "Stability" Feature).

Justification: This adds only ~10 seconds per unit but creates "Deep Data" that allows the AI to differentiate between a "Stable" part and a "Noisy/Drifting" part, even if they share the same average.

7. Radiation Test Plan (Step-Stress)

Facility: High Dose Rate (HDR) Cobalt-60 Source. Sample Size: 100 Units total (25 per group).

| Step | Dose (krad) | Action | Data Collected |
| Pre-Rad | 0 | Run Full 15-Point Suite | The "Training Data" (Inputs for AI). |
| Step 1 | 5 | Irradiate (Bias = 5V) | Early degradation check. |
| Step 2 | 10 | Irradiate (Bias = 5V) | "The Knee" (Drift usually starts). |
| Step 3 | 20 | Irradiate (Bias = 5V) | Significant parametric shifts. |
| Step 4 | 30 | Irradiate (Bias = 5V) | Target Failure Dose. |

8. Machine Learning Strategy

Algorithm: XGBoost Regressor (Gradient Boosting) or Random Forest.

Input Features (X): The 15 pre-rad metrics (Mean & Sigma) + Date Code + Silicon Revision.

Target Variable (Y): The Dose (krad) where the unit failed (or where $V_{OUT}$ drifted >5%).

Outcome: A "Feature Importance" chart proving that Bias Cliff is the #1 predictor of life expectancy.

9. Statistical Justification (Dataset Size)

A primary challenge in hardware reliability studies is the cost constraint on sample size. This research addresses the "Small $N$" concern using the "Rule of 10" heuristic for Regression Analysis.

The Constraint: High-reliability radiation testing is destructive. Generating "Big Data" (10,000+ samples) is financially impossible.

The Standard: Published reliability studies typically utilize $N=30$ to $N=100$ samples.

The Math: Robust regression requires approximately 10 samples per feature.

Features ($d$): ~15 Input Parameters.

Required Samples ($N$): $15 \times 10 = 150$.

Our Approach: With a physical sample size of $N=100$ and time-series data from 5 dose steps (effectively 500 observational points), our dataset falls well within the "Sweet Spot" for high-confidence regression without overfitting.

10. Business Impact (For General Dynamics)

Opportunity: Replace the Radiation-Hardened TPS7H1121-SEP with the Automotive TPS7A53-Q1 for Low-Earth Orbit (LEO) missions.

Financial Model: Standard modern digital payloads require high-density regulation for FPGAs (Core, I/O, Aux). A typical board utilizes ~12 LDOs. While historical sales volumes were lower, the emerging "NewSpace" constellations require production ramps into the thousands of units.

| Feature | TPS7H1121-SEP (Standard) | TPS7A53-Q1 (Proposed) | Savings Impact |
| Unit Cost | ~$150.00 | ~$2.50 | 98% Reduction |
| Board Cost (12 LDOs) | $1,800.00 | $30.00 | Save $1,770 per Board |
| Constellation (1k Boards) | $1,800,000 | $30,000 | Save $1.77 Million |

10.1 Strategic Scalability

This research is not limited to the TPS7A53. Once the "Precursor Signature" methodology is validated, the same hardware/software framework can be rapidly adapted to screen:

Point-of-Load (POL) Switchers: Detecting gate-drive weakness in buck converters.

Voltage References: Identifying drift-prone bandgaps.

GaN Drivers: Screening for threshold instability in wide-bandgap tech.

10.2 Broader Board-Level Impact (The "Simple Silicon" Strategy)

While this research focuses on LDOs, the underlying hypothesis—that analog drive strength predicts radiation hardness—is directly applicable to other "Simple Silicon" components found in high volume on digital boards. Excluding complex logic (FPGAs, DDR4), a typical spacecraft avionics board contains dozens of supporting power and signal chain ICs.

Projected Savings for a Complete "COTS-Screened" Digital Board:

| Component Family | Avg Qty/Board | Rad-Hard Cost (Avg) | Automotive Cost (Avg) | Methodology Relevance | Potential Savings |
| LDO Regulators | 12 | $150.00 | $2.50 | High (Bias Cliff) | $1,770 |
| Buck Converters | 6 | $250.00 | $5.00 | High (Gate Drive) | $1,470 |
| Voltage Translators | 8 | $120.00 | $1.50 | Med (Drive Strength) | $948 |
| Op-Amps / Monitors | 5 | $100.00 | $0.80 | Med (Slew/Gain) | $496 |
| Total per Board | 31 | -- | -- | -- | ~$4,684 |

The Multiplier Effect:

Per Board: Saving ~$4,684.

Per Constellation (1,000 Satellites): $4.68 Million in BOM cost reduction solely by validating this screening methodology for analog power/signal chains.

10.3 Per-Spacecraft Unit Economics

For program managers budgeting at the vehicle level, the impact is magnified. Assuming a standard satellite architecture utilizing roughly 2 Digital/Avionics boards per vehicle that fit this "Simple Silicon" profile:

Savings per Spacecraft (LDOs Only):

$1,770 (per board) $\times$ 2 = $3,540 saved per unit.

Savings per Spacecraft (Full "Simple Silicon" Methodology):

$4,684 (per board) $\times$ 2 = $9,368 saved per unit.

Constellation Impact (1,000 Units):
Scaling this unit cost reduction across a full constellation deployment yields a total program savings of ~$9.3 Million. This effectively funds the launch cost of ~3-4 additional satellites (assuming ~$2-3M launch cost per small-sat) purely through smarter component screening.

11. Academic Novelty (The Literature Gap)

This research fills a specific void in current reliability literature:

Gap 1: Existing papers study "Bias Dependency" (Static ON/OFF). No paper studies "Bias Headroom Margin" as a prognostic sweep.

Gap 2: Existing "ML for Radiation" papers focus on simple discrete transistors (2N2222). This research applies ML to Complex Power Management ICs (PMICs).

Gap 3: This study introduces a comparative analysis of Silicon Revisions (Rev A vs Non-A), addressing the critical industry problem of "Lot-to-Lot Variation."

12. Publication Strategy (The 3-Paper Path)

To fulfill the PhD requirement of three first-author publications, this research is structured to produce three distinct, standalone contributions.

Paper 1: The Physics Discovery (Target: NSREC 2027)

Working Title: "Electrical Characterization of Bias Headroom Margin as a Prognostic Indicator for Total Ionizing Dose Sensitivity in NMOS LDOs"

Venue: IEEE Nuclear and Space Radiation Effects Conference (NSREC).

Scope: Focus purely on the physics.

Introduce the "Bias Cliff" test method.

Present the Pre-Rad vs. Post-Rad data for the TPS7A53 (Group A).

Prove the physical link between "Low Headroom" and "Early Failure" (Charge Pump degradation).

Goal: Validate the measurement technique.

Paper 2: The Machine Learning Implementation (Target: IEEE TNS 2028)

Working Title: "Multivariate Regression Models for Predicting Radiation Hardness in COTS Power Management ICs"

Venue: IEEE Transactions on Nuclear Science (Journal).

Scope: Focus on the algorithm.

Analyze the full "15-Point Fingerprint" dataset.

Demonstrate the XGBoost model's accuracy.

Discuss feature importance (proving Bias Cliff > Slew Rate > Vout Accuracy).

Goal: Validate the predictive capability.

Paper 3: The Lot Variation & Binning Study (Target: RADECS or IRPS 2028/29)

Working Title: "Impact of Silicon Revision and Current Binning on the Radiation Hardness of Automotive LDOs"

Venue: RADECS (European Conference) or IEEE Reliability Physics Symposium (IRPS).

Scope: Focus on the supply chain reality.

Compare Rev A vs. Non-A performance.

Compare 3A (TPS7A53) vs. 4A (TPS7A54) bins.

Propose a "Rapid Screening Protocol" for Lot Acceptance.

Goal: Validate the industrial application and cost-savings.