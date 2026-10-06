/* ============================================================
   DONNÉES — aéroports, pays, avions, familles, événements
   ============================================================ */

// Pays : [nom, continent, drapeau, préfixe d'immatriculation] — noms français soignés pour les principaux pays
const COUNTRY_OVERRIDES = {
  CD:['RD Congo','AF','🇨🇩','9Q-'], AO:['Angola','AF','🇦🇴','D2-'], CG:['Congo-Brazzaville','AF','🇨🇬','TN-'],
  RW:['Rwanda','AF','🇷🇼','9XR-'], UG:['Ouganda','AF','🇺🇬','5X-'], KE:['Kenya','AF','🇰🇪','5Y-'],
  ET:['Éthiopie','AF','🇪🇹','ET-'], TZ:['Tanzanie','AF','🇹🇿','5H-'], ZM:['Zambie','AF','🇿🇲','9J-'],
  ZA:['Afrique du Sud','AF','🇿🇦','ZS-'], NG:['Nigeria','AF','🇳🇬','5N-'], GH:['Ghana','AF','🇬🇭','9G-'],
  CI:["Côte d'Ivoire",'AF','🇨🇮','TU-'], SN:['Sénégal','AF','🇸🇳','6V-'], MA:['Maroc','AF','🇲🇦','CN-'],
  DZ:['Algérie','AF','🇩🇿','7T-'], TN:['Tunisie','AF','🇹🇳','TS-'], EG:['Égypte','AF','🇪🇬','SU-'],
  CM:['Cameroun','AF','🇨🇲','TJ-'], GA:['Gabon','AF','🇬🇦','TR-'], CF:['Centrafrique','AF','🇨🇫','TL-'],
  BI:['Burundi','AF','🇧🇮','9U-'], ZW:['Zimbabwe','AF','🇿🇼','Z-'], MU:['Maurice','AF','🇲🇺','3B-'],
  MG:['Madagascar','AF','🇲🇬','5R-'], SD:['Soudan','AF','🇸🇩','ST-'], SS:['Soudan du Sud','AF','🇸🇸','Z8-'],
  MZ:['Mozambique','AF','🇲🇿','C9-'], BJ:['Bénin','AF','🇧🇯','TY-'], TD:['Tchad','AF','🇹🇩','TT-'],
  GB:['Royaume-Uni','EU','🇬🇧','G-'], FR:['France','EU','🇫🇷','F-'], BE:['Belgique','EU','🇧🇪','OO-'],
  NL:['Pays-Bas','EU','🇳🇱','PH-'], DE:['Allemagne','EU','🇩🇪','D-'], ES:['Espagne','EU','🇪🇸','EC-'],
  IT:['Italie','EU','🇮🇹','I-'], CH:['Suisse','EU','🇨🇭','HB-'], TR:['Turquie','EU','🇹🇷','TC-'],
  PT:['Portugal','EU','🇵🇹','CS-'], AT:['Autriche','EU','🇦🇹','OE-'], DK:['Danemark','EU','🇩🇰','OY-'],
  SE:['Suède','EU','🇸🇪','SE-'], IE:['Irlande','EU','🇮🇪','EI-'], GR:['Grèce','EU','🇬🇷','SX-'],
  PL:['Pologne','EU','🇵🇱','SP-'], RU:['Russie','EU','🇷🇺','RA-'],
  AE:['Émirats arabes unis','AS','🇦🇪','A6-'], QA:['Qatar','AS','🇶🇦','A7-'], SA:['Arabie saoudite','AS','🇸🇦','HZ-'],
  IL:['Israël','AS','🇮🇱','4X-'], IN:['Inde','AS','🇮🇳','VT-'], CN:['Chine','AS','🇨🇳','B-'],
  HK:['Hong Kong','AS','🇭🇰','B-H'], JP:['Japon','AS','🇯🇵','JA'], KR:['Corée du Sud','AS','🇰🇷','HL'],
  SG:['Singapour','AS','🇸🇬','9V-'], TH:['Thaïlande','AS','🇹🇭','HS-'], MY:['Malaisie','AS','🇲🇾','9M-'],
  ID:['Indonésie','AS','🇮🇩','PK-'], PH:['Philippines','AS','🇵🇭','RP-'], TW:['Taïwan','AS','🇹🇼','B-'],
  VN:['Viêt Nam','AS','🇻🇳','VN-'],
  US:['États-Unis','NA','🇺🇸','N'], CA:['Canada','NA','🇨🇦','C-'],
  MX:['Mexique','SA','🇲🇽','XA-'], BR:['Brésil','SA','🇧🇷','PR-'], AR:['Argentine','SA','🇦🇷','LV-'],
  CL:['Chili','SA','🇨🇱','CC-'], CO:['Colombie','SA','🇨🇴','HK-'], PE:['Pérou','SA','🇵🇪','OB-'],
  PA:['Panama','SA','🇵🇦','HP-'], AU:['Australie','OC','🇦🇺','VH-'], NZ:['Nouvelle-Zélande','OC','🇳🇿','ZK-'],
};
const COUNTRIES = Object.assign({}, COUNTRY_DB);
for(const [cc,v] of Object.entries(COUNTRY_OVERRIDES)) COUNTRIES[cc]=[v[0], (COUNTRY_DB[cc]||v)[1], v[2], v[3]];
const CONTINENTS = { AF:'Afrique', EU:'Europe', AS:'Asie & Moyen-Orient', NA:'Amérique du Nord & centrale', SA:'Amérique du Sud', OC:'Océanie', AN:'Antarctique' };

// Classe de piste : 1 = piste courte/latérite (Caravan, Twin Otter, ATR 42)
// 2 = piste régionale (turbopropulseurs), 3 = moyen-courrier, 4 = gros-porteurs, 5 = A380/747/777-9
// Aéroports RDC : [IATA, OACI, nom, ville, province, lat, lon, piste (m), revêtement, classe, trafic (M pax/an)]
const DRC_AIRPORTS = [
  ['FIH','FZAA',"N'Djili International",'Kinshasa','Kinshasa',-4.3858,15.4446,4700,'Asphalte',5,1.20],
  ['NLO','FZAB',"N'Dolo",'Kinshasa','Kinshasa',-4.3266,15.3275,1650,'Asphalte',2,0.25],
  ['MAT','FZAM','Tshimpi','Matadi','Kongo-Central',-5.7996,13.4404,1650,'Asphalte',2,0.04],
  ['BOA','FZAJ','Boma','Boma','Kongo-Central',-5.8540,13.0640,1500,'Asphalte',2,0.03],
  ['MNB','FZAG','Muanda','Muanda','Kongo-Central',-5.9309,12.3518,1600,'Asphalte',2,0.05],
  ['FDU','FZBO','Bandundu','Bandundu','Kwilu',-3.3113,17.3817,1500,'Asphalte',2,0.02],
  ['KKW','FZCA','Kikwit','Kikwit','Kwilu',-5.0358,18.7856,1500,'Asphalte',2,0.03],
  ['INO','FZBA','Inongo','Inongo','Maï-Ndombe',-1.9472,18.2858,1600,'Latérite',1,0.01],
  ['MDK','FZEA','Mbandaka','Mbandaka','Équateur',0.0226,18.2887,2200,'Asphalte',3,0.05],
  ['BSU','FZEN','Basankusu','Basankusu','Équateur',1.2247,19.7889,1500,'Latérite',1,0.005],
  ['BNB','FZGN','Boende','Boende','Tshuapa',-0.2170,20.8500,1300,'Latérite',1,0.005],
  ['GMA','FZFK','Gemena','Gemena','Sud-Ubangi',3.2353,19.7713,2000,'Asphalte',3,0.02],
  ['BDT','FZFD','Gbadolite','Gbadolite','Nord-Ubangi',4.2532,20.9753,3200,'Asphalte',4,0.01],
  ['LIQ','FZGA','Lisala','Lisala','Mongala',2.1707,21.4969,1600,'Latérite',1,0.005],
  ['BMB','FZFU','Bumba','Bumba','Mongala',2.1826,22.4817,1800,'Latérite',2,0.01],
  ['FKI','FZIC','Bangoka International','Kisangani','Tshopo',0.4817,25.3380,3500,'Asphalte',4,0.12],
  ['BZU','FZKJ','Buta Zega','Buta','Bas-Uele',2.8180,24.7940,1500,'Latérite',1,0.004],
  ['IRP','FZJH','Matari','Isiro','Haut-Uele',2.8276,27.5883,2000,'Asphalte',2,0.01],
  ['BUX','FZKA','Bunia','Bunia','Ituri',1.5657,30.2208,2000,'Asphalte',3,0.04],
  ['BNC','FZNP','Mavivi','Beni','Nord-Kivu',0.5750,29.4739,2000,'Asphalte',2,0.03],
  ['RUE','FZNB','Rughenda','Butembo','Nord-Kivu',0.1171,29.3133,1350,'Latérite',1,0.02],
  ['GOM','FZNA','Goma International','Goma','Nord-Kivu',-1.6708,29.2385,3000,'Asphalte',4,0.20],
  ['BKY','FZMA','Kavumu','Bukavu','Sud-Kivu',-2.3089,28.8088,2000,'Asphalte',3,0.08],
  ['KND','FZOA','Kindu','Kindu','Maniema',-2.9192,25.9154,2200,'Asphalte',3,0.03],
  ['FMI','FZRF','Kalemie','Kalemie','Tanganyika',-5.8756,29.2500,2000,'Asphalte',3,0.03],
  ['KOO','FZRQ','Kongolo','Kongolo','Tanganyika',-5.3944,26.9900,1600,'Latérite',1,0.005],
  ['MNO','FZRA','Manono','Manono','Tanganyika',-7.2889,27.3944,1900,'Latérite',2,0.005],
  ['BDV','FZRB','Moba','Moba','Tanganyika',-7.0670,29.7830,1300,'Latérite',1,0.003],
  ['FBM','FZQA','Luano International','Lubumbashi','Haut-Katanga',-11.5913,27.5309,3200,'Asphalte',4,0.50],
  ['PWO','FZQC','Pweto','Pweto','Haut-Katanga',-8.4670,28.9000,1300,'Latérite',1,0.003],
  ['KWZ','FZQM','Kolwezi','Kolwezi','Lualaba',-10.7659,25.5057,2600,'Asphalte',3,0.08],
  ['DIC','FZSC','Dilolo','Dilolo','Lualaba',-10.7000,22.3500,1300,'Latérite',1,0.002],
  ['KAP','FZSK','Kapanga','Kapanga','Lualaba',-8.3500,22.5800,1200,'Latérite',1,0.002],
  ['KMN','FZSA','Kamina Base','Kamina','Haut-Lomami',-8.6421,25.2529,2700,'Asphalte',3,0.01],
  ['MJM','FZWA','Mbuji-Mayi','Mbuji-Mayi','Kasaï-Oriental',-6.1212,23.5690,2000,'Asphalte',3,0.10],
  ['GDJ','FZWC','Gandajika','Gandajika','Lomami',-6.7330,23.9500,1800,'Latérite',1,0.004],
  ['KBN','FZWT','Tunta','Kabinda','Lomami',-6.0330,24.4830,1500,'Latérite',1,0.005],
  ['KGA','FZUA','Kananga','Kananga','Kasaï-Central',-5.9001,22.4692,2000,'Asphalte',3,0.06],
  ['TSH','FZUK','Tshikapa','Tshikapa','Kasaï',-6.4383,20.7947,1700,'Asphalte',2,0.03],
  ['PFR','FZVS','Ilebo','Ilebo','Kasaï',-4.3299,20.5900,1500,'Latérite',1,0.005],
  ['MEW','FZVM','Mweka','Mweka','Kasaï',-4.8500,21.5500,1400,'Latérite',1,0.002],
  ['LJA','FZVA','Lodja','Lodja','Sankuru',-3.4170,23.4500,1600,'Latérite',2,0.01],
  ['LBO','FZVI','Lusambo','Lusambo','Sankuru',-4.9600,23.3800,1500,'Latérite',1,0.003],
];

// Autres aéroports : [IATA, nom, ville, pays, lat, lon, classe, trafic (M pax/an)]
const WORLD_AIRPORTS = [
  // Afrique
  ['LAD','Agostinho Neto','Luanda','AO',-8.8584,13.2312,4,2.5],
  ['BZV','Maya-Maya','Brazzaville','CG',-4.2517,15.2530,4,1.0],
  ['PNR','Agostinho-Neto','Pointe-Noire','CG',-4.8160,11.8866,4,0.8],
  ['KGL','Kigali International','Kigali','RW',-1.9686,30.1395,4,1.0],
  ['EBB','Entebbe International','Entebbe','UG',0.0424,32.4435,4,1.8],
  ['NBO','Jomo Kenyatta','Nairobi','KE',-1.3192,36.9278,5,7],
  ['ADD','Bole International','Addis-Abeba','ET',8.9779,38.7993,5,12],
  ['DAR','Julius Nyerere','Dar es Salaam','TZ',-6.8781,39.2026,4,3],
  ['LUN','Kenneth Kaunda','Lusaka','ZM',-15.3308,28.4526,4,1.5],
  ['NLA','Simon Mwansa Kapwepwe','Ndola','ZM',-12.9980,28.6649,3,0.3],
  ['JNB','O. R. Tambo','Johannesburg','ZA',-26.1392,28.2460,5,21],
  ['CPT','Cape Town International','Le Cap','ZA',-33.9649,18.6017,5,10],
  ['LOS','Murtala Muhammed','Lagos','NG',6.5774,3.3212,5,8],
  ['ABV','Nnamdi Azikiwe','Abuja','NG',9.0068,7.2632,4,4],
  ['ACC','Kotoka','Accra','GH',5.6052,-0.1668,4,3],
  ['ABJ','Félix-Houphouët-Boigny','Abidjan','CI',5.2614,-3.9263,4,2.5],
  ['DSS','Blaise Diagne','Dakar','SN',14.6700,-17.0730,4,2.5],
  ['CMN','Mohammed V','Casablanca','MA',33.3675,-7.5899,5,10],
  ['ALG','Houari-Boumédiène','Alger','DZ',36.6910,3.2154,4,8],
  ['TUN','Tunis-Carthage','Tunis','TN',36.8510,10.2272,4,6],
  ['CAI','Cairo International','Le Caire','EG',30.1219,31.4056,5,25],
  ['DLA','Douala International','Douala','CM',4.0061,9.7195,4,1.5],
  ['LBV',"Léon-Mba",'Libreville','GA',0.4586,9.4123,4,0.9],
  ['BGF',"Bangui M'Poko",'Bangui','CF',4.3985,18.5188,3,0.15],
  ['BJM','Melchior Ndadaye','Bujumbura','BI',-3.3240,29.3185,3,0.3],
  ['HRE','Robert Gabriel Mugabe','Harare','ZW',-17.9318,31.0928,4,1.2],
  ['MRU','Sir Seewoosagur Ramgoolam','Maurice','MU',-20.4302,57.6836,4,4],
  ['TNR','Ivato','Antananarivo','MG',-18.7969,47.4788,4,1.3],
  ['KRT','Khartoum International','Khartoum','SD',15.5895,32.5532,4,0.5],
  ['JUB','Juba International','Juba','SS',4.8720,31.6011,3,0.4],
  ['MPM','Maputo International','Maputo','MZ',-25.9208,32.5726,4,1.0],
  ['COO','Cadjehoun','Cotonou','BJ',6.3572,2.3844,4,0.6],
  ['NDJ',"Hassan Djamous",'N’Djamena','TD',12.1337,15.0340,4,0.4],
  // Europe
  ['LHR','Heathrow','Londres','GB',51.4700,-0.4543,5,80],
  ['CDG','Charles-de-Gaulle','Paris','FR',49.0097,2.5479,5,70],
  ['BRU','Brussels Airport','Bruxelles','BE',50.9014,4.4844,5,24],
  ['AMS','Schiphol','Amsterdam','NL',52.3105,4.7683,5,62],
  ['FRA','Frankfurt am Main','Francfort','DE',50.0379,8.5622,5,62],
  ['MUC','Franz Josef Strauss','Munich','DE',48.3538,11.7861,5,42],
  ['MAD','Barajas','Madrid','ES',40.4983,-3.5676,5,60],
  ['BCN','El Prat','Barcelone','ES',41.2974,2.0833,5,50],
  ['FCO','Fiumicino','Rome','IT',41.8003,12.2389,5,45],
  ['ZRH','Zurich Kloten','Zurich','CH',47.4582,8.5555,5,31],
  ['GVA','Genève Cointrin','Genève','CH',46.2381,6.1090,4,18],
  ['IST','Istanbul Airport','Istanbul','TR',41.2753,28.7519,5,76],
  ['LIS','Humberto Delgado','Lisbonne','PT',38.7742,-9.1342,5,33],
  ['VIE','Schwechat','Vienne','AT',48.1103,16.5697,5,30],
  ['CPH','Kastrup','Copenhague','DK',55.6180,12.6560,5,30],
  ['ARN','Arlanda','Stockholm','SE',59.6498,17.9238,5,25],
  ['DUB','Dublin Airport','Dublin','IE',53.4264,-6.2499,5,33],
  ['ATH','Elefthérios-Venizélos','Athènes','GR',37.9364,23.9445,5,28],
  ['WAW','Chopin','Varsovie','PL',52.1657,20.9671,5,21],
  ['SVO','Cheremetievo','Moscou','RU',55.9726,37.4146,5,40],
  // Asie & Moyen-Orient
  ['DXB','Dubai International','Dubaï','AE',25.2532,55.3657,5,92],
  ['AUH','Zayed International','Abou Dabi','AE',24.4330,54.6511,5,28],
  ['DOH','Hamad International','Doha','QA',25.2731,51.6081,5,46],
  ['RUH','King Khalid','Riyad','SA',24.9576,46.6988,5,37],
  ['JED','King Abdulaziz','Djeddah','SA',21.6796,39.1565,5,45],
  ['TLV','Ben Gourion','Tel Aviv','IL',32.0055,34.8854,5,21],
  ['DEL','Indira Gandhi','New Delhi','IN',28.5562,77.1000,5,74],
  ['BOM','Chhatrapati Shivaji','Mumbai','IN',19.0896,72.8656,5,52],
  ['BLR','Kempegowda','Bangalore','IN',13.1986,77.7066,5,37],
  ['PEK','Capital International','Pékin','CN',40.0799,116.6031,5,53],
  ['PVG','Pudong','Shanghai','CN',31.1443,121.8083,5,55],
  ['CAN','Baiyun','Canton','CN',23.3924,113.2988,5,63],
  ['HKG','Chek Lap Kok','Hong Kong','HK',22.3080,113.9185,5,40],
  ['NRT','Narita','Tokyo','JP',35.7720,140.3929,5,33],
  ['HND','Haneda','Tokyo','JP',35.5494,139.7798,5,79],
  ['ICN','Incheon','Séoul','KR',37.4602,126.4407,5,56],
  ['SIN','Changi','Singapour','SG',1.3644,103.9915,5,59],
  ['BKK','Suvarnabhumi','Bangkok','TH',13.6900,100.7501,5,52],
  ['KUL','Kuala Lumpur International','Kuala Lumpur','MY',2.7456,101.7099,5,47],
  ['CGK','Soekarno-Hatta','Jakarta','ID',-6.1256,106.6559,5,52],
  ['MNL','Ninoy Aquino','Manille','PH',14.5086,121.0198,5,45],
  ['TPE','Taoyuan','Taipei','TW',25.0797,121.2342,5,35],
  ['SGN','Tân Sơn Nhất','Hô Chi Minh-Ville','VN',10.8188,106.6520,5,40],
  // Amériques
  ['JFK','John F. Kennedy','New York','US',40.6413,-73.7781,5,62],
  ['ATL','Hartsfield-Jackson','Atlanta','US',33.6407,-84.4277,5,104],
  ['ORD',"O'Hare",'Chicago','US',41.9742,-87.9073,5,80],
  ['LAX','Los Angeles International','Los Angeles','US',33.9416,-118.4085,5,75],
  ['SFO','San Francisco International','San Francisco','US',37.6213,-122.3790,5,50],
  ['MIA','Miami International','Miami','US',25.7959,-80.2870,5,52],
  ['DFW','Dallas/Fort Worth','Dallas','US',32.8998,-97.0403,5,82],
  ['IAD','Washington Dulles','Washington','US',38.9531,-77.4565,5,25],
  ['YUL','Montréal-Trudeau','Montréal','CA',45.4706,-73.7408,5,21],
  ['YYZ','Toronto Pearson','Toronto','CA',43.6777,-79.6248,5,47],
  ['MEX','Benito Juárez','Mexico','MX',19.4363,-99.0721,5,48],
  ['CUN','Cancún International','Cancún','MX',21.0365,-86.8771,5,32],
  ['GRU','Guarulhos','São Paulo','BR',-23.4356,-46.4731,5,42],
  ['GIG','Galeão','Rio de Janeiro','BR',-22.8100,-43.2506,5,15],
  ['EZE','Ezeiza','Buenos Aires','AR',-34.8222,-58.5358,5,10],
  ['SCL','Arturo Merino Benítez','Santiago','CL',-33.3930,-70.7858,5,25],
  ['BOG','El Dorado','Bogota','CO',4.7016,-74.1469,5,40],
  ['LIM','Jorge Chávez','Lima','PE',-12.0219,-77.1143,5,24],
  ['PTY','Tocumen','Panama','PA',9.0714,-79.3835,5,18],
  // Océanie
  ['SYD','Kingsford Smith','Sydney','AU',-33.9399,151.1753,5,42],
  ['MEL','Tullamarine','Melbourne','AU',-37.6690,144.8410,5,36],
  ['AKL','Auckland Airport','Auckland','NZ',-37.0082,174.7850,5,20],
  ['PER','Perth Airport','Perth','AU',-31.9385,115.9672,5,15],
];

const AIRPORTS = {};
// 1) base mondiale (≈3 200 aéroports avec vols réguliers)
AIRPORT_DB.forEach(([code,icao,name,city,cc,lat,lon,cls,traffic,runway,large,utc,region])=>{
  if(!COUNTRIES[cc]) return;
  AIRPORTS[code]={code,icao,name,city,cc,prov:'',region,lat,lon,runway,surface:'Asphalte',cls,traffic,large:!!large,utc,drc:cc==='CD'};
});
// 2) noms français des grandes villes
WORLD_AIRPORTS.forEach(([code,name,city])=>{ if(AIRPORTS[code]){ AIRPORTS[code].city=city; } });
// 3) RDC : données détaillées (provinces, pistes en latérite)
DRC_AIRPORTS.forEach(([code,icao,name,city,prov,lat,lon,runway,surface,cls,traffic])=>{
  AIRPORTS[code] = Object.assign(AIRPORTS[code]||{}, {code,icao,name,city,cc:'CD',prov,lat,lon,runway,surface,cls,traffic,drc:true,large:cls>=4});
});
// 4) pistes réelles et altitude (OurAirports)
if(typeof RUNWAY_DB!=='undefined') for(const [code,a] of Object.entries(AIRPORTS)){
  const rws=RUNWAY_DB[code]; if(ELEV_DB&&ELEV_DB[code]!==undefined) a.elev=ELEV_DB[code];
  if(!rws||!rws.length) continue;
  const hard=rws.filter(r=>r[9]), best=Math.max(...(hard.length?hard:rws).map(r=>r[7]));
  a.runway=best; a.rwCount=rws.length;
  a.surface= hard.length? 'Asphalte' : 'Latérite / herbe';
  a.cls = best<1200?1: best<1700?2: best<2400?3: best<3100?4: 5;
}
const AIRPORT_CODES = Object.keys(AIRPORTS);
const DRC_PROVINCES = ['Kinshasa','Kongo-Central','Kwango','Kwilu','Maï-Ndombe','Équateur','Sud-Ubangi','Nord-Ubangi','Mongala','Tshuapa','Tshopo','Bas-Uele','Haut-Uele','Ituri','Nord-Kivu','Sud-Kivu','Maniema','Haut-Katanga','Lualaba','Haut-Lomami','Tanganyika','Lomami','Sankuru','Kasaï','Kasaï-Central','Kasaï-Oriental'];

// Familles de qualification pilote : [nom, coût formation $, jours, salaire mensuel $]
const FAMILIES = {
  TURBO:['Turbopropulseurs (ATR, Dash 8, Caravan)',15000,20,6500],
  CRJ:['Bombardier CRJ',30000,30,8000],
  EMB:['Embraer E-Jet',35000,30,8500],
  A220:['Airbus A220',45000,35,9500],
  A320:['Airbus A320 family',55000,40,11000],
  B737:['Boeing 737',55000,40,11000],
  B75X:['Boeing 757/767',70000,50,12500],
  A330:['Airbus A330',80000,55,14000],
  B787:['Boeing 787',85000,55,15000],
  A350:['Airbus A350',90000,60,16000],
  B777:['Boeing 777',95000,60,16500],
  B747:['Boeing 747',100000,70,17000],
  A380:['Airbus A380',110000,80,19000],
  A340:['Airbus A340',85000,55,14500],
  RUCN:['Avions russes & chinois (Superjet, MC-21, COMAC)',50000,40,10000],
  MD:['McDonnell Douglas & Boeing 717',70000,50,12000],
  CONC:['Concorde (supersonique)',120000,90,22000],
};

// Modèles : id, nom, constructeur, famille, sièges, cargo (t), autonomie km, vitesse croisière km/h,
// conso L/h, prix M$, classe de piste mini, altitude croisière (m)
const MODELS = [
  ['C208','Cessna 208 Caravan','Cessna','TURBO',12,0,1700,340,210,2.6,1,6000],
  ['DHC6','DHC-6 Twin Otter 400','De Havilland','TURBO',19,0,1480,330,300,7.5,1,6000],
  ['Q400','Dash 8-400','De Havilland','TURBO',78,0,2000,660,1000,32,2,7600],
  ['AT46','ATR 42-600','ATR','TURBO',48,0,1300,535,600,19.5,1,7600],
  ['AT76','ATR 72-600','ATR','TURBO',72,0,1500,510,750,26,2,7600],
  ['AT7F','ATR 72-600F','ATR','TURBO',0,8.5,1500,510,760,24,2,7600],
  ['CRJ2','CRJ200','Bombardier','CRJ',50,0,3000,785,1600,25,2,11000],
  ['CRJ7','CRJ700','Bombardier','CRJ',70,0,2650,830,1900,36,3,11000],
  ['CRJ9','CRJ900','Bombardier','CRJ',90,0,2950,830,2100,46,3,11000],
  ['E175','Embraer E175','Embraer','EMB',78,0,3700,830,2000,50,3,11000],
  ['E190','Embraer E190','Embraer','EMB',100,0,4500,830,2400,52,3,11000],
  ['E295','Embraer E195-E2','Embraer','EMB',132,0,4800,830,2600,60,3,11000],
  ['BCS1','Airbus A220-100','Airbus','A220',120,0,6300,830,2500,81,3,11000],
  ['BCS3','Airbus A220-300','Airbus','A220',145,0,6200,830,2800,91,3,11000],
  ['A19N','Airbus A319neo','Airbus','A320',140,0,6900,830,2900,101,3,11300],
  ['A20N','Airbus A320neo','Airbus','A320',180,0,6300,830,3000,111,3,11300],
  ['A21N','Airbus A321neo','Airbus','A320',220,0,7400,830,3400,129,3,11300],
  ['A21X','Airbus A321XLR','Airbus','A320',200,0,8700,830,3400,142,3,11300],
  ['B738','Boeing 737-800','Boeing','B737',189,0,5400,840,3100,106,3,11300],
  ['B38M','Boeing 737 MAX 8','Boeing','B737',178,0,6570,840,2700,121,3,11300],
  ['B3XM','Boeing 737 MAX 10','Boeing','B737',204,0,6110,840,2950,134,3,11300],
  ['B38F','Boeing 737-800BCF','Boeing','B737',0,23,3700,840,3100,35,3,11300],
  ['B752','Boeing 757-200','Boeing','B75X',200,0,7250,850,4200,80,3,11600],
  ['B763','Boeing 767-300ER','Boeing','B75X',269,0,11000,850,6000,217,4,11600],
  ['B76F','Boeing 767-300F','Boeing','B75X',0,52,6000,850,6100,220,4,11600],
  ['A333','Airbus A330-300','Airbus','A330',300,0,11750,870,7000,264,4,11900],
  ['A339','Airbus A330-900neo','Airbus','A330',287,0,13300,870,6200,296,4,11900],
  ['A33F','Airbus A330-200F','Airbus','A330',0,70,7400,870,6800,240,4,11900],
  ['B788','Boeing 787-8','Boeing','B787',248,0,13600,900,6000,248,4,12500],
  ['B789','Boeing 787-9','Boeing','B787',296,0,14000,900,6500,292,4,12500],
  ['B78X','Boeing 787-10','Boeing','B787',336,0,11900,900,7000,338,4,12500],
  ['A359','Airbus A350-900','Airbus','A350',325,0,15000,900,7200,317,4,12500],
  ['A35K','Airbus A350-1000','Airbus','A350',366,0,16100,900,8300,366,4,12500],
  ['B77E','Boeing 777-200ER','Boeing','B777',313,0,13080,905,8800,306,4,11900],
  ['B77W','Boeing 777-300ER','Boeing','B777',396,0,13650,905,9500,375,4,11900],
  ['B779','Boeing 777-9','Boeing','B777',426,0,13500,905,9300,442,5,11900],
  ['B77F','Boeing 777F','Boeing','B777',0,102,9200,905,9500,352,4,11900],
  ['B744','Boeing 747-400 (occasion)','Boeing','B747',416,0,13450,910,13500,95,5,11300],
  ['B748','Boeing 747-8 Intercontinental','Boeing','B747',467,0,14300,910,12800,418,5,11900],
  ['B74F','Boeing 747-8F','Boeing','B747',0,134,8100,910,12500,419,5,11900],
  ['A388','Airbus A380-800','Airbus','A380',555,0,15200,900,13700,445,5,12500],
  ['CONC','Concorde','Aérospatiale/BAC','CONC',100,0,7200,2150,25600,250,4,18000],
  ['SF34','Saab 340B','Saab','TURBO',34,0,1700,500,450,8,1,7600],
  ['DH8C','Dash 8-300','De Havilland','TURBO',50,0,1700,530,650,17,2,7600],
  ['E145','Embraer ERJ145','Embraer','EMB',50,0,2900,830,1500,25,2,11000],
  ['E170','Embraer E170','Embraer','EMB',72,0,3900,830,1900,45,3,11000],
  ['E195','Embraer E195','Embraer','EMB',124,0,4200,830,2600,50,3,11000],
  ['E290','Embraer E190-E2','Embraer','EMB',114,0,5300,830,2300,59,3,11000],
  ['SU95','Sukhoi Superjet 100','Sukhoi','RUCN',98,0,4500,830,2300,35,3,11000],
  ['AJ27','COMAC C909 (ARJ21)','COMAC','RUCN',90,0,2200,820,2200,38,3,11000],
  ['C919','COMAC C919','COMAC','RUCN',168,0,4100,830,3000,99,3,11300],
  ['MC21','Irkut MC-21-300','Irkut','RUCN',180,0,6000,850,2900,90,3,11300],
  ['A318','Airbus A318','Airbus','A320',107,0,5700,830,2600,77,3,11300],
  ['A320','Airbus A320ceo (occasion)','Airbus','A320',180,0,6100,830,3300,55,3,11300],
  ['A321','Airbus A321ceo','Airbus','A320',220,0,5900,830,3700,65,3,11300],
  ['B737','Boeing 737-700','Boeing','B737',140,0,6300,840,2900,75,3,11300],
  ['B39M','Boeing 737 MAX 9','Boeing','B737',193,0,6570,840,2850,128,3,11300],
  ['B712','Boeing 717-200','Boeing','MD',110,0,3800,810,2400,30,3,11000],
  ['B753','Boeing 757-300','Boeing','B75X',243,0,6400,850,4500,85,3,11600],
  ['B75F','Boeing 757-200F','Boeing','B75X',0,39,5800,850,4300,60,3,11600],
  ['B764','Boeing 767-400ER','Boeing','B75X',296,0,10400,850,6400,230,4,11600],
  ['A332','Airbus A330-200','Airbus','A330',247,0,13450,870,6500,238,4,11900],
  ['A343','Airbus A340-300 (occasion)','Airbus','A340',295,0,13700,870,9000,120,4,11900],
  ['A346','Airbus A340-600','Airbus','A340',380,0,14400,880,11000,160,4,11900],
  ['A35F','Airbus A350F','Airbus','A350',0,111,8700,900,7800,400,4,12500],
  ['B77L','Boeing 777-200LR','Boeing','B777',317,0,15800,905,9000,346,4,11900],
  ['B778','Boeing 777-8','Boeing','B777',395,0,16200,905,9100,410,5,11900],
  ['MD11','McDonnell Douglas MD-11F','McDonnell Douglas','MD',0,91,6700,880,9500,45,4,11300],
].map(([id,name,maker,fam,seats,cargo,range,speed,burn,price,cls,alt])=>({id,name,maker,fam,seats,cargo,range,speed,burn,price,cls,alt}));

const MAINT = {
  A:{every:600, label:'Check A', days:0.5, cost:(m)=>15000+Math.max(m.seats,m.cargo*3)*150},
  C:{every:3000, label:'Check C', days:6, cost:(m)=>200000+Math.max(m.seats,m.cargo*3)*3500},
  D:{every:12000, label:'Check D (grande visite)', days:25, cost:(m)=>1500000+Math.max(m.seats,m.cargo*3)*22000},
};

const LOAN_PRODUCTS = [
  {id:'court', name:'Crédit de trésorerie', amount:5e6, months:12, rate:0.07, minNet:0},
  {id:'equip', name:"Prêt d'équipement", amount:40e6, months:36, rate:0.085, minNet:20e6},
  {id:'flotte', name:'Financement de flotte', amount:200e6, months:60, rate:0.095, minNet:80e6},
];

const CAMPAIGNS = [
  {id:'radio', name:'Radio & affichage national', cost:150000, days:30, scope:'home', boost:0.15, rep:2, desc:'Radios, panneaux et presse dans votre pays'},
  {id:'digital', name:'Campagne digitale', cost:400000, days:30, scope:'all', boost:0.08, rep:3, desc:'Réseaux sociaux, moteurs de recherche, influenceurs'},
  {id:'tv', name:'TV internationale', cost:2500000, days:45, scope:'intl', boost:0.15, rep:6, desc:'Spots sur les chaînes d’info internationales'},
  {id:'leopards', name:'Sponsoring de l’équipe nationale', cost:5000000, days:90, scope:'home', boost:0.25, rep:10, desc:'Votre logo sur le maillot de l’équipe nationale de football'},
];

const ALLIANCES = [
  {id:'afri', name:'Alliance régionale', minRep:40, minFleet:3, fee:50000, scope:'region', boost:0.12, desc:'Partage de codes avec les compagnies de votre continent'},
  {id:'sky', name:'SkyTeam', minRep:65, minFleet:12, fee:300000, scope:'intl', boost:0.14, desc:'Partage de codes avec de grands transporteurs européens'},
  {id:'star', name:'Star Alliance', minRep:70, minFleet:15, fee:400000, scope:'intl', boost:0.16, desc:'Le plus grand réseau mondial'},
  {id:'one', name:'oneworld', minRep:75, minFleet:20, fee:450000, scope:'intl', boost:0.18, desc:'Réseau premium, forte clientèle affaires'},
];

// Événements : effets appliqués pendant la durée
const EVENT_TYPES = [
  {id:'oil_crisis', name:'Crise pétrolière', icon:'🛢️', p:0.006, days:[30,60], oil:1.6, desc:'Le baril s’envole : le kérosène coûte beaucoup plus cher.'},
  {id:'oil_glut', name:'Surproduction de pétrole', icon:'⛽', p:0.006, days:[30,60], oil:0.7, desc:'Le baril chute : bonne période pour voler.'},
  {id:'tourism', name:'Boom du tourisme', icon:'🏖️', p:0.006, days:[20,45], demand:1.25, desc:'La demande mondiale grimpe de 25 %.'},
  {id:'recession', name:'Récession mondiale', icon:'📉', p:0.004, days:[45,90], demand:0.82, desc:'Les voyageurs se font rares.'},
  {id:'pandemic', name:'Pandémie', icon:'🦠', p:0.0008, days:[60,120], demand:0.35, desc:'Restrictions sanitaires : la demande s’effondre.'},
  {id:'strike', name:'Grève des contrôleurs', icon:'✊', p:0.008, days:[2,6], closeRandom:true, desc:'Un grand aéroport est fermé.'},
  {id:'nyiragongo', name:'Éruption du Nyiragongo', icon:'🌋', p:0.003, days:[8,20], close:['GOM'], drc:true, desc:'L’aéroport de Goma est fermé par les cendres volcaniques.'},
  {id:'ebola', name:'Alerte Ebola dans l’Est', icon:'⚕️', p:0.003, days:[30,70], regions:['Nord-Kivu','Ituri','Équateur','Tshuapa'], regionDemand:0.55, drc:true, desc:'La demande chute dans les provinces touchées.'},
  {id:'mining', name:'Boom minier au Katanga', icon:'⛏️', p:0.005, days:[30,80], regions:['Haut-Katanga','Lualaba','Haut-Lomami'], regionDemand:1.5, cargo:1.4, drc:true, desc:'Cuivre et cobalt : affluence vers Lubumbashi et Kolwezi.'},
  {id:'rain', name:'Grandes pluies', icon:'🌧️', p:0.006, days:[3,8], closeLaterite:true, drc:true, desc:'Les pistes en latérite sont impraticables.'},
  {id:'insecurity', name:'Insécurité dans le Kivu', icon:'⚠️', p:0.004, days:[20,50], regions:['Nord-Kivu','Ituri','Sud-Kivu'], regionDemand:0.7, drc:true, desc:'Demande en baisse et assurances plus chères.'},
  {id:'fuel_drc', name:'Pénurie de carburant en RDC', icon:'⛽', p:0.004, days:[7,20], drcFuel:1.5, drc:true, desc:'Le Jet A1 se fait rare dans les aéroports congolais.'},
  // ---- événements mondiaux et régionaux ----
  {id:'hurricane', name:'Ouragan dans les Caraïbes', icon:'🌀', p:0.006, days:[2,5], closeZone:a=>a.lat>10&&a.lat<30&&a.lon>-90&&a.lon<-58&&a.cls>=3, closeCount:3, desc:'Plusieurs aéroports des Caraïbes et du golfe du Mexique sont fermés.'},
  {id:'typhoon', name:'Typhon en Asie de l’Est', icon:'🌪️', p:0.006, days:[2,4], closeZone:a=>a.lat>12&&a.lat<36&&a.lon>105&&a.lon<142&&a.cls>=3, closeCount:3, desc:'Des aéroports de Chine du Sud, Taïwan, Philippines ou Japon sont fermés.'},
  {id:'snow', name:'Tempête de neige', icon:'❄️', p:0.007, days:[1,3], closeZone:a=>a.lat>40&&a.large&&(COUNTRIES[a.cc][1]==='EU'||COUNTRIES[a.cc][1]==='NA'), closeCount:2, winter:true, desc:'De grands aéroports d’Europe ou d’Amérique du Nord sont paralysés.'},
  {id:'ash', name:'Nuage de cendres volcaniques', icon:'🌋', p:0.002, days:[3,8], closeNear:['KEF','DPS','CTS','UIO','CTA'], radius:700, desc:'Tous les aéroports autour du volcan sont fermés.'},
  {id:'monsoon', name:'Mousson en Asie du Sud', icon:'🌧️', p:0.004, days:[20,45], ccs:['IN','BD','LK','NP','PK','MM'], ccDemand:0.8, desc:'Retards et baisse de la demande en Inde et dans les pays voisins.'},
  {id:'sport', name:'Grand événement sportif', icon:'🏟️', p:0.004, days:[12,25], boostRandom:true, boost:1.6, desc:'Coupe du monde, Jeux… : la demande explose vers la ville hôte.'},
  {id:'hajj', name:'Pèlerinage du Hajj', icon:'🕋', p:0.003, days:[15,25], ccs:['SA'], ccDemand:1.6, desc:'Afflux de pèlerins vers Djeddah et Médine.'},
  {id:'lny', name:'Nouvel An lunaire', icon:'🧧', p:0.003, days:[10,18], ccs:['CN','HK','TW','VN','KR','SG','MY'], ccDemand:1.4, desc:'Le plus grand mouvement de population au monde.'},
  {id:'visa', name:'Exemption de visas', icon:'🛂', p:0.003, days:[60,120], ccsRandom:true, ccDemand:1.3, desc:'Un pays supprime les visas touristiques : la demande grimpe.'},
  {id:'fikin', name:'FIKIN – Foire internationale de Kinshasa', icon:'🎪', p:0.004, days:[10,15], regions:['Kinshasa'], regionDemand:1.35, drc:true, desc:'Afflux d’affaires vers la capitale.'},
];

const FIRST_NAMES_CD = ['Patrick','Jean-Pierre','Christelle','Fiston','Grâce','Merveille','Junior','Héritier','Rachel','Dieudonné','Blaise','Sarah','Trésor','Jonathan','Esther','Cédric','Nathalie','Fabrice','Prisca','Olivier','Gloire','Ruth','Serge','Bénédicte'];
const LAST_NAMES_CD = ['Mukendi','Kabila','Tshisekedi','Mbuyi','Kalala','Ilunga','Lukusa','Kasongo','Mwamba','Nzuzi','Lumbala','Bakajika','Mulumba','Kanku','Tshibanda','Matondo','Makiese','Lokombe','Bokungu','Mpiana','Ngoy','Kayembe','Banza','Tshimanga'];
const FIRST_NAMES_W = ['Lucas','Emma','Thomas','Sofia','David','Amina','Kwame','Chen','Yuki','Carlos','Fatou','Ahmed','Olga','Ibrahim','Marie','Pedro','Hannah','Ravi'];
const LAST_NAMES_W = ['Martin','Dubois','Okafor','Mensah','Silva','Kowalski','Müller','Diallo','Nakamura','Haddad','Rossi','Johnson','Ndiaye','Kamau','Patel','Van Damme'];

// Frontière de la RD Congo (Natural Earth 1:50m via world-atlas, domaine public) — [lat, lon]
const DRC_BORDER = [[-8.193,30.75],[-8.219,30.577],[-8.258,30.329],[-8.301,30.051],[-8.344,29.767],[-8.388,29.482],[-8.428,29.216],[-8.464,28.971],[-8.485,28.899],[-8.591,28.935],[-8.7,28.917],[-8.785,28.87],[-8.891,28.795],[-8.933,28.759],[-9.014,28.68],[-9.072,28.615],[-9.169,28.485],[-9.224,28.399],[-9.275,28.399],[-9.509,28.539],[-9.679,28.604],[-9.832,28.629],[-9.919,28.629],[-10.099,28.622],[-10.313,28.618],[-10.398,28.608],[-10.551,28.647],[-10.669,28.64],[-10.803,28.543],[-10.933,28.518],[-11.11,28.471],[-11.355,28.402],[-11.483,28.356],[-11.566,28.384],[-11.624,28.406],[-11.698,28.431],[-11.813,28.482],[-11.879,28.543],[-11.908,28.575],[-12.051,28.77],[-12.12,28.849],[-12.257,28.975],[-12.349,29.065],[-12.37,29.191],[-12.405,29.342],[-12.431,29.428],[-12.419,29.486],[-12.386,29.504],[-12.318,29.5],[-12.268,29.493],[-12.228,29.508],[-12.202,29.558],[-12.198,29.691],[-12.164,29.749],[-12.155,29.796],[-12.306,29.796],[-12.45,29.796],[-12.625,29.796],[-12.827,29.796],[-12.992,29.796],[-13.167,29.796],[-13.37,29.796],[-13.393,29.796],[-13.438,29.774],[-13.453,29.724],[-13.415,29.652],[-13.374,29.648],[-13.299,29.63],[-13.261,29.598],[-13.249,29.554],[-13.268,29.482],[-13.323,29.382],[-13.37,29.252],[-13.398,29.202],[-13.394,29.112],[-13.368,29.014],[-13.308,28.942],[-13.214,28.921],[-13.12,28.86],[-12.981,28.773],[-12.926,28.73],[-12.861,28.672],[-12.854,28.615],[-12.835,28.55],[-12.742,28.51],[-12.624,28.474],[-12.577,28.453],[-12.518,28.413],[-12.481,28.359],[-12.434,28.237],[-12.368,28.068],[-12.285,27.859],[-12.282,27.758],[-12.266,27.643],[-12.228,27.574],[-12.195,27.535],[-12.08,27.488],[-11.945,27.423],[-11.783,27.24],[-11.605,27.196],[-11.579,27.16],[-11.594,27.096],[-11.617,27.045],[-11.664,27.027],[-11.825,26.977],[-11.9,26.948],[-11.919,26.93],[-11.943,26.89],[-11.966,26.826],[-11.976,26.728],[-11.973,26.595],[-11.948,26.43],[-11.929,26.34],[-11.903,26.095],[-11.891,26.026],[-11.855,25.926],[-11.82,25.854],[-11.743,25.62],[-11.754,25.512],[-11.7,25.461],[-11.674,25.414],[-11.624,25.35],[-11.554,25.321],[-11.405,25.281],[-11.325,25.292],[-11.237,25.321],[-11.212,25.288],[-11.212,25.245],[-11.243,25.184],[-11.261,25.076],[-11.299,24.878],[-11.322,24.806],[-11.337,24.727],[-11.353,24.669],[-11.438,24.518],[-11.448,24.468],[-11.417,24.378],[-11.372,24.334],[-11.32,24.378],[-11.256,24.396],[-11.131,24.367],[-11.072,24.32],[-11.03,24.187],[-11.026,24.136],[-10.955,24.115],[-10.891,24.079],[-10.879,24.003],[-10.872,23.967],[-10.891,23.928],[-10.943,23.906],[-10.983,23.902],[-11.014,23.834],[-11.007,23.697],[-10.978,23.56],[-10.969,23.463],[-10.976,23.398],[-11.075,23.157],[-11.087,23.078],[-11.08,22.815],[-11.059,22.668],[-11.056,22.56],[-11.087,22.488],[-11.16,22.394],[-11.198,22.315],[-11.195,22.279],[-11.164,22.257],[-11.122,22.225],[-11.013,22.218],[-10.893,22.178],[-10.83,22.203],[-10.783,22.279],[-10.691,22.308],[-10.551,22.282],[-10.454,22.282],[-10.396,22.304],[-10.259,22.275],[-10.04,22.196],[-9.863,22.088],[-9.726,21.948],[-9.594,21.858],[-9.469,21.814],[-9.169,21.829],[-8.903,21.872],[-8.693,21.904],[-8.341,21.897],[-8.112,21.8],[-7.865,21.778],[-7.601,21.832],[-7.421,21.843],[-7.329,21.807],[-7.315,21.782],[-7.306,21.75],[-7.298,21.512],[-7.285,21.192],[-7.282,20.911],[-7.278,20.608],[-7.244,20.558],[-7.183,20.536],[-7.122,20.536],[-6.935,20.598],[-6.919,20.59],[-6.916,20.482],[-6.947,20.191],[-6.976,19.996],[-6.987,19.874],[-7.037,19.662],[-7.145,19.528],[-7.28,19.485],[-7.391,19.489],[-7.473,19.482],[-7.558,19.42],[-7.655,19.37],[-7.707,19.37],[-7.966,19.341],[-8.001,19.143],[-8.001,18.945],[-7.999,18.898],[-7.936,18.654],[-7.936,18.564],[-7.969,18.484],[-8.001,18.333],[-8.023,18.193],[-8.101,18.049],[-8.108,18.009],[-8.068,17.912],[-8.072,17.779],[-8.091,17.642],[-8.1,17.581],[-8.075,17.538],[-7.883,17.412],[-7.624,17.246],[-7.461,17.156],[-7.419,17.12],[-7.363,17.062],[-7.258,16.983],[-7.157,16.951],[-7.061,16.965],[-6.935,16.918],[-6.773,16.814],[-6.619,16.742],[-6.471,16.71],[-6.346,16.702],[-6.242,16.717],[-6.164,16.699],[-6.115,16.641],[-6.051,16.609],[-6.025,16.584],[-5.966,16.537],[-5.9,16.432],[-5.865,16.314],[-5.865,16.062],[-5.864,15.727],[-5.869,15.424],[-5.874,15.09],[-5.879,14.751],[-5.89,14.658],[-5.893,14.398],[-5.876,14.19],[-5.865,14.114],[-5.857,13.977],[-5.855,13.765],[-5.862,13.65],[-5.862,13.372],[-5.864,13.347],[-5.883,13.304],[-5.857,13.185],[-5.865,13.07],[-5.836,13.002],[-5.855,12.861],[-5.877,12.793],[-5.961,12.681],[-6.004,12.516],[-6.001,12.454],[-5.987,12.411],[-5.895,12.314],[-5.808,12.242],[-5.759,12.213],[-5.747,12.256],[-5.728,12.386],[-5.72,12.483],[-5.695,12.505],[-5.424,12.519],[-5.148,12.523],[-5.112,12.487],[-5.091,12.454],[-5.072,12.451],[-5.037,12.501],[-4.997,12.573],[-4.978,12.595],[-4.905,12.674],[-4.737,12.829],[-4.695,12.948],[-4.652,13.056],[-4.635,13.074],[-4.602,13.088],[-4.605,13.138],[-4.621,13.153],[-4.655,13.178],[-4.706,13.221],[-4.765,13.297],[-4.829,13.376],[-4.838,13.416],[-4.805,13.477],[-4.756,13.552],[-4.721,13.66],[-4.688,13.686],[-4.619,13.7],[-4.542,13.707],[-4.454,13.718],[-4.442,13.74],[-4.433,13.779],[-4.459,13.851],[-4.485,13.884],[-4.485,13.941],[-4.461,13.977],[-4.418,14.046],[-4.4,14.136],[-4.358,14.226],[-4.305,14.316],[-4.299,14.359],[-4.369,14.402],[-4.419,14.442],[-4.449,14.449],[-4.508,14.409],[-4.586,14.366],[-4.681,14.402],[-4.775,14.413],[-4.831,14.409],[-4.853,14.442],[-4.865,14.463],[-4.852,14.496],[-4.855,14.557],[-4.884,14.632],[-4.881,14.708],[-4.846,14.78],[-4.706,14.913],[-4.461,15.108],[-4.308,15.266],[-4.246,15.396],[-4.171,15.482],[-4.088,15.525],[-4.03,15.601],[-3.985,15.756],[-3.935,15.871],[-3.767,15.99],[-3.464,16.148],[-3.194,16.191],[-3.03,16.216],[-2.464,16.202],[-2.279,16.191],[-2.178,16.216],[-2.109,16.274],[-1.961,16.432],[-1.84,16.54],[-1.699,16.623],[-1.376,16.782],[-1.272,16.85],[-1.227,16.879],[-1.14,16.976],[-1.065,17.109],[-0.999,17.278],[-0.775,17.541],[-0.55,17.754],[-0.277,17.725],[-0.053,17.772],[0.235,17.887],[0.537,17.926],[0.856,17.887],[1.119,17.901],[1.422,18.013],[1.535,18.06],[1.719,18.074],[2.013,18.07],[2.415,18.211],[2.655,18.344],[2.924,18.492],[3.087,18.546],[3.304,18.621],[3.478,18.61],[3.679,18.596],[3.954,18.632],[4.117,18.621],[4.257,18.567],[4.346,18.592],[4.382,18.7],[4.523,18.83],[4.891,19.068],[5.071,19.323],[5.127,19.5],[5.122,19.687],[5.089,19.806],[5.032,19.863],[4.945,20.004],[4.83,20.227],[4.686,20.392],[4.542,20.486],[4.462,20.558],[4.436,20.648],[4.447,20.792],[4.414,20.954],[4.332,21.127],[4.302,21.231],[4.323,21.267],[4.311,21.35],[4.245,21.537],[4.282,21.688],[4.254,21.908],[4.136,22.423],[4.155,22.448],[4.16,22.462],[4.207,22.506],[4.445,22.617],[4.592,22.711],[4.646,22.754],[4.724,22.866],[4.743,22.992],[4.736,23.118],[4.703,23.218],[4.664,23.312],[4.664,23.416],[4.702,23.524],[4.771,23.683],[4.816,23.848],[4.867,23.992],[4.953,24.226],[4.993,24.32],[5.011,24.439],[4.931,24.766],[4.983,24.979],[4.967,25.065],[5.025,25.249],[5.063,25.285],[5.256,25.4],[5.313,25.526],[5.283,25.713],[5.254,25.821],[5.17,26.174],[5.085,26.631],[5.071,26.768],[5.063,26.822],[5.075,26.869],[5.184,27.02],[5.2,27.07],[5.198,27.114],[5.11,27.402],[5.039,27.438],[4.967,27.492],[4.846,27.664],[4.778,27.718],[4.703,27.762],[4.644,27.787],[4.598,27.841],[4.568,27.916],[4.532,27.981],[4.48,28.021],[4.424,28.078],[4.351,28.194],[4.349,28.248],[4.339,28.312],[4.318,28.366],[4.325,28.428],[4.374,28.525],[4.455,28.64],[4.506,28.726],[4.486,28.939],[4.447,29.058],[4.388,29.151],[4.393,29.223],[4.499,29.385],[4.611,29.468],[4.636,29.551],[4.587,29.677],[4.481,29.781],[4.327,29.871],[4.268,29.932],[4.177,30.023],[3.981,30.195],[3.884,30.422],[3.835,30.509],[3.787,30.537],[3.723,30.555],[3.653,30.559],[3.624,30.588],[3.634,30.649],[3.644,30.699],[3.624,30.757],[3.573,30.797],[3.533,30.818],[3.49,30.84],[3.464,30.894],[3.408,30.908],[3.342,30.869],[3.283,30.829],[3.164,30.779],[3.042,30.753],[3.002,30.786],[2.967,30.822],[2.933,30.84],[2.893,30.851],[2.848,30.847],[2.678,30.771],[2.53,30.728],[2.455,30.728],[2.4,30.829],[2.403,30.962],[2.369,31.005],[2.315,31.045],[2.289,31.081],[2.289,31.139],[2.27,31.178],[2.233,31.193],[2.191,31.236],[2.146,31.275],[2.089,31.257],[2.044,31.254],[1.922,31.16],[1.683,30.944],[1.238,30.48],[1.238,30.476],[1.185,30.321],[1.103,30.239],[0.973,30.185],[0.863,30.048],[0.82,29.943],[0.792,29.932],[0.674,29.925],[0.499,29.936],[0.419,29.886],[0.263,29.814],[0.166,29.778],[0.146,29.749],[0.098,29.716],[-0.06,29.698],[-0.114,29.684],[-0.442,29.634],[-0.536,29.648],[-0.692,29.608],[-0.782,29.605],[-0.886,29.59],[-0.977,29.562],[-1.121,29.565],[-1.357,29.58],[-1.388,29.576],[-1.409,29.536],[-1.468,29.468],[-1.508,29.403],[-1.518,29.353],[-1.621,29.266],[-1.72,29.198],[-1.815,29.144],[-1.86,29.13],[-1.985,29.14],[-2.131,29.148],[-2.195,29.133],[-2.234,29.108],[-2.313,28.989],[-2.371,28.914],[-2.4,28.878],[-2.447,28.856],[-2.555,28.892],[-2.635,28.896],[-2.681,28.921],[-2.72,29.014],[-2.758,29.014],[-2.8,29.018],[-2.852,29.065],[-2.956,29.155],[-3.053,29.223],[-3.138,29.227],[-3.28,29.212],[-3.364,29.209],[-3.475,29.216],[-3.685,29.216],[-3.834,29.212],[-3.911,29.223],[-4.095,29.331],[-4.299,29.378],[-4.449,29.403],[-4.497,29.403],[-4.669,29.367],[-4.836,29.324],[-4.898,29.324],[-4.983,29.342],[-5.176,29.421],[-5.317,29.475],[-5.402,29.504],[-5.499,29.544],[-5.65,29.594],[-5.723,29.608],[-5.777,29.598],[-5.966,29.49],[-6.025,29.479],[-6.173,29.508],[-6.313,29.54],[-6.395,29.59],[-6.617,29.709],[-6.692,29.799],[-6.803,29.961],[-6.916,30.105],[-6.973,30.163],[-7.037,30.213],[-7.204,30.314],[-7.339,30.375],[-7.461,30.408],[-7.627,30.487],[-7.782,30.559],[-7.971,30.653],[-8.105,30.721],[-8.193,30.75]];

// Articles Wikipédia (anglais) dont la photo principale illustre chaque modèle
// (photos libres de droits de Wikimedia Commons, chargées par le navigateur du joueur)
const WIKI_TITLES = {
  C208:'Cessna 208 Caravan', DHC6:'de Havilland Canada DHC-6 Twin Otter', Q400:'De Havilland Canada Dash 8',
  AT46:'ATR 42', AT76:'ATR 72', AT7F:'ATR 72',
  CRJ2:'Bombardier CRJ100/200', CRJ7:'Bombardier CRJ700 series', CRJ9:'Bombardier CRJ700 series',
  E175:'Embraer E-Jet family', E190:'Embraer E-Jet family', E295:'Embraer E-Jet E2 family',
  BCS1:'Airbus A220', BCS3:'Airbus A220',
  A19N:'Airbus A320neo family', A20N:'Airbus A320neo family', A21N:'Airbus A321neo', A21X:'Airbus A321XLR',
  B738:'Boeing 737 Next Generation', B38M:'Boeing 737 MAX', B3XM:'Boeing 737 MAX', B38F:'Boeing 737 Next Generation',
  B752:'Boeing 757', B763:'Boeing 767', B76F:'Boeing 767',
  A333:'Airbus A330', A339:'Airbus A330neo', A33F:'Airbus A330',
  B788:'Boeing 787 Dreamliner', B789:'Boeing 787 Dreamliner', B78X:'Boeing 787 Dreamliner',
  A359:'Airbus A350', A35K:'Airbus A350',
  B77E:'Boeing 777', B77W:'Boeing 777', B779:'Boeing 777X', B77F:'Boeing 777',
  B744:'Boeing 747-400', B748:'Boeing 747-8', B74F:'Boeing 747-8',
  A388:'Airbus A380', CONC:'Concorde',
  SF34:'Saab 340', DH8C:'De Havilland Canada Dash 8', E145:'Embraer ERJ family', E170:'Embraer E-Jet family', E195:'Embraer E-Jet family', E290:'Embraer E-Jet E2 family',
  SU95:'Sukhoi Superjet 100', AJ27:'Comac ARJ21', C919:'Comac C919', MC21:'Irkut MC-21', A318:'Airbus A318', A320:'Airbus A320 family', A321:'Airbus A321',
  B737:'Boeing 737 Next Generation', B39M:'Boeing 737 MAX', B712:'Boeing 717', B753:'Boeing 757', B75F:'Boeing 757', B764:'Boeing 767',
  A332:'Airbus A330', A343:'Airbus A340', A346:'Airbus A340', A35F:'Airbus A350', B77L:'Boeing 777', B778:'Boeing 777X', MD11:'McDonnell Douglas MD-11',
};
