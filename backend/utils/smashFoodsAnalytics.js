// ============================================================================
// SMASH FOODS ANALYTICS - Generate insights and recommendations
// File: backend/utils/smashFoodsAnalytics.js
// ============================================================================

/**
 * SmashFoodsAnalytics - Generate intelligent recommendations and insights
 * from Smash Foods shipment data analysis
 */
class SmashFoodsAnalytics {

  /**
   * Generate comprehensive recommendations based on analysis
   * @param {Object} analysis - Complete analysis object
   * @param {Array} shipments - Array of shipment objects
   * @returns {Array} - Array of recommendation objects
   */
  generateRecommendations(analysis, shipments) {
    const recommendations = [];

    // 1. Cost Savings Recommendation
    if (analysis.savings && analysis.savings.amount > 0) {
      recommendations.push({
        type: 'cost_savings',
        title: 'Significant Cost Savings Opportunity',
        description: `By switching to AMZ Prep, you can save $${analysis.savings.amount.toLocaleString()} (${analysis.savings.percent}%) on your total shipping costs. This includes optimized pallet handling, internal transfers, and middle-mile transport.`,
        impact: analysis.savings.amount > 5000 ? 'high' : analysis.savings.amount > 2000 ? 'medium' : 'low',
        savings: analysis.savings.amount,
        savingsPercent: analysis.savings.percent
      });
    }

    // 2. Transit Time Improvement
    if (analysis.transitImprovement && analysis.transitImprovement.improvementDays > 0) {
      recommendations.push({
        type: 'transit_time',
        title: 'Faster Transit Times',
        description: `AMZ Prep can reduce your average transit time from ${analysis.transitImprovement.currentTransitDays} days to ${analysis.transitImprovement.amzPrepTransitDays} days - a ${analysis.transitImprovement.improvementPercent}% improvement. This means your products reach Amazon warehouses ${analysis.transitImprovement.improvementDays} days faster.`,
        impact: analysis.transitImprovement.improvementDays > 20 ? 'high' : analysis.transitImprovement.improvementDays > 10 ? 'medium' : 'low',
        improvement: analysis.transitImprovement.improvementDays,
        improvementPercent: analysis.transitImprovement.improvementPercent
      });
    }

    // 3. Prep Time Analysis
    const avgPrepTime = this.calculateAvgPrepTime(shipments);
    if (avgPrepTime > 5) {
      recommendations.push({
        type: 'prep_time',
        title: 'Reduce Prep Time Gap',
        description: `Your current average prep time is ${avgPrepTime} days between order creation and shipment. AMZ Prep's streamlined process can reduce this significantly, getting your inventory to Amazon faster.`,
        impact: avgPrepTime > 10 ? 'high' : avgPrepTime > 7 ? 'medium' : 'low',
        currentPrepTime: avgPrepTime,
        targetPrepTime: 2
      });
    }

    // 4. Placement Fee Optimization
    const splitShipmentRate = this.calculateSplitShipmentRate(shipments);
    if (splitShipmentRate > 50) {
      recommendations.push({
        type: 'consolidation',
        title: 'Optimize Placement Fees',
        description: `${splitShipmentRate}% of your shipments incurred placement fees due to splitting. AMZ Prep's strategic location in Columbus, OH can help reduce split shipments and associated fees.`,
        impact: 'high',
        splitRate: splitShipmentRate
      });
    }

    // 5. State-Specific Routing
    const topStates = this.getTopDestinationStates(analysis.stateBreakdown);
    if (topStates.length > 0) {
      const topState = topStates[0];
      recommendations.push({
        type: 'routing',
        title: 'Geographic Optimization',
        description: `Your top destination is ${topState.state} with ${topState.percentage}% of shipments. AMZ Prep's central location provides better coverage to all major regions, especially the ${topState.state} area.`,
        impact: 'medium',
        topState: topState.state,
        percentage: topState.percentage
      });
    }

    // 6. Volume Discount Opportunity
    const totalUnits = shipments.reduce((sum, s) => sum + s.units, 0);
    if (totalUnits > 50000) {
      recommendations.push({
        type: 'volume_discount',
        title: 'Volume Discount Eligibility',
        description: `With ${totalUnits.toLocaleString()} units shipped, you qualify for volume discounts. Contact AMZ Prep to discuss custom pricing that could increase your savings even further.`,
        impact: 'medium',
        totalUnits
      });
    }

    return recommendations;
  }

  /**
   * Calculate average prep time (time between created and shipped)
   */
  calculateAvgPrepTime(shipments) {
    const validShipments = shipments.filter(s => s.createdDate && s.checkedInDate);
    if (validShipments.length === 0) return 0;

    const totalPrepTime = validShipments.reduce((sum, s) => {
      // Prep time is typically 3-7 days before transit
      return sum + Math.max(0, s.transitDays - 20); // Rough estimate
    }, 0);

    return Math.round(totalPrepTime / validShipments.length);
  }

  /**
   * Calculate split shipment rate (percentage with placement fees)
   */
  calculateSplitShipmentRate(shipments) {
    const shipmentsWithPlacementFees = shipments.filter(s => s.placementFees > 0);
    return Math.round((shipmentsWithPlacementFees.length / shipments.length) * 100);
  }

  /**
   * Get top destination states sorted by shipment count
   */
  getTopDestinationStates(stateBreakdown) {
    const totalShipments = Object.values(stateBreakdown).reduce((sum, s) => sum + s.count, 0);

    const states = Object.values(stateBreakdown).map(state => ({
      state: state.state,
      count: state.count,
      units: state.units,
      pallets: state.pallets,
      percentage: Math.round((state.count / totalShipments) * 100),
      avgTransitDays: state.avgTransitDays
    }));

    return states.sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze carrier performance
   */
  analyzeCarrierPerformance(shipments) {
    const carrierData = {};

    shipments.forEach(shipment => {
      const carrier = shipment.carrier || 'Unknown';

      if (!carrierData[carrier]) {
        carrierData[carrier] = {
          carrier,
          count: 0,
          avgTransitDays: 0,
          totalCost: 0
        };
      }

      carrierData[carrier].count += 1;
      carrierData[carrier].avgTransitDays += shipment.transitDays;
      carrierData[carrier].totalCost += shipment.carrierCost;
    });

    // Calculate averages
    Object.keys(carrierData).forEach(carrier => {
      carrierData[carrier].avgTransitDays = Math.round(
        carrierData[carrier].avgTransitDays / carrierData[carrier].count
      );
      carrierData[carrier].avgCost = Math.round(
        carrierData[carrier].totalCost / carrierData[carrier].count
      );
    });

    return Object.values(carrierData).sort((a, b) => b.count - a.count);
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(analysis, shipments) {
    const totalShipments = shipments.length;
    const totalUnits = shipments.reduce((sum, s) => sum + s.units, 0);
    const totalPallets = shipments.reduce((sum, s) => sum + s.calculatedPallets, 0);

    const topStates = this.getTopDestinationStates(analysis.stateBreakdown);
    const carriers = this.analyzeCarrierPerformance(shipments);

    return {
      overview: {
        totalShipments,
        totalUnits,
        totalPallets: Math.round(totalPallets),
        analysisTimeframe: this.getTimeframe(shipments),
        topDestination: topStates[0]?.state || 'Unknown',
        primaryCarrier: carriers[0]?.carrier || 'Unknown'
      },

      costComparison: {
        currentTotal: analysis.currentCosts.totalCost,
        proposedTotal: analysis.proposedCosts.totalCost,
        savings: analysis.savings.amount,
        savingsPercent: analysis.savings.percent
      },

      efficiency: {
        currentAvgTransit: analysis.transitImprovement.currentTransitDays,
        proposedAvgTransit: analysis.transitImprovement.amzPrepTransitDays,
        transitImprovement: analysis.transitImprovement.improvementDays,
        splitShipmentRate: this.calculateSplitShipmentRate(shipments)
      },

      topStates: topStates.slice(0, 5),
      carriers: carriers.slice(0, 3)
    };
  }

  /**
   * Get timeframe of shipments
   */
  getTimeframe(shipments) {
    const validDates = shipments
      .map(s => s.createdDate)
      .filter(d => d !== null)
      .map(d => new Date(d));

    if (validDates.length === 0) return 'Unknown';

    const earliest = new Date(Math.min(...validDates));
    const latest = new Date(Math.max(...validDates));

    return {
      start: earliest.toISOString().split('T')[0],
      end: latest.toISOString().split('T')[0],
      days: Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24))
    };
  }

  /**
   * Generate detailed insights for dashboard display
   */
  generateDashboardInsights(analysis, shipments) {
    const executiveSummary = this.generateExecutiveSummary(analysis, shipments);
    const recommendations = this.generateRecommendations(analysis, shipments);

    return {
      // Key metrics for display
      keyMetrics: {
        totalSavings: analysis.savings.amount,
        savingsPercent: analysis.savings.percent,
        transitImprovement: analysis.transitImprovement.improvementDays,
        transitImprovementPercent: analysis.transitImprovement.improvementPercent,
        totalShipments: executiveSummary.overview.totalShipments,
        totalUnits: executiveSummary.overview.totalUnits,
        totalPallets: executiveSummary.overview.totalPallets
      },

      // Cost breakdown
      costs: {
        current: {
          freight: analysis.currentCosts.totalFreight,
          placement: analysis.currentCosts.totalPlacementFees,
          total: analysis.currentCosts.totalCost,
          perCuft: analysis.currentMetrics.costPerCuft,
          perUnit: analysis.currentMetrics.costPerUnit,
          perPallet: analysis.currentMetrics.costPerPallet
        },
        proposed: {
          pallets: analysis.proposedCosts.palletCost,
          cuft: analysis.proposedCosts.cuftCost,
          prep: analysis.proposedCosts.prepCost,
          middleMile: analysis.proposedCosts.middleMileCost,
          total: analysis.proposedCosts.totalCost,
          perCuft: analysis.proposedMetrics.costPerCuft,
          perUnit: analysis.proposedMetrics.costPerUnit,
          perPallet: analysis.proposedMetrics.costPerPallet
        }
      },

      // Geographic insights
      geographic: {
        topStates: executiveSummary.topStates,
        stateBreakdown: analysis.stateBreakdown
      },

      // Performance metrics
      performance: {
        currentTransit: executiveSummary.efficiency.currentAvgTransit,
        proposedTransit: executiveSummary.efficiency.proposedAvgTransit,
        splitRate: executiveSummary.efficiency.splitShipmentRate,
        carriers: executiveSummary.carriers
      },

      // Recommendations
      recommendations,

      // Executive summary
      executiveSummary
    };
  }
}

export default SmashFoodsAnalytics;
