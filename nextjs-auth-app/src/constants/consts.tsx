export const GetPrecinctsDictionary: Record<number,string> = {
  0: "Alabang",
  1: "Bayanan",
  2: "Buli",
  3: "Cupang",
  4: "Poblacion",
  5: "Putatan",
  6: "Tunasan",
  7: "Ayala Alabang", // Fixed underscore
  8: "Sucat"
};

// Mapping from precinct numbers to names for API lookup
export const PrecinctNumberToNameMap: Record<number, string> = {
  0: "Alabang",
  1: "Bayanan", 
  2: "Buli",
  3: "Cupang",
  4: "Poblacion",
  5: "Putatan",
  6: "Tunasan",
  7: "Ayala Alabang",
  8: "Sucat"
};

// Mapping from GUID PrecinctIds to precinct numbers for API lookup
export const PrecinctGuidToNumberMap: Record<string, number> = {
  "88888888-8888-8888-8888-888888888888": 0, // Alabang
  "11111111-1111-1111-1111-111111111111": 1, // Bayanan
  "22222222-2222-2222-2222-222222222222": 2, // Buli
  "33333333-3333-3333-3333-333333333333": 3, // Cupang
  "44444444-4444-4444-4444-444444444444": 4, // Poblacion
  "55555555-5555-5555-5555-555555555555": 5, // Putatan
  "66666666-6666-6666-6666-666666666666": 6, // Tunasan
  "77777777-7777-7777-7777-777777777777": 7, // Ayala Alabang
  "99999999-9999-9999-9999-999999999999": 8  // Sucat
};

export const CrimeTypesDictionary: Record<number, string> = {
  0: "Arson", 1: "Assault", 2: "Burglary", 3: "Corruption", 4: "Counterfeiting",
  5: "Cyber Crime", 6: "Domestic Violence", 7: "Drug Trafficking", 8: "Embezzlement", 9: "Extortion",
  10: "Fraud", 11: "Human Trafficking", 12: "Homicide", 13: "Illegal Possession Of Firearms",
  14: "Kidnapping", 15: "Murder", 16: "Rape", 17: "Robbery", 18: "Theft", 19: "Vandalism"
};
