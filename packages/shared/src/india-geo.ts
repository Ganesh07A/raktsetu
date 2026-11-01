// Official Pan-India States & Districts data with eRaktKosh official codes
export interface DistrictInfo {
  name: string;
  code: string;
}

export interface StateInfo {
  name?: string;
  code: string;
  districts: DistrictInfo[];
}

export const INDIA_STATES_DATA: Record<string, StateInfo> = {
  "Andaman and Nicobar Islands": {
    "code": "35",
    "districts": [
      {
        "name": "Nicobars",
        "code": "638"
      },
      {
        "name": "North  & Middle Andaman",
        "code": "639"
      },
      {
        "name": "South Andaman",
        "code": "640"
      }
    ],
    "name": "Andaman and Nicobar Islands"
  },
  "Andhra Pradesh": {
    "code": "28",
    "districts": [
      {
        "name": "Alluri Sitharama Raju",
        "code": "679"
      },
      {
        "name": "Anakapalli",
        "code": "680"
      },
      {
        "name": "Ananthapuramu",
        "code": "553"
      },
      {
        "name": "Annamayya",
        "code": "753"
      },
      {
        "name": "Bapatla",
        "code": "750"
      },
      {
        "name": "Chittoor",
        "code": "554"
      },
      {
        "name": "Dr. B. R. Ambedkar Konaseema",
        "code": "682"
      },
      {
        "name": "East Godavari",
        "code": "545"
      },
      {
        "name": "Eluru",
        "code": "748"
      },
      {
        "name": "Guntur",
        "code": "548"
      },
      {
        "name": "Kakinada",
        "code": "681"
      },
      {
        "name": "Krishna",
        "code": "547"
      },
      {
        "name": "Kurnool",
        "code": "552"
      },
      {
        "name": "Markapuram",
        "code": "536"
      },
      {
        "name": "Nandyal",
        "code": "755"
      },
      {
        "name": "NTR",
        "code": "749"
      },
      {
        "name": "Palnadu",
        "code": "751"
      },
      {
        "name": "Parvathipuram Manyam",
        "code": "743"
      },
      {
        "name": "Polavaram",
        "code": "532"
      },
      {
        "name": "Prakasam",
        "code": "549"
      },
      {
        "name": "Srikakulam",
        "code": "542"
      },
      {
        "name": "Sri Potti Sriramulu Nellore",
        "code": "550"
      },
      {
        "name": "Sri Sathya Sai",
        "code": "754"
      },
      {
        "name": "Tirupati",
        "code": "752"
      },
      {
        "name": "Visakhapatnam",
        "code": "544"
      },
      {
        "name": "Vizianagaram",
        "code": "543"
      },
      {
        "name": "West Godavari",
        "code": "546"
      },
      {
        "name": "Y.S.R.",
        "code": "551"
      }
    ],
    "name": "Andhra Pradesh"
  },
  "Arunachal Pradesh": {
    "code": "12",
    "districts": [
      {
        "name": "Anjaw",
        "code": "260"
      },
      {
        "name": "Bichom",
        "code": "787"
      },
      {
        "name": "Changlang",
        "code": "253"
      },
      {
        "name": "Dibang Valley",
        "code": "257"
      },
      {
        "name": "East Kameng",
        "code": "247"
      },
      {
        "name": "East Siang",
        "code": "251"
      },
      {
        "name": "Kamle",
        "code": "701"
      },
      {
        "name": "Keyi Panyor",
        "code": "786"
      },
      {
        "name": "Kra Daadi",
        "code": "702"
      },
      {
        "name": "Kurung Kumey",
        "code": "256"
      },
      {
        "name": "Lepa-Rada",
        "code": "703"
      },
      {
        "name": "Lohit",
        "code": "259"
      },
      {
        "name": "Longding",
        "code": "642"
      },
      {
        "name": "Lower Dibang Valley",
        "code": "258"
      },
      {
        "name": "Lower Siang",
        "code": "704"
      },
      {
        "name": "Lower Subansiri",
        "code": "255"
      },
      {
        "name": "Namsai",
        "code": "678"
      },
      {
        "name": "Pakke-Kessang",
        "code": "706"
      },
      {
        "name": "Papum Pare",
        "code": "248"
      },
      {
        "name": "Shi Yomi",
        "code": "707"
      },
      {
        "name": "Siang",
        "code": "709"
      },
      {
        "name": "Tawang",
        "code": "245"
      },
      {
        "name": "Tirap",
        "code": "254"
      },
      {
        "name": "Upper Siang",
        "code": "252"
      },
      {
        "name": "Upper Subansiri",
        "code": "249"
      },
      {
        "name": "West Kameng",
        "code": "246"
      },
      {
        "name": "West Siang",
        "code": "250"
      }
    ],
    "name": "Arunachal Pradesh"
  },
  "Assam": {
    "code": "18",
    "districts": [
      {
        "name": "Bajali",
        "code": "990"
      },
      {
        "name": "Baksa",
        "code": "324"
      },
      {
        "name": "Barpeta",
        "code": "303"
      },
      {
        "name": "Bishwanath",
        "code": "710"
      },
      {
        "name": "Bongaigaon",
        "code": "319"
      },
      {
        "name": "Cachar",
        "code": "316"
      },
      {
        "name": "Charaideo",
        "code": "711"
      },
      {
        "name": "Chirang",
        "code": "320"
      },
      {
        "name": "Darrang",
        "code": "325"
      },
      {
        "name": "Dhemaji",
        "code": "308"
      },
      {
        "name": "Dhubri",
        "code": "301"
      },
      {
        "name": "Dibrugarh",
        "code": "310"
      },
      {
        "name": "Dima Hasao",
        "code": "315"
      },
      {
        "name": "Goalpara",
        "code": "302"
      },
      {
        "name": "Golaghat",
        "code": "313"
      },
      {
        "name": "Hailakandi",
        "code": "318"
      },
      {
        "name": "Hojai",
        "code": "712"
      },
      {
        "name": "Jorhat",
        "code": "312"
      },
      {
        "name": "Kamrup",
        "code": "321"
      },
      {
        "name": "Kamrup Metro",
        "code": "322"
      },
      {
        "name": "Karbi Anglong",
        "code": "314"
      },
      {
        "name": "Karimganj",
        "code": "317"
      },
      {
        "name": "Kokrajhar",
        "code": "300"
      },
      {
        "name": "Lakhimpur",
        "code": "307"
      },
      {
        "name": "Majuli",
        "code": "713"
      },
      {
        "name": "Morigaon",
        "code": "304"
      },
      {
        "name": "Nagaon",
        "code": "305"
      },
      {
        "name": "Nalbari",
        "code": "323"
      },
      {
        "name": "Sivasagar",
        "code": "311"
      },
      {
        "name": "Sonitpur",
        "code": "306"
      },
      {
        "name": "South Salmara",
        "code": "714"
      },
      {
        "name": "Tamulpur",
        "code": "716"
      },
      {
        "name": "Tinsukia",
        "code": "309"
      },
      {
        "name": "Udalguri",
        "code": "326"
      },
      {
        "name": "West Karbi Anglong",
        "code": "715"
      }
    ],
    "name": "Assam"
  },
  "Bihar": {
    "code": "10",
    "districts": [
      {
        "name": "Araria",
        "code": "209"
      },
      {
        "name": "Arwal",
        "code": "240"
      },
      {
        "name": "Aurangabad",
        "code": "235"
      },
      {
        "name": "Banka",
        "code": "225"
      },
      {
        "name": "Begusarai",
        "code": "222"
      },
      {
        "name": "Bhagalpur",
        "code": "224"
      },
      {
        "name": "Bhojpur",
        "code": "231"
      },
      {
        "name": "Buxar",
        "code": "232"
      },
      {
        "name": "Darbhanga",
        "code": "215"
      },
      {
        "name": "Gaya",
        "code": "236"
      },
      {
        "name": "Gopalganj",
        "code": "217"
      },
      {
        "name": "Jamui",
        "code": "238"
      },
      {
        "name": "Jehanabad",
        "code": "239"
      },
      {
        "name": "Kaimur (Bhabua)",
        "code": "233"
      },
      {
        "name": "Katihar",
        "code": "212"
      },
      {
        "name": "Khagaria",
        "code": "223"
      },
      {
        "name": "Kishanganj",
        "code": "210"
      },
      {
        "name": "Lakhisarai",
        "code": "227"
      },
      {
        "name": "Madhepura",
        "code": "213"
      },
      {
        "name": "Madhubani",
        "code": "207"
      },
      {
        "name": "Munger",
        "code": "226"
      },
      {
        "name": "Muzaffarpur",
        "code": "216"
      },
      {
        "name": "Nalanda",
        "code": "229"
      },
      {
        "name": "Nawada",
        "code": "237"
      },
      {
        "name": "Pashchim Champaran",
        "code": "203"
      },
      {
        "name": "Patna",
        "code": "230"
      },
      {
        "name": "Purba Champaran",
        "code": "204"
      },
      {
        "name": "Purnia",
        "code": "211"
      },
      {
        "name": "Rohtas",
        "code": "234"
      },
      {
        "name": "Saharsa",
        "code": "214"
      },
      {
        "name": "Samastipur",
        "code": "221"
      },
      {
        "name": "Saran",
        "code": "219"
      },
      {
        "name": "Sheikhpura",
        "code": "228"
      },
      {
        "name": "Sheohar",
        "code": "205"
      },
      {
        "name": "Sitamarhi",
        "code": "206"
      },
      {
        "name": "Siwan",
        "code": "218"
      },
      {
        "name": "Supaul",
        "code": "208"
      },
      {
        "name": "Vaishali",
        "code": "220"
      }
    ],
    "name": "Bihar"
  },
  "Chandigarh": {
    "code": "94",
    "districts": [
      {
        "name": "Chandigarh",
        "code": "55"
      }
    ],
    "name": "Chandigarh"
  },
  "Chhattisgarh": {
    "code": "22",
    "districts": [
      {
        "name": "Balod",
        "code": "643"
      },
      {
        "name": "Baloda Bazaar",
        "code": "644"
      },
      {
        "name": "Balrampur- Ramanujganj",
        "code": "645"
      },
      {
        "name": "Bastar",
        "code": "414"
      },
      {
        "name": "Bemetra",
        "code": "646"
      },
      {
        "name": "Bharatpur",
        "code": "760"
      },
      {
        "name": "Bijapur",
        "code": "417"
      },
      {
        "name": "Bilaigarh",
        "code": "763"
      },
      {
        "name": "Bilaspur",
        "code": "406"
      },
      {
        "name": "Dantewada",
        "code": "416"
      },
      {
        "name": "Dhamtari",
        "code": "412"
      },
      {
        "name": "Durg",
        "code": "409"
      },
      {
        "name": "Gariyaband",
        "code": "647"
      },
      {
        "name": "Gaurella Pendra Marwahi",
        "code": "997"
      },
      {
        "name": "Janjgir - Champa",
        "code": "405"
      },
      {
        "name": "Jashpur",
        "code": "402"
      },
      {
        "name": "Kabirdham",
        "code": "407"
      },
      {
        "name": "Kanker",
        "code": "413"
      },
      {
        "name": "Khairgarh Chhuikhadan Gandai",
        "code": "759"
      },
      {
        "name": "Kondagaon",
        "code": "648"
      },
      {
        "name": "Korba",
        "code": "404"
      },
      {
        "name": "Koriya",
        "code": "400"
      },
      {
        "name": "Mahasamund",
        "code": "411"
      },
      {
        "name": "Mohla-Manpur-Ambagarh Chouki",
        "code": "761"
      },
      {
        "name": "Mungeli",
        "code": "649"
      },
      {
        "name": "Narayanpur",
        "code": "415"
      },
      {
        "name": "Raigarh",
        "code": "403"
      },
      {
        "name": "Raipur",
        "code": "410"
      },
      {
        "name": "Rajnandgaon",
        "code": "408"
      },
      {
        "name": "Sakti Sarangarh",
        "code": "762"
      },
      {
        "name": "Sukma",
        "code": "651"
      },
      {
        "name": "Surajpur",
        "code": "650"
      },
      {
        "name": "Surguja",
        "code": "401"
      }
    ],
    "name": "Chhattisgarh"
  },
  "Dadra And Nagar Haveli And Daman And Diu": {
    "code": "25",
    "districts": [
      {
        "name": "Dadra & Nagar Haveli",
        "code": "496"
      },
      {
        "name": "Daman",
        "code": "495"
      },
      {
        "name": "Diu",
        "code": "494"
      }
    ],
    "name": "Dadra And Nagar Haveli And Daman And Diu"
  },
  "Delhi": {
    "code": "97",
    "districts": [
      {
        "name": "Central Delhi",
        "code": "95"
      },
      {
        "name": "East Delhi",
        "code": "93"
      },
      {
        "name": "New Delhi",
        "code": "94"
      },
      {
        "name": "North Delhi",
        "code": "91"
      },
      {
        "name": "North East Delhi",
        "code": "92"
      },
      {
        "name": "North West Delhi",
        "code": "90"
      },
      {
        "name": "Shahdara",
        "code": "653"
      },
      {
        "name": "South Delhi",
        "code": "98"
      },
      {
        "name": "South East Delhi",
        "code": "652"
      },
      {
        "name": "South West Delhi",
        "code": "97"
      },
      {
        "name": "West Delhi",
        "code": "96"
      }
    ],
    "name": "Delhi"
  },
  "Goa": {
    "code": "30",
    "districts": [
      {
        "name": "North Goa",
        "code": "585"
      },
      {
        "name": "south Goa",
        "code": "586"
      }
    ],
    "name": "Goa"
  },
  "Gujarat": {
    "code": "24",
    "districts": [
      {
        "name": "Ahmedabad",
        "code": "474"
      },
      {
        "name": "Amreli",
        "code": "480"
      },
      {
        "name": "Anand",
        "code": "482"
      },
      {
        "name": "Aravalli",
        "code": "656"
      },
      {
        "name": "Banas Kantha",
        "code": "469"
      },
      {
        "name": "Bharuch",
        "code": "488"
      },
      {
        "name": "Bhavnagar",
        "code": "481"
      },
      {
        "name": "Botad",
        "code": "803"
      },
      {
        "name": "Chhotaudepur",
        "code": "655"
      },
      {
        "name": "Dahod",
        "code": "485"
      },
      {
        "name": "Dang",
        "code": "654"
      },
      {
        "name": "Devbhoomi Dwarka",
        "code": "717"
      },
      {
        "name": "Gandhinagar",
        "code": "473"
      },
      {
        "name": "Gir Somnath",
        "code": "718"
      },
      {
        "name": "Jamnagar",
        "code": "477"
      },
      {
        "name": "Junagadh",
        "code": "479"
      },
      {
        "name": "Kachchh",
        "code": "468"
      },
      {
        "name": "Kheda",
        "code": "483"
      },
      {
        "name": "Mahesana",
        "code": "471"
      },
      {
        "name": "Mahisagar",
        "code": "657"
      },
      {
        "name": "Morbi",
        "code": "676"
      },
      {
        "name": "Narmada",
        "code": "487"
      },
      {
        "name": "Navsari ",
        "code": "490"
      },
      {
        "name": "Panch Mahals",
        "code": "484"
      },
      {
        "name": "Patan",
        "code": "470"
      },
      {
        "name": "Porbandar",
        "code": "478"
      },
      {
        "name": "Rajkot",
        "code": "476"
      },
      {
        "name": "Sabar Kantha",
        "code": "472"
      },
      {
        "name": "Surat",
        "code": "492"
      },
      {
        "name": "Surendranagar",
        "code": "475"
      },
      {
        "name": "Tapi",
        "code": "493"
      },
      {
        "name": "Vadodara",
        "code": "486"
      },
      {
        "name": "Valsad",
        "code": "491"
      },
      {
        "name": "Vav-Tharad",
        "code": "489"
      }
    ],
    "name": "Gujarat"
  },
  "Haryana": {
    "code": "96",
    "districts": [
      {
        "name": "Ambala",
        "code": "70"
      },
      {
        "name": "Bhiwani",
        "code": "81"
      },
      {
        "name": "Charkhi Dadri",
        "code": "719"
      },
      {
        "name": "Faridabad",
        "code": "88"
      },
      {
        "name": "Fatehabad",
        "code": "78"
      },
      {
        "name": "Gurgaon",
        "code": "86"
      },
      {
        "name": "Hisar",
        "code": "80"
      },
      {
        "name": "Jhajjar",
        "code": "83"
      },
      {
        "name": "Jind",
        "code": "77"
      },
      {
        "name": "Kaithal",
        "code": "73"
      },
      {
        "name": "Karnal",
        "code": "74"
      },
      {
        "name": "Kurukshetra",
        "code": "72"
      },
      {
        "name": "Mahendragarh",
        "code": "84"
      },
      {
        "name": "Nuh",
        "code": "720"
      },
      {
        "name": "Palwal ",
        "code": "89"
      },
      {
        "name": "Panchkula",
        "code": "69"
      },
      {
        "name": "Panipat",
        "code": "75"
      },
      {
        "name": "Rewari",
        "code": "85"
      },
      {
        "name": "Rohtak",
        "code": "82"
      },
      {
        "name": "Sirsa",
        "code": "79"
      },
      {
        "name": "Sonipat",
        "code": "76"
      },
      {
        "name": "Yamunanagar",
        "code": "71"
      }
    ],
    "name": "Haryana"
  },
  "Himachal Pradesh": {
    "code": "92",
    "districts": [
      {
        "name": "Bilaspur",
        "code": "30"
      },
      {
        "name": "Chamba",
        "code": "23"
      },
      {
        "name": "Hamirpur",
        "code": "28"
      },
      {
        "name": "Kangra",
        "code": "24"
      },
      {
        "name": "Kinnaur",
        "code": "34"
      },
      {
        "name": "Kullu",
        "code": "26"
      },
      {
        "name": "Lahul & Spiti",
        "code": "25"
      },
      {
        "name": "Mandi",
        "code": "27"
      },
      {
        "name": "Shimla",
        "code": "33"
      },
      {
        "name": "Sirmaur",
        "code": "32"
      },
      {
        "name": "Solan",
        "code": "31"
      },
      {
        "name": "Una",
        "code": "29"
      }
    ],
    "name": "Himachal Pradesh"
  },
  "Jammu and Kashmir": {
    "code": "91",
    "districts": [
      {
        "name": "Anantnag",
        "code": "14"
      },
      {
        "name": "Badgam",
        "code": "2"
      },
      {
        "name": "Bandipore",
        "code": "9"
      },
      {
        "name": "Baramula",
        "code": "8"
      },
      {
        "name": "Doda",
        "code": "16"
      },
      {
        "name": "Ganderbal",
        "code": "11"
      },
      {
        "name": "Jammu",
        "code": "21"
      },
      {
        "name": "Kathua",
        "code": "7"
      },
      {
        "name": "Kishtwar",
        "code": "18"
      },
      {
        "name": "Kulgam",
        "code": "15"
      },
      {
        "name": "Kupwara",
        "code": "1"
      },
      {
        "name": "Poonch",
        "code": "5"
      },
      {
        "name": "Pulwama",
        "code": "12"
      },
      {
        "name": "Rajouri",
        "code": "6"
      },
      {
        "name": "Ramban",
        "code": "17"
      },
      {
        "name": "Reasi",
        "code": "20"
      },
      {
        "name": "Samba",
        "code": "22"
      },
      {
        "name": "Shopian",
        "code": "13"
      },
      {
        "name": "Srinagar",
        "code": "10"
      },
      {
        "name": "Udhampur",
        "code": "19"
      }
    ],
    "name": "Jammu and Kashmir"
  },
  "Jharkhand": {
    "code": "20",
    "districts": [
      {
        "name": "Bokaro",
        "code": "355"
      },
      {
        "name": "Chatra",
        "code": "347"
      },
      {
        "name": "Deoghar",
        "code": "350"
      },
      {
        "name": "Dhanbad",
        "code": "354"
      },
      {
        "name": "Dumka",
        "code": "362"
      },
      {
        "name": "Garhwa",
        "code": "346"
      },
      {
        "name": "Giridih",
        "code": "349"
      },
      {
        "name": "Godda",
        "code": "351"
      },
      {
        "name": "Gumla",
        "code": "366"
      },
      {
        "name": "Hazaribagh",
        "code": "360"
      },
      {
        "name": "Jamtara",
        "code": "363"
      },
      {
        "name": "Khunti",
        "code": "365"
      },
      {
        "name": "Kodarma",
        "code": "348"
      },
      {
        "name": "Latehar",
        "code": "359"
      },
      {
        "name": "Lohardaga",
        "code": "356"
      },
      {
        "name": "Pakur",
        "code": "353"
      },
      {
        "name": "Palamu",
        "code": "358"
      },
      {
        "name": "Pashchimi Singhbhum",
        "code": "368"
      },
      {
        "name": "Purbi Singhbhum",
        "code": "357"
      },
      {
        "name": "Ramgarh",
        "code": "361"
      },
      {
        "name": "Ranchi",
        "code": "364"
      },
      {
        "name": "Sahibganj",
        "code": "352"
      },
      {
        "name": "Saraikela-Kharsawan",
        "code": "369"
      },
      {
        "name": "Simdega",
        "code": "367"
      }
    ],
    "name": "Jharkhand"
  },
  "Karnataka": {
    "code": "29",
    "districts": [
      {
        "name": "Bagalkot",
        "code": "556"
      },
      {
        "name": "Ballari",
        "code": "565"
      },
      {
        "name": "Bangalore Rural",
        "code": "583"
      },
      {
        "name": "Bangalore Urban",
        "code": "572"
      },
      {
        "name": "Belagavi",
        "code": "555"
      },
      {
        "name": "Bidar",
        "code": "558"
      },
      {
        "name": "Chamarajanagar",
        "code": "578"
      },
      {
        "name": "Chikkaballapura",
        "code": "582"
      },
      {
        "name": "Chikmagalur",
        "code": "570"
      },
      {
        "name": "Chitradurga",
        "code": "566"
      },
      {
        "name": "Dakshina Kannada",
        "code": "575"
      },
      {
        "name": "Davanagere",
        "code": "567"
      },
      {
        "name": "Dharwad",
        "code": "562"
      },
      {
        "name": "Gadag",
        "code": "561"
      },
      {
        "name": "Hassan",
        "code": "574"
      },
      {
        "name": "Haveri",
        "code": "564"
      },
      {
        "name": "Kalaburagi",
        "code": "721"
      },
      {
        "name": "Kodagu",
        "code": "576"
      },
      {
        "name": "Kolar",
        "code": "581"
      },
      {
        "name": "Koppal",
        "code": "560"
      },
      {
        "name": "Mandya",
        "code": "573"
      },
      {
        "name": "Mysore",
        "code": "577"
      },
      {
        "name": "Raichur",
        "code": "559"
      },
      {
        "name": "Ramanagara",
        "code": "584"
      },
      {
        "name": "Shimoga",
        "code": "568"
      },
      {
        "name": "Tumkur",
        "code": "571"
      },
      {
        "name": "Udupi",
        "code": "569"
      },
      {
        "name": "Uttara Kannada",
        "code": "563"
      },
      {
        "name": "Vijayanagara",
        "code": "764"
      },
      {
        "name": "Vijayapura",
        "code": "722"
      },
      {
        "name": "Yadgir",
        "code": "580"
      }
    ],
    "name": "Karnataka"
  },
  "Kerala": {
    "code": "32",
    "districts": [
      {
        "name": "Alappuzha",
        "code": "598"
      },
      {
        "name": "Ernakulam",
        "code": "595"
      },
      {
        "name": "Idukki",
        "code": "596"
      },
      {
        "name": "Kannur",
        "code": "589"
      },
      {
        "name": "Kasaragod",
        "code": "588"
      },
      {
        "name": "Kollam",
        "code": "600"
      },
      {
        "name": "Kottayam",
        "code": "597"
      },
      {
        "name": "Kozhikode",
        "code": "591"
      },
      {
        "name": "Malappuram",
        "code": "592"
      },
      {
        "name": "Palakkad",
        "code": "593"
      },
      {
        "name": "Pathanamthitta",
        "code": "599"
      },
      {
        "name": "Thiruvananthapuram",
        "code": "601"
      },
      {
        "name": "Thrissur",
        "code": "594"
      },
      {
        "name": "Wayanad",
        "code": "590"
      }
    ],
    "name": "Kerala"
  },
  "Ladakh": {
    "code": "37",
    "districts": [
      {
        "name": "Kargil",
        "code": "4"
      },
      {
        "name": "Leh(Ladakh)",
        "code": "3"
      }
    ],
    "name": "Ladakh"
  },
  "Lakshadweep": {
    "code": "31",
    "districts": [
      {
        "name": "Lakshadweep",
        "code": "587"
      }
    ],
    "name": "Lakshadweep"
  },
  "Madhya Pradesh": {
    "code": "23",
    "districts": [
      {
        "name": "Agar Malwa",
        "code": "641"
      },
      {
        "name": "Alirajpur",
        "code": "465"
      },
      {
        "name": "Anuppur",
        "code": "461"
      },
      {
        "name": "Ashoknagar",
        "code": "459"
      },
      {
        "name": "Balaghat",
        "code": "457"
      },
      {
        "name": "Barwani",
        "code": "441"
      },
      {
        "name": "Betul",
        "code": "447"
      },
      {
        "name": "Bhind",
        "code": "420"
      },
      {
        "name": "Bhopal",
        "code": "444"
      },
      {
        "name": "Burhanpur",
        "code": "467"
      },
      {
        "name": "Chhatarpur",
        "code": "425"
      },
      {
        "name": "Chhindwara",
        "code": "455"
      },
      {
        "name": "Damoh",
        "code": "428"
      },
      {
        "name": "Datia",
        "code": "422"
      },
      {
        "name": "Dewas",
        "code": "437"
      },
      {
        "name": "Dhar",
        "code": "438"
      },
      {
        "name": "Dindori",
        "code": "453"
      },
      {
        "name": "Guna",
        "code": "458"
      },
      {
        "name": "Gwalior",
        "code": "421"
      },
      {
        "name": "Harda",
        "code": "448"
      },
      {
        "name": "Indore",
        "code": "439"
      },
      {
        "name": "Jabalpur",
        "code": "451"
      },
      {
        "name": "Jhabua",
        "code": "464"
      },
      {
        "name": "Katni",
        "code": "450"
      },
      {
        "name": "Khandwa (East Nimar)",
        "code": "466"
      },
      {
        "name": "Khargone (West Nimar)",
        "code": "440"
      },
      {
        "name": "Maihar",
        "code": "784"
      },
      {
        "name": "Mandla",
        "code": "454"
      },
      {
        "name": "Mandsaur",
        "code": "433"
      },
      {
        "name": "Mauganj",
        "code": "766"
      },
      {
        "name": "Morena",
        "code": "419"
      },
      {
        "name": "Narmadapuram",
        "code": "449"
      },
      {
        "name": "Narsimhapur",
        "code": "452"
      },
      {
        "name": "Neemuch",
        "code": "432"
      },
      {
        "name": "Niwari",
        "code": "723"
      },
      {
        "name": "Pandhurna",
        "code": "785"
      },
      {
        "name": "Panna",
        "code": "426"
      },
      {
        "name": "Raisen",
        "code": "446"
      },
      {
        "name": "Rajgarh",
        "code": "442"
      },
      {
        "name": "Ratlam",
        "code": "434"
      },
      {
        "name": "Rewa",
        "code": "430"
      },
      {
        "name": "Sagar",
        "code": "427"
      },
      {
        "name": "Satna",
        "code": "429"
      },
      {
        "name": "Sehore",
        "code": "445"
      },
      {
        "name": "Seoni",
        "code": "456"
      },
      {
        "name": "Shahdol",
        "code": "460"
      },
      {
        "name": "Shajapur",
        "code": "436"
      },
      {
        "name": "Sheopur ",
        "code": "418"
      },
      {
        "name": "Shivpuri",
        "code": "423"
      },
      {
        "name": "Sidhi",
        "code": "462"
      },
      {
        "name": "Singrauli",
        "code": "463"
      },
      {
        "name": "Tikamgarh",
        "code": "424"
      },
      {
        "name": "Ujjain",
        "code": "435"
      },
      {
        "name": "Umaria",
        "code": "431"
      },
      {
        "name": "Vidisha",
        "code": "443"
      }
    ],
    "name": "Madhya Pradesh"
  },
  "Maharashtra": {
    "code": "27",
    "districts": [
      {
        "name": "Ahmadnagar",
        "code": "522"
      },
      {
        "name": "Akola",
        "code": "501"
      },
      {
        "name": "Amravati",
        "code": "503"
      },
      {
        "name": "Bhandara",
        "code": "506"
      },
      {
        "name": "Bid",
        "code": "523"
      },
      {
        "name": "Buldana",
        "code": "500"
      },
      {
        "name": "Chandrapur",
        "code": "509"
      },
      {
        "name": "Chhatrapati Sambhajinagar",
        "code": "515"
      },
      {
        "name": "Dhule",
        "code": "498"
      },
      {
        "name": "Gadchiroli",
        "code": "508"
      },
      {
        "name": "Gondiya",
        "code": "507"
      },
      {
        "name": "Hingoli",
        "code": "512"
      },
      {
        "name": "Jalgaon",
        "code": "499"
      },
      {
        "name": "Jalna",
        "code": "514"
      },
      {
        "name": "Kolhapur",
        "code": "530"
      },
      {
        "name": "Latur",
        "code": "524"
      },
      {
        "name": "Mumbai",
        "code": "519"
      },
      {
        "name": "Mumbai Suburban",
        "code": "518"
      },
      {
        "name": "Nagpur",
        "code": "505"
      },
      {
        "name": "Nanded",
        "code": "511"
      },
      {
        "name": "Nandurbar",
        "code": "497"
      },
      {
        "name": "Nashik",
        "code": "516"
      },
      {
        "name": "Osmanabad",
        "code": "525"
      },
      {
        "name": "Palghar",
        "code": "669"
      },
      {
        "name": "Parbhani",
        "code": "513"
      },
      {
        "name": "Pune",
        "code": "521"
      },
      {
        "name": "Raigarh",
        "code": "520"
      },
      {
        "name": "Ratnagiri",
        "code": "528"
      },
      {
        "name": "Sangli",
        "code": "531"
      },
      {
        "name": "Satara",
        "code": "527"
      },
      {
        "name": "Sindhudurg",
        "code": "529"
      },
      {
        "name": "Solapur",
        "code": "526"
      },
      {
        "name": "Thane",
        "code": "517"
      },
      {
        "name": "Wardha",
        "code": "504"
      },
      {
        "name": "Washim",
        "code": "502"
      },
      {
        "name": "Yavatmal",
        "code": "510"
      }
    ],
    "name": "Maharashtra"
  },
  "Manipur": {
    "code": "14",
    "districts": [
      {
        "name": "Bishnupur",
        "code": "275"
      },
      {
        "name": "Chandel",
        "code": "280"
      },
      {
        "name": "Churachandpur",
        "code": "274"
      },
      {
        "name": "Imphal East",
        "code": "278"
      },
      {
        "name": "Imphal West",
        "code": "277"
      },
      {
        "name": "Jiribam",
        "code": "724"
      },
      {
        "name": "Kakching",
        "code": "725"
      },
      {
        "name": "Kamjong",
        "code": "726"
      },
      {
        "name": "Kangpokpi",
        "code": "727"
      },
      {
        "name": "Noney",
        "code": "728"
      },
      {
        "name": "Pherzawl",
        "code": "729"
      },
      {
        "name": "Senapati",
        "code": "272"
      },
      {
        "name": "Tamenglong",
        "code": "273"
      },
      {
        "name": "Tengnoupal",
        "code": "730"
      },
      {
        "name": "Thoubal",
        "code": "276"
      },
      {
        "name": "Ukhrul",
        "code": "279"
      }
    ],
    "name": "Manipur"
  },
  "Meghalaya": {
    "code": "17",
    "districts": [
      {
        "name": "Eastern West Khasi Hills",
        "code": "765"
      },
      {
        "name": "East Garo Hills",
        "code": "294"
      },
      {
        "name": "East Jaintia Hills",
        "code": "660"
      },
      {
        "name": "East Khasi Hills",
        "code": "298"
      },
      {
        "name": "North Garo Hills",
        "code": "659"
      },
      {
        "name": "Ribhoi",
        "code": "297"
      },
      {
        "name": "South Garo Hills",
        "code": "295"
      },
      {
        "name": "South West Garo Hills",
        "code": "662"
      },
      {
        "name": "South West Khasi Hills",
        "code": "661"
      },
      {
        "name": "West Garo Hills",
        "code": "293"
      },
      {
        "name": "West Jaintia Hills",
        "code": "658"
      },
      {
        "name": "West Khasi Hills",
        "code": "296"
      }
    ],
    "name": "Meghalaya"
  },
  "Mizoram": {
    "code": "15",
    "districts": [
      {
        "name": "Aizawl",
        "code": "283"
      },
      {
        "name": "Champhai",
        "code": "284"
      },
      {
        "name": "Hnahthial",
        "code": "767"
      },
      {
        "name": "Khawzawl",
        "code": "768"
      },
      {
        "name": "Kolasib",
        "code": "282"
      },
      {
        "name": "Lawngtlai",
        "code": "287"
      },
      {
        "name": "Lunglei",
        "code": "286"
      },
      {
        "name": "Mamit",
        "code": "281"
      },
      {
        "name": "Saitual",
        "code": "769"
      },
      {
        "name": "Serchhip",
        "code": "285"
      },
      {
        "name": "Siaha",
        "code": "288"
      }
    ],
    "name": "Mizoram"
  },
  "Nagaland": {
    "code": "13",
    "districts": [
      {
        "name": "Chumoukedima",
        "code": "993"
      },
      {
        "name": "Dimapur",
        "code": "265"
      },
      {
        "name": "Kiphire",
        "code": "269"
      },
      {
        "name": "Kohima",
        "code": "270"
      },
      {
        "name": "Longleng",
        "code": "268"
      },
      {
        "name": "Meluri",
        "code": "788"
      },
      {
        "name": "Mokokchung",
        "code": "262"
      },
      {
        "name": "Mon",
        "code": "261"
      },
      {
        "name": "Niuland",
        "code": "992"
      },
      {
        "name": "Noklak",
        "code": "736"
      },
      {
        "name": "Peren",
        "code": "271"
      },
      {
        "name": "Phek",
        "code": "266"
      },
      {
        "name": "Tseminyu",
        "code": "991"
      },
      {
        "name": "Tuensang",
        "code": "267"
      },
      {
        "name": "Wokha",
        "code": "264"
      },
      {
        "name": "Zunheboto",
        "code": "263"
      }
    ],
    "name": "Nagaland"
  },
  "Odisha": {
    "code": "21",
    "districts": [
      {
        "name": "Angul",
        "code": "384"
      },
      {
        "name": "Balangir",
        "code": "393"
      },
      {
        "name": "Baleshwar",
        "code": "377"
      },
      {
        "name": "Bargarh",
        "code": "382"
      },
      {
        "name": "Baudh",
        "code": "391"
      },
      {
        "name": "Bhadrak",
        "code": "378"
      },
      {
        "name": "Cuttack",
        "code": "381"
      },
      {
        "name": "Deogarh",
        "code": "373"
      },
      {
        "name": "Dhenkanal",
        "code": "383"
      },
      {
        "name": "Gajapati",
        "code": "389"
      },
      {
        "name": "Ganjam",
        "code": "388"
      },
      {
        "name": "Jagatsinghapur",
        "code": "380"
      },
      {
        "name": "Jajapur ",
        "code": "370"
      },
      {
        "name": "Jharsuguda",
        "code": "371"
      },
      {
        "name": "Kalahandi",
        "code": "395"
      },
      {
        "name": "Kandhamal",
        "code": "390"
      },
      {
        "name": "Kendrapara ",
        "code": "379"
      },
      {
        "name": "Kendujhar",
        "code": "375"
      },
      {
        "name": "Khordha",
        "code": "386"
      },
      {
        "name": "Koraput",
        "code": "398"
      },
      {
        "name": "Malkangiri",
        "code": "399"
      },
      {
        "name": "Mayurbhanj",
        "code": "376"
      },
      {
        "name": "Nabarangapur",
        "code": "397"
      },
      {
        "name": "Nayagarh ",
        "code": "385"
      },
      {
        "name": "Nuapada",
        "code": "394"
      },
      {
        "name": "Puri",
        "code": "387"
      },
      {
        "name": "Rayagada",
        "code": "396"
      },
      {
        "name": "Sambalpur",
        "code": "372"
      },
      {
        "name": "Subarnapur",
        "code": "392"
      },
      {
        "name": "Sundargarh",
        "code": "374"
      }
    ],
    "name": "Odisha"
  },
  "Puducherry": {
    "code": "34",
    "districts": [
      {
        "name": "Karaikal",
        "code": "637"
      },
      {
        "name": "Mahe",
        "code": "636"
      },
      {
        "name": "Puducherry",
        "code": "635"
      },
      {
        "name": "Yanam",
        "code": "634"
      }
    ],
    "name": "Puducherry"
  },
  "Punjab": {
    "code": "93",
    "districts": [
      {
        "name": "Amritsar",
        "code": "49"
      },
      {
        "name": "Barnala",
        "code": "54"
      },
      {
        "name": "Bathinda",
        "code": "46"
      },
      {
        "name": "Faridkot",
        "code": "45"
      },
      {
        "name": "Fatehgarh Sahib",
        "code": "40"
      },
      {
        "name": "Fazilka",
        "code": "663"
      },
      {
        "name": "Firozpur",
        "code": "43"
      },
      {
        "name": "Gurdaspur",
        "code": "35"
      },
      {
        "name": "Hoshiarpur",
        "code": "38"
      },
      {
        "name": "Jalandhar",
        "code": "37"
      },
      {
        "name": "Kapurthala",
        "code": "36"
      },
      {
        "name": "Ludhiana",
        "code": "41"
      },
      {
        "name": "Malerkotla",
        "code": "737"
      },
      {
        "name": "Mansa",
        "code": "47"
      },
      {
        "name": "Moga",
        "code": "42"
      },
      {
        "name": "Muktsar",
        "code": "44"
      },
      {
        "name": "Pathankot",
        "code": "664"
      },
      {
        "name": "Patiala",
        "code": "48"
      },
      {
        "name": "Rupnagar",
        "code": "51"
      },
      {
        "name": "Sahibzada Ajit Singh Nagar",
        "code": "52"
      },
      {
        "name": "Sangrur",
        "code": "53"
      },
      {
        "name": "Shahid Bhagat Singh Nagar ",
        "code": "39"
      },
      {
        "name": "Tarn Taran",
        "code": "50"
      }
    ],
    "name": "Punjab"
  },
  "Rajasthan": {
    "code": "98",
    "districts": [
      {
        "name": "Ajmer",
        "code": "119"
      },
      {
        "name": "Alwar",
        "code": "104"
      },
      {
        "name": "Balotara",
        "code": "684"
      },
      {
        "name": "Banswara",
        "code": "125"
      },
      {
        "name": "Baran",
        "code": "128"
      },
      {
        "name": "Barmer",
        "code": "115"
      },
      {
        "name": "Beawar",
        "code": "688"
      },
      {
        "name": "Bharatpur",
        "code": "105"
      },
      {
        "name": "Bhilwara",
        "code": "122"
      },
      {
        "name": "Bikaner",
        "code": "101"
      },
      {
        "name": "Bundi",
        "code": "121"
      },
      {
        "name": "Chittaurgarh",
        "code": "126"
      },
      {
        "name": "Churu",
        "code": "102"
      },
      {
        "name": "Dausa",
        "code": "109"
      },
      {
        "name": "Deeg",
        "code": "685"
      },
      {
        "name": "Dhaulpur",
        "code": "106"
      },
      {
        "name": "Didwana-Kuchaman",
        "code": "687"
      },
      {
        "name": "Dungarpur",
        "code": "124"
      },
      {
        "name": "Ganganagar",
        "code": "99"
      },
      {
        "name": "Hanumangarh",
        "code": "100"
      },
      {
        "name": "Jaipur",
        "code": "110"
      },
      {
        "name": "Jaisalmer",
        "code": "114"
      },
      {
        "name": "Jalor",
        "code": "116"
      },
      {
        "name": "Jhalawar",
        "code": "129"
      },
      {
        "name": "Jhunjhunun",
        "code": "103"
      },
      {
        "name": "Jodhpur",
        "code": "113"
      },
      {
        "name": "Karauli",
        "code": "107"
      },
      {
        "name": "Khairthal-Tijara",
        "code": "693"
      },
      {
        "name": "Kota",
        "code": "127"
      },
      {
        "name": "Kotputli-Behror",
        "code": "691"
      },
      {
        "name": "Nagaur",
        "code": "112"
      },
      {
        "name": "Pali",
        "code": "118"
      },
      {
        "name": "Phalodi",
        "code": "695"
      },
      {
        "name": "Pratapgarh",
        "code": "131"
      },
      {
        "name": "Rajsamand",
        "code": "123"
      },
      {
        "name": "Salumbar",
        "code": "696"
      },
      {
        "name": "Sawai Madhopur",
        "code": "108"
      },
      {
        "name": "Sikar",
        "code": "111"
      },
      {
        "name": "Sirohi",
        "code": "117"
      },
      {
        "name": "Tonk",
        "code": "120"
      },
      {
        "name": "Udaipur",
        "code": "130"
      }
    ],
    "name": "Rajasthan"
  },
  "Sikkim": {
    "code": "11",
    "districts": [
      {
        "name": "Gangtok",
        "code": "244"
      },
      {
        "name": "Gyalshing",
        "code": "242"
      },
      {
        "name": "Mangan",
        "code": "241"
      },
      {
        "name": "Namchi",
        "code": "243"
      },
      {
        "name": "Pakyong",
        "code": "705"
      },
      {
        "name": "Soreng",
        "code": "700"
      }
    ],
    "name": "Sikkim"
  },
  "Tamil Nadu": {
    "code": "33",
    "districts": [
      {
        "name": "Ariyalur",
        "code": "616"
      },
      {
        "name": "Chengalpattu",
        "code": "735"
      },
      {
        "name": "Chennai",
        "code": "603"
      },
      {
        "name": "Coimbatore",
        "code": "632"
      },
      {
        "name": "Cuddalore",
        "code": "617"
      },
      {
        "name": "Dharmapuri",
        "code": "630"
      },
      {
        "name": "Dindigul",
        "code": "612"
      },
      {
        "name": "Erode",
        "code": "610"
      },
      {
        "name": "Kallakurichi",
        "code": "733"
      },
      {
        "name": "Kanchipuram",
        "code": "604"
      },
      {
        "name": "Kanyakumari",
        "code": "629"
      },
      {
        "name": "Karur",
        "code": "613"
      },
      {
        "name": "Krishnagiri",
        "code": "631"
      },
      {
        "name": "Madurai",
        "code": "623"
      },
      {
        "name": "Mayiladuthurai",
        "code": "674"
      },
      {
        "name": "Nagapattinam",
        "code": "618"
      },
      {
        "name": "Namakkal",
        "code": "609"
      },
      {
        "name": "Perambalur",
        "code": "615"
      },
      {
        "name": "Pudukkottai",
        "code": "621"
      },
      {
        "name": "Ramanathapuram",
        "code": "626"
      },
      {
        "name": "Ranipet",
        "code": "731"
      },
      {
        "name": "Salem",
        "code": "608"
      },
      {
        "name": "Sivaganga",
        "code": "622"
      },
      {
        "name": "Tenkasi",
        "code": "747"
      },
      {
        "name": "Thanjavur",
        "code": "620"
      },
      {
        "name": "Theni ",
        "code": "624"
      },
      {
        "name": "The Nilgiris",
        "code": "611"
      },
      {
        "name": "Thiruvallur",
        "code": "602"
      },
      {
        "name": "Thiruvarur",
        "code": "619"
      },
      {
        "name": "Thoothukkudi",
        "code": "627"
      },
      {
        "name": "Tiruchirappalli",
        "code": "614"
      },
      {
        "name": "Tirunelveli",
        "code": "628"
      },
      {
        "name": "Tirupattur",
        "code": "732"
      },
      {
        "name": "Tiruppur",
        "code": "633"
      },
      {
        "name": "Tiruvannamalai",
        "code": "606"
      },
      {
        "name": "Vellore",
        "code": "605"
      },
      {
        "name": "Viluppuram",
        "code": "607"
      },
      {
        "name": "Virudhunagar",
        "code": "625"
      }
    ],
    "name": "Tamil Nadu"
  },
  "Telangana": {
    "code": "36",
    "districts": [
      {
        "name": "Adilabad",
        "code": "901"
      },
      {
        "name": "Bhadradri Kothagudem",
        "code": "911"
      },
      {
        "name": "Hanumakonda",
        "code": "677"
      },
      {
        "name": "Hyderabad",
        "code": "902"
      },
      {
        "name": "Jagtial",
        "code": "912"
      },
      {
        "name": "Jangaon",
        "code": "913"
      },
      {
        "name": "Jayashankar Bhupalpally",
        "code": "914"
      },
      {
        "name": "Jogulamba Gadwal",
        "code": "915"
      },
      {
        "name": "Kamareddy",
        "code": "916"
      },
      {
        "name": "Karimnagar",
        "code": "903"
      },
      {
        "name": "Khammam",
        "code": "904"
      },
      {
        "name": "Kumaram Bheem Asifabad",
        "code": "917"
      },
      {
        "name": "Mahabubabad",
        "code": "918"
      },
      {
        "name": "Mahbubnagar",
        "code": "905"
      },
      {
        "name": "Mancherial",
        "code": "919"
      },
      {
        "name": "Medak",
        "code": "906"
      },
      {
        "name": "Medchal Malkajgiri",
        "code": "920"
      },
      {
        "name": "Mulugu",
        "code": "998"
      },
      {
        "name": "Nagarkurnool",
        "code": "921"
      },
      {
        "name": "Nalgonda",
        "code": "999"
      },
      {
        "name": "Narayanpet",
        "code": "708"
      },
      {
        "name": "Nirmal",
        "code": "922"
      },
      {
        "name": "Nizamabad",
        "code": "907"
      },
      {
        "name": "Peddapalli",
        "code": "923"
      },
      {
        "name": "Rajanna Sircilla",
        "code": "924"
      },
      {
        "name": "Rangareddy",
        "code": "908"
      },
      {
        "name": "Sangareddy",
        "code": "925"
      },
      {
        "name": "Siddipet",
        "code": "926"
      },
      {
        "name": "Suryapet",
        "code": "927"
      },
      {
        "name": "Vikarabad",
        "code": "931"
      },
      {
        "name": "Wanaparthy",
        "code": "928"
      },
      {
        "name": "Warangal",
        "code": "910"
      },
      {
        "name": "Yadadri Bhuvanagiri",
        "code": "930"
      }
    ],
    "name": "Telangana"
  },
  "Tripura": {
    "code": "16",
    "districts": [
      {
        "name": "Dhalai",
        "code": "291"
      },
      {
        "name": "Gomati",
        "code": "667"
      },
      {
        "name": "Khowai",
        "code": "665"
      },
      {
        "name": "North Tripura",
        "code": "292"
      },
      {
        "name": "Sepahijala",
        "code": "666"
      },
      {
        "name": "South Tripura",
        "code": "290"
      },
      {
        "name": "Unakoti",
        "code": "668"
      },
      {
        "name": "West Tripura",
        "code": "289"
      }
    ],
    "name": "Tripura"
  },
  "Uttarakhand": {
    "code": "95",
    "districts": [
      {
        "name": "Almora",
        "code": "64"
      },
      {
        "name": "Bageshwar",
        "code": "63"
      },
      {
        "name": "Chamoli",
        "code": "57"
      },
      {
        "name": "Champawat",
        "code": "65"
      },
      {
        "name": "Dehradun",
        "code": "60"
      },
      {
        "name": "Haridwar",
        "code": "68"
      },
      {
        "name": "Nainital",
        "code": "66"
      },
      {
        "name": "Pauri Garhwal",
        "code": "61"
      },
      {
        "name": "Pithoragarh",
        "code": "62"
      },
      {
        "name": "Rudraprayag",
        "code": "58"
      },
      {
        "name": "Tehri Garhwal",
        "code": "59"
      },
      {
        "name": "Udham Singh Nagar",
        "code": "67"
      },
      {
        "name": "Uttarkashi",
        "code": "56"
      }
    ],
    "name": "Uttarakhand"
  },
  "Uttar Pradesh": {
    "code": "99",
    "districts": [
      {
        "name": "Agra",
        "code": "146"
      },
      {
        "name": "Aligarh",
        "code": "143"
      },
      {
        "name": "Ambedkar Nagar",
        "code": "178"
      },
      {
        "name": "Amethi",
        "code": "734"
      },
      {
        "name": "Amroha",
        "code": "670"
      },
      {
        "name": "Auraiya",
        "code": "162"
      },
      {
        "name": "Ayodhya",
        "code": "177"
      },
      {
        "name": "Azamgarh",
        "code": "191"
      },
      {
        "name": "Baghpat",
        "code": "139"
      },
      {
        "name": "Bahraich",
        "code": "180"
      },
      {
        "name": "Ballia",
        "code": "193"
      },
      {
        "name": "Balrampur",
        "code": "182"
      },
      {
        "name": "Banda",
        "code": "170"
      },
      {
        "name": "Bara Banki",
        "code": "176"
      },
      {
        "name": "Bareilly",
        "code": "150"
      },
      {
        "name": "Basti",
        "code": "185"
      },
      {
        "name": "Bhadohi",
        "code": "198"
      },
      {
        "name": "Bijnor",
        "code": "134"
      },
      {
        "name": "Budaun",
        "code": "149"
      },
      {
        "name": "Bulandshahr",
        "code": "142"
      },
      {
        "name": "Chandauli",
        "code": "196"
      },
      {
        "name": "Chitrakoot",
        "code": "171"
      },
      {
        "name": "Deoria",
        "code": "190"
      },
      {
        "name": "Etah",
        "code": "201"
      },
      {
        "name": "Etawah",
        "code": "161"
      },
      {
        "name": "Farrukhabad",
        "code": "159"
      },
      {
        "name": "Fatehpur",
        "code": "172"
      },
      {
        "name": "Firozabad",
        "code": "147"
      },
      {
        "name": "Gautam Buddha Nagar",
        "code": "141"
      },
      {
        "name": "Ghaziabad",
        "code": "140"
      },
      {
        "name": "Ghazipur",
        "code": "195"
      },
      {
        "name": "Gonda",
        "code": "183"
      },
      {
        "name": "Gorakhpur",
        "code": "188"
      },
      {
        "name": "Hamirpur",
        "code": "168"
      },
      {
        "name": "Hapur",
        "code": "801"
      },
      {
        "name": "Hardoi",
        "code": "155"
      },
      {
        "name": "Hathras",
        "code": "675"
      },
      {
        "name": "Jalaun",
        "code": "165"
      },
      {
        "name": "Jaunpur",
        "code": "194"
      },
      {
        "name": "Jhansi",
        "code": "166"
      },
      {
        "name": "Kannauj",
        "code": "160"
      },
      {
        "name": "Kanpur Dehat",
        "code": "163"
      },
      {
        "name": "Kanpur Nagar",
        "code": "164"
      },
      {
        "name": "Kasganj",
        "code": "202"
      },
      {
        "name": "Kaushambi",
        "code": "174"
      },
      {
        "name": "Kushinagar",
        "code": "189"
      },
      {
        "name": "Lakhimpur Kheri",
        "code": "153"
      },
      {
        "name": "Lalitpur",
        "code": "167"
      },
      {
        "name": "Lucknow",
        "code": "157"
      },
      {
        "name": "Maharajganj",
        "code": "187"
      },
      {
        "name": "Mahoba",
        "code": "169"
      },
      {
        "name": "Mainpuri",
        "code": "148"
      },
      {
        "name": "Mathura",
        "code": "145"
      },
      {
        "name": "Mau",
        "code": "192"
      },
      {
        "name": "Meerut",
        "code": "138"
      },
      {
        "name": "Mirzapur",
        "code": "199"
      },
      {
        "name": "Moradabad",
        "code": "135"
      },
      {
        "name": "Muzaffarnagar",
        "code": "133"
      },
      {
        "name": "Pilibhit",
        "code": "151"
      },
      {
        "name": "Pratapgarh",
        "code": "173"
      },
      {
        "name": "Prayagraj",
        "code": "175"
      },
      {
        "name": "Raebareli",
        "code": "158"
      },
      {
        "name": "Rampur",
        "code": "136"
      },
      {
        "name": "Saharanpur",
        "code": "132"
      },
      {
        "name": "Sambhal",
        "code": "802"
      },
      {
        "name": "Sant Kabir Nagar",
        "code": "186"
      },
      {
        "name": "Shahjahanpur",
        "code": "152"
      },
      {
        "name": "Shamli",
        "code": "672"
      },
      {
        "name": "Shravasti",
        "code": "181"
      },
      {
        "name": "Siddharthnagar",
        "code": "184"
      },
      {
        "name": "Sitapur",
        "code": "154"
      },
      {
        "name": "Sonbhadra",
        "code": "200"
      },
      {
        "name": "Sultanpur",
        "code": "179"
      },
      {
        "name": "Unnao",
        "code": "156"
      },
      {
        "name": "Varanasi",
        "code": "197"
      }
    ],
    "name": "Uttar Pradesh"
  },
  "West Bengal": {
    "code": "19",
    "districts": [
      {
        "name": "Alipurduar",
        "code": "738"
      },
      {
        "name": "Bankura",
        "code": "339"
      },
      {
        "name": "Birbhum",
        "code": "334"
      },
      {
        "name": "Cooch Behar",
        "code": "741"
      },
      {
        "name": "Dakshin Dinajpur",
        "code": "331"
      },
      {
        "name": "Darjeeling",
        "code": "327"
      },
      {
        "name": "Hooghly",
        "code": "338"
      },
      {
        "name": "Howrah",
        "code": "341"
      },
      {
        "name": "Jalpaiguri",
        "code": "328"
      },
      {
        "name": "Jhargram",
        "code": "744"
      },
      {
        "name": "Kalimpong",
        "code": "745"
      },
      {
        "name": "Kolkata",
        "code": "342"
      },
      {
        "name": "Maldah",
        "code": "332"
      },
      {
        "name": "Murshidabad ",
        "code": "333"
      },
      {
        "name": "Nadia",
        "code": "336"
      },
      {
        "name": "North Twenty Four Parganas",
        "code": "337"
      },
      {
        "name": "Paschim Bardhaman",
        "code": "739"
      },
      {
        "name": "Paschim Medinipur",
        "code": "344"
      },
      {
        "name": "Purba Bardhaman",
        "code": "740"
      },
      {
        "name": "Purba Medinipur",
        "code": "345"
      },
      {
        "name": "Purulia",
        "code": "340"
      },
      {
        "name": "South Twenty Four Parganas",
        "code": "343"
      },
      {
        "name": "Uttar Dinajpur",
        "code": "330"
      }
    ],
    "name": "West Bengal"
  }
};

export const ALL_INDIAN_STATES = Object.keys(INDIA_STATES_DATA).sort();

export function getDistrictsForState(stateName: string): string[] {
  const state = INDIA_STATES_DATA[stateName];
  if (!state) return [];
  return state.districts.map((d) => d.name);
}

export function getEraktkoshStateCode(stateName: string): string | undefined {
  const state = INDIA_STATES_DATA[stateName];
  if (state) return state.code;
  const lower = stateName.toLowerCase();
  for (const s of Object.values(INDIA_STATES_DATA)) {
    if (s.name && s.name.toLowerCase() === lower) return s.code;
  }
  return undefined;
}

export function getEraktkoshDistrictCode(stateName: string, districtName: string): string | undefined {
  const state = INDIA_STATES_DATA[stateName];
  if (!state) return undefined;
  const lower = districtName.toLowerCase().replace(/district/gi, '').trim();

  // Alias mapping for districts that were renamed or alternate spellings
  const aliases: Record<string, string[]> = {
    '515': ['chhatrapati sambhajinagar', 'aurangabad', 'sambhajinagar'],
    '520': ['dharashiv', 'osmanabad'],
  };
  for (const [code, names] of Object.entries(aliases)) {
    if (names.some((n) => lower.includes(n) || n.includes(lower))) {
      return code;
    }
  }

  const d = state.districts.find(
    (dist) => dist.name.toLowerCase() === lower || lower.includes(dist.name.toLowerCase()) || dist.name.toLowerCase().includes(lower)
  );
  return d ? d.code : undefined;
}

export function matchStateAndDistrict(
  rawState?: string | null,
  rawDistrict?: string | null
): { state: string; district: string } {
  let matchedState = 'Maharashtra';
  let matchedDistrict = 'Mumbai Suburban';

  if (rawState) {
    const rawStLower = rawState.toLowerCase().trim();
    for (const st of ALL_INDIAN_STATES) {
      if (st.toLowerCase() === rawStLower || rawStLower.includes(st.toLowerCase()) || st.toLowerCase().includes(rawStLower)) {
        matchedState = st;
        break;
      }
    }
  }

  const dists = getDistrictsForState(matchedState);
  if (dists.length > 0) {
    matchedDistrict = dists[0]!;
  }

  if (rawDistrict) {
    const rawDistLower = rawDistrict.toLowerCase().replace(/district/gi, '').trim();
    for (const d of dists) {
      if (d.toLowerCase() === rawDistLower || rawDistLower.includes(d.toLowerCase()) || d.toLowerCase().includes(rawDistLower)) {
        matchedDistrict = d;
        break;
      }
    }
  }

  return { state: matchedState, district: matchedDistrict };
}