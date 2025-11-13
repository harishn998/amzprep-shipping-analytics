// ============================================================================
// HAZMAT CLASSIFIER - FIXED VERSION WITH ACCURATE DETECTION
// File: backend/utils/hazmatClassifier.js
// ============================================================================

/**
 * HazmatClassifier - FIXED VERSION
 *
 * KEY CHANGES:
 * 1. Uses Hazmat sheet as source of truth when available
 * 2. Falls back to dangerous_goods_storage_type in Storage sheet
 * 3. Uses Placement sheet "Hazmat" column
 * 4. Improved ASIN-to-shipment mapping
 * 5. More accurate classification logic
 */
class HazmatClassifier {

  constructor() {
    // Hazmat keywords for product name analysis (LOW PRIORITY)
    this.hazmatKeywords = [
      'aerosol', 'spray', 'flammable', 'perfume', 'cologne', 'fragrance',
      'alcohol', 'battery', 'lithium', 'compressed', 'oxidizer', 'corrosive',
      'eau de toilette', 'eau de parfum', 'mist'
    ];

    // Dangerous goods categories (Amazon classification)
    this.dgCategories = {
      'aerosol': {
        class: 'Division 2.1',
        name: 'Aerosol',
        description: 'Pressurized containers with flammable propellants'
      },
      'aerosols': {
        class: 'Division 2.1',
        name: 'Aerosol',
        description: 'Pressurized containers with flammable propellants'
      },
      'flammable': {
        class: 'Class 3',
        name: 'Flammable Liquid',
        description: 'Liquids with flash point below 140°F'
      },
      'flammable liquid': {
        class: 'Class 3',
        name: 'Flammable Liquid',
        description: 'Liquids with flash point below 140°F'
      },
      'flammable solid': {
        class: 'Class 4',
        name: 'Flammable Solid',
        description: 'Solids that can ignite easily'
      },
      'oxidizer': {
        class: 'Class 5',
        name: 'Oxidizing Substance',
        description: 'Substances that can cause or enhance combustion'
      },
      'corrosive': {
        class: 'Class 8',
        name: 'Corrosive Material',
        description: 'Materials that can corrode metals or damage skin'
      },
      'battery': {
        class: 'Class 9',
        name: 'Lithium Battery',
        description: 'Lithium metal or lithium ion batteries'
      },
      'lithium': {
        class: 'Class 9',
        name: 'Lithium Battery',
        description: 'Lithium metal or lithium ion batteries'
      }
    };
  }

  /**
   * NEW: Build hazmat reference from Hazmat sheet (if available)
   * This is the MOST ACCURATE source
   */
  buildHazmatReferenceFromHazmatSheet(hazmatSheetData) {
    if (!hazmatSheetData || hazmatSheetData.length === 0) {
      console.log('⚠️  No Hazmat sheet data provided');
      return new Map();
    }

    console.log(`🔬 Building hazmat reference from Hazmat sheet (${hazmatSheetData.length} entries)`);

    const hazmatReference = new Map();

    hazmatSheetData.forEach(item => {
      if (item.asin) {
        hazmatReference.set(item.asin, {
          isHazmat: true,
          type: this.normalizeStorageType(item.storage_type || item.storageType),
          source: 'hazmat_sheet',
          confidence: 'high',
          productName: item.product_name || item.productName || ''
        });
      }
    });

    console.log(`✅ Hazmat reference built: ${hazmatReference.size} ASINs`);
    return hazmatReference;
  }

  /**
   * NEW: Normalize storage type to standard names
   */
  normalizeStorageType(storageType) {
    if (!storageType) return null;

    const normalized = String(storageType).toLowerCase().trim();

    if (normalized.includes('aerosol')) return 'Aerosol';
    if (normalized.includes('flammable')) return 'Flammable Liquid';
    if (normalized.includes('corrosive')) return 'Corrosive';
    if (normalized.includes('oxidizer')) return 'Oxidizer';
    if (normalized.includes('battery') || normalized.includes('lithium')) return 'Lithium Battery';

    return storageType; // Return as-is if not recognized
  }

  /**
   * IMPROVED: Classify a single product with reference data
   */
  classifyProduct(storageItem, hazmatReference = null) {
    const classification = {
      asin: storageItem.asin || '',
      fnsku: storageItem.fnsku || '',
      productName: storageItem.product_name || '',
      isHazmat: false,
      hazmatType: null,
      storageType: null,
      dangerousGoodsClass: null,
      dangerousGoodsName: null,
      confidence: 'low',
      reasons: []
    };

    let confidenceScore = 0;

    // ========================================================================
    // RULE 1: Check hazmat reference (HIGHEST PRIORITY - if available)
    // ========================================================================
    if (hazmatReference && storageItem.asin && hazmatReference.has(storageItem.asin)) {
      const refData = hazmatReference.get(storageItem.asin);
      classification.isHazmat = true;
      classification.hazmatType = refData.type;
      classification.storageType = refData.type;
      classification.confidence = 'high';
      classification.reasons.push('Listed in Hazmat reference sheet');
      confidenceScore = 100;

      // Get DG class info
      const dgInfo = this.categorizeDangerousGoods(refData.type);
      classification.dangerousGoodsClass = dgInfo.class;
      classification.dangerousGoodsName = dgInfo.name;

      return classification; // Early return - we have definitive answer
    }

    // ========================================================================
    // RULE 2: Check explicit Hazmat field
    // ========================================================================
    if (storageItem.Hazmat) {
      const hazmatValue = String(storageItem.Hazmat).trim().toLowerCase();
      if (hazmatValue === 'yes' || hazmatValue === 'true' || hazmatValue === '1') {
        classification.isHazmat = true;
        classification.reasons.push('Explicit Hazmat flag = Yes');
        confidenceScore += 50;
      }
    }

    // ========================================================================
    // RULE 3: Check dangerous_goods_storage_type (HIGH PRIORITY)
    // ========================================================================
    if (storageItem.dangerous_goods_storage_type) {
      const dgType = String(storageItem.dangerous_goods_storage_type).trim();

      // Only consider as hazmat if dgType is meaningful
      if (dgType &&
          dgType !== '--' &&
          dgType !== 'None' &&
          dgType !== 'N/A' &&
          dgType !== 'not applicable' &&
          dgType !== '') {

        classification.isHazmat = true;
        classification.storageType = this.normalizeStorageType(dgType);
        classification.reasons.push(`DG Storage Type: ${dgType}`);
        confidenceScore += 40;

        // Determine DG class and name
        const dgInfo = this.categorizeDangerousGoods(dgType);
        classification.dangerousGoodsClass = dgInfo.class;
        classification.dangerousGoodsName = dgInfo.name;
        classification.hazmatType = dgInfo.name;
      }
    }

    // ========================================================================
    // RULE 4: Check product_size_tier for hazmat indicators
    // ========================================================================
    if (storageItem.product_size_tier) {
      const sizeTier = String(storageItem.product_size_tier).toLowerCase();

      if (sizeTier.includes('aerosol')) {
        classification.isHazmat = true;
        classification.hazmatType = classification.hazmatType || 'Aerosol';
        classification.reasons.push('Size tier contains: Aerosol');
        confidenceScore += 30;
      }

      if (sizeTier.includes('flammable')) {
        classification.isHazmat = true;
        classification.hazmatType = classification.hazmatType || 'Flammable Liquid';
        classification.reasons.push('Size tier contains: Flammable');
        confidenceScore += 30;
      }
    }

    // ========================================================================
    // RULE 5: Product name keyword analysis (LOWEST PRIORITY)
    // Only use if no other indicators found
    // ========================================================================
    if (confidenceScore < 30 && storageItem.product_name) {
      const productName = String(storageItem.product_name).toLowerCase();

      for (const keyword of this.hazmatKeywords) {
        if (productName.includes(keyword)) {
          // Don't automatically classify as hazmat based on keywords
          // Just flag for review
          classification.reasons.push(`Product name contains: "${keyword}"`);
          confidenceScore += 5;
          break;
        }
      }
    }

    // ========================================================================
    // Determine confidence level
    // ========================================================================
    if (confidenceScore >= 50) {
      classification.confidence = 'high';
    } else if (confidenceScore >= 30) {
      classification.confidence = 'medium';
    } else if (confidenceScore > 0) {
      classification.confidence = 'low';
    }

    return classification;
  }

  /**
   * Categorize dangerous goods and return class/name
   */
  categorizeDangerousGoods(storageType) {
    const type = String(storageType).toLowerCase();

    for (const [keyword, info] of Object.entries(this.dgCategories)) {
      if (type.includes(keyword)) {
        return info;
      }
    }

    // Default for unknown types
    return {
      class: 'Unknown',
      name: 'Other Dangerous Goods',
      description: 'Requires manual review'
    };
  }

  /**
   * Get hazmat type from keyword
   */
  getHazmatTypeFromKeyword(keyword) {
    const keywordMap = {
      'aerosol': 'Aerosol',
      'spray': 'Aerosol',
      'flammable': 'Flammable Liquid',
      'perfume': 'Flammable Liquid',
      'cologne': 'Flammable Liquid',
      'fragrance': 'Flammable Liquid',
      'alcohol': 'Flammable Liquid',
      'battery': 'Lithium Battery',
      'lithium': 'Lithium Battery',
      'eau de toilette': 'Flammable Liquid',
      'eau de parfum': 'Flammable Liquid'
    };

    return keywordMap[keyword] || 'Hazmat (General)';
  }

  /**
   * IMPROVED: Classify all products with hazmat reference
   */
  classifyAllProducts(storageData, hazmatReference = null) {
    console.log('🔍 Starting hazmat classification...');
    console.log(`   Total products to classify: ${storageData.length}`);
    if (hazmatReference) {
      console.log(`   Using hazmat reference with ${hazmatReference.size} known hazmat ASINs`);
    }

    const results = {
      total: storageData.length,
      hazmat: [],
      nonHazmat: [],
      noData: [],
      summary: {
        hazmatCount: 0,
        nonHazmatCount: 0,
        noDataCount: 0,
        byType: {},
        byClass: {},
        byConfidence: {
          high: 0,
          medium: 0,
          low: 0
        }
      }
    };

    storageData.forEach(item => {
      // Check if item has minimal data
      if (!item.asin && !item.fnsku && !item.product_name) {
        results.noData.push(item);
        results.summary.noDataCount++;
        return;
      }

      const classification = this.classifyProduct(item, hazmatReference);

      if (classification.isHazmat) {
        results.hazmat.push({
          ...item,
          classification
        });
        results.summary.hazmatCount++;

        // Count by type
        const type = classification.hazmatType || 'Unspecified';
        results.summary.byType[type] = (results.summary.byType[type] || 0) + 1;

        // Count by DG class
        if (classification.dangerousGoodsClass) {
          const dgClass = classification.dangerousGoodsClass;
          results.summary.byClass[dgClass] = (results.summary.byClass[dgClass] || 0) + 1;
        }

        // Count by confidence
        results.summary.byConfidence[classification.confidence]++;

      } else {
        results.nonHazmat.push(item);
        results.summary.nonHazmatCount++;
      }
    });

    console.log('✅ Hazmat classification complete:');
    console.log(`   ✓ Hazmat products: ${results.summary.hazmatCount}`);
    console.log(`   ✓ Non-hazmat products: ${results.summary.nonHazmatCount}`);
    console.log(`   ✓ No data: ${results.summary.noDataCount}`);

    if (Object.keys(results.summary.byType).length > 0) {
      console.log('   📊 Hazmat types found:');
      Object.entries(results.summary.byType).forEach(([type, count]) => {
        console.log(`      - ${type}: ${count}`);
      });
    }

    return results;
  }

  /**
   * Create ASIN → Hazmat lookup map
   */
  createHazmatLookupMap(hazmatClassification) {
    const lookupMap = new Map();

    // Add hazmat products
    hazmatClassification.hazmat.forEach(item => {
      if (item.asin) {
        lookupMap.set(item.asin, {
          isHazmat: true,
          type: item.classification.hazmatType,
          storageType: item.classification.storageType,
          dgClass: item.classification.dangerousGoodsClass,
          confidence: item.classification.confidence
        });
      }
    });

    // Add non-hazmat products
    hazmatClassification.nonHazmat.forEach(item => {
      if (item.asin) {
        lookupMap.set(item.asin, {
          isHazmat: false,
          type: null,
          storageType: null,
          dgClass: null,
          confidence: 'high'
        });
      }
    });

    console.log(`📋 Hazmat lookup map created: ${lookupMap.size} ASINs`);
    return lookupMap;
  }

  /**
   * NEW: Enhanced shipment enrichment with accurate hazmat detection
   */
  enrichShipmentsWithHazmat(shipments, hazmatLookupMap, placementData) {
    console.log('🔗 Enriching shipments with hazmat data...');

    // Build ASIN-to-shipment mapping from placement data
    const shipmentAsinMap = new Map();

    if (placementData && placementData.length > 0) {
      placementData.forEach(item => {
        const shipmentId = item.fbaShipmentID || item.fba_shipment_id;
        const asin = item.asin;

        if (shipmentId && asin) {
          if (!shipmentAsinMap.has(shipmentId)) {
            shipmentAsinMap.set(shipmentId, new Set());
          }
          shipmentAsinMap.get(shipmentId).add(asin);
        }
      });

      console.log(`   Found ASINs for ${shipmentAsinMap.size} shipments`);
    } else {
      console.warn('   ⚠️  No placement data provided - hazmat detection may be incomplete');
    }

    // Enrich each shipment
    const enrichedShipments = shipments.map(shipment => {
      const shipmentAsins = shipmentAsinMap.get(shipment.fbaShipmentID) || new Set();

      let containsHazmat = false;
      let hazmatTypes = new Set();
      let hazmatCount = 0;
      let nonHazmatCount = 0;
      let unknownCount = 0;

      shipmentAsins.forEach(asin => {
        const hazmatInfo = hazmatLookupMap.get(asin);

        if (hazmatInfo) {
          if (hazmatInfo.isHazmat) {
            containsHazmat = true;
            hazmatCount++;
            if (hazmatInfo.type) {
              hazmatTypes.add(hazmatInfo.type);
            }
          } else {
            nonHazmatCount++;
          }
        } else {
          unknownCount++;
        }
      });

      return {
        ...shipment,
        containsHazmat,
        hazmatProductCount: hazmatCount,
        nonHazmatProductCount: nonHazmatCount,
        unknownProductCount: unknownCount,
        hazmatTypes: Array.from(hazmatTypes),
        totalAsins: shipmentAsins.size,
        hazmatPercentage: shipmentAsins.size > 0
          ? Math.round((hazmatCount / shipmentAsins.size) * 100)
          : 0
      };
    });

    const hazmatShipmentCount = enrichedShipments.filter(s => s.containsHazmat).length;
    console.log(`✅ Enrichment complete: ${hazmatShipmentCount} shipments contain hazmat products`);

    return enrichedShipments;
  }

  /**
   * Filter shipments by hazmat status
   */
  filterShipmentsByHazmat(shipments, filterType) {
    if (filterType === 'all') {
      return shipments;
    }

    if (filterType === 'hazmat') {
      return shipments.filter(s => s.containsHazmat === true);
    }

    if (filterType === 'non-hazmat') {
      return shipments.filter(s => s.containsHazmat === false);
    }

    return shipments;
  }

  /**
   * Generate hazmat summary statistics
   */
  generateHazmatSummary(shipments) {
    const summary = {
      totalShipments: shipments.length,
      hazmatShipments: 0,
      nonHazmatShipments: 0,
      mixedShipments: 0,
      percentHazmat: 0,
      byType: {},
      byDGClass: {}
    };

    shipments.forEach(shipment => {
      if (shipment.containsHazmat) {
        summary.hazmatShipments++;

        // Check if mixed (has both hazmat and non-hazmat)
        if (shipment.nonHazmatProductCount > 0) {
          summary.mixedShipments++;
        }

        // Count types
        if (shipment.hazmatTypes) {
          shipment.hazmatTypes.forEach(type => {
            summary.byType[type] = (summary.byType[type] || 0) + 1;
          });
        }
      } else {
        summary.nonHazmatShipments++;
      }
    });

    summary.percentHazmat = summary.totalShipments > 0
      ? parseFloat(((summary.hazmatShipments / summary.totalShipments) * 100).toFixed(2))
      : 0;

    return summary;
  }
}

export default HazmatClassifier;
