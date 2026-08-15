import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// List all hostile targets
export const list = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targets = await ctx.db.query("targets").collect();
    if (args.status) {
      targets = targets.filter((t) => t.status === args.status);
    }
    return targets;
  },
});

// Get a target by codename
export const getByCodename = query({
  args: { codename: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("targets")
      .withIndex("by_codename", (q) => q.eq("codename", args.codename))
      .first();
  },
});

// Upsert / Add a new target with CDN sprite support
export const upsertTarget = mutation({
  args: {
    codename: v.string(),
    name: v.string(),
    threatLevel: v.string(),
    role: v.string(),
    lastSeen: v.string(),
    description: v.string(),
    identifyingMarks: v.string(),
    faceImage: v.string(),
    bodySprite: v.string(),
    uapaSerialNo: v.optional(v.number()),
    gazetteRef: v.optional(v.string()),
    status: v.optional(v.string()),
    baseScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("targets")
      .withIndex("by_codename", (q) => q.eq("codename", args.codename))
      .first();

    const targetDoc = {
      codename: args.codename,
      name: args.name,
      threatLevel: args.threatLevel,
      role: args.role,
      lastSeen: args.lastSeen,
      description: args.description,
      identifyingMarks: args.identifyingMarks,
      faceImage: args.faceImage,
      bodySprite: args.bodySprite,
      uapaSerialNo: args.uapaSerialNo,
      gazetteRef: args.gazetteRef,
      status: args.status || "ACTIVE",
      baseScore: args.baseScore || 1000,
      neutralizedCount: existing ? existing.neutralizedCount : 0,
    };

    if (existing) {
      await ctx.db.patch(existing._id, targetDoc);
      return existing._id;
    } else {
      return await ctx.db.insert("targets", targetDoc);
    }
  },
});

// Wipe existing targets and seed newly generated UAPA targets
export const resetAndSeedTargets = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Delete all existing targets
    const existingTargets = await ctx.db.query("targets").collect();
    for (const t of existingTargets) {
      await ctx.db.delete(t._id);
    }

    // 2. Insert new UAPA targets
    const newTargets = [
    {
        "codename": "VALI-1",
        "name": "Maulana Masood Azhar",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Founder & Supreme Commander, Jaish-e-Mohammed (JeM)",
        "lastSeen": "Markaz Usman-o-Ali Outpost, Bahawalpur Sector",
        "description": "Mastermind behind the 2001 Indian Parliament attack, 2016 Pathankot airbase strike, and 2019 Pulwama convoy blast. Coordinates suicide strike modules and terror financing networks.",
        "identifyingMarks": "White traditional headwear, heavy build, dark cloak, escorted by armed commandos with assault rifles.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/masood_azhar.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_11_militia_commander.png",
        "uapaSerialNo": 1,
        "gazetteRef": "MHA Notification S.O. 3171(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1500,
        "neutralizedCount": 0
    },
    {
        "codename": "MOHAMMAD-SAHIB",
        "name": "Hafiz Muhammad Saeed",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Founder & Chief Amir, Lashkar-e-Taiba (LeT) / JuD",
        "lastSeen": "Muridke Operational Complex, Sector 2B",
        "description": "Chief conspirator of the 26/11 Mumbai terrorist attacks, 2006 Mumbai train bombings, and cross-border infiltration logistics across the Line of Control.",
        "identifyingMarks": "Reddish-dyed beard, traditional vest over tunic, heavily fortified perimeter protection.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/hafiz_saeed.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_01_urban_assault.png",
        "uapaSerialNo": 2,
        "gazetteRef": "MHA Notification S.O. 3171(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1500,
        "neutralizedCount": 0
    },
    {
        "codename": "CHACHA-OPS",
        "name": "Zaki-ur-Rehman Lakhvi",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Supreme Military Operations Commander, Lashkar-e-Taiba (LeT)",
        "lastSeen": "Muzaffarabad Combat Training Base, Sector 3A",
        "description": "Direct tactical controller and handler of the 10 sea-borne terrorists during the 2008 Mumbai 26/11 siege. Supervised maritime assault training and weaponry selection.",
        "identifyingMarks": "Full dark beard, military-style chest harness, tactical radio transceiver.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/zakiur_rehman_lakhvi.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_02_covert_commando.png",
        "uapaSerialNo": 3,
        "gazetteRef": "MHA Notification S.O. 3171(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1400,
        "neutralizedCount": 0
    },
    {
        "codename": "GOLD-SYNDICATE",
        "name": "Dawood Ibrahim Kaskar",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Head of International Crime & Terror Syndicate (D-Company)",
        "lastSeen": "Clifton Safehouse Compound, Sector 7X",
        "description": "Perpetrator of the 1993 Mumbai serial bomb blasts. Operates an international syndicate funding terror logistics, narcotics smuggling, arms supply, and counterfeit currency rackets.",
        "identifyingMarks": "Groomed moustache, luxury watch, protected by elite armed personal security details.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/dawood_ibrahim.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_18_specops_mercenary.png",
        "uapaSerialNo": 4,
        "gazetteRef": "MHA Notification S.O. 3171(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1500,
        "neutralizedCount": 0
    },
    {
        "codename": "IBRAHIM-SHAH",
        "name": "Sajid Mir",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Chief Technical & Foreign Operations Handler, Lashkar-e-Taiba",
        "lastSeen": "Secret Tactical Comms Node, Sector 4D",
        "description": "VoIP tactical voice controller directing gunmen in real-time during the Taj, Oberoi, and Nariman House assaults during 26/11. Expert in clandestine foreign procurement.",
        "identifyingMarks": "Tactical dark balaclava or cap, mobile satellite encryption pack, tactical chest rig with carbine.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/sajid_mir.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_15_electronic_warfare.png",
        "uapaSerialNo": 14,
        "gazetteRef": "MHA Notification S.O. 3848(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1400,
        "neutralizedCount": 0
    },
    {
        "codename": "BUZURG-9",
        "name": "Syed Mohammad Yusuf Shah @ Syed Salahuddin",
        "threatLevel": "EXTREME (CATEGORY 1)",
        "role": "Supreme Commander, Hizbul Mujahideen (HM) & United Jihad Council",
        "lastSeen": "Rawalpindi Transit Node, Sector 5C",
        "description": "Coordinates cross-border infiltration of strike modules, tactical drone drops, arms distribution, and local recruit radicalization across the Kashmir valley.",
        "identifyingMarks": "Grey-white long beard, woolen cap, accompanied by armed tactical bodyguards.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/syed_salahuddin.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_16_ridge_patrol.png",
        "uapaSerialNo": 23,
        "gazetteRef": "MHA Notification S.O. 3848(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1300,
        "neutralizedCount": 0
    },
    {
        "codename": "IM-FOUNDER",
        "name": "Riyaz Ismail Shahbandri @ Riyaz Bhatkal",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Founder & Supreme Bombmaker, Indian Mujahideen (IM)",
        "lastSeen": "Safe Transit Zone, Sector 8K",
        "description": "Responsible for serial bomb blasts across Delhi, Ahmedabad, Jaipur, Bengaluru, and Pune German Bakery. Expert in assembling ammonium nitrate-timer explosive arrays.",
        "identifyingMarks": "Trimmed goatee beard, eyeglasses, utility vest, carrying equipment briefcase.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/riyaz_bhatkal.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_14_ballistic_pointman.png",
        "uapaSerialNo": 26,
        "gazetteRef": "MHA Notification S.O. 3848(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1300,
        "neutralizedCount": 0
    },
    {
        "codename": "SHAKEEL-EXEC",
        "name": "Shaikh Shakeel @ Chhota Shakeel",
        "threatLevel": "EXTREME (CATEGORY 1)",
        "role": "Chief Enforcer & Syndicate Extortion Head, D-Company",
        "lastSeen": "Sindh Industrial Zone Safehouse, Sector 7S",
        "description": "Controls cross-border targeted strike teams, arms procurement, hawala money laundering, and illegal narcotics distribution funding insurgent cells.",
        "identifyingMarks": "Short moustache, mobile encryption rig, heavy gold ring, armed bodyguards.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/chhota_shakeel.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_17_tactical_raider.png",
        "uapaSerialNo": 28,
        "gazetteRef": "MHA Notification S.O. 3848(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1200,
        "neutralizedCount": 0
    },
    {
        "codename": "MUSTAFA-BLAST",
        "name": "Ibrahim Abdul Razak Memon @ Tiger Memon",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Operational Commander & Logistics Chief, 1993 Mumbai Blasts",
        "lastSeen": "Karachi Defense Housing Outpost, Sector 6M",
        "description": "Directly orchestrated landing of RDX explosives and assault rifles on Maharashtra coasts, weapon training camps, and timed car bombings across Mumbai landmarks.",
        "identifyingMarks": "Thick moustache, dark aviator sunglasses, tactical holster with sidearm.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/tiger_memon.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_10_saboteur_engineer.png",
        "uapaSerialNo": 30,
        "gazetteRef": "MHA Notification S.O. 3848(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1400,
        "neutralizedCount": 0
    },
    {
        "codename": "DOCTOR-WEST",
        "name": "Satwinder Singh @ Goldy Brar",
        "threatLevel": "EXTREME (CATEGORY 1)",
        "role": "Cross-Border Syndicate Coordinator & Targeted Hit Organizer",
        "lastSeen": "Transit Logistics Hub, Sector 8B",
        "description": "Designated terrorist behind cross-border smuggling of assault rifles, grenade launchers, extortion networks, and high-profile contract assassinations in northern India.",
        "identifyingMarks": "Short cropped beard, casual jacket over tactical vest, encrypted VOIP handsets.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/goldy_brar.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_12_smg_gunner.png",
        "uapaSerialNo": 56,
        "gazetteRef": "MHA Notification S.O. 56 / 08.01.2024",
        "status": "ACTIVE",
        "baseScore": 1200,
        "neutralizedCount": 0
    },
    {
        "codename": "LEGAL-FRONT",
        "name": "Gurpatwant Singh Pannun",
        "threatLevel": "HIGH (CATEGORY 2)",
        "role": "Propaganda & Secessionist Terror Financier, SFJ",
        "lastSeen": "International Broadcast Suite, Sector 9N",
        "description": "Key instigator of violent anti-India campaigns, radicalization conduits, issuing bounties and threats against civilian air transport, infrastructure, and state leaders.",
        "identifyingMarks": "Dark turban, tactical recon headset, compact carbine.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/gurpatwant_pannun.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_09_tactical_scout.png",
        "uapaSerialNo": 11,
        "gazetteRef": "MHA Notification S.O. 2210(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1000,
        "neutralizedCount": 0
    },
    {
        "codename": "LANDA-STRIKE",
        "name": "Lakhbir Singh @ Landa",
        "threatLevel": "EXTREME (CATEGORY 1)",
        "role": "RPG & IED Blast Coordinator, Babbar Khalsa International (BKI)",
        "lastSeen": "Trans-border Transit Hideout, Sector 4T",
        "description": "Key operative behind the RPG attack on Punjab Police Intelligence HQ in Mohali and improvised explosive device placements across critical infrastructure.",
        "identifyingMarks": "Bearded with dark beanie, tactical ballistic jacket, automatic weapon.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/lakhbir_singh_landa.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_06_cqb_breacher.png",
        "uapaSerialNo": 55,
        "gazetteRef": "MHA Notification S.O. 55 / 08.01.2024",
        "status": "ACTIVE",
        "baseScore": 1200,
        "neutralizedCount": 0
    },
    {
        "codename": "RINDA-BKI",
        "name": "Harwinder Singh Sandhu @ Rinda",
        "threatLevel": "CRITICAL (CATEGORY 1)",
        "role": "Field Commander & Drone Weapons Smuggler, BKI",
        "lastSeen": "Border Drone Launching Station, Sector 2R",
        "description": "Orchestrates cross-border UAV drone drops of AK assault rifles, MP5 submachine guns, hand grenades, and contraband funding trans-border strike teams.",
        "identifyingMarks": "Full black beard, dark combat hoodie, tactical chest rig with extra magazines.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/harwinder_sandhu_rinda.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_20_masked_vanguard.png",
        "uapaSerialNo": 54,
        "gazetteRef": "MHA Notification S.O. 54 / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1300,
        "neutralizedCount": 0
    },
    {
        "codename": "KTF-NORTH",
        "name": "Hardeep Singh Nijjar",
        "threatLevel": "EXTREME (CATEGORY 1)",
        "role": "Chief Operational Head, Khalistan Tiger Force (KTF)",
        "lastSeen": "Western Logistics Hub, Sector 9K",
        "description": "Designated under UAPA for recruiting, financing, and training targeted assassination hit squads and organizing weapons training camps.",
        "identifyingMarks": "Flowing beard, dark turban, alpine combat parka, scoped rifle.",
        "faceImage": "https://dhurandar-assets.pages.dev/mugshots/hardeep_nijjar.jpg",
        "bodySprite": "https://dhurandar-assets.pages.dev/sprites/sprite_03_mountain_sniper.png",
        "uapaSerialNo": 12,
        "gazetteRef": "MHA Notification S.O. 2210(E) / Fourth Schedule",
        "status": "ACTIVE",
        "baseScore": 1200,
        "neutralizedCount": 0
    }
];

    const insertedIds = [];
    for (const target of newTargets) {
      const id = await ctx.db.insert("targets", target);
      insertedIds.push(id);
    }

    return {
      deletedCount: existingTargets.length,
      insertedCount: insertedIds.length,
      status: "SUCCESS"
    };
  }
});
