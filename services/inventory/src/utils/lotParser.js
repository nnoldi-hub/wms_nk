/**
 * Parse "Lot intrare" field to extract packaging, manufacturer, and quantity information
 * 
 * Patterns:
 * 1. Tambur format: ##E1200 ELP 0-1083 1083 M
 *    - ##E1200: Tambur code (E1200)
 *    - ELP: Manufacturer short code (Electroplast)
 *    - 0-1083: Marking range (start-end)
 *    - 1083 M: Total length in meters
 * 
 * 2. Producer format: # TOP CABLE
 *    - #: Producer prefix
 *    - TOP CABLE: Manufacturer name
 * 
 * 3. Colac format: COLAC PRVSMIAN 125 ML
 *    - COLAC: Packaging type
 *    - PRVSMIAN: Manufacturer
 *    - 125 ML: Length in linear meters
 */
const parseLotIntrare = (lotString) => {
  if (!lotString || typeof lotString !== 'string') {
    return {
      lot_number: null,
      packaging_type: null,
      manufacturer: null,
      length: null,
      length_uom: null,
      marking_start: null,
      marking_end: null,
      tambur_code: null,
    };
  }

  const result = {
    lot_number: lotString.trim(),
    packaging_type: null,
    manufacturer: null,
    length: null,
    length_uom: null,
    marking_start: null,
    marking_end: null,
    tambur_code: null,
  };

  // Pattern 1: Tambur with manufacturer (##E1200 ELP 0-1083 1083 M)
  const tamburPattern = /^##([A-Z0-9]+)\s+([A-Z]+)\s+(\d+)-(\d+)\s+(\d+(?:\.\d+)?)\s*([A-Z]+)?$/i;
  const tamburMatch = lotString.match(tamburPattern);
  
  if (tamburMatch) {
    result.packaging_type = 'TAMBUR';
    result.tambur_code = tamburMatch[1]; // E1200
    result.manufacturer = expandManufacturerCode(tamburMatch[2]); // ELP → Electroplast
    result.marking_start = parseInt(tamburMatch[3]); // 0
    result.marking_end = parseInt(tamburMatch[4]); // 1083
    result.length = parseFloat(tamburMatch[5]); // 1083
    result.length_uom = tamburMatch[6] ? tamburMatch[6].toUpperCase() : 'M'; // M
    return result;
  }

  // Pattern 2: Producer with # prefix (# TOP CABLE, ##CABTEC, ##ELP)
  const producerPattern = /^#{1,2}\s*([A-Z][A-Z\s]+)$/i;
  const producerMatch = lotString.match(producerPattern);
  
  if (producerMatch) {
    result.packaging_type = 'PRODUCER_LOT';
    result.manufacturer = producerMatch[1].trim();
    return result;
  }

  // Pattern 3: Colac with length (COLAC PRVSMIAN 125 ML)
  const colacPattern = /^COLAC\s+([A-Z]+)\s+(\d+(?:\.\d+)?)\s*([A-Z]+)?$/i;
  const colacMatch = lotString.match(colacPattern);
  
  if (colacMatch) {
    result.packaging_type = 'COLAC';
    result.manufacturer = colacMatch[1]; // PRVSMIAN
    result.length = parseFloat(colacMatch[2]); // 125
    result.length_uom = colacMatch[3] ? colacMatch[3].toUpperCase() : 'ML'; // ML
    return result;
  }

  // Pattern 4: Simple length format (500 ML UNPA)
  const simpleLengthPattern = /^(\d+(?:\.\d+)?)\s*([A-Z]+)\s+([A-Z]+)$/i;
  const simpleLengthMatch = lotString.match(simpleLengthPattern);
  
  if (simpleLengthMatch) {
    result.packaging_type = 'BUNDLE';
    result.length = parseFloat(simpleLengthMatch[1]); // 500
    result.length_uom = simpleLengthMatch[2]; // ML
    result.manufacturer = simpleLengthMatch[3]; // UNPA
    return result;
  }

  // Pattern 5: Manufacturer only (TAMBUR E1200)
  const manufacturerOnlyPattern = /^(TAMBUR|COLAC)\s+([A-Z0-9\s]+)$/i;
  const manufacturerOnlyMatch = lotString.match(manufacturerOnlyPattern);
  
  if (manufacturerOnlyMatch) {
    result.packaging_type = manufacturerOnlyMatch[1].toUpperCase();
    result.tambur_code = manufacturerOnlyMatch[2].trim();
    return result;
  }

  // No pattern matched - return as simple lot number
  return result;
};

/**
 * Expand manufacturer short codes to full names
 */
const expandManufacturerCode = (code) => {
  const manufacturers = {
    'ELP': 'Electroplast',
    'PRVSMIAN': 'Prysmian',
    'CABTEC': 'Cabtec',
    'ICME': 'ICME',
    'RCB': 'RCB',
    'VLGCONDUSE': 'VLG Conduse',
    'PGA': 'PGA',
    'ENG': 'ENG',
    'POLYTRADE': 'Polytrade',
    'PROEB': 'Proeb',
    'INALT': 'Inalt',
  };

  const upperCode = code.toUpperCase();
  return manufacturers[upperCode] || code;
};

/**
 * Generate smart description based on lot information
 */
const generateSmartDescription = (name, lotInfo) => {
  const parts = [name];

  if (lotInfo.packaging_type) {
    if (lotInfo.packaging_type === 'TAMBUR' && lotInfo.tambur_code) {
      parts.push(`Tambur ${lotInfo.tambur_code}`);
    } else if (lotInfo.packaging_type === 'COLAC') {
      parts.push('Colac');
    }
  }

  if (lotInfo.manufacturer) {
    parts.push(`- ${lotInfo.manufacturer}`);
  }

  if (lotInfo.length && lotInfo.length_uom) {
    parts.push(`${lotInfo.length} ${lotInfo.length_uom}`);
  }

  if (lotInfo.marking_start !== null && lotInfo.marking_end !== null) {
    parts.push(`(marcat ${lotInfo.marking_start}-${lotInfo.marking_end})`);
  }

  return parts.join(' ');
};

module.exports = {
  parseLotIntrare,
  expandManufacturerCode,
  generateSmartDescription,
};
