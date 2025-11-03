require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');

async function seed() {
  console.log('Seeding development data...');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const hasColumn = async (table, column) => {
      const r = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
        [table, column]
      );
      return r.rowCount > 0;
    };

    // Create one warehouse
    const whId = uuidv4();
    await client.query(`
      INSERT INTO warehouses (id, warehouse_code, warehouse_name, company_name)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (id) DO NOTHING
    `, [whId, 'WH-RO-B', 'Bucharest DC', 'Pluriva Logistics']);

    // Location types
    let ltId = null;
    if (await hasColumn('location_types', 'id')) {
      // Try to reuse an existing location type if present
      const existingLT = await client.query('SELECT id FROM location_types LIMIT 1');
      if (existingLT.rowCount > 0) {
        ltId = existingLT.rows[0].id;
      } else if (await hasColumn('location_types', 'type_code') && await hasColumn('location_types', 'type_name')) {
        ltId = uuidv4();
        await client.query(`
          INSERT INTO location_types (id, type_code, type_name)
          VALUES ($1,$2,$3)
          ON CONFLICT (id) DO NOTHING
        `, [ltId, 'PALLET', 'Pallet Rack']);
      }
    }

    // Zones
    const zReceiving = uuidv4();
    const zStorage = uuidv4();
    await client.query(`
      INSERT INTO warehouse_zones (id, warehouse_id, zone_code, zone_name, zone_type, is_active)
      VALUES ($1,$3,$2,$4,'RECEIVING',true), ($5,$3,'ST-01','Storage A','STORAGE',true)
      ON CONFLICT (id) DO NOTHING
    `, [zReceiving, 'RCV-01', whId, 'Receiving', zStorage]);

    // Locations (a handful)
    const locs = [];
    const pushLoc = async (aisle, rack, shelf, bin) => {
      const id = uuidv4().substring(0, 50);
      locs.push(id);
      const columns = ['id','warehouse_id','zone_id','location_code','barcode'];
      const values = [id, whId, zStorage, `${String(aisle).padStart(2,'0')}-${String(rack).padStart(2,'0')}-${String(shelf).padStart(2,'0')}-${String(bin).padStart(2,'0')}`, `${aisle}${rack}${shelf}${bin}`];
  if (ltId && await hasColumn('locations', 'location_type_id')) { columns.push('location_type_id'); values.push(ltId); }
      if (await hasColumn('locations', 'aisle')) { columns.push('aisle'); values.push(String(aisle).padStart(2,'0')); }
      if (await hasColumn('locations', 'rack')) { columns.push('rack'); values.push(String(rack).padStart(2,'0')); }
      if (await hasColumn('locations', 'shelf_level')) { columns.push('shelf_level'); values.push(shelf); }
      if (await hasColumn('locations', 'bin_position')) { columns.push('bin_position'); values.push(bin); }
      if (await hasColumn('locations', 'width_cm')) { columns.push('width_cm'); values.push(100); }
      if (await hasColumn('locations', 'depth_cm')) { columns.push('depth_cm'); values.push(100); }
      if (await hasColumn('locations', 'height_cm')) { columns.push('height_cm'); values.push(150); }
      if (await hasColumn('locations', 'max_weight_kg')) { columns.push('max_weight_kg'); values.push(1000); }
      if (await hasColumn('locations', 'max_volume_cubic_meters')) { columns.push('max_volume_cubic_meters'); values.push(1.5); }
      if (await hasColumn('locations', 'status')) { columns.push('status'); values.push('AVAILABLE'); }
      if (await hasColumn('locations', 'priority_level')) { columns.push('priority_level'); values.push(1); }
      if (await hasColumn('locations', 'accessibility_level')) { columns.push('accessibility_level'); values.push('GROUND'); }
      const params = values.map((_, i) => `$${i+1}`).join(',');
      await client.query(`INSERT INTO locations (${columns.join(',')}) VALUES (${params})`, values);
    };
    for (let a = 1; a <= 1; a++) {
      for (let r = 1; r <= 2; r++) {
        for (let s = 1; s <= 2; s++) {
          for (let b = 1; b <= 2; b++) {
            // eslint-disable-next-line no-await-in-loop
            await pushLoc(a, r, s, b);
          }
        }
      }
    }

    // Vehicles
    const v1 = uuidv4();
    await client.query(`
      INSERT INTO internal_vehicles (id, warehouse_id, vehicle_code, license_plate, current_status, year, has_refrigeration)
      VALUES ($1,$2,'TRUCK-01','B-99-TRK','AVAILABLE',2022,false)
      ON CONFLICT (id) DO NOTHING
    `, [v1, whId]);

    // Carriers and services
    const c1 = uuidv4();
    await client.query(`
      INSERT INTO shipping_carriers (id, carrier_code, carrier_name, carrier_type)
      VALUES ($1,'FAN','Fan Courier','PARCEL')
      ON CONFLICT (id) DO NOTHING
    `, [c1]);
    const cs1 = uuidv4();
    {
      const cols = ['id','carrier_id','service_code','service_name'];
      const vals = [cs1, c1, 'STD', 'Standard 24-48h'];
      if (await hasColumn('carrier_services','service_type')) { cols.push('service_type'); vals.push('GROUND'); }
      const params = vals.map((_, i) => `$${i+1}`).join(',');
      await client.query(`INSERT INTO carrier_services (${cols.join(',')}) VALUES (${params}) ON CONFLICT (id) DO NOTHING`, vals);
    }

    // Packaging
    let pt1 = null;
    if (await hasColumn('packaging_types','id')) {
      const existingPT = await client.query('SELECT id FROM packaging_types LIMIT 1');
      if (existingPT.rowCount > 0) {
        pt1 = existingPT.rows[0].id;
      } else if (await hasColumn('packaging_types', 'packaging_code') && await hasColumn('packaging_types','packaging_name')) {
        pt1 = uuidv4();
        await client.query(`
          INSERT INTO packaging_types (id, category, packaging_code, packaging_name, is_reusable)
          VALUES ($1,'BOX','BOX-M','Medium Box',false)
          ON CONFLICT (id) DO NOTHING
        `, [pt1]);
      }
    }
    const pi1 = uuidv4();
  if (pt1 && await hasColumn('package_instances', 'barcode')) {
      const cols = ['id','packaging_type_id','barcode','status'];
      const vals = [pi1, pt1, 'PKG0001', 'AVAILABLE'];
      if (await hasColumn('package_instances','instance_code')) { cols.push('instance_code'); vals.push('PKG0001'); }
      if (await hasColumn('package_instances','condition')) { cols.push('condition'); vals.push('GOOD'); }
      const params = vals.map((_, i) => `$${i+1}`).join(',');
      await client.query(`INSERT INTO package_instances (${cols.join(',')}) VALUES (${params}) ON CONFLICT (id) DO NOTHING`, vals);
    }

    // Delivery zone and availability
    const dz1 = uuidv4();
    await client.query(`
      INSERT INTO delivery_zones (id, warehouse_id, zone_code, zone_name, zone_type, countries, is_active)
      VALUES ($1,$2,'RO-B-1','Bucharest Zone 1','URBAN', '["RO"]'::jsonb, true)
      ON CONFLICT (id) DO NOTHING
    `, [dz1, whId]);
    const zca1 = uuidv4();
    await client.query(`
      INSERT INTO zone_carrier_availability (id, delivery_zone_id, carrier_id, priority, estimated_delivery_days, cost_adjustment, is_available)
      VALUES ($1,$2,$3,1,1,0,true)
      ON CONFLICT (id) DO NOTHING
    `, [zca1, dz1, c1]);

    // Settings
    const s1 = uuidv4();
    if (await hasColumn('warehouse_settings', 'setting_category')) {
      await client.query(`
        INSERT INTO warehouse_settings (id, warehouse_id, setting_category, setting_key, setting_value, setting_type, display_name, is_editable)
        VALUES ($1,$2,'INVENTORY','DEFAULT_PUTAWAY_ZONE', '{"zone_code":"ST-01"}'::jsonb,'JSON','Default Putaway Zone',true)
        ON CONFLICT (id) DO NOTHING
      `, [s1, whId]);
    }

    // Workflows
    if (await hasColumn('workflow_states','state_code')) {
      const wsNew = uuidv4();
      const wsPacked = uuidv4();
      const wsShipped = uuidv4();
      const cols = ['id','warehouse_id','state_code','state_name'];
      const params = (vals) => vals.map((_, i) => `$${i+1}`).join(',');
      // Insert three states
      await client.query(`INSERT INTO workflow_states (${cols.join(',')}) VALUES (${params([wsNew,whId,'NEW','New'])}) ON CONFLICT (id) DO NOTHING`, [wsNew, whId, 'NEW', 'New']);
      await client.query(`INSERT INTO workflow_states (${cols.join(',')}) VALUES (${params([wsPacked,whId,'PACKED','Packed'])}) ON CONFLICT (id) DO NOTHING`, [wsPacked, whId, 'PACKED', 'Packed']);
      await client.query(`INSERT INTO workflow_states (${cols.join(',')}) VALUES (${params([wsShipped,whId,'SHIPPED','Shipped'])}) ON CONFLICT (id) DO NOTHING`, [wsShipped, whId, 'SHIPPED', 'Shipped']);
      if (await hasColumn('workflow_transitions','from_state_id') && await hasColumn('workflow_transitions','to_state_id')) {
        const wt1 = uuidv4();
        const wt2 = uuidv4();
        const baseCols = ['id','warehouse_id','from_state_id','to_state_id'];
        const extraCols = [];
        const baseVals1 = [wt1, whId, wsNew, wsPacked];
        const baseVals2 = [wt2, whId, wsPacked, wsShipped];
        if (await hasColumn('workflow_transitions','transition_code')) { extraCols.push('transition_code'); baseVals1.push('PACK'); baseVals2.push('SHIP'); }
        if (await hasColumn('workflow_transitions','transition_name')) { extraCols.push('transition_name'); baseVals1.push('Pack'); baseVals2.push('Ship'); }
        const params = (vals) => vals.map((_, i) => `$${i+1}`).join(',');
        await client.query(`INSERT INTO workflow_transitions (${baseCols.concat(extraCols).join(',')}) VALUES (${params(baseVals1)}) ON CONFLICT (id) DO NOTHING`, baseVals1);
        await client.query(`INSERT INTO workflow_transitions (${baseCols.concat(extraCols).join(',')}) VALUES (${params(baseVals2)}) ON CONFLICT (id) DO NOTHING`, baseVals2);
      }
    }

    await client.query('COMMIT');
    console.log('Seed completed.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

seed();
