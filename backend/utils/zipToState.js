// backend/utils/zipToState.js
// Comprehensive ZIP code to State mapping
const zipRanges = [
  { min: '00600', max: '00799', state: 'Puerto Rico', code: 'PR' },
  { min: '00800', max: '00899', state: 'Virgin Islands', code: 'VI' },
  { min: '01000', max: '02799', state: 'Massachusetts', code: 'MA' },
  { min: '02800', max: '02999', state: 'Rhode Island', code: 'RI' },
  { min: '03000', max: '03899', state: 'New Hampshire', code: 'NH' },
  { min: '03900', max: '04999', state: 'Maine', code: 'ME' },
  { min: '05000', max: '05999', state: 'Vermont', code: 'VT' },
  { min: '06000', max: '06999', state: 'Connecticut', code: 'CT' },
  { min: '07000', max: '08999', state: 'New Jersey', code: 'NJ' },
  { min: '10000', max: '14999', state: 'New York', code: 'NY' },
  { min: '15000', max: '19699', state: 'Pennsylvania', code: 'PA' },
  { min: '19700', max: '19999', state: 'Delaware', code: 'DE' },
  { min: '20000', max: '20599', state: 'District of Columbia', code: 'DC' },
  { min: '20600', max: '21999', state: 'Maryland', code: 'MD' },
  { min: '22000', max: '24699', state: 'Virginia', code: 'VA' },
  { min: '24700', max: '26999', state: 'West Virginia', code: 'WV' },
  { min: '27000', max: '28999', state: 'North Carolina', code: 'NC' },
  { min: '29000', max: '29999', state: 'South Carolina', code: 'SC' },
  { min: '30000', max: '31999', state: 'Georgia', code: 'GA' },
  { min: '32000', max: '34999', state: 'Florida', code: 'FL' },
  { min: '35000', max: '36999', state: 'Alabama', code: 'AL' },
  { min: '37000', max: '38599', state: 'Tennessee', code: 'TN' },
  { min: '38600', max: '39999', state: 'Mississippi', code: 'MS' },
  { min: '40000', max: '42799', state: 'Kentucky', code: 'KY' },
  { min: '43000', max: '45999', state: 'Ohio', code: 'OH' },
  { min: '46000', max: '47999', state: 'Indiana', code: 'IN' },
  { min: '48000', max: '49999', state: 'Michigan', code: 'MI' },
  { min: '50000', max: '52999', state: 'Iowa', code: 'IA' },
  { min: '53000', max: '54999', state: 'Wisconsin', code: 'WI' },
  { min: '55000', max: '56799', state: 'Minnesota', code: 'MN' },
  { min: '57000', max: '57999', state: 'South Dakota', code: 'SD' },
  { min: '58000', max: '58999', state: 'North Dakota', code: 'ND' },
  { min: '59000', max: '59999', state: 'Montana', code: 'MT' },
  { min: '60000', max: '62999', state: 'Illinois', code: 'IL' },
  { min: '63000', max: '65999', state: 'Missouri', code: 'MO' },
  { min: '66000', max: '67999', state: 'Kansas', code: 'KS' },
  { min: '68000', max: '69999', state: 'Nebraska', code: 'NE' },
  { min: '70000', max: '71599', state: 'Louisiana', code: 'LA' },
  { min: '71600', max: '72999', state: 'Arkansas', code: 'AR' },
  { min: '73000', max: '74999', state: 'Oklahoma', code: 'OK' },
  { min: '75000', max: '79999', state: 'Texas', code: 'TX' },
  { min: '80000', max: '81999', state: 'Colorado', code: 'CO' },
  { min: '82000', max: '83199', state: 'Wyoming', code: 'WY' },
  { min: '83200', max: '83999', state: 'Idaho', code: 'ID' },
  { min: '84000', max: '84999', state: 'Utah', code: 'UT' },
  { min: '85000', max: '86999', state: 'Arizona', code: 'AZ' },
  { min: '87000', max: '88499', state: 'New Mexico', code: 'NM' },
  { min: '88500', max: '89999', state: 'Nevada', code: 'NV' },
  { min: '90000', max: '96199', state: 'California', code: 'CA' },
  { min: '96700', max: '96899', state: 'Hawaii', code: 'HI' },
  { min: '97000', max: '97999', state: 'Oregon', code: 'OR' },
  { min: '98000', max: '99499', state: 'Washington', code: 'WA' },
  { min: '99500', max: '99999', state: 'Alaska', code: 'AK' }
];

export function zipToState(zipCode) {
  if (!zipCode) return null;

  // Clean zip code - remove everything after hyphen and spaces
  const cleanZip = String(zipCode).split('-')[0].trim().padStart(5, '0');

  // Find matching range
  for (const range of zipRanges) {
    if (cleanZip >= range.min && cleanZip <= range.max) {
      return {
        state: range.state,
        code: range.code
      };
    }
  }

  return null;
}

// Calculate shipping zone based on origin and destination
export function calculateZone(originZip, destinationZip) {
  // Simplified zone calculation
  // In reality, carriers have complex zone charts

  if (!originZip || !destinationZip) return 5; // Default

  const originState = zipToState(originZip);
  const destState = zipToState(destinationZip);

  if (!originState || !destState) return 5;

  // Same state = Zone 2
  if (originState.code === destState.code) return 2;

  // Adjacent states = Zone 3-4
  // Far states = Zone 5-8
  // This is simplified - real zone calculation is more complex

  const distance = calculateStateDistance(originState.code, destState.code);

  if (distance < 500) return 3;
  if (distance < 1000) return 4;
  if (distance < 1500) return 5;
  if (distance < 2000) return 6;
  if (distance < 2500) return 7;
  return 8;
}

// Simplified state-to-state distance estimation
function calculateStateDistance(state1, state2) {
  // State center coordinates (latitude, longitude)
  const stateCoords = {
    'AL': [32.806671, -86.791130], 'AK': [61.370716, -152.404419],
    'AZ': [33.729759, -111.431221], 'AR': [34.969704, -92.373123],
    'CA': [36.116203, -119.681564], 'CO': [39.059811, -105.311104],
    'CT': [41.597782, -72.755371], 'DE': [39.318523, -75.507141],
    'FL': [27.766279, -81.686783], 'GA': [33.040619, -83.643074],
    'HI': [21.094318, -157.498337], 'ID': [44.240459, -114.478828],
    'IL': [40.349457, -88.986137], 'IN': [39.849426, -86.258278],
    'IA': [42.011539, -93.210526], 'KS': [38.526600, -96.726486],
    'KY': [37.668140, -84.670067], 'LA': [31.169546, -91.867805],
    'ME': [44.693947, -69.381927], 'MD': [39.063946, -76.802101],
    'MA': [42.230171, -71.530106], 'MI': [43.326618, -84.536095],
    'MN': [45.694454, -93.900192], 'MS': [32.741646, -89.678696],
    'MO': [38.456085, -92.288368], 'MT': [46.921925, -110.454353],
    'NE': [41.125370, -98.268082], 'NV': [38.313515, -117.055374],
    'NH': [43.452492, -71.563896], 'NJ': [40.298904, -74.521011],
    'NM': [34.840515, -106.248482], 'NY': [42.165726, -74.948051],
    'NC': [35.630066, -79.806419], 'ND': [47.528912, -99.784012],
    'OH': [40.388783, -82.764915], 'OK': [35.565342, -96.928917],
    'OR': [44.572021, -122.070938], 'PA': [40.590752, -77.209755],
    'RI': [41.680893, -71.511780], 'SC': [33.856892, -80.945007],
    'SD': [44.299782, -99.438828], 'TN': [35.747845, -86.692345],
    'TX': [31.054487, -97.563461], 'UT': [40.150032, -111.862434],
    'VT': [44.045876, -72.710686], 'VA': [37.769337, -78.169968],
    'WA': [47.400902, -121.490494], 'WV': [38.491226, -80.954456],
    'WI': [44.268543, -89.616508], 'WY': [42.755966, -107.302490]
  };

  const coords1 = stateCoords[state1];
  const coords2 = stateCoords[state2];

  if (!coords1 || !coords2) return 1500; // Default distance

  // Haversine formula for distance
  const R = 3959; // Earth radius in miles
  const lat1 = coords1[0] * Math.PI / 180;
  const lat2 = coords2[0] * Math.PI / 180;
  const dLat = (coords2[0] - coords1[0]) * Math.PI / 180;
  const dLon = (coords2[1] - coords1[1]) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
           Math.cos(lat1) * Math.cos(lat2) *
           Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance);
}

// Estimate transit time based on shipping method and zone
export function estimateTransitTime(shippingMethod, zone) {
  const method = String(shippingMethod).toUpperCase();

  // SPD = Small Parcel Delivery
  if (method.includes('SPD') || method.includes('GROUND')) {
    if (zone <= 2) return 2;
    if (zone <= 4) return 3;
    if (zone <= 6) return 4;
    return 5;
  }

  if (method.includes('EXPRESS') || method.includes('2-DAY')) {
    return 2;
  }

  if (method.includes('OVERNIGHT') || method.includes('NEXT DAY')) {
    return 1;
  }

  // Default
  return 4;
}
