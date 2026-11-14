// Synthetic demo data (not real airline data). Shared by the browser app and the backend tests.
window.DEMO_DATA = {
 "rm": {
  "dtd": 30,
  "ob": 0,
  "w": 0.6,
  "vmr": 2,
  "method": "emsr",
  "cur": "SAR",
  "legs": [
   {
    "leg": "RUH-JED",
    "cap": 174,
    "dist": 846,
    "ref": "",
    "noshow": 6
   },
   {
    "leg": "DMM-JED",
    "cap": 174,
    "dist": 1230,
    "ref": "",
    "noshow": 6
   },
   {
    "leg": "JED-CAI",
    "cap": 174,
    "dist": 1220,
    "ref": "",
    "noshow": 6
   },
   {
    "leg": "JED-AMM",
    "cap": 174,
    "dist": 1190,
    "ref": "",
    "noshow": 6
   }
  ],
  "prods": [
   {
    "od": "RUH-JED",
    "path": "RUH-JED",
    "rbd": "Y",
    "fare": 1450,
    "hist": 7.5,
    "otb": 2,
    "curve": "late"
   },
   {
    "od": "RUH-JED",
    "path": "RUH-JED",
    "rbd": "M",
    "fare": 960,
    "hist": 18.0,
    "otb": 9,
    "curve": "mid"
   },
   {
    "od": "RUH-JED",
    "path": "RUH-JED",
    "rbd": "K",
    "fare": 680,
    "hist": 30.0,
    "otb": 15,
    "curve": "mid"
   },
   {
    "od": "RUH-JED",
    "path": "RUH-JED",
    "rbd": "V",
    "fare": 480,
    "hist": 42.0,
    "otb": 30,
    "curve": "early"
   },
   {
    "od": "RUH-JED",
    "path": "RUH-JED",
    "rbd": "E",
    "fare": 290,
    "hist": 52.5,
    "otb": 38,
    "curve": "early"
   },
   {
    "od": "DMM-JED",
    "path": "DMM-JED",
    "rbd": "Y",
    "fare": 1500,
    "hist": 6.0,
    "otb": 2,
    "curve": "late"
   },
   {
    "od": "DMM-JED",
    "path": "DMM-JED",
    "rbd": "M",
    "fare": 990,
    "hist": 14.4,
    "otb": 7,
    "curve": "mid"
   },
   {
    "od": "DMM-JED",
    "path": "DMM-JED",
    "rbd": "K",
    "fare": 710,
    "hist": 24.0,
    "otb": 12,
    "curve": "mid"
   },
   {
    "od": "DMM-JED",
    "path": "DMM-JED",
    "rbd": "V",
    "fare": 500,
    "hist": 33.6,
    "otb": 24,
    "curve": "early"
   },
   {
    "od": "DMM-JED",
    "path": "DMM-JED",
    "rbd": "E",
    "fare": 300,
    "hist": 42.0,
    "otb": 30,
    "curve": "early"
   },
   {
    "od": "JED-CAI",
    "path": "JED-CAI",
    "rbd": "Y",
    "fare": 1900,
    "hist": 5.5,
    "otb": 1,
    "curve": "late"
   },
   {
    "od": "JED-CAI",
    "path": "JED-CAI",
    "rbd": "M",
    "fare": 1250,
    "hist": 13.2,
    "otb": 7,
    "curve": "mid"
   },
   {
    "od": "JED-CAI",
    "path": "JED-CAI",
    "rbd": "K",
    "fare": 890,
    "hist": 22.0,
    "otb": 11,
    "curve": "mid"
   },
   {
    "od": "JED-CAI",
    "path": "JED-CAI",
    "rbd": "V",
    "fare": 630,
    "hist": 30.8,
    "otb": 22,
    "curve": "early"
   },
   {
    "od": "JED-CAI",
    "path": "JED-CAI",
    "rbd": "E",
    "fare": 380,
    "hist": 38.5,
    "otb": 28,
    "curve": "early"
   },
   {
    "od": "JED-AMM",
    "path": "JED-AMM",
    "rbd": "Y",
    "fare": 1700,
    "hist": 4.0,
    "otb": 1,
    "curve": "late"
   },
   {
    "od": "JED-AMM",
    "path": "JED-AMM",
    "rbd": "M",
    "fare": 1120,
    "hist": 9.6,
    "otb": 5,
    "curve": "mid"
   },
   {
    "od": "JED-AMM",
    "path": "JED-AMM",
    "rbd": "K",
    "fare": 800,
    "hist": 16.0,
    "otb": 8,
    "curve": "mid"
   },
   {
    "od": "JED-AMM",
    "path": "JED-AMM",
    "rbd": "V",
    "fare": 560,
    "hist": 22.4,
    "otb": 16,
    "curve": "early"
   },
   {
    "od": "JED-AMM",
    "path": "JED-AMM",
    "rbd": "E",
    "fare": 340,
    "hist": 28.0,
    "otb": 20,
    "curve": "early"
   },
   {
    "od": "RUH-CAI",
    "path": "RUH-JED>JED-CAI",
    "rbd": "Y",
    "fare": 2500,
    "hist": 2.2,
    "otb": 1,
    "curve": "late"
   },
   {
    "od": "RUH-CAI",
    "path": "RUH-JED>JED-CAI",
    "rbd": "M",
    "fare": 1650,
    "hist": 5.4,
    "otb": 3,
    "curve": "mid"
   },
   {
    "od": "RUH-CAI",
    "path": "RUH-JED>JED-CAI",
    "rbd": "K",
    "fare": 1180,
    "hist": 9.0,
    "otb": 5,
    "curve": "mid"
   },
   {
    "od": "RUH-CAI",
    "path": "RUH-JED>JED-CAI",
    "rbd": "V",
    "fare": 830,
    "hist": 12.6,
    "otb": 9,
    "curve": "early"
   },
   {
    "od": "RUH-CAI",
    "path": "RUH-JED>JED-CAI",
    "rbd": "E",
    "fare": 500,
    "hist": 15.7,
    "otb": 11,
    "curve": "early"
   },
   {
    "od": "RUH-AMM",
    "path": "RUH-JED>JED-AMM",
    "rbd": "Y",
    "fare": 2300,
    "hist": 1.5,
    "otb": 0,
    "curve": "late"
   },
   {
    "od": "RUH-AMM",
    "path": "RUH-JED>JED-AMM",
    "rbd": "M",
    "fare": 1520,
    "hist": 3.6,
    "otb": 2,
    "curve": "mid"
   },
   {
    "od": "RUH-AMM",
    "path": "RUH-JED>JED-AMM",
    "rbd": "K",
    "fare": 1080,
    "hist": 6.0,
    "otb": 3,
    "curve": "mid"
   },
   {
    "od": "RUH-AMM",
    "path": "RUH-JED>JED-AMM",
    "rbd": "V",
    "fare": 760,
    "hist": 8.4,
    "otb": 6,
    "curve": "early"
   },
   {
    "od": "RUH-AMM",
    "path": "RUH-JED>JED-AMM",
    "rbd": "E",
    "fare": 460,
    "hist": 10.5,
    "otb": 8,
    "curve": "early"
   },
   {
    "od": "DMM-CAI",
    "path": "DMM-JED>JED-CAI",
    "rbd": "Y",
    "fare": 2600,
    "hist": 1.8,
    "otb": 0,
    "curve": "late"
   },
   {
    "od": "DMM-CAI",
    "path": "DMM-JED>JED-CAI",
    "rbd": "M",
    "fare": 1720,
    "hist": 4.2,
    "otb": 2,
    "curve": "mid"
   },
   {
    "od": "DMM-CAI",
    "path": "DMM-JED>JED-CAI",
    "rbd": "K",
    "fare": 1220,
    "hist": 7.0,
    "otb": 4,
    "curve": "mid"
   },
   {
    "od": "DMM-CAI",
    "path": "DMM-JED>JED-CAI",
    "rbd": "V",
    "fare": 860,
    "hist": 9.8,
    "otb": 7,
    "curve": "early"
   },
   {
    "od": "DMM-CAI",
    "path": "DMM-JED>JED-CAI",
    "rbd": "E",
    "fare": 520,
    "hist": 12.2,
    "otb": 9,
    "curve": "early"
   },
   {
    "od": "DMM-AMM",
    "path": "DMM-JED>JED-AMM",
    "rbd": "Y",
    "fare": 2400,
    "hist": 1.0,
    "otb": 0,
    "curve": "late"
   },
   {
    "od": "DMM-AMM",
    "path": "DMM-JED>JED-AMM",
    "rbd": "M",
    "fare": 1580,
    "hist": 2.4,
    "otb": 1,
    "curve": "mid"
   },
   {
    "od": "DMM-AMM",
    "path": "DMM-JED>JED-AMM",
    "rbd": "K",
    "fare": 1130,
    "hist": 4.0,
    "otb": 2,
    "curve": "mid"
   },
   {
    "od": "DMM-AMM",
    "path": "DMM-JED>JED-AMM",
    "rbd": "V",
    "fare": 790,
    "hist": 5.6,
    "otb": 4,
    "curve": "early"
   },
   {
    "od": "DMM-AMM",
    "path": "DMM-JED>JED-AMM",
    "rbd": "E",
    "fare": 480,
    "hist": 7.0,
    "otb": 5,
    "curve": "early"
   }
  ],
  "curves": {
   "early": [
    10,
    25,
    45,
    58,
    72,
    82,
    89,
    95,
    98,
    100
   ],
   "mid": [
    5,
    12,
    25,
    35,
    50,
    62,
    74,
    86,
    94,
    100
   ],
   "late": [
    2,
    5,
    10,
    15,
    25,
    35,
    48,
    66,
    84,
    100
   ]
  },
  "bd_on": "yes",
  "alpha": 0.5,
  "frat5": 3.0,
  "season": 1.0,
  "event": 0,
  "ob_mode": "manual",
  "db_cost": 1200
 },
 "plan": {
  "params": {
   "elasticity": 0.3,
   "cv": 0.35,
   "cur": "SAR",
   "bh_mode": "fleet",
   "lock_fleet": "no"
  },
  "fleets": [
   {
    "type": "A320neo",
    "seats": 174,
    "count": 4,
    "util": 11,
    "cost_bh": 14000,
    "fee_dep": 6000,
    "turn": 45,
    "iata": "32N"
   },
   {
    "type": "A321neo",
    "seats": 215,
    "count": 3,
    "util": 11,
    "cost_bh": 16000,
    "fee_dep": 6500,
    "turn": 50,
    "iata": "32Q"
   }
  ],
  "routes": [
   {
    "route": "RUH-JED",
    "block": 1.9,
    "demand": 3000,
    "fare": 420,
    "cur_freq": 14,
    "cur_fleet": "A320neo",
    "min_freq": 7,
    "max_freq": 28,
    "fleets": "all",
    "dist": 846
   },
   {
    "route": "RUH-DMM",
    "block": 1.1,
    "demand": 1300,
    "fare": 330,
    "cur_freq": 10,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 21,
    "fleets": "all",
    "dist": 380
   },
   {
    "route": "RUH-CAI",
    "block": 2.7,
    "demand": 1500,
    "fare": 760,
    "cur_freq": 7,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 21,
    "fleets": "all",
    "dist": 1630
   },
   {
    "route": "RUH-DXB",
    "block": 1.9,
    "demand": 1100,
    "fare": 520,
    "cur_freq": 7,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 21,
    "fleets": "all",
    "dist": 870
   },
   {
    "route": "RUH-AMM",
    "block": 2.3,
    "demand": 650,
    "fare": 640,
    "cur_freq": 4,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 14,
    "fleets": "all",
    "dist": 1290
   },
   {
    "route": "RUH-IST",
    "block": 4.4,
    "demand": 750,
    "fare": 1250,
    "cur_freq": 4,
    "cur_fleet": "A321neo",
    "min_freq": 0,
    "max_freq": 14,
    "fleets": "all",
    "dist": 2450
   },
   {
    "route": "JED-CAI",
    "block": 2.2,
    "demand": 2000,
    "fare": 690,
    "cur_freq": 10,
    "cur_fleet": "A321neo",
    "min_freq": 3,
    "max_freq": 21,
    "fleets": "all",
    "dist": 1220
   },
   {
    "route": "JED-AMM",
    "block": 2.1,
    "demand": 800,
    "fare": 610,
    "cur_freq": 5,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 14,
    "fleets": "all",
    "dist": 1190
   },
   {
    "route": "JED-DMM",
    "block": 2.2,
    "demand": 1100,
    "fare": 450,
    "cur_freq": 7,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 21,
    "fleets": "all",
    "dist": 1210
   },
   {
    "route": "JED-KWI",
    "block": 2.4,
    "demand": 600,
    "fare": 560,
    "cur_freq": 4,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 14,
    "fleets": "all",
    "dist": 1370
   },
   {
    "route": "JED-IST",
    "block": 3.9,
    "demand": 650,
    "fare": 1200,
    "cur_freq": 3,
    "cur_fleet": "A321neo",
    "min_freq": 0,
    "max_freq": 14,
    "fleets": "all",
    "dist": 2370
   },
   {
    "route": "DMM-CAI",
    "block": 3.0,
    "demand": 700,
    "fare": 810,
    "cur_freq": 4,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 14,
    "fleets": "all",
    "dist": 1830
   },
   {
    "route": "DMM-DXB",
    "block": 1.3,
    "demand": 900,
    "fare": 380,
    "cur_freq": 7,
    "cur_fleet": "A320neo",
    "min_freq": 0,
    "max_freq": 21,
    "fleets": "all",
    "dist": 470
   }
  ]
 },
 "sched": {
  "base": [
   {
    "id": "F101",
    "fn": "ZZ101",
    "org": "RUH",
    "dst": "IST",
    "dep": "05:30",
    "block": "4:24",
    "days": "1357",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F102",
    "fn": "ZZ102",
    "org": "IST",
    "dst": "RUH",
    "dep": "10:44",
    "block": "4:24",
    "days": "1357",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F103",
    "fn": "ZZ103",
    "org": "JED",
    "dst": "IST",
    "dep": "06:00",
    "block": "3:54",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F104",
    "fn": "ZZ104",
    "org": "IST",
    "dst": "JED",
    "dep": "10:44",
    "block": "3:54",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F105",
    "fn": "ZZ105",
    "org": "DMM",
    "dst": "CAI",
    "dep": "05:45",
    "block": "3:00",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F106",
    "fn": "ZZ106",
    "org": "CAI",
    "dst": "DMM",
    "dep": "09:30",
    "block": "3:00",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F107",
    "fn": "ZZ107",
    "org": "RUH",
    "dst": "CAI",
    "dep": "05:30",
    "block": "2:42",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F108",
    "fn": "ZZ108",
    "org": "CAI",
    "dst": "RUH",
    "dep": "08:57",
    "block": "2:42",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F109",
    "fn": "ZZ109",
    "org": "JED",
    "dst": "KWI",
    "dep": "06:00",
    "block": "2:24",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F110",
    "fn": "ZZ110",
    "org": "KWI",
    "dst": "JED",
    "dep": "09:09",
    "block": "2:24",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F111",
    "fn": "ZZ111",
    "org": "RUH",
    "dst": "AMM",
    "dep": "12:25",
    "block": "2:18",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F112",
    "fn": "ZZ112",
    "org": "AMM",
    "dst": "RUH",
    "dep": "15:28",
    "block": "2:18",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F113",
    "fn": "ZZ113",
    "org": "JED",
    "dst": "CAI",
    "dep": "09:00",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F114",
    "fn": "ZZ114",
    "org": "CAI",
    "dst": "JED",
    "dep": "12:02",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F115",
    "fn": "ZZ115",
    "org": "JED",
    "dst": "CAI",
    "dep": "15:15",
    "block": "2:12",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F116",
    "fn": "ZZ116",
    "org": "CAI",
    "dst": "JED",
    "dep": "18:17",
    "block": "2:12",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F117",
    "fn": "ZZ117",
    "org": "JED",
    "dst": "DMM",
    "dep": "12:20",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F118",
    "fn": "ZZ118",
    "org": "DMM",
    "dst": "JED",
    "dep": "15:17",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F119",
    "fn": "ZZ119",
    "org": "JED",
    "dst": "AMM",
    "dep": "19:10",
    "block": "2:06",
    "days": "12457",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F120",
    "fn": "ZZ120",
    "org": "AMM",
    "dst": "JED",
    "dep": "22:01",
    "block": "2:06",
    "days": "12457",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F121",
    "fn": "ZZ121",
    "org": "RUH",
    "dst": "JED",
    "dep": "16:10",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F122",
    "fn": "ZZ122",
    "org": "JED",
    "dst": "RUH",
    "dep": "18:49",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F123",
    "fn": "ZZ123",
    "org": "RUH",
    "dst": "JED",
    "dep": "05:30",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F124",
    "fn": "ZZ124",
    "org": "JED",
    "dst": "RUH",
    "dep": "08:09",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F125",
    "fn": "ZZ125",
    "org": "RUH",
    "dst": "DXB",
    "dep": "10:50",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F126",
    "fn": "ZZ126",
    "org": "DXB",
    "dst": "RUH",
    "dep": "13:29",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F127",
    "fn": "ZZ127",
    "org": "DMM",
    "dst": "DXB",
    "dep": "13:15",
    "block": "1:18",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F128",
    "fn": "ZZ128",
    "org": "DXB",
    "dst": "DMM",
    "dep": "15:18",
    "block": "1:18",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F129",
    "fn": "ZZ129",
    "org": "RUH",
    "dst": "DMM",
    "dep": "18:35",
    "block": "1:06",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F130",
    "fn": "ZZ130",
    "org": "DMM",
    "dst": "RUH",
    "dep": "20:26",
    "block": "1:06",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F131",
    "fn": "ZZ131",
    "org": "DMM",
    "dst": "RUH",
    "dep": "17:30",
    "block": "1:06",
    "days": "135",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F132",
    "fn": "ZZ132",
    "org": "RUH",
    "dst": "DMM",
    "dep": "19:30",
    "block": "1:06",
    "days": "135",
    "fleet": "A320neo",
    "status": "active"
   }
  ],
  "prop": [
   {
    "id": "F101",
    "fn": "ZZ101",
    "org": "RUH",
    "dst": "IST",
    "dep": "05:30",
    "block": "4:24",
    "days": "1357",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F102",
    "fn": "ZZ102",
    "org": "IST",
    "dst": "RUH",
    "dep": "10:44",
    "block": "4:24",
    "days": "1357",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F103",
    "fn": "ZZ103",
    "org": "JED",
    "dst": "IST",
    "dep": "06:00",
    "block": "3:54",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F104",
    "fn": "ZZ104",
    "org": "IST",
    "dst": "JED",
    "dep": "10:44",
    "block": "3:54",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F105",
    "fn": "ZZ105",
    "org": "DMM",
    "dst": "CAI",
    "dep": "05:45",
    "block": "3:00",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F106",
    "fn": "ZZ106",
    "org": "CAI",
    "dst": "DMM",
    "dep": "09:30",
    "block": "3:00",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F107",
    "fn": "ZZ107",
    "org": "RUH",
    "dst": "CAI",
    "dep": "05:30",
    "block": "2:42",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F108",
    "fn": "ZZ108",
    "org": "CAI",
    "dst": "RUH",
    "dep": "08:57",
    "block": "2:42",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F109",
    "fn": "ZZ109",
    "org": "JED",
    "dst": "KWI",
    "dep": "06:00",
    "block": "2:24",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F110",
    "fn": "ZZ110",
    "org": "KWI",
    "dst": "JED",
    "dep": "09:09",
    "block": "2:24",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F111",
    "fn": "ZZ111",
    "org": "RUH",
    "dst": "AMM",
    "dep": "12:25",
    "block": "2:18",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F112",
    "fn": "ZZ112",
    "org": "AMM",
    "dst": "RUH",
    "dep": "15:28",
    "block": "2:18",
    "days": "1357",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F113",
    "fn": "ZZ113",
    "org": "JED",
    "dst": "CAI",
    "dep": "09:00",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F114",
    "fn": "ZZ114",
    "org": "CAI",
    "dst": "JED",
    "dep": "12:02",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F115",
    "fn": "ZZ115",
    "org": "JED",
    "dst": "CAI",
    "dep": "15:15",
    "block": "2:12",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F116",
    "fn": "ZZ116",
    "org": "CAI",
    "dst": "JED",
    "dep": "18:17",
    "block": "2:12",
    "days": "135",
    "fleet": "A321neo",
    "status": "active"
   },
   {
    "id": "F117",
    "fn": "ZZ117",
    "org": "JED",
    "dst": "DMM",
    "dep": "12:20",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F118",
    "fn": "ZZ118",
    "org": "DMM",
    "dst": "JED",
    "dep": "15:17",
    "block": "2:12",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F119",
    "fn": "ZZ119",
    "org": "JED",
    "dst": "AMM",
    "dep": "19:10",
    "block": "2:06",
    "days": "12457",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F120",
    "fn": "ZZ120",
    "org": "AMM",
    "dst": "JED",
    "dep": "22:01",
    "block": "2:06",
    "days": "12457",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F121",
    "fn": "ZZ121",
    "org": "RUH",
    "dst": "JED",
    "dep": "16:10",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F122",
    "fn": "ZZ122",
    "org": "JED",
    "dst": "RUH",
    "dep": "18:49",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F123",
    "fn": "ZZ123",
    "org": "RUH",
    "dst": "JED",
    "dep": "05:30",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F124",
    "fn": "ZZ124",
    "org": "JED",
    "dst": "RUH",
    "dep": "08:09",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F125",
    "fn": "ZZ125",
    "org": "RUH",
    "dst": "DXB",
    "dep": "10:50",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F126",
    "fn": "ZZ126",
    "org": "DXB",
    "dst": "RUH",
    "dep": "13:29",
    "block": "1:54",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F127",
    "fn": "ZZ127",
    "org": "DMM",
    "dst": "DXB",
    "dep": "13:15",
    "block": "1:18",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F128",
    "fn": "ZZ128",
    "org": "DXB",
    "dst": "DMM",
    "dep": "15:18",
    "block": "1:18",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F129",
    "fn": "ZZ129",
    "org": "RUH",
    "dst": "DMM",
    "dep": "18:35",
    "block": "1:06",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F130",
    "fn": "ZZ130",
    "org": "DMM",
    "dst": "RUH",
    "dep": "20:26",
    "block": "1:06",
    "days": "1234567",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F131",
    "fn": "ZZ131",
    "org": "DMM",
    "dst": "RUH",
    "dep": "17:30",
    "block": "1:06",
    "days": "135",
    "fleet": "A320neo",
    "status": "active"
   },
   {
    "id": "F132",
    "fn": "ZZ132",
    "org": "RUH",
    "dst": "DMM",
    "dep": "19:30",
    "block": "1:06",
    "days": "135",
    "fleet": "A320neo",
    "status": "active"
   }
  ],
  "params": {
   "hubs": "JED,RUH",
   "mct": 60,
   "maxc": 300,
   "day": "1",
   "utc_offset": "+0300",
   "period_from": "2026-10-25",
   "period_to": "2027-03-27"
  },
  "station_offsets": {
   "RUH": "+0300",
   "JED": "+0300",
   "DMM": "+0300",
   "CAI": "+0200",
   "AMM": "+0300",
   "DXB": "+0400",
   "IST": "+0300",
   "KWI": "+0300"
  }
 },
 "ops": {
  "crew_bases": "RUH,JED,DMM",
  "tails": [
   {
    "reg": "ZA-301",
    "fleet": "A320neo",
    "base": "RUH",
    "maint": "",
    "hrs_to_check": 60
   },
   {
    "reg": "ZA-302",
    "fleet": "A320neo",
    "base": "RUH",
    "maint": "",
    "hrs_to_check": 300
   },
   {
    "reg": "ZA-303",
    "fleet": "A320neo",
    "base": "JED",
    "maint": "",
    "hrs_to_check": 300
   },
   {
    "reg": "ZA-304",
    "fleet": "A320neo",
    "base": "DMM",
    "maint": "",
    "hrs_to_check": 300
   },
   {
    "reg": "ZB-401",
    "fleet": "A321neo",
    "base": "RUH",
    "maint": "",
    "hrs_to_check": 400
   },
   {
    "reg": "ZB-402",
    "fleet": "A321neo",
    "base": "JED",
    "maint": "",
    "hrs_to_check": 300
   },
   {
    "reg": "ZB-403",
    "fleet": "A321neo",
    "base": "JED",
    "maint": "2",
    "hrs_to_check": 300
   }
  ],
  "overrides": {},
  "rules": {
   "report": 60,
   "post": 30,
   "fdp_base": 13,
   "fdp_step": 0.5,
   "fdp_min": 9,
   "rest": 12,
   "max_duty_7d": 60,
   "max_block_7d": 40,
   "max_consec": 5,
   "min_off": 2,
   "reserve_pct": 10
  },
  "complement": {
   "A320neo": {
    "CPT": 1,
    "FO": 1,
    "CC": 4
   },
   "A321neo": {
    "CPT": 1,
    "FO": 1,
    "CC": 5
   }
  },
  "pool": [
   {
    "base": "RUH",
    "fleet": "A320neo",
    "rank": "CPT",
    "count": 7
   },
   {
    "base": "RUH",
    "fleet": "A320neo",
    "rank": "FO",
    "count": 5
   },
   {
    "base": "RUH",
    "fleet": "A321neo",
    "rank": "CPT",
    "count": 2
   },
   {
    "base": "RUH",
    "fleet": "A321neo",
    "rank": "FO",
    "count": 2
   },
   {
    "base": "RUH",
    "fleet": "ALL",
    "rank": "CC",
    "count": 30
   },
   {
    "base": "JED",
    "fleet": "A320neo",
    "rank": "CPT",
    "count": 4
   },
   {
    "base": "JED",
    "fleet": "A320neo",
    "rank": "FO",
    "count": 4
   },
   {
    "base": "JED",
    "fleet": "A321neo",
    "rank": "CPT",
    "count": 4
   },
   {
    "base": "JED",
    "fleet": "A321neo",
    "rank": "FO",
    "count": 4
   },
   {
    "base": "JED",
    "fleet": "ALL",
    "rank": "CC",
    "count": 28
   },
   {
    "base": "DMM",
    "fleet": "A320neo",
    "rank": "CPT",
    "count": 4
   },
   {
    "base": "DMM",
    "fleet": "A320neo",
    "rank": "FO",
    "count": 4
   },
   {
    "base": "DMM",
    "fleet": "ALL",
    "rank": "CC",
    "count": 14
   }
  ],
  "leave": [
   {
    "crew": "JED-A321neo-CPT02",
    "days": "34"
   },
   {
    "crew": "RUH-ALL-CC05",
    "days": "1234567"
   }
  ],
  "source": "prop",
  "day": "1"
 },
 "pricing": {
  "date": "2026-11-05",
  "currency": "SAR",
  "stations": [
   {
    "code": "RUH",
    "country": "SA"
   },
   {
    "code": "JED",
    "country": "SA"
   },
   {
    "code": "DMM",
    "country": "SA"
   },
   {
    "code": "CAI",
    "country": "EG"
   },
   {
    "code": "AMM",
    "country": "JO"
   },
   {
    "code": "DXB",
    "country": "AE"
   },
   {
    "code": "IST",
    "country": "TR"
   },
   {
    "code": "KWI",
    "country": "KW"
   }
  ],
  "taxes": [
   {
    "code": "VAT",
    "name": "VAT on domestic tickets (15%)",
    "basis": "percent",
    "amount": 15,
    "scope": "domestic",
    "where": "SA",
    "inf": "yes"
   },
   {
    "code": "DEP",
    "name": "Departure airport fee (sample)",
    "basis": "fixed",
    "amount": 87,
    "scope": "departure",
    "where": "SA",
    "inf": "no"
   },
   {
    "code": "SEC",
    "name": "Security charge (sample)",
    "basis": "fixed",
    "amount": 10,
    "scope": "departure",
    "where": "",
    "inf": "no"
   },
   {
    "code": "ARR",
    "name": "Arrival fee (sample)",
    "basis": "fixed",
    "amount": 35,
    "scope": "arrival",
    "where": "EG,JO",
    "inf": "no"
   }
  ],
  "adjustments": [
   {
    "name": "Fuel surcharge",
    "type": "surcharge",
    "method": "fixed",
    "value": 25,
    "markets": "ALL",
    "rbds": "ALL",
    "from": "",
    "to": "",
    "active": "yes"
   },
   {
    "name": "Winter Cairo promotion",
    "type": "promotion",
    "method": "percent",
    "value": 15,
    "markets": "*-CAI",
    "rbds": "V,E",
    "from": "2026-11-01",
    "to": "2026-12-15",
    "active": "yes"
   },
   {
    "name": "Peak surcharge RUH-JED",
    "type": "surcharge",
    "method": "percent",
    "value": 5,
    "markets": "RUH-JED",
    "rbds": "ALL",
    "from": "2026-12-20",
    "to": "2027-01-05",
    "active": "yes"
   },
   {
    "name": "Flash sale Amman",
    "type": "promotion",
    "method": "fixed",
    "value": 60,
    "markets": "*-AMM",
    "rbds": "E",
    "from": "",
    "to": "",
    "active": "no"
   }
  ],
  "fares": [
   {
    "market": "RUH-JED",
    "rbd": "Y",
    "base": 1450,
    "basis": ""
   },
   {
    "market": "RUH-JED",
    "rbd": "M",
    "base": 960,
    "basis": ""
   },
   {
    "market": "RUH-JED",
    "rbd": "K",
    "base": 680,
    "basis": ""
   },
   {
    "market": "RUH-JED",
    "rbd": "V",
    "base": 480,
    "basis": ""
   },
   {
    "market": "RUH-JED",
    "rbd": "E",
    "base": 290,
    "basis": ""
   },
   {
    "market": "DMM-JED",
    "rbd": "Y",
    "base": 1500,
    "basis": ""
   },
   {
    "market": "DMM-JED",
    "rbd": "M",
    "base": 990,
    "basis": ""
   },
   {
    "market": "DMM-JED",
    "rbd": "K",
    "base": 710,
    "basis": ""
   },
   {
    "market": "DMM-JED",
    "rbd": "V",
    "base": 500,
    "basis": ""
   },
   {
    "market": "DMM-JED",
    "rbd": "E",
    "base": 300,
    "basis": ""
   },
   {
    "market": "JED-CAI",
    "rbd": "Y",
    "base": 1900,
    "basis": ""
   },
   {
    "market": "JED-CAI",
    "rbd": "M",
    "base": 1250,
    "basis": ""
   },
   {
    "market": "JED-CAI",
    "rbd": "K",
    "base": 890,
    "basis": ""
   },
   {
    "market": "JED-CAI",
    "rbd": "V",
    "base": 630,
    "basis": ""
   },
   {
    "market": "JED-CAI",
    "rbd": "E",
    "base": 380,
    "basis": ""
   },
   {
    "market": "JED-AMM",
    "rbd": "Y",
    "base": 1700,
    "basis": ""
   },
   {
    "market": "JED-AMM",
    "rbd": "M",
    "base": 1120,
    "basis": ""
   },
   {
    "market": "JED-AMM",
    "rbd": "K",
    "base": 800,
    "basis": ""
   },
   {
    "market": "JED-AMM",
    "rbd": "V",
    "base": 560,
    "basis": ""
   },
   {
    "market": "JED-AMM",
    "rbd": "E",
    "base": 340,
    "basis": ""
   },
   {
    "market": "RUH-CAI",
    "rbd": "Y",
    "base": 2500,
    "basis": ""
   },
   {
    "market": "RUH-CAI",
    "rbd": "M",
    "base": 1650,
    "basis": ""
   },
   {
    "market": "RUH-CAI",
    "rbd": "K",
    "base": 1180,
    "basis": ""
   },
   {
    "market": "RUH-CAI",
    "rbd": "V",
    "base": 830,
    "basis": ""
   },
   {
    "market": "RUH-CAI",
    "rbd": "E",
    "base": 500,
    "basis": ""
   },
   {
    "market": "RUH-AMM",
    "rbd": "Y",
    "base": 2300,
    "basis": ""
   },
   {
    "market": "RUH-AMM",
    "rbd": "M",
    "base": 1520,
    "basis": ""
   },
   {
    "market": "RUH-AMM",
    "rbd": "K",
    "base": 1080,
    "basis": ""
   },
   {
    "market": "RUH-AMM",
    "rbd": "V",
    "base": 760,
    "basis": ""
   },
   {
    "market": "RUH-AMM",
    "rbd": "E",
    "base": 460,
    "basis": ""
   },
   {
    "market": "DMM-CAI",
    "rbd": "Y",
    "base": 2600,
    "basis": ""
   },
   {
    "market": "DMM-CAI",
    "rbd": "M",
    "base": 1720,
    "basis": ""
   },
   {
    "market": "DMM-CAI",
    "rbd": "K",
    "base": 1220,
    "basis": ""
   },
   {
    "market": "DMM-CAI",
    "rbd": "V",
    "base": 860,
    "basis": ""
   },
   {
    "market": "DMM-CAI",
    "rbd": "E",
    "base": 520,
    "basis": ""
   },
   {
    "market": "DMM-AMM",
    "rbd": "Y",
    "base": 2400,
    "basis": ""
   },
   {
    "market": "DMM-AMM",
    "rbd": "M",
    "base": 1580,
    "basis": ""
   },
   {
    "market": "DMM-AMM",
    "rbd": "K",
    "base": 1130,
    "basis": ""
   },
   {
    "market": "DMM-AMM",
    "rbd": "V",
    "base": 790,
    "basis": ""
   },
   {
    "market": "DMM-AMM",
    "rbd": "E",
    "base": 480,
    "basis": ""
   }
  ],
  "market": "RUH-CAI",
  "families": [
   {
    "family": "Light",
    "rbds": "E,V",
    "includes": "7 kg cabin bag",
    "refund": "No",
    "change_fee": 150,
    "ap_days": 14
   },
   {
    "family": "Value",
    "rbds": "K,M",
    "includes": "20 kg bag, standard seat",
    "refund": "No",
    "change_fee": 75,
    "ap_days": 7
   },
   {
    "family": "Flex",
    "rbds": "Y",
    "includes": "30 kg bag, any seat, meal",
    "refund": "Yes",
    "change_fee": 0,
    "ap_days": 0
   }
  ],
  "pax": {
   "chd_pct": 25,
   "inf_pct": 90
  },
  "currencies": [
   {
    "code": "SAR",
    "rate": 1
   },
   {
    "code": "USD",
    "rate": 0.2666
   },
   {
    "code": "EUR",
    "rate": 0.2457
   },
   {
    "code": "EGP",
    "rate": 13.2
   },
   {
    "code": "INR",
    "rate": 23.4
   }
  ],
  "display_cur": "SAR"
 },
 "com": {
  "own_carrier": "ZZ",
  "share_alpha": 1.3,
  "share_beta": 1.0,
  "costs": {
   "fuel_share": 35,
   "fuel_index": 100,
   "overhead_pct": 18,
   "lease": {
    "A320neo": 1350000,
    "A321neo": 1650000
   }
  },
  "budget": {
   "revenue_wk": 17500000,
   "lf": 82,
   "cask": 0.3,
   "margin": 25
  },
  "ancillaries": [
   {
    "item": "Checked bag 20 kg",
    "price": 120,
    "take": 35,
    "cost_pct": 10,
    "markets": "ALL"
   },
   {
    "item": "Seat selection",
    "price": 45,
    "take": 22,
    "cost_pct": 0,
    "markets": "ALL"
   },
   {
    "item": "Meal",
    "price": 40,
    "take": 15,
    "cost_pct": 45,
    "markets": "ALL"
   },
   {
    "item": "Extra-legroom seat",
    "price": 110,
    "take": 6,
    "cost_pct": 0,
    "markets": "*-IST,*-CAI"
   }
  ],
  "channels": [
   {
    "channel": "Website & app",
    "share": 55,
    "cost_seg": 4,
    "commission": 0,
    "incentive": 0
   },
   {
    "channel": "GDS travel agents",
    "share": 25,
    "cost_seg": 18,
    "commission": 3,
    "incentive": 1
   },
   {
    "channel": "NDC agents",
    "share": 10,
    "cost_seg": 6,
    "commission": 3,
    "incentive": 0
   },
   {
    "channel": "Call centre",
    "share": 5,
    "cost_seg": 12,
    "commission": 0,
    "incentive": 0
   },
   {
    "channel": "OTA",
    "share": 5,
    "cost_seg": 10,
    "commission": 5,
    "incentive": 0
   }
  ],
  "corporates": [
   {
    "name": "Example Energy Co.",
    "markets": "RUH-JED,RUH-DMM",
    "discount": 12,
    "committed": 6000,
    "actual": 4100,
    "months": 10
   },
   {
    "name": "Example Bank",
    "markets": "RUH-*",
    "discount": 8,
    "committed": 2500,
    "actual": 2300,
    "months": 10
   },
   {
    "name": "Example Contractors",
    "markets": "*-CAI",
    "discount": 10,
    "committed": 3000,
    "actual": 1500,
    "months": 10
   }
  ],
  "competitors": [
   {
    "market": "RUH-JED",
    "carrier": "AA1",
    "freq": 28,
    "fare": 520,
    "date": "2026-11-04"
   },
   {
    "market": "RUH-JED",
    "carrier": "AA2",
    "freq": 21,
    "fare": 430,
    "date": "2026-11-04"
   },
   {
    "market": "RUH-CAI",
    "carrier": "AA1",
    "freq": 7,
    "fare": 980,
    "date": "2026-11-04"
   },
   {
    "market": "RUH-CAI",
    "carrier": "AA3",
    "freq": 10,
    "fare": 810,
    "date": "2026-11-04"
   },
   {
    "market": "JED-CAI",
    "carrier": "AA3",
    "freq": 14,
    "fare": 690,
    "date": "2026-11-04"
   },
   {
    "market": "JED-AMM",
    "carrier": "AA4",
    "freq": 7,
    "fare": 640,
    "date": "2026-11-04"
   },
   {
    "market": "DMM-JED",
    "carrier": "AA2",
    "freq": 7,
    "fare": 450,
    "date": "2026-11-04"
   }
  ],
  "interline": [
   {
    "id": "IL-001",
    "fare": 3200,
    "pax": 40,
    "segments": "ZZ:RUH-JED:846; PX:JED-LHR:4730"
   },
   {
    "id": "IL-002",
    "fare": 1900,
    "pax": 25,
    "segments": "ZZ:DMM-JED:1230; QX:JED-ADD:1390:SPA=700"
   },
   {
    "id": "CS-010",
    "fare": 1400,
    "pax": 60,
    "segments": "PX:LHR-RUH:4930; ZZ:RUH-DMM:380:SPA=150"
   }
  ],
  "basis": "current"
 },
 "inv": {
  "start": "2026-11-05",
  "days": 14,
  "today": "2026-11-05",
  "rules": [
   {
    "active": "yes",
    "name": "DMM-JED afternoon: protect for event",
    "mode": "manual",
    "sectors": "DMM-JED",
    "flights": "",
    "from": "2026-11-12",
    "to": "2026-11-15",
    "dow": "",
    "time_from": "12:00",
    "time_to": "18:00",
    "close": "V,E",
    "open": "",
    "limits": "K:10",
    "bp_pct": "",
    "bp_fixed": "",
    "owner": "Analyst A",
    "expires": "2026-11-16",
    "note": "Exhibition in Jeddah; forecast unreliable"
   },
   {
    "active": "yes",
    "name": "Cairo high-season protection",
    "mode": "adjust",
    "sectors": "*-CAI",
    "flights": "",
    "from": "2026-11-05",
    "to": "2026-11-30",
    "dow": "567",
    "time_from": "",
    "time_to": "",
    "close": "",
    "open": "",
    "limits": "",
    "bp_pct": 30,
    "bp_fixed": "",
    "owner": "Analyst B",
    "expires": "",
    "note": "Raise bid price 30% on weekend Cairo flights during peak"
   },
   {
    "active": "no",
    "name": "ZZ123 Monday lock",
    "mode": "manual",
    "sectors": "ALL",
    "flights": "ZZ123",
    "from": "",
    "to": "",
    "dow": "1",
    "time_from": "",
    "time_to": "",
    "close": "E",
    "open": "",
    "limits": "",
    "bp_pct": "",
    "bp_fixed": "",
    "owner": "Analyst A",
    "expires": "",
    "note": "Example of a paused rule"
   }
  ],
  "only_model": "yes"
 }
};
