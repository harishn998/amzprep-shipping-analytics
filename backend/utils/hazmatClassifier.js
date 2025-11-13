// ============================================================================
// HAZMAT CLASSIFIER - Amazon Dangerous Goods Classification
// File: backend/utils/hazmatClassifier.js
// ============================================================================

/**
 * HazmatClassifier - Classifies products as hazmat/dangerous goods based on
 * Amazon Seller Central rules and storage tab indicators
 *
 * References:
 * - Amazon Hazmat Guide: https://sellercentral.amazon.com/help/hub/reference/external/G63ZD2BUDXF28WEC
 * - Dangerous Goods ID: https://sellercentral.amazon.com/help/hub/reference/external/G201003400
 */
class HazmatClassifier {

  constructor() {
    // Hazmat keywords for product name analysis
    this.hazmatKeywords = [
      'aerosol', 'spray', 'flammable', 'perfume', 'cologne', 'fragrance',
      'alcohol', 'battery', 'lithium', 'compressed', 'oxidizer', 'corrosive',
      'eau de toilette', 'eau de parfum', 'mist'
    ];

    // Dangerous goods categories (Amazon classification)
    this.dgCategories = {
      'aerosol': {
        class: 'Division 2.1',
        name: 'Flammable Aerosols',
        description: 'Pressurized containers with flammable propellants'
      },
      'flammable': {
        class: 'Class 3',
        name: 'Flammable Liquids',
        description: 'Liquids with flash point below 140°F'
      },
      'flammable liquid': {
        class: 'Class 3',
        name: 'Flammable Liquids',
        description: 'Liquids with flash point below 140°F'
      },
      'flammable solid': {
        class: 'Class 4',
        name: 'Flammable Solids',
        description: 'Solids that can ignite easily'
      },
      'oxidizer': {
        class: 'Class 5',
        name: 'Oxidizing Substances',
        description: 'Substances that can cause or enhance combustion'
      },
      'corrosive': {
        class: 'Class 8',
        name: 'Corrosive Materials',
        description: 'Materials that can corrode metals or damage skin'
      },
      'battery': {
        class: 'Class 9',
        name: 'Lithium Batteries',
        description: 'Lithium metal or lithium ion batteries'
      },
      'lithium': {
        class: 'Class 9',
        name: 'Lithium Batteries',
        description: 'Lithium metal or lithium ion batteries'
      }
    };
  }

  /**
   * Classify a single product as hazmat or non-hazmat
   * @param {Object} storageItem - Item from Storage sheet
   * @returns {Object} - Classification result
   */
  classifyProduct(storageItem) {
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
    // RULE 1: Check explicit Hazmat field (HIGHEST PRIORITY)
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
    // RULE 2: Check dangerous_goods_storage_type (HIGH PRIORITY)
    // ========================================================================
    if (storageItem.dangerous_goods_storage_type) {
      const dgType = String(storageItem.dangerous_goods_storage_type).trim().toLowerCase();

      // Only consider as hazmat if dgType is meaningful
      if (dgType &&
          dgType !== 'none' &&
          dgType !== 'n/a' &&
          dgType !== 'not applicable' &&
          dgType !== '') {

        classification.isHazmat = true;
        classification.storageType = storageItem.dangerous_goods_storage_type;
        classification.reasons.push(`DG Storage Type: ${classification.storageType}`);
        confidenceScore += 40;

        // Determine DG class and name
        const dgInfo = this.categorizeDangerousGoods(dgType);
        classification.dangerousGoodsClass = dgInfo.class;
        classification.dangerousGoodsName = dgInfo.name;
        classification.hazmatType = dgInfo.name;
      }
    }

    // ========================================================================
    // RULE 3: Check product_size_tier for hazmat indicators
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
    // RULE 4: Product name keyword analysis (MEDIUM PRIORITY)
    // ========================================================================
    if (storageItem.product_name) {
      const productName = String(storageItem.product_name).toLowerCase();

      for (const keyword of this.hazmatKeywords) {
        if (productName.includes(keyword)) {
          classification.isHazmat = true;
          classification.hazmatType = classification.hazmatType || this.getHazmatTypeFromKeyword(keyword);
          classification.reasons.push(`Product name contains: "${keyword}"`);
          confidenceScore += 10;
          break; // Only count first keyword match
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
    const type = storageType.toLowerCase();

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
   * Classify all products from storage sheet
   * @param {Array} storageData - Array of items from Storage sheet
   * @returns {Object} - Complete classification results
   */
  classifyAllProducts(storageData) {
    console.log('🔍 Starting hazmat classification...');
    console.log(`   Total products to classify: ${storageData.length}`);

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

      const classification = this.classifyProduct(item);

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
   * @param {Object} hazmatClassification - Result from classifyAllProducts
   * @returns {Map} - Map of ASIN → classification object
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
          dgClass: item.classification.dangerousGoodsClass
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
          dgClass: null
        });
      }
    });

    return lookupMap;
  }

  /**
   * Enrich shipments with hazmat information
   * @param {Array} shipments - Parsed shipment data
   * @param {Map} hazmatLookupMap - ASIN → hazmat info map
   * @returns {Array} - Enriched shipments with hazmat flags
   */
  enrichShipmentsWithHazmat(shipments, hazmatLookupMap) {
    console.log('🔗 Enriching shipments with hazmat data...');

    return shipments.map(shipment => {
      // Determine if shipment contains any hazmat products
      // This requires checking ASINs associated with the shipment

      // For now, we'll use a simple heuristic:
      // Check if shipment name/ID appears in hazmat product list
      // This is a placeholder - actual implementation depends on data structure

      const enriched = {
        ...shipment,
        containsHazmat: false,
        hazmatProducts: [],
        hazmatTypes: new Set()
      };

      // TODO: Implement actual ASIN matching logic here
      // This depends on how ASINs are stored in your Data sheet
      // You may need to parse ASIN columns or match through Placement sheet

      return enriched;
    });
  }

  /**
   * Filter shipments by hazmat status
   * @param {Array} shipments - All shipments
   * @param {String} filterType - 'all', 'hazmat', or 'non-hazmat'
   * @returns {Array} - Filtered shipments
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
   * @param {Array} shipments - Enriched shipments
   * @returns {Object} - Summary statistics
   */
  generateHazmatSummary(shipments) {
    const summary = {
      totalShipments: shipments.length,
      hazmatShipments: 0,
      nonHazmatShipments: 0,
      noDataShipments: 0,
      percentHazmat: 0,
      byType: {},
      byDGClass: {}
    };

    shipments.forEach(shipment => {
      if (shipment.containsHazmat) {
        summary.hazmatShipments++;

        // Count types
        shipment.hazmatTypes.forEach(type => {
          summary.byType[type] = (summary.byType[type] || 0) + 1;
        });
      } else if (shipment.containsHazmat === false) {
        summary.nonHazmatShipments++;
      } else {
        summary.noDataShipments++;
      }
    });

    summary.percentHazmat = summary.totalShipments > 0
      ? ((summary.hazmatShipments / summary.totalShipments) * 100).toFixed(2)
      : 0;

    return summary;
  }
}

export default HazmatClassifier;
