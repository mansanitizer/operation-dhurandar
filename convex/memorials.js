import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

// List all memorials in the Hall of Heroes
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memorials").collect();
  },
});

// Get a specific braveheart memorial by slug ID
export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memorials")
      .withIndex("by_slug", (q) => q.eq("id", args.id))
      .first();
  },
});

// Pay Tribute / Salute a braveheart
export const payTribute = mutation({
  args: {
    memorialId: v.string(),
    agentCallsign: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const memorial = await ctx.db
      .query("memorials")
      .withIndex("by_slug", (q) => q.eq("id", args.memorialId))
      .first();

    if (!memorial) {
      throw new Error(`Memorial with ID ${args.memorialId} not found.`);
    }

    // Increment salutes count
    await ctx.db.patch(memorial._id, {
      salutesCount: memorial.salutesCount + 1,
    });

    // Record tribute
    const tributeId = await ctx.db.insert("tributes", {
      memorialId: args.memorialId,
      agentCallsign: args.agentCallsign,
      message: args.message || "Saluted with Highest National Honors 🇮🇳",
      timestamp: Date.now(),
    });

    // Also push to Live Ops Feed
    await ctx.db.insert("opsFeed", {
      type: "TRIBUTE",
      agentCallsign: args.agentCallsign,
      headline: `TRIBUTE PAID // ${memorial.name}`,
      detail: `Agent ${args.agentCallsign} paid national homage to ${memorial.name} (${memorial.decoration}).`,
      timestamp: Date.now(),
    });

    return {
      status: "SUCCESS",
      salutesCount: memorial.salutesCount + 1,
      tributeId,
    };
  },
});

// Reset and seed all 16 Hall of Heroes memorials
export const resetAndSeedMemorials = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("memorials").collect();
    for (const m of existing) {
      await ctx.db.delete(m._id);
    }

    const newMemorials = [
    {
        "id": "sandeep-unnikrishnan",
        "name": "Major Sandeep Unnikrishnan, AC",
        "rank": "Major",
        "unit": "51 Special Action Group (NSG) / 7 Bihar",
        "decoration": "Ashoka Chakra (Posthumous)",
        "operation": "Operation Black Tornado (26/11 Mumbai, 2008)",
        "dateOfMartyrdom": "28 November 2008",
        "image": "https://dhurandar-assets.pages.dev/heroes/sandeep-unnikrishnan.jpg",
        "quote": "\"Do not come up, I will handle them.\"",
        "writeUp": "During the 26/11 Mumbai terrorist attacks at the Taj Mahal Palace Hotel, Major Sandeep Unnikrishnan led the elite NSG 51 SAG commando team to rescue hostages from the terror siege. When his fellow commando was hit by enemy fire, he engaged the terrorists alone in fierce close combat, drawing fire away from his team before making the supreme sacrifice.",
        "salutesCount": 2611,
        "citations": [
            "Ashoka Chakra \u2014 India's highest peacetime military decoration for conspicuous bravery",
            "NSG Special Action Group Commander",
            "Operation Black Tornado Hero"
        ],
        "links": [
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            },
            {
                "label": "MHA Gallantry Citation",
                "url": "https://www.gallantryawards.gov.in"
            }
        ]
    },
    {
        "id": "vikram-batra",
        "name": "Captain Vikram Batra, PVC",
        "rank": "Captain",
        "unit": "13 Jammu and Kashmir Rifles",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "Operation Vijay (Kargil War, 1999)",
        "dateOfMartyrdom": "7 July 1999",
        "image": "https://dhurandar-assets.pages.dev/heroes/vikram-batra.jpg",
        "quote": "\"Yeh Dil Maange More!\"",
        "writeUp": "Leading from the front at 17,000 feet in the Kargil heights, Captain Batra recaptured Point 5140 in fierce hand-to-hand combat. Later, during the assault on Point 4875, he fearlessly exposed himself to heavy enemy machine gun fire to rescue an injured junior officer, laying down his life with unmatched valor.",
        "salutesCount": 1999,
        "citations": [
            "Param Vir Chakra \u2014 India's highest military decoration for most conspicuous bravery",
            "Sher Shah of Kargil",
            "Captor of Point 5140 & Point 4875"
        ],
        "links": [
            {
                "label": "Param Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "mohit-sharma",
        "name": "Major Mohit Sharma, AC, SM",
        "rank": "Major",
        "unit": "1 Para (Special Forces)",
        "decoration": "Ashoka Chakra (Posthumous)",
        "operation": "Kupwara Counter-Terror Ops (J&K, 2009)",
        "dateOfMartyrdom": "21 March 2009",
        "image": "https://dhurandar-assets.pages.dev/heroes/mohit-sharma.jpg",
        "quote": "\"Bravery is not the absence of fear, but the mastery of it.\"",
        "writeUp": "Operating deep undercover under the alias Iftikhar Bhatt and later commanding 1 Para SF commandos in dense Kupwara forests, Major Mohit Sharma shielded two wounded comrades under heavy sniper fire, eliminated four terrorists in close quarters, and laid down his life protecting his men.",
        "salutesCount": 1857,
        "citations": [
            "Ashoka Chakra (Posthumous)",
            "Sena Medal (Gallantry)",
            "1 Para SF Covert Recon Commander"
        ],
        "links": [
            {
                "label": "Special Forces Roll of Honor",
                "url": "https://indianarmy.nic.in"
            },
            {
                "label": "Gallantry Awards Citation",
                "url": "https://www.gallantryawards.gov.in"
            }
        ]
    },
    {
        "id": "santosh-babu",
        "name": "Colonel B. Santosh Babu, MVC",
        "rank": "Colonel",
        "unit": "16 Bihar Regiment",
        "decoration": "Maha Vir Chakra (Posthumous)",
        "operation": "Operation Snow Leopard (Galwan Valley, 2020)",
        "dateOfMartyrdom": "15 June 2020",
        "image": "https://dhurandar-assets.pages.dev/heroes/santosh-babu.jpg",
        "quote": "\"Service Before Self \u2014 Stand Firm.\"",
        "writeUp": "Commanding Officer of 16 Bihar, Colonel Santosh Babu led his troops with exemplary calm and indomitable courage during the violent confrontation in the Galwan Valley, holding Indian sovereign territory resolutely until making the supreme sacrifice.",
        "salutesCount": 2020,
        "citations": [
            "Maha Vir Chakra (Posthumous)",
            "Commanding Officer, 16 Bihar Regiment",
            "Defender of Galwan Heights"
        ],
        "links": [
            {
                "label": "Galwan Bravehearts Memorial",
                "url": "https://nationalwarmemorial.gov.in"
            },
            {
                "label": "Gallantry Awards Citation",
                "url": "https://www.gallantryawards.gov.in"
            }
        ]
    },
    {
        "id": "tukaram-omble",
        "name": "ASI Tukaram Gopal Omble, AC",
        "rank": "Assistant Sub-Inspector",
        "unit": "Mumbai Police (DB Marg Police Station)",
        "decoration": "Ashoka Chakra (Posthumous)",
        "operation": "26/11 Mumbai Terror Attacks (Girgaum Chowpatty, 2008)",
        "dateOfMartyrdom": "26 November 2008",
        "image": "https://dhurandar-assets.pages.dev/heroes/tukaram-omble.jpg",
        "quote": "\"Hold him down, do not let him escape!\"",
        "writeUp": "Armed only with a lathi, ASI Tukaram Omble pounced directly onto terrorist Ajmal Kasab at Girgaum Chowpatty, taking a point-blank burst of 23 bullets from an AK-47 into his torso while refusing to let go of the barrel with his bare hands, making Kasab's live capture possible.",
        "salutesCount": 2611,
        "citations": [
            "Ashoka Chakra (Posthumous) \u2014 Highest Peacetime Gallantry Honor",
            "Hero of 26/11 Girgaum Interception",
            "President's Police Medal for Gallantry"
        ],
        "links": [
            {
                "label": "MHA Gallantry Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "Mumbai Police Memorial",
                "url": "https://mumbaipolice.gov.in"
            }
        ]
    },
    {
        "id": "somnath-sharma",
        "name": "Major Somnath Sharma, PVC",
        "rank": "Major",
        "unit": "4 Kumaon Regiment",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "Battle of Badgam (1947 Indo-Pak War)",
        "dateOfMartyrdom": "3 November 1947",
        "image": "https://dhurandar-assets.pages.dev/heroes/somnath-sharma.jpg",
        "quote": "\"The enemies are only 50 yards from us. We are heavily outnumbered. I shall not withdraw an inch but fight to our last man and last round.\"",
        "writeUp": "The first recipient of the Param Vir Chakra, Major Somnath Sharma and his company of 4 Kumaon held the Badgam heights against 500 heavily armed tribal raiders, saving the vital Srinagar airfield and the Kashmir valley despite having his left arm in a plaster cast.",
        "salutesCount": 1947,
        "citations": [
            "Param Vir Chakra (First Recipient in Indian History)",
            "Savior of Srinagar Airfield",
            "Commander, Delta Company, 4 Kumaon"
        ],
        "links": [
            {
                "label": "First Param Vir Chakra Record",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "mukund-varadarajan",
        "name": "Major Mukund Varadarajan, AC",
        "rank": "Major",
        "unit": "44 Rashtriya Rifles / Rajput Regiment",
        "decoration": "Ashoka Chakra (Posthumous)",
        "operation": "Operation Qazipathri (Shopian, J&K, 2014)",
        "dateOfMartyrdom": "25 April 2014",
        "image": "https://dhurandar-assets.pages.dev/heroes/mukund-varadarajan.jpg",
        "quote": "\"In the line of duty, courage is our only currency.\"",
        "writeUp": "Leading 44 Rashtriya Rifles in Shopian, Major Mukund Varadarajan cleared an orchard complex and crawled into an outhouse under heavy automatic fire, neutralizing three top Hizbul Mujahideen terrorists in hand-to-hand room intervention before succumbing to multiple gunshot wounds.",
        "salutesCount": 2014,
        "citations": [
            "Ashoka Chakra (Posthumous)",
            "Company Commander, 44 Rashtriya Rifles",
            "Hero of Shopian Operations"
        ],
        "links": [
            {
                "label": "Ashoka Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "nazir-ahmad-wani",
        "name": "Lance Naik Nazir Ahmad Wani, AC, SM*",
        "rank": "Lance Naik",
        "unit": "34 Rashtriya Rifles / 9 Para (Special Forces)",
        "decoration": "Ashoka Chakra (Posthumous)",
        "operation": "Operation Batagund (Shopian, J&K, 2018)",
        "dateOfMartyrdom": "25 November 2018",
        "image": "https://dhurandar-assets.pages.dev/heroes/nazir-ahmad-wani.jpg",
        "quote": "\"A soldier does not fight because he hates what is in front of him, but because he loves what is behind him.\"",
        "writeUp": "A reformed insurgent who joined the Territorial Army and rose to become an elite 9 Para SF commando, Lance Naik Wani breached a fortified terror hideout in Shopian, eliminating two top commanders at point-blank range while sustaining grievous injuries to shield his assault buddy.",
        "salutesCount": 2018,
        "citations": [
            "Ashoka Chakra (Posthumous)",
            "Sena Medal (Gallantry) with Bar",
            "9 Para (Special Forces) Elite Operator"
        ],
        "links": [
            {
                "label": "Ashoka Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "nirmal-jit-sekhon",
        "name": "Flying Officer Nirmal Jit Singh Sekhon, PVC",
        "rank": "Flying Officer",
        "unit": "No. 18 Squadron (The Flying Bullets), IAF",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "1971 Indo-Pak War (Air Defence of Srinagar Airbase)",
        "dateOfMartyrdom": "14 December 1971",
        "image": "https://dhurandar-assets.pages.dev/heroes/nirmal-jit-sekhon.jpg",
        "quote": "\"I will engage the Sabres \u2014 Srinagar base is clear!\"",
        "writeUp": "The only Indian Air Force personnel to be awarded the Param Vir Chakra. Flying Officer Sekhon took off in his Gnat fighter jet while Srinagar runway was being strafed by six PAF F-86 Sabres. He single-handedly engaged the entire enemy formation in low-altitude dogfights, shooting down two Sabres.",
        "salutesCount": 1971,
        "citations": [
            "Param Vir Chakra (Only IAF recipient in Indian History)",
            "Defender of Srinagar Airbase",
            "No. 18 Squadron \"The Flying Bullets\""
        ],
        "links": [
            {
                "label": "Param Vir Chakra IAF Record",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "abdul-hamid",
        "name": "CQMH Abdul Hamid, PVC",
        "rank": "Company Quartermaster Havildar",
        "unit": "4 Grenadiers",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "Battle of Asal Uttar (1965 Indo-Pak War)",
        "dateOfMartyrdom": "10 September 1965",
        "image": "https://dhurandar-assets.pages.dev/heroes/abdul-hamid.jpg",
        "quote": "\"Target the Patton! Hold the perimeter!\"",
        "writeUp": "During the historic tank battle of Asal Uttar, CQMH Abdul Hamid positioned his jeep-mounted 106mm recoilless gun in sugar cane fields, destroying seven Pakistani Patton tanks in succession before laying down his life when an eighth tank fired upon his position.",
        "salutesCount": 1965,
        "citations": [
            "Param Vir Chakra (Posthumous)",
            "Tank Buster of Asal Uttar",
            "4 Grenadiers Battalion Hero"
        ],
        "links": [
            {
                "label": "Param Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "shaitan-singh",
        "name": "Major Shaitan Singh, PVC",
        "rank": "Major",
        "unit": "13 Kumaon Regiment",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "Battle of Rezang La (1962 Sino-Indian War)",
        "dateOfMartyrdom": "18 November 1962",
        "image": "https://dhurandar-assets.pages.dev/heroes/shaitan-singh.jpg",
        "quote": "\"Not a single man will leave his post. We stand for Ladakh.\"",
        "writeUp": "At 16,000 feet in Rezang La during -30\u00b0C blizzards, Major Shaitan Singh commanded Charlie Company (120 Ahir bravehearts) against massive enemy infantry waves. Moving from post to post under intense mortar fire, he inspired his men to fight to the last man and last bullet, repelling multiple assaults.",
        "salutesCount": 1962,
        "citations": [
            "Param Vir Chakra (Posthumous)",
            "Hero of the Battle of Rezang La",
            "Charlie Company Commander, 13 Kumaon"
        ],
        "links": [
            {
                "label": "Param Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "manoj-kumar-pandey",
        "name": "Captain Manoj Kumar Pandey, PVC",
        "rank": "Captain",
        "unit": "1/11 Gorkha Rifles",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "Operation Vijay (Battle of Khalubar, Kargil, 1999)",
        "dateOfMartyrdom": "3 July 1999",
        "image": "https://dhurandar-assets.pages.dev/heroes/manoj-kumar-pandey.jpg",
        "quote": "\"If death strikes before I prove my blood, I swear, I will kill death!\"",
        "writeUp": "During the night assault on Khalubar Ridge in Kargil, Captain Manoj Pandey led his platoon through daylight-clear machine gun fire, cleared two fortified enemy positions in hand-to-hand combat, and destroyed a fourth bunker with his Khukri before succumbing to mortal wounds.",
        "salutesCount": 1999,
        "citations": [
            "Param Vir Chakra (Posthumous)",
            "Hero of Khalubar Heights",
            "1/11 Gorkha Rifles Battalion Hero"
        ],
        "links": [
            {
                "label": "Param Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "hangpan-dada",
        "name": "Havildar Hangpan Dada, AC",
        "rank": "Havildar",
        "unit": "35 Rashtriya Rifles / Assam Regiment",
        "decoration": "Ashoka Chakra (Posthumous)",
        "operation": "Shamshabari Ridge Counter-Infiltration (Naugam, 2016)",
        "dateOfMartyrdom": "26 May 2016",
        "image": "https://dhurandar-assets.pages.dev/heroes/hangpan-dada.jpg",
        "quote": "\"Lead from the front, stand as the shield.\"",
        "writeUp": "At 13,000 feet on the ice-covered Shamshabari Ridge in Kashmir, Havildar Hangpan Dada charged alone through heavy automatic fire into a gully, eliminating two infiltrating terrorists in close combat and two more in hand-to-hand grappling, saving his team before making the supreme sacrifice.",
        "salutesCount": 2016,
        "citations": [
            "Ashoka Chakra (Posthumous)",
            "Hero of Shamshabari Ridge",
            "Assam Regiment Gallantry Icon"
        ],
        "links": [
            {
                "label": "Ashoka Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "jaswant-singh-rawat",
        "name": "Rifleman Jaswant Singh Rawat, MVC",
        "rank": "Rifleman",
        "unit": "4 Garhwal Rifles",
        "decoration": "Maha Vir Chakra (Posthumous)",
        "operation": "Battle of Nuranang (1962 Sino-Indian War)",
        "dateOfMartyrdom": "17 November 1962",
        "image": "https://dhurandar-assets.pages.dev/heroes/jaswant-singh-rawat.jpg",
        "quote": "\"The Garhwali spirit never surrenders.\"",
        "writeUp": "During the Battle of Nuranang, Rifleman Jaswant Singh Rawat captured an enemy medium machine gun and held the post for 72 hours almost single-handedly with the help of two local Monpa girls (Sela and Nura), running across three gun points to fool the enemy into believing a full company was defending the ridge.",
        "salutesCount": 1962,
        "citations": [
            "Maha Vir Chakra (Posthumous)",
            "Legend of Jaswant Garh",
            "4 Garhwal Rifles Gallantry Hero"
        ],
        "links": [
            {
                "label": "Maha Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "anuj-nayyar",
        "name": "Captain Anuj Nayyar, MVC",
        "rank": "Captain",
        "unit": "17 Jat Regiment",
        "decoration": "Maha Vir Chakra (Posthumous)",
        "operation": "Operation Vijay (Battle of Pimple Complex, Kargil, 1999)",
        "dateOfMartyrdom": "7 July 1999",
        "image": "https://dhurandar-assets.pages.dev/heroes/anuj-nayyar.jpg",
        "quote": "\"The bunker is ours. Charge!\"",
        "writeUp": "Second-in-command of Charlie Company during the assault on the Pimple Complex (Point 4875), Captain Anuj Nayyar advanced under heavy rocket and mortar fire, single-handedly clearing three enemy bunker strongpoints with hand grenades and CQB fire before securing the peak.",
        "salutesCount": 1999,
        "citations": [
            "Maha Vir Chakra (Posthumous)",
            "Hero of Point 4875 / Pimple Complex",
            "17 Jat Regiment Gallantry Hero"
        ],
        "links": [
            {
                "label": "Maha Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    },
    {
        "id": "albert-ekka",
        "name": "Lance Naik Albert Ekka, PVC",
        "rank": "Lance Naik",
        "unit": "14 Guards",
        "decoration": "Param Vir Chakra (Posthumous)",
        "operation": "Battle of Gangasagar (1971 Indo-Pak War)",
        "dateOfMartyrdom": "3 December 1971",
        "image": "https://dhurandar-assets.pages.dev/heroes/albert-ekka.jpg",
        "quote": "\"Silence the machine gun at any cost!\"",
        "writeUp": "During the assault on the fortified railway station at Gangasagar, Lance Naik Albert Ekka charged through fortified enemy trenches, silenced two medium machine gun bunker complexes in fierce hand-to-hand bayonet combat despite being grievously wounded, ensuring victory for 14 Guards.",
        "salutesCount": 1971,
        "citations": [
            "Param Vir Chakra (Posthumous)",
            "Hero of the Battle of Gangasagar",
            "14 Guards Battalion Gallantry Icon"
        ],
        "links": [
            {
                "label": "Param Vir Chakra Citation",
                "url": "https://www.gallantryawards.gov.in"
            },
            {
                "label": "National War Memorial Entry",
                "url": "https://nationalwarmemorial.gov.in"
            }
        ]
    }
];

    const insertedIds = [];
    for (const item of newMemorials) {
      const id = await ctx.db.insert("memorials", item);
      insertedIds.push(id);
    }

    return {
      deletedCount: existing.length,
      insertedCount: insertedIds.length,
      status: "SUCCESS"
    };
  }
});
