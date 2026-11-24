# Railway Logistics Simulator — MVP 1

## Open the simulator

1. Copy the `railway-simulator-mvp1` folder to your work computer.
2. Open `index.html` in a modern browser. No installation, internet connection or server is required.
3. Change the inputs, then select **Run and view results**.
4. Use **Calculation details** to inspect the day-by-day inventory ledger and staffing maths.
5. Use **Export scenario** to keep a copy of your inputs. **Import scenario** restores a JSON scenario file.

The browser also saves the most recently run scenario locally on that computer.

## Main files

- `index.html` — page content and controls
- `styles.css` — light/dark responsive layout and help/graph styles
- `app.js` — editable inputs, flow calculations, staffing estimates, checks and SVG graphs

## Important model limits

- Daily East Coast and East Malaysia production enters NAC. Stock reaches SFT only when both NAC-to-SFT transfer capacity and transfer time are entered. Enter zero minutes explicitly if same-time transfer is the intended planning assumption.
- Starting stock fields default to zero as scenario inputs. They are not actual stock records.
- The inventory graph can show end-of-day stock or daily peak stock. It includes NAC, SFT, Paya Besar, Kuantan Port, transit and East Malaysia hub stock. The calculation page shows opening stock, arrivals/production, departures, closing stock and daily peak.
- The daily flow model uses the entered train slot count and load rule. Blank rail elapsed times do not move arrivals to Paya Besar or Kuantan Port. Those vehicles remain in rail transit, and readiness marks the resulting timing as incomplete.
- Vessel dispatch frequency is TBD until entered. When the 1,500-unit dispatch quantity is reached with no frequency, units are marked ready at Kuantan Port and remain there.
- Hands-on time is active crew work per cycle and is used for staffing. Elapsed time is the clock time per cycle and is used for the process timeline. Cycle basis defines what one cycle handles. Crew size is people working together; parallel teams can run at once. Current headcount is optional.
- Backlog is extra work already waiting at one process. It is separate from physical inventory. Each process has its own backlog quantity and clearance deadline. A blank quantity or deadline stays not checked.
- The process timeline follows the route order and uses elapsed time × cycle count ÷ parallel teams. It does not add queue delays that are not entered in the model.
- East Malaysia dealer outflow is modeled using separate editable Sabah and Sarawak CBU/day inputs. The Sabah allocation share must be entered before branch hub stock can be split and reduced; blank delivery rates remain TBD and do not deduct stock.
- Paya Besar East Coast dealer delivery starts with a 137 CBU/day planning assumption, matching the initial East Coast volume. It is not a confirmed dispatch rate. This editable rate drains Paya Besar inventory; readiness warns when its rate differs from inbound East Coast volume or when available stock cannot fulfill demand.
- Blank node capacities are not applied. Add confirmed capacities to check for modeled storage overflows.
- The mixed daily volume, train capacity and historical accumulation figures contain unresolved discrepancies. The simulator surfaces them and does not silently reconcile them.
- Readiness results are planning checks, not a safety or regulatory certification.
- The light/dark choice is saved in the browser separately from scenario inputs.
