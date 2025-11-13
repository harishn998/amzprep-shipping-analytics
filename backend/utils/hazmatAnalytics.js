// ============================================================================
// HAZMAT ANALYTICS - Generate hazmat-specific insights
// File: backend/utils/hazmatAnalytics.js
// ============================================================================

/**
 * HazmatAnalytics - Generates analytics and insights specifically for
 * hazmat/dangerous goods shipments
 */
class HazmatAnalytics {

  /**
   * Generate comprehensive hazmat analysis
   * @param {Object} hazmatClassification - From HazmatClassifier
   * @param {Array} shipments - Enriched shipment data
   * @returns {Object} - Complete hazmat analytics
   */
  generateHazmatAnalysis(hazmatClassification, shipments) {
    console.log('📊 Generating hazmat analytics...');

    const analysis = {
      // Product-level metrics
      products: {
        total: hazmatClassification.total,
        hazmat: hazmatClassification.summary.hazmatCount,
        nonHazmat: hazmatClassification.summary.nonHazmatCount,
        noData: hazmatClassification.summary.noDataCount,
        percentHazmat: this.calculatePercentage(
          hazmatClassification.summary.hazmatCount,
          hazmatClassification.total
        )
      },

      // Hazmat type breakdown
      typeBreakdown: this.generateTypeBreakdown(hazmatClassification),

      // Dangerous goods class breakdown
      dgClassBreakdown: this.generateDGClassBreakdown(hazmatClassification),

      // Confidence level breakdown
      confidenceBreakdown: hazmatClassification.summary.byConfidence,

      // Shipment-level metrics
      shipments: this.generateShipmentMetrics(shipments),

      // Geographic analysis
      geographic: this.generateGeographicAnalysis(shipments),

      // Compliance insights
      compliance: this.generateComplianceInsights(hazmatClassification),

      // Recommendations
      recommendations: this.generateRecommendations(hazmatClassification, shipments)
    };

    console.log('✅ Hazmat analytics complete');
    return analysis;
  }

  /**
   * Calculate percentage
   */
  calculatePercentage(value, total) {
    return total > 0 ? parseFloat(((value / total) * 100).toFixed(2)) : 0;
  }

  /**
   * Generate type breakdown
   */
  generateTypeBreakdown(hazmatClassification) {
    const total = hazmatClassification.summary.hazmatCount;
    const breakdown = [];

    Object.entries(hazmatClassification.summary.byType).forEach(([type, count]) => {
      breakdown.push({
        type,
        count,
        percentage: this.calculatePercentage(count, total)
      });
    });

    // Sort by count descending
    return breakdown.sort((a, b) => b.count - a.count);
  }

  /**
   * Generate DG class breakdown
   */
  generateDGClassBreakdown(hazmatClassification) {
    const total = hazmatClassification.summary.hazmatCount;
    const breakdown = [];

    Object.entries(hazmatClassification.summary.byClass).forEach(([dgClass, count]) => {
      breakdown.push({
        class: dgClass,
        count,
        percentage: this.calculatePercentage(count, total)
      });
    });

    return breakdown.sort((a, b) => b.count - a.count);
  }

  /**
   * Generate shipment-level metrics
   */
  generateShipmentMetrics(shipments) {
    const hazmatShipments = shipments.filter(s => s.containsHazmat);
    const nonHazmatShipments = shipments.filter(s => s.containsHazmat === false);

    return {
      total: shipments.length,
      hazmat: hazmatShipments.length,
      nonHazmat: nonHazmatShipments.length,
      percentHazmat: this.calculatePercentage(hazmatShipments.length, shipments.length),

      // Calculate average metrics for hazmat shipments
      hazmatMetrics: {
        avgUnits: this.calculateAverage(hazmatShipments, 'units'),
        avgPallets: this.calculateAverage(hazmatShipments, 'calculatedPallets'),
        avgCuft: this.calculateAverage(hazmatShipments, 'cuft'),
        avgCost: this.calculateAverage(hazmatShipments, 'currentTotalCost')
      },

      // Calculate average metrics for non-hazmat shipments
      nonHazmatMetrics: {
        avgUnits: this.calculateAverage(nonHazmatShipments, 'units'),
        avgPallets: this.calculateAverage(nonHazmatShipments, 'calculatedPallets'),
        avgCuft: this.calculateAverage(nonHazmatShipments, 'cuft'),
        avgCost: this.calculateAverage(nonHazmatShipments, 'currentTotalCost')
      }
    };
  }

  /**
   * Calculate average of a field across shipments
   */
  calculateAverage(shipments, field) {
    if (shipments.length === 0) return 0;

    const sum = shipments.reduce((acc, s) => acc + (s[field] || 0), 0);
    return parseFloat((sum / shipments.length).toFixed(2));
  }

  /**
   * Generate geographic analysis for hazmat
   */
  generateGeographicAnalysis(shipments) {
    const hazmatShipments = shipments.filter(s => s.containsHazmat);
    const stateBreakdown = {};

    hazmatShipments.forEach(shipment => {
      const state = shipment.destinationState || 'Unknown';

      if (!stateBreakdown[state]) {
        stateBreakdown[state] = {
          state,
          count: 0,
          units: 0,
          cuft: 0,
          cost: 0
        };
      }

      stateBreakdown[state].count++;
      stateBreakdown[state].units += shipment.units || 0;
      stateBreakdown[state].cuft += shipment.cuft || 0;
      stateBreakdown[state].cost += shipment.currentTotalCost || 0;
    });

    // Convert to array and add percentages
    const total = hazmatShipments.length;
    const states = Object.values(stateBreakdown).map(state => ({
      ...state,
      percentage: this.calculatePercentage(state.count, total)
    }));

    return {
      states: states.sort((a, b) => b.count - a.count),
      topStates: states.slice(0, 5)
    };
  }

  /**
   * Generate compliance insights
   */
  generateComplianceInsights(hazmatClassification) {
    const insights = [];

    // High confidence hazmat products
    const highConfidence = hazmatClassification.summary.byConfidence.high || 0;
    if (highConfidence > 0) {
      insights.push({
        type: 'info',
        title: 'High Confidence Classifications',
        message: `${highConfidence} products have high-confidence hazmat classification based on explicit flags or DG storage types.`,
        priority: 'low'
      });
    }

    // Low confidence products need review
    const lowConfidence = hazmatClassification.summary.byConfidence.low || 0;
    if (lowConfidence > 0) {
      insights.push({
        type: 'warning',
        title: 'Manual Review Recommended',
        message: `${lowConfidence} products have low-confidence hazmat classification. Consider manual verification with Amazon Seller Central.`,
        priority: 'medium'
      });
    }

    // Aerosols require special handling
    const aerosols = hazmatClassification.summary.byType['Aerosol'] || 0;
    if (aerosols > 0) {
      insights.push({
        type: 'warning',
        title: 'Aerosol Handling Requirements',
        message: `${aerosols} aerosol products identified. These require Division 2.1 classification and special shipping/storage protocols.`,
        priority: 'high'
      });
    }

    // Flammable liquids compliance
    const flammable = hazmatClassification.summary.byType['Flammable Liquid'] || 0;
    if (flammable > 0) {
      insights.push({
        type: 'warning',
        title: 'Flammable Liquid Compliance',
        message: `${flammable} flammable liquid products (Class 3). Ensure compliance with DOT/IATA regulations for flash point testing and labeling.`,
        priority: 'high'
      });
    }

    // Products with no data
    if (hazmatClassification.summary.noDataCount > 0) {
      insights.push({
        type: 'error',
        title: 'Missing Product Data',
        message: `${hazmatClassification.summary.noDataCount} products have insufficient data for classification. Update product information in Storage tab.`,
        priority: 'high'
      });
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(hazmatClassification, shipments) {
    const recommendations = [];

    const hazmatCount = hazmatClassification.summary.hazmatCount;
    const totalProducts = hazmatClassification.total;
    const hazmatPercent = this.calculatePercentage(hazmatCount, totalProducts);

    // High hazmat percentage
    if (hazmatPercent > 30) {
      recommendations.push({
        type: 'strategy',
        title: 'Consider Hazmat-Specialized Warehousing',
        description: `${hazmatPercent}% of your products are hazmat. Consider using a warehouse with dedicated hazmat storage capabilities to reduce compliance costs and improve efficiency.`,
        impact: 'high',
        estimatedSavings: null
      });
    }

    // Multiple DG classes
    const dgClassCount = Object.keys(hazmatClassification.summary.byClass).length;
    if (dgClassCount > 2) {
      recommendations.push({
        type: 'compliance',
        title: 'Multi-Class DG Training Required',
        description: `You have ${dgClassCount} different dangerous goods classes. Ensure your team is trained on handling requirements for each classification.`,
        impact: 'medium',
        estimatedSavings: null
      });
    }

    // Aerosol-specific recommendation
    const aerosols = hazmatClassification.summary.byType['Aerosol'] || 0;
    if (aerosols > 10) {
      recommendations.push({
        type: 'optimization',
        title: 'Optimize Aerosol Shipping',
        description: `With ${aerosols} aerosol products, consider consolidating shipments to reduce per-unit hazmat fees. AMZ Prep can help optimize aerosol handling and reduce costs.`,
        impact: 'high',
        estimatedSavings: aerosols * 0.50 // Estimate $0.50 savings per unit
      });
    }

    return recommendations;
  }

  /**
   * Generate hazmat pivot table data (matching manual process)
   */
  generateHazmatPivotData(shipments) {
    const hazmatShipments = shipments.filter(s => s.containsHazmat);
    const nonHazmatShipments = shipments.filter(s => !s.containsHazmat);
    const noDataShipments = shipments.filter(s => s.containsHazmat === null);

    return {
      byHazmatStatus: [
        {
          status: 'Hazmat',
          count: hazmatShipments.length,
          percentage: this.calculatePercentage(hazmatShipments.length, shipments.length),
          units: this.sumField(hazmatShipments, 'units'),
          pallets: this.sumField(hazmatShipments, 'calculatedPallets'),
          cuft: this.sumField(hazmatShipments, 'cuft'),
          totalCost: this.sumField(hazmatShipments, 'currentTotalCost')
        },
        {
          status: 'Not Hazmat',
          count: nonHazmatShipments.length,
          percentage: this.calculatePercentage(nonHazmatShipments.length, shipments.length),
          units: this.sumField(nonHazmatShipments, 'units'),
          pallets: this.sumField(nonHazmatShipments, 'calculatedPallets'),
          cuft: this.sumField(nonHazmatShipments, 'cuft'),
          totalCost: this.sumField(nonHazmatShipments, 'currentTotalCost')
        },
        {
          status: 'No data',
          count: noDataShipments.length,
          percentage: this.calculatePercentage(noDataShipments.length, shipments.length),
          units: this.sumField(noDataShipments, 'units'),
          pallets: this.sumField(noDataShipments, 'calculatedPallets'),
          cuft: this.sumField(noDataShipments, 'cuft'),
          totalCost: this.sumField(noDataShipments, 'currentTotalCost')
        }
      ]
    };
  }

  /**
   * Sum a field across shipments
   */
  sumField(shipments, field) {
    return parseFloat(
      shipments.reduce((sum, s) => sum + (s[field] || 0), 0).toFixed(2)
    );
  }
}

export default HazmatAnalytics;
