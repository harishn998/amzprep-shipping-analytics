// ============================================================================
// SMASH FOODS INTEGRATION - SOP COMPLIANT VERSION (FIXED)
// File: backend/utils/smashFoodsIntegration.js
//
// FIX: Added zipToStateLookup method for calculateFromZipBreakdown
// ============================================================================

import SmashFoodsParser from './smashFoodsParser.js';
import SmashFoodsCalculator from './smashFoodsCalculator.js'; // Keep for backup
import MiddleMileCalculatorSOP from './middleMileCalculatorSOP.js'; // NEW SOP calculator
import SmashFoodsAnalytics from './smashFoodsAnalytics.js';
import HazmatAnalytics from './hazmatAnalytics.js';
import AmazonRateEnhanced from '../models/AmazonRateEnhanced.js';

/**
 * SmashFoodsIntegration - SOP COMPLIANT VERSION
 */
class SmashFoodsIntegration {

  constructor() {
    this.parser = new SmashFoodsParser();
    this.oldCalculator = new SmashFoodsCalculator(); // Keep for comparison
    this.sopCalculator = new MiddleMileCalculatorSOP(); // NEW SOP calculator
    this.analytics = new SmashFoodsAnalytics();
    this.hazmatAnalytics = new HazmatAnalytics();

    // 🆕 ZIP to State lookup table (first 3 digits)
    this.zip3ToState = {
      '006': 'PR', '007': 'PR', '008': 'VI', '009': 'PR',
      '010': 'MA', '011': 'MA', '012': 'MA', '013': 'MA', '014': 'MA', '015': 'MA', '016': 'MA', '017': 'MA', '018': 'MA', '019': 'MA',
      '020': 'MA', '021': 'MA', '022': 'MA', '023': 'MA', '024': 'MA', '025': 'MA', '026': 'MA', '027': 'MA',
      '028': 'RI', '029': 'RI',
      '030': 'NH', '031': 'NH', '032': 'NH', '033': 'NH', '034': 'NH', '035': 'NH', '036': 'NH', '037': 'NH', '038': 'NH',
      '039': 'ME', '040': 'ME', '041': 'ME', '042': 'ME', '043': 'ME', '044': 'ME', '045': 'ME', '046': 'ME', '047': 'ME', '048': 'ME', '049': 'ME',
      '050': 'VT', '051': 'VT', '052': 'VT', '053': 'VT', '054': 'VT', '055': 'VT', '056': 'VT', '057': 'VT', '058': 'VT', '059': 'VT',
      '060': 'CT', '061': 'CT', '062': 'CT', '063': 'CT', '064': 'CT', '065': 'CT', '066': 'CT', '067': 'CT', '068': 'CT', '069': 'CT',
      '070': 'NJ', '071': 'NJ', '072': 'NJ', '073': 'NJ', '074': 'NJ', '075': 'NJ', '076': 'NJ', '077': 'NJ', '078': 'NJ', '079': 'NJ',
      '080': 'NJ', '081': 'NJ', '082': 'NJ', '083': 'NJ', '084': 'NJ', '085': 'NJ', '086': 'NJ', '087': 'NJ', '088': 'NJ', '089': 'NJ',
      '100': 'NY', '101': 'NY', '102': 'NY', '103': 'NY', '104': 'NY', '105': 'NY', '106': 'NY', '107': 'NY', '108': 'NY', '109': 'NY',
      '110': 'NY', '111': 'NY', '112': 'NY', '113': 'NY', '114': 'NY', '115': 'NY', '116': 'NY', '117': 'NY', '118': 'NY', '119': 'NY',
      '120': 'NY', '121': 'NY', '122': 'NY', '123': 'NY', '124': 'NY', '125': 'NY', '126': 'NY', '127': 'NY', '128': 'NY', '129': 'NY',
      '130': 'NY', '131': 'NY', '132': 'NY', '133': 'NY', '134': 'NY', '135': 'NY', '136': 'NY', '137': 'NY', '138': 'NY', '139': 'NY',
      '140': 'NY', '141': 'NY', '142': 'NY', '143': 'NY', '144': 'NY', '145': 'NY', '146': 'NY', '147': 'NY', '148': 'NY', '149': 'NY',
      '150': 'PA', '151': 'PA', '152': 'PA', '153': 'PA', '154': 'PA', '155': 'PA', '156': 'PA', '157': 'PA', '158': 'PA', '159': 'PA',
      '160': 'PA', '161': 'PA', '162': 'PA', '163': 'PA', '164': 'PA', '165': 'PA', '166': 'PA', '167': 'PA', '168': 'PA', '169': 'PA',
      '170': 'PA', '171': 'PA', '172': 'PA', '173': 'PA', '174': 'PA', '175': 'PA', '176': 'PA', '177': 'PA', '178': 'PA', '179': 'PA',
      '180': 'PA', '181': 'PA', '182': 'PA', '183': 'PA', '184': 'PA', '185': 'PA', '186': 'PA', '187': 'PA', '188': 'PA', '189': 'PA',
      '190': 'PA', '191': 'PA', '192': 'PA', '193': 'PA', '194': 'PA', '195': 'PA', '196': 'PA',
      '197': 'DE', '198': 'DE', '199': 'DE',
      '200': 'DC', '201': 'VA', '202': 'DC', '203': 'DC', '204': 'DC', '205': 'DC',
      '206': 'MD', '207': 'MD', '208': 'MD', '209': 'MD', '210': 'MD', '211': 'MD', '212': 'MD', '214': 'MD', '215': 'MD', '216': 'MD', '217': 'MD', '218': 'MD', '219': 'MD',
      '220': 'VA', '221': 'VA', '222': 'VA', '223': 'VA', '224': 'VA', '225': 'VA', '226': 'VA', '227': 'VA', '228': 'VA', '229': 'VA',
      '230': 'VA', '231': 'VA', '232': 'VA', '233': 'VA', '234': 'VA', '235': 'VA', '236': 'VA', '237': 'VA', '238': 'VA', '239': 'VA',
      '240': 'VA', '241': 'VA', '242': 'VA', '243': 'VA', '244': 'VA', '245': 'VA', '246': 'VA',
      '247': 'WV', '248': 'WV', '249': 'WV', '250': 'WV', '251': 'WV', '252': 'WV', '253': 'WV', '254': 'WV', '255': 'WV', '256': 'WV', '257': 'WV', '258': 'WV', '259': 'WV',
      '260': 'WV', '261': 'WV', '262': 'WV', '263': 'WV', '264': 'WV', '265': 'WV', '266': 'WV', '267': 'WV', '268': 'WV',
      '270': 'NC', '271': 'NC', '272': 'NC', '273': 'NC', '274': 'NC', '275': 'NC', '276': 'NC', '277': 'NC', '278': 'NC', '279': 'NC',
      '280': 'NC', '281': 'NC', '282': 'NC', '283': 'NC', '284': 'NC', '285': 'NC', '286': 'NC', '287': 'NC', '288': 'NC', '289': 'NC',
      '290': 'SC', '291': 'SC', '292': 'SC', '293': 'SC', '294': 'SC', '295': 'SC', '296': 'SC', '297': 'SC', '298': 'SC', '299': 'SC',
      '300': 'GA', '301': 'GA', '302': 'GA', '303': 'GA', '304': 'GA', '305': 'GA', '306': 'GA', '307': 'GA', '308': 'GA', '309': 'GA',
      '310': 'GA', '311': 'GA', '312': 'GA', '313': 'GA', '314': 'GA', '315': 'GA', '316': 'GA', '317': 'GA', '318': 'GA', '319': 'GA',
      '320': 'FL', '321': 'FL', '322': 'FL', '323': 'FL', '324': 'FL', '325': 'FL', '326': 'FL', '327': 'FL', '328': 'FL', '329': 'FL',
      '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL', '335': 'FL', '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL',
      '340': 'FL', '341': 'FL', '342': 'FL', '344': 'FL', '346': 'FL', '347': 'FL', '349': 'FL',
      '350': 'AL', '351': 'AL', '352': 'AL', '354': 'AL', '355': 'AL', '356': 'AL', '357': 'AL', '358': 'AL', '359': 'AL',
      '360': 'AL', '361': 'AL', '362': 'AL', '363': 'AL', '364': 'AL', '365': 'AL', '366': 'AL', '367': 'AL', '368': 'AL', '369': 'AL',
      '370': 'TN', '371': 'TN', '372': 'TN', '373': 'TN', '374': 'TN', '375': 'TN', '376': 'TN', '377': 'TN', '378': 'TN', '379': 'TN',
      '380': 'TN', '381': 'TN', '382': 'TN', '383': 'TN', '384': 'TN', '385': 'TN',
      '386': 'MS', '387': 'MS', '388': 'MS', '389': 'MS', '390': 'MS', '391': 'MS', '392': 'MS', '393': 'MS', '394': 'MS', '395': 'MS', '396': 'MS', '397': 'MS',
      '400': 'KY', '401': 'KY', '402': 'KY', '403': 'KY', '404': 'KY', '405': 'KY', '406': 'KY', '407': 'KY', '408': 'KY', '409': 'KY',
      '410': 'KY', '411': 'KY', '412': 'KY', '413': 'KY', '414': 'KY', '415': 'KY', '416': 'KY', '417': 'KY', '418': 'KY',
      '420': 'KY', '421': 'KY', '422': 'KY', '423': 'KY', '424': 'KY', '425': 'KY', '426': 'KY', '427': 'KY',
      '430': 'OH', '431': 'OH', '432': 'OH', '433': 'OH', '434': 'OH', '435': 'OH', '436': 'OH', '437': 'OH', '438': 'OH', '439': 'OH',
      '440': 'OH', '441': 'OH', '442': 'OH', '443': 'OH', '444': 'OH', '445': 'OH', '446': 'OH', '447': 'OH', '448': 'OH', '449': 'OH',
      '450': 'OH', '451': 'OH', '452': 'OH', '453': 'OH', '454': 'OH', '455': 'OH', '456': 'OH', '457': 'OH', '458': 'OH',
      '460': 'IN', '461': 'IN', '462': 'IN', '463': 'IN', '464': 'IN', '465': 'IN', '466': 'IN', '467': 'IN', '468': 'IN', '469': 'IN',
      '470': 'IN', '471': 'IN', '472': 'IN', '473': 'IN', '474': 'IN', '475': 'IN', '476': 'IN', '477': 'IN', '478': 'IN', '479': 'IN',
      '480': 'MI', '481': 'MI', '482': 'MI', '483': 'MI', '484': 'MI', '485': 'MI', '486': 'MI', '487': 'MI', '488': 'MI', '489': 'MI',
      '490': 'MI', '491': 'MI', '492': 'MI', '493': 'MI', '494': 'MI', '495': 'MI', '496': 'MI', '497': 'MI', '498': 'MI', '499': 'MI',
      '500': 'IA', '501': 'IA', '502': 'IA', '503': 'IA', '504': 'IA', '505': 'IA', '506': 'IA', '507': 'IA', '508': 'IA', '509': 'IA',
      '510': 'IA', '511': 'IA', '512': 'IA', '513': 'IA', '514': 'IA', '515': 'IA', '516': 'IA', '517': 'IA', '518': 'IA', '519': 'IA',
      '520': 'IA', '521': 'IA', '522': 'IA', '523': 'IA', '524': 'IA', '525': 'IA', '526': 'IA', '527': 'IA', '528': 'IA',
      '530': 'WI', '531': 'WI', '532': 'WI', '534': 'WI', '535': 'WI', '537': 'WI', '538': 'WI', '539': 'WI',
      '540': 'WI', '541': 'WI', '542': 'WI', '543': 'WI', '544': 'WI', '545': 'WI', '546': 'WI', '547': 'WI', '548': 'WI', '549': 'WI',
      '550': 'MN', '551': 'MN', '553': 'MN', '554': 'MN', '555': 'MN', '556': 'MN', '557': 'MN', '558': 'MN', '559': 'MN',
      '560': 'MN', '561': 'MN', '562': 'MN', '563': 'MN', '564': 'MN', '565': 'MN', '566': 'MN', '567': 'MN',
      '570': 'SD', '571': 'SD', '572': 'SD', '573': 'SD', '574': 'SD', '575': 'SD', '576': 'SD', '577': 'SD',
      '580': 'ND', '581': 'ND', '582': 'ND', '583': 'ND', '584': 'ND', '585': 'ND', '586': 'ND', '587': 'ND', '588': 'ND',
      '590': 'MT', '591': 'MT', '592': 'MT', '593': 'MT', '594': 'MT', '595': 'MT', '596': 'MT', '597': 'MT', '598': 'MT', '599': 'MT',
      '600': 'IL', '601': 'IL', '602': 'IL', '603': 'IL', '604': 'IL', '605': 'IL', '606': 'IL', '607': 'IL', '608': 'IL', '609': 'IL',
      '610': 'IL', '611': 'IL', '612': 'IL', '613': 'IL', '614': 'IL', '615': 'IL', '616': 'IL', '617': 'IL', '618': 'IL', '619': 'IL',
      '620': 'IL', '622': 'IL', '623': 'IL', '624': 'IL', '625': 'IL', '626': 'IL', '627': 'IL', '628': 'IL', '629': 'IL',
      '630': 'MO', '631': 'MO', '633': 'MO', '634': 'MO', '635': 'MO', '636': 'MO', '637': 'MO', '638': 'MO', '639': 'MO',
      '640': 'MO', '641': 'MO', '644': 'MO', '645': 'MO', '646': 'MO', '647': 'MO', '648': 'MO', '649': 'MO',
      '650': 'MO', '651': 'MO', '652': 'MO', '653': 'MO', '654': 'MO', '655': 'MO', '656': 'MO', '657': 'MO', '658': 'MO',
      '660': 'KS', '661': 'KS', '662': 'KS', '664': 'KS', '665': 'KS', '666': 'KS', '667': 'KS', '668': 'KS', '669': 'KS',
      '670': 'KS', '671': 'KS', '672': 'KS', '673': 'KS', '674': 'KS', '675': 'KS', '676': 'KS', '677': 'KS', '678': 'KS', '679': 'KS',
      '680': 'NE', '681': 'NE', '683': 'NE', '684': 'NE', '685': 'NE', '686': 'NE', '687': 'NE', '688': 'NE', '689': 'NE',
      '690': 'NE', '691': 'NE', '692': 'NE', '693': 'NE',
      '700': 'LA', '701': 'LA', '703': 'LA', '704': 'LA', '705': 'LA', '706': 'LA', '707': 'LA', '708': 'LA',
      '710': 'LA', '711': 'LA', '712': 'LA', '713': 'LA', '714': 'LA',
      '716': 'AR', '717': 'AR', '718': 'AR', '719': 'AR', '720': 'AR', '721': 'AR', '722': 'AR', '723': 'AR', '724': 'AR', '725': 'AR', '726': 'AR', '727': 'AR', '728': 'AR', '729': 'AR',
      '730': 'OK', '731': 'OK', '733': 'OK', '734': 'OK', '735': 'OK', '736': 'OK', '737': 'OK', '738': 'OK', '739': 'OK',
      '740': 'OK', '741': 'OK', '743': 'OK', '744': 'OK', '745': 'OK', '746': 'OK', '747': 'OK', '748': 'OK', '749': 'OK',
      '750': 'TX', '751': 'TX', '752': 'TX', '753': 'TX', '754': 'TX', '755': 'TX', '756': 'TX', '757': 'TX', '758': 'TX', '759': 'TX',
      '760': 'TX', '761': 'TX', '762': 'TX', '763': 'TX', '764': 'TX', '765': 'TX', '766': 'TX', '767': 'TX', '768': 'TX', '769': 'TX',
      '770': 'TX', '772': 'TX', '773': 'TX', '774': 'TX', '775': 'TX', '776': 'TX', '777': 'TX', '778': 'TX', '779': 'TX',
      '780': 'TX', '781': 'TX', '782': 'TX', '783': 'TX', '784': 'TX', '785': 'TX', '786': 'TX', '787': 'TX', '788': 'TX', '789': 'TX',
      '790': 'TX', '791': 'TX', '792': 'TX', '793': 'TX', '794': 'TX', '795': 'TX', '796': 'TX', '797': 'TX', '798': 'TX', '799': 'TX',
      '800': 'CO', '801': 'CO', '802': 'CO', '803': 'CO', '804': 'CO', '805': 'CO', '806': 'CO', '807': 'CO', '808': 'CO', '809': 'CO',
      '810': 'CO', '811': 'CO', '812': 'CO', '813': 'CO', '814': 'CO', '815': 'CO', '816': 'CO',
      '820': 'WY', '821': 'WY', '822': 'WY', '823': 'WY', '824': 'WY', '825': 'WY', '826': 'WY', '827': 'WY', '828': 'WY', '829': 'WY', '830': 'WY', '831': 'WY',
      '832': 'ID', '833': 'ID', '834': 'ID', '835': 'ID', '836': 'ID', '837': 'ID', '838': 'ID',
      '840': 'UT', '841': 'UT', '842': 'UT', '843': 'UT', '844': 'UT', '845': 'UT', '846': 'UT', '847': 'UT',
      '850': 'AZ', '851': 'AZ', '852': 'AZ', '853': 'AZ', '855': 'AZ', '856': 'AZ', '857': 'AZ', '859': 'AZ', '860': 'AZ', '863': 'AZ', '864': 'AZ', '865': 'AZ',
      '870': 'NM', '871': 'NM', '872': 'NM', '873': 'NM', '874': 'NM', '875': 'NM', '877': 'NM', '878': 'NM', '879': 'NM',
      '880': 'NM', '881': 'NM', '882': 'NM', '883': 'NM', '884': 'NM',
      '885': 'TX', '889': 'NV', '890': 'NV', '891': 'NV', '893': 'NV', '894': 'NV', '895': 'NV', '897': 'NV', '898': 'NV',
      '900': 'CA', '901': 'CA', '902': 'CA', '903': 'CA', '904': 'CA', '905': 'CA', '906': 'CA', '907': 'CA', '908': 'CA', '909': 'CA',
      '910': 'CA', '911': 'CA', '912': 'CA', '913': 'CA', '914': 'CA', '915': 'CA', '916': 'CA', '917': 'CA', '918': 'CA',
      '920': 'CA', '921': 'CA', '922': 'CA', '923': 'CA', '924': 'CA', '925': 'CA', '926': 'CA', '927': 'CA', '928': 'CA',
      '930': 'CA', '931': 'CA', '932': 'CA', '933': 'CA', '934': 'CA', '935': 'CA', '936': 'CA', '937': 'CA', '938': 'CA', '939': 'CA',
      '940': 'CA', '941': 'CA', '942': 'CA', '943': 'CA', '944': 'CA', '945': 'CA', '946': 'CA', '947': 'CA', '948': 'CA', '949': 'CA',
      '950': 'CA', '951': 'CA', '952': 'CA', '953': 'CA', '954': 'CA', '955': 'CA', '956': 'CA', '957': 'CA', '958': 'CA', '959': 'CA',
      '960': 'CA', '961': 'CA',
      '967': 'HI', '968': 'HI',
      '970': 'OR', '971': 'OR', '972': 'OR', '973': 'OR', '974': 'OR', '975': 'OR', '976': 'OR', '977': 'OR', '978': 'OR', '979': 'OR',
      '980': 'WA', '981': 'WA', '982': 'WA', '983': 'WA', '984': 'WA', '985': 'WA', '986': 'WA', '988': 'WA', '989': 'WA',
      '990': 'WA', '991': 'WA', '992': 'WA', '993': 'WA', '994': 'WA',
      '995': 'AK', '996': 'AK', '997': 'AK', '998': 'AK', '999': 'AK'
    };
  }

  /**
   * 🆕 ZIP to State lookup helper
   * @param {string} zipCode - 5-digit ZIP code
   * @returns {string} - State code (e.g., 'FL', 'CA') or '-' if not found
   */
  zipToStateLookup(zipCode) {
    if (!zipCode || zipCode === 'Unknown') return '-';
    const zip3 = String(zipCode).substring(0, 3);
    return this.zip3ToState[zip3] || '-';
  }

  /**
   * Main analysis method - SOP COMPLIANT WITH DYNAMIC CONFIG
   */
  async analyzeSmashFoodsFile(filePath, rateType = 'combined', markup = 0.10, hazmatFilter = 'all', config = {}) {
    console.log('\n🚀 ===============================================');
    console.log('   SMASH FOODS ANALYSIS - SOP COMPLIANT');
    console.log('===============================================');
    console.log(`   File: ${filePath}`);
    console.log(`   Hazmat Filter: ${hazmatFilter}`);
    console.log(`   Dynamic Config: ${JSON.stringify(config)}`);
    console.log('===============================================\n');

    try {
      // =========================================================================
      // 🆕 CHANGE #1: Build parser options from config for date filtering
      // =========================================================================
      const parserOptions = {
        year: config.analysisYear || new Date().getFullYear(),
        startMonth: config.analysisStartMonth || 1,
        endMonth: config.analysisEndMonth || 12,
        shipFromZips: config.shipFromFilter || []
      };

      console.log(`📅 Analysis Period: ${parserOptions.year} (${parserOptions.startMonth}-${parserOptions.endMonth})`);

      // Step 1: Parse Excel file WITH OPTIONS
      console.log('📊 Step 1: Parsing Excel file...');
      const parsedData = await this.parser.parseFile(filePath, parserOptions);
      let shipments = parsedData.dataSheet;

      if (shipments.length === 0) {
        throw new Error('No closed shipments found in file');
      }

      console.log(`✅ Parsed ${shipments.length} closed shipments`);

      // Log hazmat detection
      const hazmatShipments = shipments.filter(s => s.containsHazmat);
      console.log(`\n🔬 Hazmat Detection:`);
      console.log(`   Products: ${parsedData.hazmatClassification.summary.hazmatCount} hazmat, ${parsedData.hazmatClassification.summary.nonHazmatCount} non-hazmat`);
      console.log(`   Shipments: ${hazmatShipments.length} contain hazmat (${((hazmatShipments.length/shipments.length)*100).toFixed(1)}%)`);

      // =========================================================================
      // 🆕 CHANGE #2: Date filtering now handled by parser - just log it
      // =========================================================================
      console.log(`\n📅 Filtered to ${shipments.length} shipments from ${parserOptions.year} (months ${parserOptions.startMonth}-${parserOptions.endMonth})`);

      // Apply hazmat filter
      let originalShipmentCount = shipments.length;
      let filterDescription = 'All shipments';

      if (hazmatFilter === 'hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === true);
        filterDescription = 'Hazmat shipments only';
        console.log(`\n🔍 Filtered to ${shipments.length} HAZMAT shipments (from ${originalShipmentCount} total)`);
      } else if (hazmatFilter === 'non-hazmat') {
        shipments = shipments.filter(s => s.containsHazmat === false);
        filterDescription = 'Non-hazmat shipments only';
        console.log(`\n🔍 Filtered to ${shipments.length} NON-HAZMAT shipments (from ${originalShipmentCount} total)`);
      }

      if (shipments.length === 0) {
        throw new Error(`No ${hazmatFilter} shipments found after filtering`);
      }

      // Log hazmat type breakdown
      if (hazmatFilter === 'hazmat') {
        const typeBreakdown = {};
        shipments.forEach(s => {
          s.hazmatTypes.forEach(type => {
            typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
          });
        });
        console.log(`\n📊 Hazmat Types:`);
        Object.entries(typeBreakdown).forEach(([type, count]) => {
          console.log(`   - ${type}: ${count} shipments`);
        });
      }

      // Step 2: Calculate costs using SOP WITH DYNAMIC CONFIG
      console.log(`\n🧮 Step 2: Calculating costs (SOP method with dynamic config)...`);

      // 🆕 Build sopConfig from request config
      const sopConfig = {
        freightCost: config.freightCost || 3000,
        freightMarkup: config.freightMarkup || 1.20,
        mmBaseCost: config.mmBaseCost || null,  // null = use default pattern rates
        mmMarkup: config.mmMarkup || 1.0,
        rateMode: config.rateMode || 'FTL',
        destination: config.destination || null,  // null = auto-detect
        palletCost: config.palletCost || 150
      };

      // =========================================================================
      // ⚠️ CRITICAL: Use calculateBulkShipmentsWithConfig - NOT calculateAllCosts
      // =========================================================================
      const sopCalculation = this.sopCalculator.calculateBulkShipmentsWithConfig(shipments, sopConfig);

      // Step 3: Get current costs
      console.log(`\n💰 Step 3: Calculating current costs...`);
      const currentCosts = this.calculateCurrentCosts(shipments);

      console.log(`✅ Current: $${currentCosts.totalCost.toFixed(2)}`);
      console.log(`   - Placement: $${currentCosts.totalPlacementFees.toFixed(2)}`);
      console.log(`   - Carrier: $${currentCosts.totalFreight.toFixed(2)}`);

      // Step 4: Generate analytics
      console.log(`\n📈 Step 4: Generating insights...`);

      const costAnalysisForAnalytics = {
        currentCosts,
        currentMetrics: this.calculateMetrics(
          currentCosts.totalCost,
          sopCalculation.summary.totalCuft,
          sopCalculation.summary.totalShipments * 50,
          sopCalculation.summary.totalPallets
        ),
        proposedCosts: {
          totalCost: sopCalculation.summary.totalFreightCost
        },
        proposedMetrics: this.calculateMetrics(
          sopCalculation.summary.totalFreightCost,
          sopCalculation.summary.totalCuft,
          sopCalculation.summary.totalShipments * 50,
          sopCalculation.summary.totalPallets
        ),
        savings: {
          amount: sopCalculation.summary.totalMerchantSavings,
          percent: sopCalculation.summary.savingsPercent,
          currentTotal: sopCalculation.summary.totalClientCost,
          proposedTotal: sopCalculation.summary.totalFreightCost
        },
        transitImprovement: {
          currentTransitDays: Math.round(shipments.reduce((sum, s) => sum + s.transitDays, 0) / shipments.length),
          amzPrepTransitDays: 6,
          improvementDays: 0,
          improvementPercent: 0
        },
        stateBreakdown: this.calculateStateBreakdown(shipments)
      };

      // Calculate transit improvement
      if (costAnalysisForAnalytics.transitImprovement.currentTransitDays > 6) {
        costAnalysisForAnalytics.transitImprovement.improvementDays =
          costAnalysisForAnalytics.transitImprovement.currentTransitDays - 6;
        costAnalysisForAnalytics.transitImprovement.improvementPercent =
          (costAnalysisForAnalytics.transitImprovement.improvementDays /
           costAnalysisForAnalytics.transitImprovement.currentTransitDays) * 100;
      }

      const insights = this.analytics.generateDashboardInsights(
        costAnalysisForAnalytics,
        shipments
      );
      console.log('✅ Insights generated');

      // Step 5: Hazmat analytics
      console.log(`\n🔬 Step 5: Generating hazmat analytics...`);
      const hazmatAnalysis = this.hazmatAnalytics.generateHazmatAnalysis(
        parsedData.hazmatClassification,
        shipments
      );
      console.log('✅ Hazmat analytics complete');

      // Step 6: Compile complete analysis
      const summary = this.parser.getSummary({
        dataSheet: shipments,
        hazmatClassification: parsedData.hazmatClassification
      });

      const hazmatMetricsBreakdown = this.calculateHazmatMetricsBreakdown(
        shipments,
        costAnalysisForAnalytics
      );

      // Generate monthly breakdown with aggregate costs
      const breakdowns = this.generateMonthlyBreakdown(shipments, sopCalculation.summary);
      console.log('📊 Monthly breakdown generated:');
      console.log(`   Months: ${breakdowns.monthlyBreakdown.length}`);
      console.log(`   Ship methods: ${breakdowns.shipMethodBreakdown.length}`);

      // 🆕 Calculate From Zip breakdown
      const fromZipBreakdown = this.calculateFromZipBreakdown(shipments, sopCalculation);
      console.log(`✅ From Zip breakdown calculated: ${fromZipBreakdown.length} unique origins`);


      const completeAnalysis = {
        // Basic metrics
        totalShipments: summary.totalShipments,
        totalUnits: summary.totalUnits,
        totalPallets: Math.round(summary.totalPallets),
        totalCuft: Math.round(summary.totalCuft),
        totalWeight: Math.round(summary.totalWeight),

        // Filter info
        filterApplied: hazmatFilter,
        filterDescription,
        originalShipmentCount,

        // Date range
        dateRange: insights.executiveSummary.overview.analysisTimeframe,

        // 🆕 Add analysis period to response
        analysisPeriod: {
          year: parserOptions.year,
          startMonth: parserOptions.startMonth,
          endMonth: parserOptions.endMonth
        },

        // Calculation method
        calculationMethod: 'SOP_COMPLIANT',
        sopConfig,

        // Current costs
        currentCosts: {
          totalFreight: currentCosts.totalFreight,
          totalPlacementFees: currentCosts.totalPlacementFees,
          totalCost: currentCosts.totalCost,
          costPerCuft: costAnalysisForAnalytics.currentMetrics.costPerCuft,
          costPerUnit: costAnalysisForAnalytics.currentMetrics.costPerUnit,
          costPerPallet: costAnalysisForAnalytics.currentMetrics.costPerPallet
        },

        // Proposed costs (SOP)
        proposedCosts: {
          sop: {
            mmCost: sopCalculation.summary.totalMM,
            internalTransferCost: sopCalculation.summary.totalInternalTransfer,
            totalFreightCost: sopCalculation.summary.totalFreightCost,
            mmCostPT: sopCalculation.summary.totalMMCostPT,

            costPerCuft: costAnalysisForAnalytics.proposedMetrics.costPerCuft,
            costPerUnit: costAnalysisForAnalytics.proposedMetrics.costPerUnit,
            costPerPallet: costAnalysisForAnalytics.proposedMetrics.costPerPallet,

            breakdown: [
              {
                type: 'Middle Mile (Pattern to Amazon)',
                description: `${Math.round(summary.totalCuft)} cuft × rate (varies by type)`,
                cost: sopCalculation.summary.totalMM,
                formula: 'Cuft × Pattern Rate ($2.75-$7.00 depending on type)'
              },
              {
                type: 'Internal Transfer (Warehouse to Pattern)',
                description: `${Math.round(summary.totalCuft)} cuft × (FTL/1742) × 1.20`,
                cost: sopCalculation.summary.totalInternalTransfer,
                formula: 'Cuft × (FTL/1742) × 1.20 markup'
              },
              {
                type: 'Total Freight Cost',
                description: 'MM + Internal Transfer',
                cost: sopCalculation.summary.totalFreightCost,
                formula: 'Client would pay this amount'
              },
              {
                type: 'AMZ Prep Cost (MM Cost PT)',
                description: 'Our internal cost',
                cost: sopCalculation.summary.totalMMCostPT,
                formula: 'Pattern cost without markup'
              }
            ]
          }
        },

        // Savings
        savings: costAnalysisForAnalytics.savings,

        // Transit improvement
        transitImprovement: costAnalysisForAnalytics.transitImprovement,

        // Insights
        insights: {
          recommendations: insights.recommendations,
          executiveSummary: insights.executiveSummary
        },

        // Hazmat
        hazmatAnalysis,
        hazmatMetricsBreakdown,

        // State breakdown
        stateBreakdown: costAnalysisForAnalytics.stateBreakdown,

        // Monthly breakdown
        monthlyBreakdown: breakdowns.monthlyBreakdown,
        shipMethodBreakdown: breakdowns.shipMethodBreakdown,

        // 🆕 From Zip breakdown
        fromZipBreakdown
      };

      console.log('\n✅ ===============================================');
      console.log('   ANALYSIS COMPLETE');
      console.log('===============================================');
      console.log(`   Shipments: ${completeAnalysis.totalShipments}`);
      console.log(`   Current Cost: $${currentCosts.totalCost.toLocaleString()}`);
      console.log(`   AMZ Prep Cost: $${sopCalculation.summary.totalFreightCost.toLocaleString()}`);
      console.log(`   Savings: $${costAnalysisForAnalytics.savings.amount.toLocaleString()} (${costAnalysisForAnalytics.savings.percent}%)`);
      console.log('===============================================\n');

      return completeAnalysis;

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate monthly breakdown with SOP costs
   */
  generateMonthlyBreakdown(shipments, sopSummary) {
    const monthlyData = {};
    const shipMethodData = {};
    const totalShipments = shipments.length;

    // Get aggregate costs for distribution
    const totalMM = sopSummary.totalMM || 0;
    const totalIT = sopSummary.totalInternalTransfer || 0;
    const totalFreight = sopSummary.totalFreightCost || 0;
    const totalCuft = sopSummary.totalCuft || 1;

    console.log(`📊 Aggregate costs available: ${totalMM}`);

    shipments.forEach(shipment => {
      // Get month key
      const createdDate = new Date(shipment.createdDate);
      const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;

      // Calculate this shipment's share of costs based on cuft proportion
      const cuftProportion = shipment.cuft / totalCuft;
      const shipmentMM = totalMM * cuftProportion;
      const shipmentIT = totalIT * cuftProportion;
      const shipmentFreight = totalFreight * cuftProportion;

      // Monthly aggregation
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          shipmentCount: 0,
          shipmentDistribution: '0%',
          transitTime: 0,
          avgTransitTime: 0,
          qty: 0,
          palletCount: 0,
          totalCuft: 0,
          clientPlacementFees: 0,
          clientCarrierCost: 0,
          clientTotalFees: 0,
          mmCost: 0,
          internalTransfer: 0,
          totalFreightCost: 0,
          savings: 0
        };
      }

      const monthly = monthlyData[monthKey];
      monthly.shipmentCount += 1;
      monthly.transitTime += shipment.transitDays || 0;
      monthly.qty += shipment.units || 0;
      monthly.palletCount += shipment.calculatedPallets || 0;
      monthly.totalCuft += shipment.cuft || 0;
      monthly.clientPlacementFees += shipment.placementFees || 0;
      monthly.clientCarrierCost += shipment.carrierCost || 0;
      monthly.clientTotalFees += shipment.currentTotalCost || 0;
      monthly.mmCost += shipmentMM;
      monthly.internalTransfer += shipmentIT;
      monthly.totalFreightCost += shipmentFreight;

      // Ship method aggregation
      const method = shipment.shipMethod || 'Unknown';
      if (!shipMethodData[method]) {
        shipMethodData[method] = {
          method,
          shipmentCount: 0,
          transitTime: 0,
          avgTransitTime: 0,
          qty: 0,
          palletCount: 0,
          totalCuft: 0,
          clientPlacementFees: 0,
          clientCarrierCost: 0,
          clientTotalFees: 0,
          mmCost: 0,
          internalTransfer: 0,
          totalFreightCost: 0
        };
      }

      const methodData = shipMethodData[method];
      methodData.shipmentCount += 1;
      methodData.transitTime += shipment.transitDays || 0;
      methodData.qty += shipment.units || 0;
      methodData.palletCount += shipment.calculatedPallets || 0;
      methodData.totalCuft += shipment.cuft || 0;
      methodData.clientPlacementFees += shipment.placementFees || 0;
      methodData.clientCarrierCost += shipment.carrierCost || 0;
      methodData.clientTotalFees += shipment.currentTotalCost || 0;
      methodData.mmCost += shipmentMM;
      methodData.internalTransfer += shipmentIT;
      methodData.totalFreightCost += shipmentFreight;
    });

    // Calculate averages and round values
    console.log(`   Total MM Cost: $${totalMM.toFixed(2)}`);
    console.log(`   Total IT Cost: $${totalIT.toFixed(2)}`);
    console.log(`   Total Freight: $${totalFreight.toFixed(2)}`);

    Object.keys(monthlyData).forEach(month => {
      const data = monthlyData[month];
      data.avgTransitTime = Math.round(data.transitTime / data.shipmentCount);
      data.shipmentDistribution = ((data.shipmentCount / totalShipments) * 100).toFixed(2) + '%';
      data.savings = data.clientTotalFees - data.totalFreightCost;
    });

    Object.keys(shipMethodData).forEach(method => {
      const data = shipMethodData[method];
      data.avgTransitTime = Math.round(data.transitTime / data.shipmentCount);
      data.shipmentDistribution = ((data.shipmentCount / totalShipments) * 100).toFixed(2) + '%';
    });

    return {
      monthlyBreakdown: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      shipMethodBreakdown: Object.values(shipMethodData)
    };
  }

  /**
   * 🆕 FIXED: Calculate From Zip distribution pivot table
   * Shows shipment distribution by origin zip code
   */
  calculateFromZipBreakdown(shipments, sopCalculation) {
    const fromZipData = {};
    const totalShipments = shipments.length;

    // Get aggregate costs for distribution
    const sopSummary = sopCalculation?.summary || {};
    const totalMM = sopSummary.totalMM || 0;
    const totalIT = sopSummary.totalInternalTransfer || 0;
    const totalFreight = sopSummary.totalFreightCost || 0;
    const totalCuft = sopSummary.totalCuft || 1;

    shipments.forEach(shipment => {
      const fromZip = shipment.shipFromZip || 'Unknown';

      if (!fromZipData[fromZip]) {
        fromZipData[fromZip] = {
          fromZip,
          state: this.zipToStateLookup(fromZip),  // 🆕 Use the helper method
          shipmentCount: 0,
          fbaIdCount: 0,
          shipmentDistribution: '0%',
          totalTransitTime: 0,
          avgTransitTime: 0,
          qty: 0,
          palletCount: 0,
          totalCuft: 0,
          clientPlacementFees: 0,
          clientCarrierCost: 0,
          clientTotalFees: 0,
          mmCost: 0,
          internalTransfer: 0,
          totalFreightCost: 0
        };
      }

      // Calculate this shipment's share of costs based on cuft proportion
      const cuftProportion = shipment.cuft / totalCuft;
      const shipmentMM = totalMM * cuftProportion;
      const shipmentIT = totalIT * cuftProportion;
      const shipmentFreight = totalFreight * cuftProportion;

      const data = fromZipData[fromZip];
      data.shipmentCount += 1;
      data.fbaIdCount += 1;
      data.totalTransitTime += shipment.transitDays || 0;
      data.qty += shipment.units || 0;
      data.palletCount += shipment.calculatedPallets || 0;
      data.totalCuft += shipment.cuft || 0;
      data.clientPlacementFees += shipment.placementFees || 0;
      data.clientCarrierCost += shipment.carrierCost || 0;
      data.clientTotalFees += shipment.currentTotalCost || 0;
      data.mmCost += shipmentMM;
      data.internalTransfer += shipmentIT;
      data.totalFreightCost += shipmentFreight;
    });

    // Calculate averages and percentages
    Object.keys(fromZipData).forEach(zip => {
      const data = fromZipData[zip];
      data.avgTransitTime = data.shipmentCount > 0
        ? Math.round(data.totalTransitTime / data.shipmentCount)
        : 0;
      data.shipmentDistribution = ((data.shipmentCount / totalShipments) * 100).toFixed(2) + '%';

      // Round numeric values
      data.palletCount = parseFloat(data.palletCount.toFixed(2));
      data.totalCuft = parseFloat(data.totalCuft.toFixed(2));
      data.clientPlacementFees = parseFloat(data.clientPlacementFees.toFixed(2));
      data.clientCarrierCost = parseFloat(data.clientCarrierCost.toFixed(2));
      data.clientTotalFees = parseFloat(data.clientTotalFees.toFixed(2));
      data.mmCost = parseFloat(data.mmCost.toFixed(2));
      data.internalTransfer = parseFloat(data.internalTransfer.toFixed(2));
      data.totalFreightCost = parseFloat(data.totalFreightCost.toFixed(2));
    });

    return Object.values(fromZipData).sort((a, b) => b.shipmentCount - a.shipmentCount);
  }

  /**
   * Calculate current costs
   */
  calculateCurrentCosts(shipments) {
    const totals = {
      totalFreight: 0,
      totalPlacementFees: 0,
      totalCost: 0
    };

    shipments.forEach(shipment => {
      totals.totalFreight += shipment.carrierCost || 0;
      totals.totalPlacementFees += shipment.placementFees || 0;
      totals.totalCost += shipment.currentTotalCost || 0;
    });

    return {
      totalFreight: Math.round(totals.totalFreight * 100) / 100,
      totalPlacementFees: Math.round(totals.totalPlacementFees * 100) / 100,
      totalCost: Math.round(totals.totalCost * 100) / 100
    };
  }

  /**
   * Calculate metrics
   */
  calculateMetrics(totalCost, totalCuft, totalUnits, totalPallets) {
    return {
      costPerCuft: totalCuft > 0 ? parseFloat((totalCost / totalCuft).toFixed(2)) : 0,
      costPerUnit: totalUnits > 0 ? parseFloat((totalCost / totalUnits).toFixed(2)) : 0,
      costPerPallet: totalPallets > 0 ? parseFloat((totalCost / totalPallets).toFixed(2)) : 0
    };
  }

  /**
   * Calculate state breakdown
   */
  calculateStateBreakdown(shipments) {
    const stateData = {};

    shipments.forEach(shipment => {
      const state = shipment.destinationState || 'Unknown';

      if (!stateData[state]) {
        stateData[state] = {
          state,
          count: 0,
          units: 0,
          pallets: 0,
          cuft: 0,
          currentCost: 0,
          avgTransitDays: 0
        };
      }

      stateData[state].count += 1;
      stateData[state].units += shipment.units || 0;
      stateData[state].pallets += shipment.calculatedPallets || 0;
      stateData[state].cuft += shipment.cuft || 0;
      stateData[state].currentCost += shipment.currentTotalCost || 0;
      stateData[state].avgTransitDays += shipment.transitDays || 0;
    });

    Object.keys(stateData).forEach(state => {
      stateData[state].avgTransitDays = Math.round(
        stateData[state].avgTransitDays / stateData[state].count
      );
      stateData[state].currentCost = Math.round(stateData[state].currentCost * 100) / 100;
      stateData[state].pallets = parseFloat(stateData[state].pallets.toFixed(2));
      stateData[state].cuft = parseFloat(stateData[state].cuft.toFixed(2));
    });

    return stateData;
  }

  /**
   * Calculate hazmat metrics breakdown
   */
  calculateHazmatMetricsBreakdown(shipments, costAnalysis) {
    const hazmatShipments = shipments.filter(s => s.containsHazmat);
    const nonHazmatShipments = shipments.filter(s => !s.containsHazmat);

    const calculateTotals = (ships) => ({
      count: ships.length,
      units: ships.reduce((sum, s) => sum + s.units, 0),
      pallets: ships.reduce((sum, s) => sum + s.calculatedPallets, 0),
      cuft: ships.reduce((sum, s) => sum + s.cuft, 0),
      currentCost: ships.reduce((sum, s) => sum + s.currentTotalCost, 0),
      placementFees: ships.reduce((sum, s) => sum + s.placementFees, 0),
      carrierCost: ships.reduce((sum, s) => sum + s.carrierCost, 0)
    });

    const hazmatTotals = calculateTotals(hazmatShipments);
    const nonHazmatTotals = calculateTotals(nonHazmatShipments);
    const allTotals = calculateTotals(shipments);

    return {
      all: {
        ...allTotals,
        percentage: 100,
        avgCostPerShipment: allTotals.count > 0 ? allTotals.currentCost / allTotals.count : 0
      },
      hazmat: {
        ...hazmatTotals,
        percentage: allTotals.count > 0 ? (hazmatTotals.count / allTotals.count) * 100 : 0,
        avgCostPerShipment: hazmatTotals.count > 0 ? hazmatTotals.currentCost / hazmatTotals.count : 0
      },
      nonHazmat: {
        ...nonHazmatTotals,
        percentage: allTotals.count > 0 ? (nonHazmatTotals.count / allTotals.count) * 100 : 0,
        avgCostPerShipment: nonHazmatTotals.count > 0 ? nonHazmatTotals.currentCost / nonHazmatTotals.count : 0
      }
    };
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(summary, costAnalysis, insights, hazmatAnalysis, hazmatFilter, filterDescription) {
    const keyFindings = [];

    // Cost savings
    if (costAnalysis.savings.amount >= 0) {
      keyFindings.push(
        `Save $${Math.abs(costAnalysis.savings.amount).toLocaleString()} (${Math.abs(costAnalysis.savings.percent)}%) with AMZ Prep`
      );
    } else {
      keyFindings.push(
        `AMZ Prep costs $${Math.abs(costAnalysis.savings.amount).toLocaleString()} more (${Math.abs(costAnalysis.savings.percent)}%)`
      );
    }

    // Transit time
    if (costAnalysis.transitImprovement.improvementDays > 0) {
      keyFindings.push(
        `Reduce transit by ${costAnalysis.transitImprovement.improvementDays} days (${costAnalysis.transitImprovement.improvementPercent}%)`
      );
    }

    // Geographic
    if (insights.geographic.topStates[0]) {
      keyFindings.push(
        `Top destination: ${insights.geographic.topStates[0].state} (${insights.geographic.topStates[0].percentage}%)`
      );
    }

    // Hazmat
    if (hazmatFilter === 'all') {
      keyFindings.push(
        `${hazmatAnalysis.products.hazmat} hazmat products (${hazmatAnalysis.products.percentHazmat}%)`
      );
    }

    return {
      title: hazmatFilter === 'hazmat' ? 'Hazmat Freight Analysis' :
             hazmatFilter === 'non-hazmat' ? 'Non-Hazmat Freight Analysis' :
             'Complete Freight Analysis',
      subtitle: `${summary.totalShipments} Shipments | ${summary.totalUnits.toLocaleString()} Units`,
      filterApplied: filterDescription,
      keyFindings
    };
  }

  /**
   * Get active rates
   */
  async getActiveRates() {
    try {
      const rates = await AmazonRateEnhanced.findOne({ isActive: true });
      return rates || { palletRate: 15, cuftRate: 0.35, prepFee: 0.15 };
    } catch (error) {
      console.warn('⚠️ Could not fetch rates');
      return { palletRate: 15, cuftRate: 0.35, prepFee: 0.15 };
    }
  }

  /**
   * Validate file
   */
  async validateFile(filePath) {
    try {
      const parsedData = await this.parser.parseFile(filePath);
      return parsedData.dataSheet.length > 0;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  }
}

export default SmashFoodsIntegration;
