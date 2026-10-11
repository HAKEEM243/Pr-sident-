/* =========================================================
   Sky Empire — villes congolaises supplémentaires
   Des villes et chefs-lieux de RDC dotés d'un aérodrome (pistes en
   latérite au départ, à améliorer). Coordonnées approximatives,
   codes inventés quand le vrai code n'est pas connu du jeu.
   Format : [ville, province, lat, lon, piste m, population (milliers)]
   ========================================================= */
'use strict';
const DRC_TOWNS=[
  ['Uvira','Sud-Kivu',-3.40,29.14,1400,700],['Likasi','Haut-Katanga',-10.98,26.73,1600,600],['Kasongo','Maniema',-4.45,26.67,1300,90],
  ['Kasongo-Lunda','Kwango',-6.47,16.82,1200,60],['Idiofa','Kwilu',-4.96,19.59,1200,80],['Gungu','Kwilu',-5.73,19.32,1100,60],
  ['Kahemba','Kwango',-7.28,19.00,1300,70],['Mushie','Mai-Ndombe',-3.02,16.92,1100,40],['Kiri','Mai-Ndombe',-1.43,19.00,1100,35],
  ['Oshwe','Mai-Ndombe',-3.40,19.50,1100,30],['Tshela','Kongo-Central',-4.98,12.93,1200,60],['Lukula','Kongo-Central',-5.38,12.95,1100,50],
  ['Mbanza-Ngungu','Kongo-Central',-5.25,14.86,1300,200],['Kimpese','Kongo-Central',-5.55,14.43,1100,80],['Bulungu','Kwilu',-4.55,18.60,1100,70],
  ['Masi-Manimba','Kwilu',-4.78,17.92,1100,50],['Feshi','Kwango',-6.12,18.17,1100,30],['Tshimbulu','Kasaï-Central',-6.48,22.85,1200,90],
  ['Luiza','Kasaï-Central',-7.20,22.42,1200,60],['Demba','Kasaï-Central',-5.51,22.27,1100,50],['Mwene-Ditu','Lomami',-7.00,23.45,1500,250],
  ['Kabalo','Tanganyika',-6.05,26.92,1400,40],['Nyunzu','Tanganyika',-5.95,28.02,1100,30],['Kipushi','Haut-Katanga',-11.76,27.25,1300,150],
  ['Kasumbalesa','Haut-Katanga',-12.25,27.80,1300,100],['Sakania','Haut-Katanga',-12.75,28.56,1100,30],['Dilolo','Lualaba',-10.70,22.33,1300,40],
  ['Kapanga','Lualaba',-8.35,22.58,1200,30],['Sandoa','Lualaba',-9.69,22.90,1200,35],['Kasaji','Lualaba',-10.37,23.45,1100,25],
  ['Bukama','Haut-Lomami',-9.20,25.85,1200,40],['Malemba-Nkulu','Haut-Lomami',-8.03,26.80,1100,45],['Mitwaba','Haut-Katanga',-8.63,27.33,1100,25],
  ['Kasenga','Haut-Katanga',-10.36,28.63,1100,40],['Shabunda','Sud-Kivu',-2.69,27.34,1200,40],['Mwenga','Sud-Kivu',-3.04,28.43,1100,30],
  ['Walikale','Nord-Kivu',-1.42,28.05,1200,30],['Masisi','Nord-Kivu',-1.40,28.82,1000,40],['Rutshuru','Nord-Kivu',-1.19,29.45,1100,80],
  ['Lubero','Nord-Kivu',-0.16,29.24,1100,40],['Mambasa','Ituri',1.36,29.05,1200,40],['Aru','Ituri',2.87,30.84,1300,70],
  ['Mahagi','Ituri',2.30,30.99,1200,60],['Watsa','Haut-Uele',3.04,29.53,1300,40],['Dungu','Haut-Uele',3.62,28.57,1300,50],
  ['Faradje','Haut-Uele',3.73,29.71,1100,25],['Aketi','Bas-Uele',2.74,23.78,1200,50],['Bondo','Bas-Uele',3.81,23.67,1200,30],
  ['Poko','Bas-Uele',3.15,26.88,1100,20],['Bafwasende','Tshopo',1.08,27.27,1100,20],['Lubutu','Maniema',-0.73,26.58,1200,30],
  ['Punia','Maniema',-1.47,26.45,1200,35],['Opala','Tshopo',-0.62,24.36,1100,20],['Yangambi','Tshopo',0.77,24.45,1300,35],
  ['Basoko','Tshopo',1.24,23.60,1200,40],['Businga','Nord-Ubangi',3.34,20.88,1100,40],['Zongo','Sud-Ubangi',4.34,18.59,1200,60],
  ['Libenge','Sud-Ubangi',3.66,18.63,1200,40],['Bikoro','Équateur',-0.75,18.12,1100,30],['Bolomba','Équateur',0.48,19.20,1100,20],
  ['Djolu','Tshuapa',0.62,22.43,1100,25],['Befale','Tshuapa',0.43,20.97,1100,20],['Monkoto','Tshuapa',-1.63,20.65,1100,20],
  ['Lomela','Sankuru',-2.31,23.28,1100,25],['Kibombo','Maniema',-3.90,25.92,1100,30],['Kabambare','Maniema',-4.70,27.72,1100,25],
  ['Pangi','Maniema',-3.20,26.63,1100,25],
];
// populations (milliers d'habitants) des villes déjà présentes dans le jeu (estimations arrondies)
const DRC_CITY_POP={'Kinshasa':17000,'Lubumbashi':2800,'Mbuji-Mayi':2800,'Kananga':1600,'Kisangani':1400,'Goma':1100,'Bukavu':1200,'Tshikapa':1000,
  'Kolwezi':700,'Matadi':550,'Boma':350,'Mbandaka':450,'Kikwit':550,'Muanda':100,'Bunia':900,'Beni':400,'Butembo':900,'Kindu':300,'Kalemie':300,
  'Gemena':300,'Bandundu':200,'Kamina':200,'Isiro':250,'Ilebo':150,'Boende':80,'Basankusu':60,'Lisala':90,'Kabinda':150,'Kongolo':100,'Manono':80,
  'Gandajika':200,'Buta':90,'Lusambo':60,'Pweto':60,'Moba':50,'Mweka':50,'Inongo':60,'Lodja':120,'Bumba':180,'Gbadolite':200};
