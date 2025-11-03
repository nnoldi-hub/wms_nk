const logger = require('../utils/logger');
const db = require('../config/database');
const csv = require('csv-parser');
const { Transform } = require('stream');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { parseLotIntrare, generateSmartDescription } = require('../utils/lotParser');

/**
 * Import products from CSV or Excel file
 * POST /api/v1/products/import
 */
const importProducts = async (req, res) => {
  let client;
  try {
    // Acquire a PostgreSQL client connection
    client = await db.pool.connect();
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const updateExisting = req.body.update_existing === 'true';

    logger.info(`Processing import file: ${req.file.originalname}`);

    // Parse file based on extension
    let rows = [];
    try {
      if (fileExt === '.csv') {
        rows = await parseCSV(filePath);
      } else if (['.xlsx', '.xls'].includes(fileExt)) {
        rows = await parseExcel(filePath);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only CSV and Excel files are supported.',
        });
      }
    } catch (parseError) {
      logger.error(`Failed to parse file ${req.file.originalname}:`, parseError);
      
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Failed to parse file. Please try saving as CSV format instead of Excel.',
        error: parseError.message,
      });
    }

    logger.info(`Parsed ${rows.length} rows from file`);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'File is empty or has no valid data rows',
      });
    }

    // Process rows and import products
    const result = await processImport(rows, updateExisting, client);

    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Product import failed:', error);
    res.status(500).json({
      success: false,
      message: 'Import failed',
      error: error.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Parse CSV file (with or without header)
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const rows = [];
    let isFirstRow = true;
    let hasHeader = false;
    let headers = [];

    // Normalize separators (convert ; and \t to ,) before feeding to csv-parser.
    const normalizer = new Transform({
      transform(chunk, _enc, cb) {
        try {
          const replaced = chunk.toString().replace(/[;\t]/g, ',');
          this.push(replaced);
          cb();
        } catch (e) {
          cb(e);
        }
      }
    });

    fs.createReadStream(filePath)
      .pipe(normalizer)
      .pipe(csv({
        separator: ',', // csv-parser expects a single-character delimiter
        headers: false, // Do not assume headers exist
        skipLines: 0,
        strict: false,
      }))
      .on('data', (row) => {
        try {
          if (isFirstRow) {
            isFirstRow = false;

            // Detect if first row is header (contains keywords like "produs", "cod", "sku")
            const firstValue = Object.values(row)[0] || '';
            const firstValueLower = String(firstValue).toLowerCase();
            hasHeader = firstValueLower.includes('produs') ||
                        firstValueLower.includes('cod') ||
                        firstValueLower.includes('sku') ||
                        firstValueLower.includes('product');

            if (hasHeader) {
              // First row is header - store column names
              headers = Object.values(row).map(h => String(h).toLowerCase().trim());
              return; // Skip this row
            } else {
              // No header - assume column order
              headers = ['cod produs', 'produs', 'lot intrare', 'cantitate'];
            }
          }

          // Map row values to headers
          const normalized = {};
          const values = Object.values(row);
          headers.forEach((header, index) => {
            normalized[header] = values[index] ? String(values[index]).trim() : '';
          });

          rows.push(normalized);
        } catch (rowErr) {
          // skip malformed row
        }
      })
      .on('end', () => resolve(rows))
      .on('error', (error) => reject(error));
  });
};

/**
 * Parse Excel file (with or without header)
 */
const parseExcel = (filePath) => {
  try {
    // Read file and validate it's a valid Excel file
    const workbook = xlsx.readFile(filePath, {
      type: 'file',
      cellDates: false,
      cellText: false,
    });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets. Please save as CSV format instead.');
    }
    
    const sheetName = workbook.SheetNames[0]; // Read first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('Excel sheet is empty. Please save as CSV format instead.');
    }
    
    // Read all rows as arrays (without assuming headers)
    const rawRows = xlsx.utils.sheet_to_json(worksheet, {
      header: 1, // Read as array of arrays
      raw: false, // Convert to strings
      defval: '', // Default value for empty cells
      blankrows: false, // Skip blank rows
    });

    if (rawRows.length === 0) {
      throw new Error('Excel file has no data rows. Please check the file and try again.');
    }

    // Detect if first row is header
    const firstRow = rawRows[0];
    const firstCell = String(firstRow[0] || '').toLowerCase();
    const hasHeader = firstCell.includes('produs') || 
                     firstCell.includes('cod') || 
                     firstCell.includes('sku') ||
                     firstCell.includes('product');

    let headers = [];
    let dataStartIndex = 0;

    if (hasHeader) {
      // First row is header
      headers = firstRow.map(h => String(h || '').toLowerCase().trim());
      dataStartIndex = 1;
    } else {
      // No header - assume column order
      headers = ['cod produs', 'produs', 'lot intrare', 'cantitate'];
      dataStartIndex = 0;
    }

    // Map data rows to objects
    const rows = [];
    for (let i = dataStartIndex; i < rawRows.length; i++) {
      const rowData = rawRows[i];
      
      // Skip empty rows
      if (!rowData || rowData.length === 0 || !rowData[0]) {
        continue;
      }
      
      const normalized = {};
      headers.forEach((header, index) => {
        normalized[header] = rowData[index] ? String(rowData[index]).trim() : '';
      });
      
      rows.push(normalized);
    }

    if (rows.length === 0) {
      throw new Error('No valid data rows found in Excel file. Please check the file format.');
    }

    return rows;
  } catch (error) {
    if (error.message.includes('Unsupported file') || error.message.includes('corrupted')) {
      throw new Error('Excel file is corrupted or has invalid format. Please save as CSV (comma-delimited) format and try again.');
    }
    throw new Error(`Failed to parse Excel file: ${error.message}. Try saving as CSV format instead.`);
  }
};

/**
 * Process import rows and insert/update products
 */
const processImport = async (rows, updateExisting, client) => {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  await client.query('BEGIN');

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because first row is header, and Excel/CSV starts at 1

      try {
        // Map columns from ERP format (flexible column names)
        const sku = row['cod produs'] || row['produs'] || row['sku'] || row['code'] || row['product'];
        const name = row['produs'] || row['product'] || row['name'] || sku; // Fallback to SKU if no name
        const lotIntrare = row['lot intrare'] || row['lot'] || row['lot_number'] || '';
        const quantity = row['cantitate'] || row['quantity'] || row['qty'] || '';

        // Validate required fields
        if (!sku) {
          errors.push({
            row: rowNumber,
            sku: 'N/A',
            error: 'Missing product code/SKU',
          });
          skipped++;
          continue;
        }

        // Parse lot information to extract packaging, manufacturer, length
        const lotInfo = parseLotIntrare(lotIntrare);
        
        // Generate smart description from lot info
        const description = generateSmartDescription(name, lotInfo);

        // Determine weight from length if possible (for cables)
        let weightKg = null;
        if (lotInfo.length && lotInfo.length_uom === 'M') {
          // Estimate: 1m of cable ≈ 0.5kg (can be refined per product type)
          weightKg = lotInfo.length * 0.5;
        }

        // Check if product exists
        const existingProduct = await client.query(
          'SELECT sku FROM products WHERE sku = $1',
          [sku]
        );

        if (existingProduct.rows.length > 0) {
          if (updateExisting) {
            // Update existing product with enhanced data
            await client.query(
              `UPDATE products 
               SET name = $1, 
                   description = $2,
                   weight_kg = COALESCE($3, weight_kg),
                   lot_control = $4,
                   updated_at = NOW()
               WHERE sku = $5`,
              [
                name,
                description,
                weightKg,
                !!lotIntrare, // Enable lot control if lot info exists
                sku,
              ]
            );
            updated++;
            logger.info(`Updated product: ${sku} with lot info: ${JSON.stringify(lotInfo)}`);
          } else {
            skipped++;
            logger.info(`Skipped existing product: ${sku}`);
          }
        } else {
          // Insert new product with enhanced data from lot parsing
          await client.query(
            `INSERT INTO products (
              sku, name, description, uom, lot_control, 
              weight_kg, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              sku,
              name,
              description,
              lotInfo.length_uom || 'M', // Use parsed UOM or default to Meters
              !!lotIntrare, // Enable lot control if lot info exists
              weightKg,
            ]
          );
          imported++;
          logger.info(`Imported product: ${sku} with lot info: ${JSON.stringify(lotInfo)}`);
        }

        // Store lot metadata in separate table if lot information was parsed
        if (lotIntrare && (lotInfo.packaging_type || lotInfo.manufacturer)) {
          await client.query(
            `INSERT INTO lot_metadata (
              product_sku, lot_number, packaging_type, tambur_code,
              manufacturer, length, length_uom,
              marking_start, marking_end
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (product_sku, lot_number) 
            DO UPDATE SET
              packaging_type = EXCLUDED.packaging_type,
              tambur_code = EXCLUDED.tambur_code,
              manufacturer = EXCLUDED.manufacturer,
              length = EXCLUDED.length,
              length_uom = EXCLUDED.length_uom,
              marking_start = EXCLUDED.marking_start,
              marking_end = EXCLUDED.marking_end,
              updated_at = NOW()`,
            [
              sku,
              lotInfo.lot_number,
              lotInfo.packaging_type,
              lotInfo.tambur_code,
              lotInfo.manufacturer,
              lotInfo.length,
              lotInfo.length_uom,
              lotInfo.marking_start,
              lotInfo.marking_end,
            ]
          );
          logger.info(`Stored lot metadata for ${sku}: ${lotInfo.lot_number}`);
        }

      } catch (rowError) {
        logger.error(`Error processing row ${rowNumber}:`, rowError);
        errors.push({
          row: rowNumber,
          sku: row['cod produs'] || row['sku'] || 'N/A',
          error: rowError.message,
        });
        skipped++;
      }
    }

    await client.query('COMMIT');

    logger.info(`Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);

    return {
      total: rows.length,
      imported,
      updated,
      skipped,
      errors,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

module.exports = {
  importProducts,
};
