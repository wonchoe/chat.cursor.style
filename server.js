const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const tls = require('tls');
const https = require('https');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');

// 🌐 Express
const app = express();

// 🧠 SNI логіка — різні сертифікати для localhost / production
const sslOptions = {
  SNICallback: (servername, cb) => {
    let ctx;
    if (servername === 'localhost' || servername === '127.0.0.1') {
      console.log(`🔐 Using localhost cert for ${servername}`);
      ctx = tls.createSecureContext({
        key: fs.readFileSync(__dirname + '/ssl/localhost.key'),
        cert: fs.readFileSync(__dirname + '/ssl/localhost.pem')
      });
    } else {
      console.log(`🔐 Using origin cert for ${servername}`);
      ctx = tls.createSecureContext({
        key: fs.readFileSync(__dirname + '/ssl/origin.key'),
        cert: fs.readFileSync(__dirname + '/ssl/origin.pem')
      });
    }
    cb(null, ctx);
  },
  // 🧱 Дефолтний серт на випадок без SNI (наприклад, curl без hostname)
  key: fs.readFileSync(__dirname + '/ssl/origin.key'),
  cert: fs.readFileSync(__dirname + '/ssl/origin.pem'),
};

// 🌐 HTTPS сервер
const server = https.createServer(sslOptions, app);

// 🔌 Socket.IO поверх HTTPS
const io = new Server(server);

// 📡 Порт і Mongo URL
const PORT = 8443;
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'chatdb';
const chatHistory = {}; // { roomId: [...] }


const dangerousChars = /[<>;"'\\`$()=@#]/;
const escapedDangerous = /&(#x?)?[0-9a-fA-F]+;|<|>|<|>|"|'|&/i;
const emojiBlacklist = ['🖕', '🔪', '🔫', '🧨', '💣', '☠️', '💀', '⚰️', '🍆', '🍑', '💦', '👅', '🫦', '🩸', '💩', '🤮', '🤢', '🤬'];
const containsBlacklistedEmoji = (str) => emojiBlacklist.some(emoji => str.includes(emoji));
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const knownTldRegex = /\b[a-z0-9-]+\.(aaa|aarp|abb|abbott|abbvie|abc|able|abogado|abudhabi|ac|academy|accenture|accountant|accountants|aco|actor|ad|ads|adult|ae|aeg|aero|aetna|af|afl|africa|ag|agakhan|agency|ai|aig|airbus|airforce|airtel|akdn|al|alibaba|alipay|allfinanz|allstate|ally|alsace|alstom|am|amazon|americanexpress|americanfamily|amex|amfam|amica|amsterdam|analytics|android|anquan|anz|ao|aol|apartments|app|apple|aq|aquarelle|ar|arab|aramco|archi|army|arpa|art|arte|as|asda|asia|associates|at|athleta|attorney|au|auction|audi|audible|audio|auspost|author|auto|autos|aw|aws|ax|axa|az|azure|ba|baby|baidu|banamex|band|bank|bar|barcelona|barclaycard|barclays|barefoot|bargains|baseball|basketball|bauhaus|bayern|bb|bbc|bbt|bbva|bcg|bcn|bd|be|beats|beauty|beer|bentley|berlin|best|bestbuy|bet|bf|bg|bh|bharti|bi|bible|bid|bike|bing|bingo|bio|biz|bj|black|blackfriday|blockbuster|blog|bloomberg|blue|bm|bms|bmw|bn|bnppparibas|bo|boats|boehringer|bofa|bom|bond|boo|book|booking|bosch|bostik|boston|bot|boutique|box|br|bradesco|bridgestone|broadway|broker|brother|brussels|bs|bt|build|builders|business|buy|buzz|bv|bw|by|bz|bzh|ca|cab|cafe|cal|call|calvinklein|cam|camera|camp|canon|capetown|capital|capitalone|car|caravan|cards|care|career|careers|cars|casa|case|cash|casino|cat|catering|catholic|cba|cbn|cbre|cc|cd|center|ceo|cern|cf|cfa|cfd|cg|ch|chanel|channel|charity|chase|chat|cheap|chintai|christmas|chrome|church|ci|cipriani|circle|cisco|citadel|citi|citic|city|ck|cl|claims|cleaning|click|clinic|clinique|clothing|cloud|club|clubmed|cm|cn|co|coach|codes|coffee|college|cologne|com|commbank|community|company|compare|computer|comsec|condos|construction|consulting|contact|contractors|cooking|cool|coop|corsica|country|coupon|coupons|courses|cpa|cr|credit|creditcard|creditunion|cricket|crown|crs|cruise|cruises|cu|cuisinella|cv|cw|cx|cy|cymru|cyou|cz|dad|dance|data|date|dating|datsun|day|dclk|dds|de|deal|dealer|deals|degree|delivery|dell|deloitte|delta|democrat|dental|dentist|desi|design|dev|dhl|diamonds|diet|digital|direct|directory|discount|discover|dish|diy|dj|dk|dm|dnp|do|docs|doctor|dog|domains|dot|download|drive|dtv|dubai|dunlop|dupont|durban|dvag|dvr|dz|earth|eat|ec|eco|edeka|edu|education|ee|eg|email|emerck|energy|engineer|engineering|enterprises|epson|equipment|er|ericsson|erni|es|esq|estate|et|eu|eurovision|eus|events|exchange|expert|exposed|express|extraspace|fage|fail|fairwinds|faith|family|fan|fans|farm|farmers|fashion|fast|fedex|feedback|ferrari|ferrero|fi|fidelity|fido|film|final|finance|financial|fire|firestone|firmdale|fish|fishing|fit|fitness|fj|fk|flickr|flights|flir|florist|flowers|fly|fm|fo|foo|food|football|ford|forex|forsale|forum|foundation|fox|fr|free|fresenius|frl|frogans|frontier|ftr|fujitsu|fun|fund|furniture|futbol|fyi|ga|gal|gallery|gallo|gallup|game|games|gap|garden|gay|gb|gbiz|gd|gdn|ge|gea|gent|genting|george|gf|gg|ggee|gh|gi|gift|gifts|gives|giving|gl|glass|gle|global|globo|gm|gmail|gmbh|gmo|gmx|gn|godaddy|gold|goldpoint|golf|goo|goodyear|goog|google|gop|got|gov|gp|gq|gr|grainger|graphics|gratis|green|gripe|grocery|group|gs|gt|gu|gucci|guge|guide|guitars|guru|gw|gy|hair|hamburg|hangout|haus|hbo|hdfc|hdfcbank|health|healthcare|help|helsinki|here|hermes|hiphop|hisamitsu|hitachi|hiv|hk|hkt|hm|hn|hockey|holdings|holiday|homedepot|homegoods|homes|homesense|honda|horse|hospital|host|hosting|hot|hotels|hotmail|house|how|hr|hsbc|ht|hu|hughes|hyatt|hyundai|ibm|icbc|ice|icu|id|ie|ieee|ifm|ikano|il|im|imamat|imdb|immo|immobilien|in|inc|industries|infiniti|info|ing|ink|institute|insurance|insure|int|international|intuit|investments|io|ipiranga|iq|ir|irish|is|ismaili|ist|istanbul|it|itau|itv|jaguar|java|jcb|je|jeep|jetzt|jewelry|jio|jll|jm|jmp|jnj|jo|jobs|joburg|jot|joy|jp|jpmorgan|jprs|juegos|juniper|kaufen|kddi|ke|kerryhotels|kerryproperties|kfh|kg|kh|ki|kia|kids|kim|kindle|kitchen|kiwi|km|kn|koeln|komatsu|kosher|kp|kpmg|kpn|kr|krd|kred|kuokgroup|kw|ky|kyoto|kz|la|lacaixa|lamborghini|lamer|lancaster|land|landrover|lanxess|lasalle|lat|latino|latrobe|law|lawyer|lb|lc|lds|lease|leclerc|lefrak|legal|lego|lexus|lgbt|li|lidl|life|lifeinsurance|lifestyle|lighting|like|lilly|limited|limo|lincoln|link|live|living|lk|llc|llp|loan|loans|locker|locus|lol|london|lotte|lotto|love|lpl|lplfinancial|lr|ls|lt|ltd|ltda|lu|lundbeck|luxe|luxury|lv|ly|ma|madrid|maif|maison|makeup|man|management|mango|map|market|marketing|markets|marriott|marshalls|mattel|mba|mc|mckinsey|md|me|med|media|meet|melbourne|meme|memorial|men|menu|merckmsd|mg|mh|miami|microsoft|mil|mini|mint|mit|mitsubishi|mk|ml|mlb|mls|mm|mma|mn|mo|mobi|mobile|moda|moe|moi|mom|monash|money|monster|mormon|mortgage|moscow|moto|motorcycles|mov|movie|mp|mq|mr|ms|msd|mt|mtn|mtr|mu|museum|music|mv|mw|mx|my|mz|na|nab|nagoya|name|navy|nba|nc|ne|nec|net|netbank|netflix|network|neustar|new|news|next|nextdirect|nexus|nf|nfl|ng|ngo|nhk|ni|nico|nike|nikon|ninja|nissan|nissay|nl|no|nokia|norton|now|nowruz|nowtv|np|nr|nra|nrw|ntt|nu|nyc|nz|obi|observer|office|okinawa|olayan|olayangroup|ollo|om|omega|one|ong|onl|online|ooo|open|oracle|orange|org|organic|origins|osaka|otsuka|ott|ovh|pa|page|panasonic|paris|pars|partners|parts|party|pay|pccw|pe|pet|pf|pfizer|pg|ph|pharmacy|phd|philips|phone|photo|photography|photos|physio|pics|pictet|pictures|pid|pin|ping|pink|pioneer|pizza|pk|pl|place|play|playstation|plumbing|plus|pm|pn|pnc|pohl|poker|politie|porn|post|pr|pramerica|praxi|press|prime|pro|prod|productions|prof|progressive|promo|properties|property|protection|pru|prudential|ps|pt|pub|pw|pwc|py|qa|qpon|quebec|quest|racing|radio|re|read|realestate|realtor|realty|recipes|red|redstone|redumbrella|rehab|reise|reisen|reit|reliance|ren|rent|rentals|repair|report|republican|rest|restaurant|review|reviews|rexroth|rich|richardli|ricoh|ril|rio|rip|ro|rocks|rodeo|rogers|room|rs|rsvp|ru|rugby|ruhr|run|rw|rwe|ryukyu|sa|saarland|safe|safety|sakura|sale|salon|samsclub|samsung|sandvik|sandvikcoromant|sanofi|sap|sarl|sas|save|saxo|sb|sbi|sbs|sc|scb|schaeffler|schmidt|scholarships|school|schule|schwarz|science|scot|sd|se|search|seat|secure|security|seek|select|sener|services|seven|sew|sex|sexy|sfr|sg|sh|shangrila|sharp|shell|shia|shiksha|shoes|shop|shopping|shouji|show|si|silk|sina|singles|site|sj|sk|ski|skin|sky|skype|sl|sling|sm|smart|smile|sn|sncf|soccer|social|softbank|software|sohu|solar|solutions|song|sony|soy|spa|space|sport|spot|sr|srl|ss|st|stada|staples|star|statebank|statefarm|stc|stcgroup|stockholm|storage|store|stream|studio|study|style|su|sucks|supplies|supply|support|surf|surgery|suzuki|sv|swatch|swiss|sx|sy|sydney|systems|sz|tab|taipei|talk|taobao|target|tatamotors|tatar|tattoo|tax|taxi|tc|tci|td|tdk|team|tech|technology|tel|temasek|tennis|teva|tf|tg|th|thd|theater|theatre|tiaa|tickets|tienda|tips|tires|tirol|tj|tjmaxx|tjx|tk|tkmaxx|tl|tm|tmall|tn|to|today|tokyo|tools|top|toray|toshiba|total|tours|town|toyota|toys|tr|trade|trading|training|travel|travelers|travelersinsurance|trust|trv|tt|tube|tui|tunes|tushu|tv|tvs|tw|tz|ua|ubank|ubs|ug|uk|unicom|university|uno|uol|ups|us|uy|uz|va|vacations|vana|vanguard|vc|ve|vegas|ventures|verisign|versicherung|vet|vg|vi|viajes|video|vig|viking|villas|vin|vip|virgin|visa|vision|viva|vivo|vlaanderen|vn|vodka|volvo|vote|voting|voto|voyage|vu|wales|walmart|walter|wang|wanggou|watch|watches|weather|weatherchannel|webcam|weber|website|wed|wedding|weibo|weir|wf|whoswho|wien|wiki|williamhill|win|windows|wine|winners|wme|wolterskluwer|woodside|work|works|world|wow|ws|wtc|wtf|xbox|xerox|xihuan|xin|xn|xxx|xyz|yachts|yahoo|yamaxun|yandex|ye|yodobashi|yoga|yokohama|you|youtube|yt|yun|za|zappos|zara|zero|zip|zm|zone|zuerich|zw)\b/i;
const badWords = [
  "2g1c", "acrotomophilia", "alabamahotpocket", "alaskanpipeline", "anal", "anilingus", "anus", "apeshit", "arsehole", "arsebandit", "arsefucker", "ass", "assclown", "asshole", "assmunch", "asswipe",
  "autoerotic", "babeland", "babybatter", "babyjuice", "ballgag", "ballgravy", "ballkicking", "balllicking", "ballsack", "ballsucking", "bangbros", "bangbus", "bareback", "barelylegal",
  "barenaked", "bastard", "bastardo", "bastinado", "bbw", "bdsm", "beaner", "beaners", "beavercleaver", "beaverlips", "beastiality", "bestiality", "bigblack", "bigbreasts",
  "bigknockers", "bigtits", "bimbos", "birdlock", "bitch", "bitchass", "bitches", "bitchslap", "blackcock", "blondeaction", "blowjob", "bluewaffle", "blumpkin", "bollocks", "bondage",
  "boner", "boob", "boobs", "bootycall", "brownshowers", "brunetteaction", "bukkake", "bulldyke", "bulletvibe", "bullshit", "bunghole", "busty", "butt", "buttcheeks", "buttfuck",
  "butthole", "cameltoe", "camgirl", "camslut", "camwhore", "carpetmuncher", "chocolaterosebuds", "cialis", "circlejerk", "clevelandsteamer", "clit", "clitoris", "cloverclamps", "clusterfuck",
  "cock", "cockblock", "cockgoblin", "cockmunch", "cocksucker", "cockwomble", "cocks", "coprolagnia", "coprophilia", "cornhole", "coon", "coons", "crapsack", "creampie", "cum",
  "cumdump", "cumming", "cunt", "cuntface", "cuntpunch", "darkie", "daterape", "deepthroat", "dendrophilia", "dick", "dickbag", "dickcheese", "dickslap", "dickwad", "dildo", "dingleberry",
  "dingleberries", "dipshit", "dirtypillows", "dirtysanchez", "doggiestyle", "doggystyle", "dolcett", "domination", "dominatrix", "dommes", "donkeypunch", "doubledong", "doublepenetration",
  "dpaction", "dryhump", "dvda", "eatmyass", "ecchi", "ejaculation", "erotic", "erotism", "escort", "eunuch", "fag", "faggot", "fecal", "felch", "fellatio", "feltch", "femalesquirting",
  "femdom", "figging", "fingerbang", "fingering", "fisting", "footfetish", "footjob", "frotting", "fuck", "fuckass", "fuckbucket", "fuckbuttons", "fuckface", "fuckin", "fucking", "fucknugget",
  "fuckoff", "fuckstick", "fucktards", "fuckup", "fuckwit", "fudgepacker", "futanari", "gangbang", "gaysex", "genitals", "giantcock", "girlontop", "girlsgonewild", "goatcx", "goatse", "goddamn",
  "gokkun", "goldenshower", "goodpoop", "googirl", "goregasm", "grope", "groupsex", "gspot", "guro", "handjob", "hardcore", "hentai", "homoerotic", "honkey", "hooker", "horny", "hotcarl",
  "hotchick", "howtokill", "howtomurder", "hugefat", "humping", "incest", "intercourse", "jackoff", "jailbait", "jellydonut", "jerkoff", "jigaboo", "jiggaboo", "jiggerboo", "jizz", "juggs",
  "kike", "kinbaku", "kinkster", "kinky", "knobbing", "leatherrestraint", "leatherstraightjacket", "lemonparty", "livesex", "lolita", "lovemaking", "malesquirting", "masturbate", "masturbating",
  "masturbation", "menageatrois", "milf", "missionaryposition", "mong", "motherfucker", "moundofvenus", "mrhands", "muffdiver", "muffdiving", "nambla", "nawashi", "negro", "neonazi", "nigga", "nigger",
  "nignog", "nimphomania", "nipple", "nipples", "nsfw", "nude", "nudity", "nutten", "nympho", "nymphomania", "octopussy", "omorashi", "onecuptwogirls", "oneguyonejar", "orgasm", "orgy",
  "paedophile", "paki", "panties", "panty", "pedobear", "pedophile", "pegging", "penis", "phonesex", "pieceofshit", "pikey", "piss", "pissbucket", "pissed", "pissflaps", "pisspig", "playboy",
  "pleasurechest", "polesmoker", "ponyplay", "poon", "poontang", "punany", "poopchute", "porn", "porno", "pornography", "princealbertpiercing", "pthc", "pubes", "pussy", "pussyfart", "queaf",
  "queef", "quim", "raghead", "ragingboner", "rape", "raping", "rapist", "rectum", "reversecowgirl", "rimjob", "rimming", "rosypalm", "rustytrombone", "sadism", "santorum", "scat", "schlong",
  "scissoring", "semen", "sex", "sexcam", "sexo", "sexy", "sexual", "sexually", "sexuality", "shavedbeaver", "shavedpussy", "shemale", "shibari", "shit", "shitbag", "shitblimp", "shitcunt",
  "shithead", "shitlord", "shitsucker", "shitty", "shota", "shrimping", "skeet", "slanteye", "slut", "smut", "snatch", "snowballing", "sodomize", "sodomy", "spastic", "spic",
  "splooge", "spooge", "spreadlegs", "spunk", "strapon", "strappado", "stripclub", "styledoggy", "suck", "sucks", "suicidegirls", "sultrywomen", "swastika", "swinger", "taintedlove", "tastemy",
  "teabagging", "threesome", "throating", "thumbzilla", "thundercunt", "tiedup", "tightwhite", "tit", "tits", "titties", "titty", "tongueina", "topless", "tosser", "tossbag", "towelhead",
  "tranny", "tribadism", "tubgirl", "tushy", "twat", "twatface", "twatwaffle", "twink", "twinkie", "twogirlsonecup", "undressing", "upskirt", "urethraplay", "urophilia", "vagina", "venesmound",
  "viagra", "vibrator", "violetwand", "vorarephilia", "voyeur", "voyeurweb", "vulva", "wank", "wankjob", "wankstain", "wetback", "wetdream", "whitepower", "whore", "whorebag", "whoremonger",
  "worldsex", "wrappingmen", "wrinkledstarfish", "xxx", "yaoi", "yellowshowers", "yiffy",
  "zoophilia", "bychara", "byk", "chernozhopyi", "dolboy'eb", "ebalnik", "ebalo", "ebalom sch'elkat", "gol", "mudack", "opizdenet", "osto'eblo", "ostokhuitel'no", "ot'ebis", "otmudohat", "otpizdit", "otsosi", "padlo", "pedik", "perdet", "petuh", "pidar gnoinyj", "pizda", "pizdato", "pizdatyi", "piz'det", "pizdetc", "pizdoi nakryt'sja", "pizd'uk", "piz`dyulina", "podi ku'evo", "poeben", "po'imat' na konchik", "po'iti posrat", "po khuy", "poluchit pizdy", "pososi moyu konfetku", "prissat", "proebat", "promudobl'adsksya pizdopro'ebina", "propezdoloch", "prosrat", "raspeezdeyi", "raspizdatyi", "raz'yebuy", "raz'yoba", "s'ebat'sya", "shalava", "styervo", "sukin syn", "svodit posrat", "svoloch", "trakhat'sya", "trimandoblydskiy pizdoproyob", "ubl'yudok", "uboy", "u'ebitsche", "vafl'a", "vafli lovit", "v pizdu", "vyperdysh", "vzdrochennyi", "yeb vas", "za'ebat", "zaebis", "zalupa", "zalupat", "zasranetc", "zassat", "zlo'ebuchy", "бздёнок", "блядки", "блядовать", "блядство", "блядь", "бугор", "во пизду", "встать раком", "выёбываться", "гандон", "говно", "говнюк", "голый", "дать пизды", "дерьмо", "дрочить", "другой дразнится", "ёбарь", "ебать", "ебать-копать", "ебло", "ебнуть", "ёб твою мать", "жопа", "жополиз", "играть на кожаной флейте", "измудохать", "каждый дрочит как он хочет", "какая разница", "как два пальца обоссать", "курите мою трубку", "лысого в кулаке гонять", "малофья", "манда", "мандавошка", "мент", "муда", "мудило", "мудозвон", "наебать", "наебениться", "наебнуться", "на фиг", "на хуй", "на хую вертеть", "на хуя", "нахуячиться", "невебенный", "не ебет", "ни за хуй собачу", "ни хуя", "обнаженный", "обоссаться можно", "один ебётся", "опесдол", "офигеть", "охуеть", "охуительно", "половое сношение", "секс", "сиськи", "спиздить", "срать", "ссать", "траxать", "ты мне ваньку не валяй", "фига", "хапать", "хер с ней", "хер с ним", "хохол", "хрен", "хуёво", "хуёвый",
  "хуем груши околачивать", "ебанат", "ебанутый", "ебало", "хуеплет", "хуило", "пидор", "пизда", "хуиней страдать", "хуиня", "хуй", "хуйнуть", "хуй пинать",
  "Asesinato", "asno", "bastardo", "Bollera", "Cabrón", "Caca", "Chupada", "Chupapollas", "Chupetón", "concha", "Concha de tu madre", "Coño", "Coprofagía", "Culo", "Drogas", "Esperma", "Fiesta de salchichas", "Follador", "Follar", "Gilipichis", "Gilipollas", "Hacer una paja", "Haciendo el amor", "Heroína", "Hija de puta", "Hijaputa", "Hijo de puta", "Hijoputa", "Idiota", "Imbécil", "infierno", "Jilipollas", "Kapullo", "Lameculos", "Maciza", "Macizorra", "maldito", "Mamada", "Marica", "Maricón", "Mariconazo", "martillo", "Mierda", "Nazi", "Orina", "Pedo", "Pendejo", "Pervertido", "Pezón", "Pinche", "Pis", "Prostituta", "Puta", "Racista", "Ramera", "Sádico", "Semen", "Sexo", "Sexo oral", "Soplagaitas", "Soplapollas", "Tetas grandes", "Tía buena", "Travesti", "Trio", "Verga", "vete a la mierda", "Vulva"
];

const badWordsRegex = new RegExp(badWords.map(makeFuzzyPattern).join('|'), 'iu');

const roomUserCounts = {};
const ENCRYPTION_KEY = crypto.createHash('sha256').update('451585').digest(); // 32 bytes
const IV_LENGTH = 16;


let db;
let usersCollection;
let roomsCollection;
let messagesCollection;

let previousRoomUserCounts = {};




//************************* request limiter ************************************************ */
const { RateLimiterMemory } = require('rate-limiter-flexible');
const createLimiter = (points, duration) => new RateLimiterMemory({ points, duration });
const limiters = {
  chatMessage: createLimiter(5, 10),
  registerUser: createLimiter(5, 60),
  checkUsername: createLimiter(1, 1),
  joinRoom: createLimiter(5, 10),
  getHistory: createLimiter(5, 5)
};

const badInputLimiter = new RateLimiterMemory({
  keyPrefix: 'ban',
  points: 1,
  duration: 30,
  blockDuration: 30,
});

async function setupIndexes() {
  try {
    await messagesCollection.createIndex({ roomId: 1, timestamp: -1 });
    await messagesCollection.createIndex({ messageId: 1 }, { unique: true });
    await messagesCollection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // ⏳ TTL
    console.log('✅ MongoDB indexes set up');

    // insertTestMessagesToDB();
  } catch (err) {
    console.error('❌ Failed to set indexes:', err);
  }
}

function makeFuzzyPattern(wordOrPhrase) {
  return wordOrPhrase
    .split('')
    .map(c => {
      if (c.match(/\s/)) return '[\\s\\-\\.]{1,}';
      return c;
    })
    .join('[\\s\\-\\.]{0,2}');
}

function checkText(text) {
  const trimmed = text.trim();
  const match = trimmed.match(badWordsRegex);
  if (match) {
    console.warn(`⛔️ Matched: ${match[0]}`);
    return true;
  }
  return false;
}


function isSafeMongoInput(input) {
  return (
    typeof input === 'string' &&
    !input.includes('$') &&
    !input.includes('.') &&
    !input.includes('{') &&
    !input.includes('}') &&
    input.length < 100
  );
}


const getClientIp = (socket) => {
  const cfIp = socket.handshake.headers['cf-connecting-ip'];

  if (!cfIp) {
    const devIp = socket.handshake.address;
    const allowedLocalIps = [
      '::1',
      '127.0.0.1',
      '::ffff:127.0.0.1',
      '::ffff:172.17.0.1', // іноді цей
      '::ffff:172.18.0.1',
      '::ffff:172.19.0.1', // твій кейс
    ];

    if (allowedLocalIps.includes(devIp)) {
      console.warn('[DEV] ⚠️ No cf-connecting-ip, using dev IP:', devIp);
      return devIp;
    }

    console.warn('[SECURITY] ❌ No cf-connecting-ip! Blocking connection.');
    return null;
  }

  return cfIp;
};


function detectMaliciousInput(payload) {
  const STRINGS = [];
  const extractStrings = (obj) => {
    if (typeof obj === 'string') STRINGS.push(obj);
    else if (typeof obj === 'object' && obj !== null) Object.values(obj).forEach(extractStrings);
  };
  extractStrings(payload);
  const patterns = [
    /<script.*?>/i, /<\/script>/i, /<.*?on\w+\s*=.*?>/i, /<img.*?>/i, /<iframe.*?>/i, /<object.*?>/i, /<embed.*?>/i, /<svg.*?>/i, /<link.*?>/i, /<meta.*?>/i, /style\s*=\s*["'].*?expression.*?["']/i, /javascript:/i, /data:text\/html/i,
    /select\s+.*\s+from/i, /insert\s+into/i, /drop\s+table/i, /('|")\s+or\s+\d+=\d+/i, /--/, /union\s+select/i
  ];
  return STRINGS.some(str => patterns.some(rx => rx.test(str)));
}

const withRateLimit = (limiter, socket, handler) => {
  return async (...args) => {
    const payload = args[0];
    if (detectMaliciousInput(payload)) {
      console.warn(`[SECURITY] Blocked malicious payload from ${socket.id}:`, JSON.stringify(payload));
      try {
        const clientIp = getClientIp(socket);
        await badInputLimiter.consume(clientIp); // даємо бан
        socket.emit('rateLimit', {
          reason: '🚫 You are temporarily blocked for sending malicious input.',
          banned: true,
          banDurationSec: 30
        });
      } catch { }
      return;
    }

    // 🔥 Перевірка чи забанений
    const clientIp = getClientIp(socket);
    const isBlocked = await badInputLimiter.get(clientIp);
    if (isBlocked && isBlocked.consumedPoints > 0) {
      console.warn(`[BAN] 🚫 Blocked IP tried to reconnect: ${clientIp}`);
      socket.emit('rateLimit', { reason: '🚫 You are temporarily banned for bad behavior.' });
      socket.disconnect(true);
      return;
    }

    try {
      await limiter.consume(socket.id);
      return handler(...args);
    } catch {
      const maybeCallback = args[args.length - 1];
      if (typeof maybeCallback === 'function') {
        maybeCallback({ success: false, reason: 'Rate limit exceeded' });
      } else {
        socket.emit('rateLimit', { reason: 'Too many requests' });
      }
    }
  };
};
//**************************************************************************************** */

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-ctr', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex'); // IV потрібен для розшифровки
}

function decrypt(encryptedText) {
  const [ivHex, dataHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedData = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-ctr', ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted.toString('utf8');
}

function validateMessage(text) {
  let fullText = text;
  if (!text || typeof text !== 'string') {
    return { valid: false, reason: 'Invalid text input' };
  }


  text = text.replace(/\s+/g, '').toLowerCase();
  const trimmed = text.trim();


  if (!trimmed.length) return { valid: false, reason: 'Empty message' };
  if (trimmed.length > 1000) return { valid: false, reason: 'Message too long' };

  const htmlTagPattern = /<\/?[a-z][\s\S]*?>/i;
  const imagePattern = /\.(jpg|jpeg|png|gif|webp|svg)/i;
  const imgBBcodePattern = /\[img\](.*?)\[\/img\]/i;
  const mailtoPattern = /mailto:/i;
  const linkPattern = /(https?:\/\/|www\.)/i;
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

  if (htmlTagPattern.test(trimmed)) return { valid: false, reason: 'HTML tags are not allowed' };
  if (imagePattern.test(trimmed) || imgBBcodePattern.test(trimmed)) return { valid: false, reason: 'Image links are not allowed' };
  if (mailtoPattern.test(trimmed)) return { valid: false, reason: 'mailto: links are not allowed' };
  if (linkPattern.test(trimmed) || knownTldRegex.test(trimmed)) return { valid: false, reason: 'Links are not allowed' };
  if (emailPattern.test(trimmed)) return { valid: false, reason: 'Emails are not allowed' };
  if (checkBadWords(fullText)) return { valid: false, reason: 'Inappropriate language is not allowed' };

  return { valid: true };
}

async function getUserFromDB(extensionId) {
  if (!uuidRegex.test(extensionId) || !isSafeMongoInput(extensionId)) return null;
  return await usersCollection.findOne({ extensionId });
}

MongoClient.connect(mongoUrl)
  .then(client => {
    console.log('✅ Connected to MongoDB');
    db = client.db(dbName);
    usersCollection = db.collection('users');
    roomsCollection = db.collection('rooms');
    if (!roomsCollection) {
      console.error('❌ roomsCollection is not initialized!');
      return cb?.({ success: false, reason: 'Server DB not ready' });
    }    
    messagesCollection = db.collection('messages');
    setupIndexes();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err);
  });

app.use(express.static('public'));

function normalizeAvatar(avatar) {
  const match = /^avatar_(\d+)$/.exec(avatar);
  const index = match ? parseInt(match[1], 10) : -1;
  if (index >= 0 && index <= 112) {
    return avatar; // ✅ Валідний
  }
  return 'avatar_17'; // ❌ Невалідний — ставимо дефолт
}

async function insertTestMessagesToDB() {
  const randomUsers = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Oleksii Sem'];
  const randomAvatars = ['avatar_1', 'avatar_2', 'avatar_3', 'avatar_4', 'avatar_19'];
  const countries = ['us', 'gb', 'fr', 'de', 'ua', 'pl'];
  const randomTexts = [
    'Hello everyone!',
    'What are you up to?',
    'This room is awesome 😎',
    'Let’s talk about code!',
    'Random message drop ✉️',
    'Good vibes only!',
    'Checking in from another tab.',
    'Any updates on the project?',
    'Weekend plans?',
    'Anyone tried the new framework?',
    'Running some experiments with JS',
    'Refactoring code today!',
    'Debugging nightmare 🐛',
    'Lunch break time',
    'Let’s have a call'
  ];

  function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const rooms = await roomsCollection.find({}).toArray();

  const messages = [];

  for (const room of rooms) {
    const baseTime = Date.now() - 3600_000; // 1 година тому
    for (let i = 0; i < 200; i++) {
      const ts = baseTime + i * 15_000; // кожні 15 сек
      const username = getRandom(randomUsers);
      const avatar = username === 'Oleksii Sem' ? 'avatar_19' : getRandom(randomAvatars);
      messages.push({
        messageId: crypto.randomUUID(),
        text: getRandom(randomTexts),
        username: username,
        userId: crypto.randomUUID(),
        avatar,
        countryCode: getRandom(countries),
        roomId: room.id,
        type: 'chat:user',
        extension_id_encrypted: `mocked:${crypto.randomUUID()}`,
        ip: '1.2.3.4',
        ipCountry: 'US',
        userAgent: 'Mozilla/5.0 (Fake)',
        acceptLanguage: 'en-US',
        origin: 'chrome-extension://mock',
        cfRay: 'mocked-ray-id',
        timestamp: Date.now(),
        createdAt: new Date()
      });
    }
  }

  await messagesCollection.insertMany(messages);
  console.log(`[DB] ✅ Inserted ${messages.length} test messages`);
}


function shallowEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;

  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}

function checkBadWords(text) {
  text = ` ${text} `;
  const cleaned = text
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, '')   
      .replace(/\s+/g, ' ')
      .trim();
  const words = cleaned.split(' ');
  return words.some(word => badWords.includes(word));
}


function checkUserName(name) {
  let clean = name.trim();
  clean = clean.replace(/\s+/g, '').toLowerCase();

  const normalized = name.replace(/\s+/g, '').toLowerCase();
  if (checkBadWords(normalized)) return 'Contain bad words';

//  if (checkBadWords(name)) return 'Contain bad words';
  if (knownTldRegex.test(clean)) return 'Contain domain name';
  if (dangerousChars.test(clean)) return 'Contains dangerous characters';
  if (escapedDangerous.test(clean)) return 'Contains encoded dangerous characters';
  if (containsBlacklistedEmoji(clean)) return 'Username contains inappropriate emoji';
  if (clean.length < 4 || clean.length > 24) return 'Username must be 4–24 characters';
  return null;
}

function setRoomCountTimer() {
  setInterval(() => {
    const newCounts = {};
    let totalUserCount = 0;

    for (const [roomId, room] of io.sockets.adapter.rooms) {
      if (![...io.sockets.sockets.keys()].includes(roomId)) {
        const count = room.size;
        newCounts[roomId] = count;
        totalUserCount += count;
      }
    }

    if (!shallowEqual(previousRoomUserCounts, newCounts)) {
      previousRoomUserCounts = newCounts;
      Object.assign(roomUserCounts, newCounts);

      // 🔥 Розсилаємо разом з totalUserCount як окреме поле
      io.emit('roomUserCountsUpdate', {
        ...newCounts,
        totalUserCount
      });
    }
  }, 10 * 1000);
}


function validateUserDataObject(userData) {
  if (typeof userData !== 'object' || userData === null) {
    return 'userData must be an object';
  }

  if ('username' in userData) {
    if (typeof userData.username !== 'string') {
      return 'Invalid username';
    }
    if (!isSafeMongoInput(userData.username)) {
      return 'Unsafe username in userData';
    }
  }

  if ('avatar' in userData) {
    if (typeof userData.avatar !== 'string') {
      return 'Avatar must be a string';
    }
    if (!isSafeMongoInput(userData.avatar)) {
      return 'Unsafe avatar in userData';
    }
  }

  return null; // ✅ валідно
}


io.on('connection', async (socket) => {
  if (!roomsCollection) {
    console.error('❌ roomsCollection is not initialized!');
  } else {
    console.log('✅ roomsCollection ready');
  }
    
  const clientIp = getClientIp(socket);

  try {
    const isBlocked = await badInputLimiter.get(clientIp);
    if (isBlocked && isBlocked.consumedPoints > 0) {
      console.warn(`[BAN] 🔥 IP still banned: ${clientIp}`);
      socket.emit('rateLimit', {
        reason: '🚫 You are still banned',
        banned: true,
        banDurationSec: Math.ceil(isBlocked.msBeforeNext / 1000)
      });
      return socket.disconnect(true);
    }
  } catch (err) {
    console.error('[BAN] Check error:', err);
  }


  setRoomCountTimer();
  console.log('🔌 New client connected');

  socket.on('getHistoryChunk', withRateLimit(limiters.getHistory, socket, async ({ roomId, offset = 0, limit = 30 }, cb) => {
    try {
      if (!roomId || !isSafeMongoInput(roomId)) {
        return cb?.({ success: false, reason: 'Invalid roomId' });
      }      
      if (!roomId) return cb?.({ success: false, reason: 'No roomId' });

      const messages = await messagesCollection
        .find({ roomId })
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      const final = messages.reverse(); // щоб були від старих до нових
      const payload = final.map(msg => ({
        message: JSON.stringify(msg)
      }));

      cb?.({ success: true, messages: payload, hasMore: messages.length === limit });
    } catch (err) {
      console.error('[SRV] getHistoryChunk error:', err);
      cb?.({ success: false, reason: 'Server error' });
    }
  }));


  socket.on('getRooms', async (data, cb) => {
    try {
      
      const extensionId = data?.extension_id;
      if (!extensionId) {
        return cb({ success: false, reason: 'Missing extensionId' });
      }

      if (!uuidRegex.test(extensionId) || !isSafeMongoInput(extensionId)) {
        return cb({ success: false, reason: 'Invalid extensionId' });
      }

      const user = await usersCollection.findOne({ extensionId });

      const rooms = await roomsCollection.find({}).toArray();

      const payload = {
        success: true,
        rooms
      }

      if (user) {
        payload.user = {
          userId: user.userId,
          username: user.username,
          avatar: user.avatar,
          countryCode: user.countryCode,
          currentRoomId: user.currentRoomId || 'general',
        }
      }

      cb(payload);

    } catch (err) {
      console.error('getRooms error:', err);
      cb({ success: false, reason: 'Failed to fetch rooms' });
    }
  });

  socket.on('registerUser', withRateLimit(limiters.registerUser, socket, async ({ username, extensionId, avatar, countryCode, isNewUser, currentRoomId }, callback) => {
    if (!username || !extensionId || typeof username !== 'string' || typeof extensionId !== 'string') {
      return callback?.({ success: false, reason: 'Invalid input data' });
    }

    if (detectMaliciousInput(username)) {
      const clientIp = getClientIp(socket);
      await badInputLimiter.consume(clientIp);
      socket.emit('rateLimit', { reason: '🚫 Suspicious input' });
      socket.disconnect(true);
      return;
    }

    avatar = normalizeAvatar(avatar);
    let usernameError = null;

    username = username.trim();
    usernameError = checkUserName(username);
    if (usernameError) {
      return callback?.({ success: false, reason: usernameError });
    }

    if (!uuidRegex.test(extensionId)) {
      return callback?.({ success: false, reason: 'Not valid UUID' });
    }

    try {

      if (!isSafeMongoInput(extensionId)) return callback?.({ success: false, reason: 'Invalid ID' });
      if (!username || typeof username !== 'string') {
        return callback?.({ success: false, reason: 'Invalid username input' });
      }
      if (avatar && !isSafeMongoInput(avatar)) {
        return callback?.({ success: false, reason: 'Invalid avatar' });
      }

      socket.extensionId = extensionId;

      const existingUser = await usersCollection.findOne({ username });
      if (existingUser && existingUser.extensionId !== extensionId) {
        return callback?.({ success: false, reason: 'Username already taken' });
      }

      const currentUser = await usersCollection.findOne({ extensionId });
      if (currentUser) {
        const nameChanged = currentUser.username !== username;
        if (nameChanged && currentRoomId) {
          const systemMsg = {
            user: 'System',
            avatar: 'system',
            text: ``,  // TEXT WILL BE ON THE CLIEND SIDE
            messagedatatime: new Date().toISOString(),
            responseTo: null,
            type: 'system:usernameChanged',
            room: { id: currentRoomId },
            userId: currentUser.userId,
            oldUsername: currentUser.username,
            newUserName: username
          };

          const wrapped = {
            message: JSON.stringify(systemMsg),
            timestamp: Date.now(),
            roomId: currentRoomId,
            isNewUser: false
          };

          io.to(currentRoomId).emit('chatMessage', wrapped);
        }

        const updatePayload = {
          username: username,
          avatar: avatar,
          dateUpdated: new Date()
        };

        await usersCollection.updateOne(
          { extensionId },
          { $set: updatePayload }
        );

        console.log(`🔄 User updated: ${currentUser.username} → ${username} (${extensionId})`);
        return callback?.({
          success: true,
          user: {
            username,
            countryCode: countryCode || 'unknown',
            avatar: avatar,
            userId: currentUser.userId,
            created: false,
            action: currentUser.username !== username ? 'userNameChanged' : 'updateTimestamp'
          }
        });
      }

      const userId = crypto.randomUUID();
      await usersCollection.insertOne({
        userId,
        username,
        extensionId,
        avatar,
        countryCode: countryCode || 'unknown',
        dateCreated: new Date(),
        dateUpdated: new Date()
      });


      console.log(`✅ New user registered: ${username} (${extensionId})`);
      return callback?.({
        success: true,
        user: {
          userId,
          username,
          avatar,
          countryCode: countryCode || 'unknown',
          created: true,
          action: 'newUserAdded'
        }
      });
    } catch (err) {
      console.error('Registration error:', err);
      return callback?.({ success: false, reason: 'Server error' });
    }
  }));

  socket.on('checkUsername', withRateLimit(limiters.checkUsername, socket, async ({ username }, cb) => {
    if (typeof cb !== 'function') return;
  
    if (!username || typeof username !== 'string') {
      return cb({ available: false, reason: 'Invalid input' });
    }
  
    username = username.trim().toLowerCase();
    if (!isSafeMongoInput(username)) return cb({ available: false, reason: 'Unsafe characters' });


    const reason = checkUserName(username); // використовуємо твою перевірку
    if (reason) {
      return cb({ available: false, reason });
    }
  
    try {
      const exists = await usersCollection.findOne({ username });
      cb({ available: !exists });
    } catch (err) {
      cb({ available: false, reason: 'DB error' });
    }
  }));

  socket.on('joinRoom', withRateLimit(limiters.joinRoom, socket, async (data, cb) => {
    try {      
      
      const extensionId = data?.extension_id;
      let roomId = data.roomId ?? 'general';
      let userData = data.userData;

      if (!uuidRegex.test(extensionId) || !isSafeMongoInput(extensionId)) {
        return cb?.({ success: false, reason: 'Invalid extensionId' });
      }
      if (!isSafeMongoInput(roomId)) {
        return cb?.({ success: false, reason: 'Invalid room ID' });
      }

      const validationError = validateUserDataObject(userData);
      if (validationError) {
        return cb?.({ success: false, reason: validationError });
      }

      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
        }
      }

      let roomExists = await roomsCollection.findOne({ id: roomId });
      if (!roomExists) {
        roomExists = await roomsCollection.findOne({}, { sort: { createdAt: 1 } });
        if (!roomExists) {
          return cb?.({ success: false, reason: 'No rooms available' });
        }
      }

      socket.join(roomId);
      const user = await getUserFromDB(extensionId);
      let userId = null;
      if (user) {
        userId = user.userId;
        socket.extensionId = extensionId;
      }
      socket.roomId = roomId;

      const counts = {};
      for (const [roomId, room] of io.sockets.adapter.rooms) {
        if (![...io.sockets.sockets.keys()].includes(roomId)) {
          counts[roomId] = room.size;
        }
      }
      socket.emit('roomUserCountsUpdate', counts);
      if (!chatHistory[roomId]) chatHistory[roomId] = [];

      if (userData.username) {
        const joinMessage = {
          user: 'System',
          avatar: 'system',
          text: `${userData.username} joined the room.`,
          messagedatatime: new Date().toISOString(),
          responseTo: null,
          userId: userId,
          type: 'system:joinRoom',
          room: roomExists
        };

        const wrapped = {
          message: JSON.stringify(joinMessage),
          timestamp: Date.now(),
          roomId
        };

        io.to(roomId).emit('chatMessage', wrapped); // транслюємо, не зберігаємо
      }

      const lastMessagesFromDB = await messagesCollection
        .find({ roomId })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      const reversedMessages = lastMessagesFromDB.reverse();
      const wrappedMessages_Db = reversedMessages.map(m => ({
        message: JSON.stringify(m)
      }));

      //socket.emit('chatHistoryChunk', wrappedMessages_Db);  

      chatHistory[roomId] = reversedMessages.map(m => ({
        message: JSON.stringify(m),
        timestamp: new Date(m.messagedatatime).getTime(),
        roomId
      }));

      cb?.({ success: true, history: wrappedMessages_Db });
    } catch (err) {
      console.error('joinRoom error:', err);
      cb?.({ success: false, reason: 'Server error' });
    }
  }));

  socket.on('chatMessage', withRateLimit(limiters.chatMessage, socket, async (data, callback) => {
    try {
      data = data.payload;

      if (detectMaliciousInput(data)) {
        const clientIp = getClientIp(socket);
        console.warn(`[SECURITY] 🚨 Malicious input from ${clientIp}:`, data);
        try {
          await badInputLimiter.consume(clientIp); // додати бан
        } catch (_) { }
        socket.emit('rateLimit', {
          reason: '🚫 Suspicious input detected. You are banned for 30 seconds.',
          banned: true,
          banDurationSec: 30
        });
        socket.disconnect(true);
        return;
      }

      if (!socket.extensionId) {
        return callback?.({ success: false, reason: 'Unauthorized: not registered' });
      }

      const validation = validateMessage(data?.text);
      if (!validation.valid) {
        return callback?.({ success: false, reason: validation.reason });
      }

      const encryptedId = encrypt(socket.extensionId); // AES або Base64
      const timestamp = Date.now();
      const roomId = socket.roomId;

      if ((roomId == 'news') && (socket.extensionId != '03a0c6a9-8773-4338-8c75-891961e9a8ee')) return callback?.({ success: false, reason: 'No access to this room' });

      if (!isSafeMongoInput(roomId)) {
        return callback?.({ success: false, reason: 'Invalid roomId from socket' });
      }

      if (typeof roomId !== 'string') {
        return callback?.({ success: false, reason: 'Invalid roomId from socket' });
      }

      const user = await getUserFromDB(socket.extensionId);
      const fullMessage = {
        messageId: data.messageId,
        text: data.text,
        responseTo: data.responseTo || null,
        extension_id_encrypted: encryptedId,
        timestamp,
        createdAt: new Date(),
        username: user?.username || 'unknown',
        avatar: user?.avatar || 'avatar_17',
        countryCode: user?.countryCode || 'unknown',
        userId: user?.userId || 'anonymous',
        roomId: roomId
      };

      const headers = socket.handshake.headers;
      const clientMeta = {
        ip: headers['cf-connecting-ip'] || headers['x-forwarded-for'] || socket.handshake.address,
        ipCountry: headers['cf-ipcountry'] || null,
        userAgent: headers['user-agent'] || null,
        acceptLanguage: headers['accept-language'] || null,
        origin: headers['origin'] || null,
        cfRay: headers['cf-ray'] || null
      };

      await messagesCollection.insertOne({
        ...fullMessage,
        ...clientMeta,
        roomId: roomId,
      });


      const wrapped = {
        message: fullMessage,
        timestamp,
        roomId: roomId
      };

      if (!chatHistory[roomId]) chatHistory[roomId] = [];
      chatHistory[roomId].push(wrapped);
      chatHistory[roomId] = chatHistory[roomId].filter(
        msg => timestamp - msg.timestamp < 24 * 60 * 60 * 1000 // 24h
      );


      io.to(roomId).emit('chatMessage', wrapped);

      callback?.({ success: true, message: fullMessage });

    } catch (err) {
      console.error('[SRV] chatMessage handler error:', err);
      callback?.({ success: false, reason: 'Server error' });
    }
  }));

  socket.on('createRoom_451585', async ({ id, name, image, defaultMessage, isReadOnly }, cb) => {
    if (!id || !name) {
      return cb?.({ success: false, reason: 'Missing ID or name' });
    }

    try {
      const exists = await roomsCollection.findOne({ id });
      if (exists) {
        return cb?.({ success: false, reason: 'Room already exists' });
      }

      await roomsCollection.insertOne({
        id,
        name,
        image: image || '',
        defaultMessage: defaultMessage || '',
        isReadOnly: !!isReadOnly,
        createdAt: new Date()
      });

      return cb?.({ success: true });
    } catch (err) {
      console.error('Room creation error:', err);
      return cb?.({ success: false, reason: 'DB error' });
    }
  });


});


server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

});

