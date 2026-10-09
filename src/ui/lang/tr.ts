import type { Texts } from '../i18n';

/** Turkish. Not yet read by a native speaker. */
export const TR: Texts = {
  tut_roll: 'Bir zarın üstündesin. Onu yönlendir: yuvarlanır ve yan yüzü üste gelir',
  tut_pair: "2'yi 2'nin yanına yuvarla",
  tut_count: 'Yan yana iki 2, ve bize geçtiler. Yüzdeki nokta kadar zar gerekir: üç 3, dört 4',
  tut_three: '3 için üç zar gerekir. Seninkini aralarına sok',
  tut_carry: '4 yan yüzde. Onun boyunca yuvarlandıkça yanda kalır. Yerine getir ve üste devir',
  tut_floor: "Zarın gitti, zemindesin. Buradan zarlar itilir. 5'i diğerlerinin yanına it",
  tut_mount: 'Şimşek: burada bir zar yükseliyor. Alçakken üstüne çık',
  tut_seven: 'Üstte 1 varsa altta 6 vardır: karşılıklı yüzlerin toplamı yedidir. İki yuvarlama, ve üstte',
  tut_chain: 'Bir grup giderken kanal açıktır. Yandaki zara geç ve onu gruba ekle: puan katlanır',
  tut_ones: '1 ayrıdır: birler birleşmez. Onu giden grubun yanına getir',
  tut_alone: 'Ayrı olanların hepsi gitti. Biri kaldı: üstünde durduğun',
  tut_end: 'Bundan sonra zarlar kendiliğinden gelir. Alanın dolmasına izin verme, yoksa seni duyamayız',
  newBest: 'Yeni rekor',
  dailyBest: 'Günün en iyi sonucu. Günün oturumu herkes için aynıdır, yenisi UTC gece yarısında gelir',
  dailyNote: 'Günün oturumu herkes için aynıdır. Yenisi UTC gece yarısında gelir',
  practiceNote: 'Alıştırma oyunu: rekor kaydedilmedi',
  notSaved: 'Depolama kullanılamıyor: rekor kaydedilmedi',
  hintFloor: 'Zeminde küpleri itersin',
  hintMount: 'Beliren küpün üstüne çık',
  hintChain: 'Batarlarken aynı küplerden ekle',
  hintOne: "Bir 1'i zincire getir, diğer bütün 1'ler kaybolur",
  hintLow: 'Saydam küpün üstünden yuvarlanabilirsin',
  customNote: 'Değişkenler değiştirildi: rekor kaydedilmedi',
  tier_intro: 'İlk adımlar',
  tier_path: 'Uzun yol',
  tier_decoy: 'Sahte çift',
  tier_pair: 'İki grup',
  tier_big: 'Büyük grup',
  tier_tight: 'Dar',
  tier_hard: 'Zor',
  puzzleHeld: 'Grup tamam. Yandaki zara geç, grup kaybolsun',
  deadNoExit: 'Çıkmaz: geçilecek zar yok ve hâlâ zar var. Hamleyi geri al',
  deadSingle: 'Çıkmaz: eşleşecek hiçbir şeyi olmayan tek zar kalır. Hamleyi geri al',
  puzzleRule1: 'Yandaki zara adım atmak bedavadır. Zarını boş kareye yuvarlamak bir hamledir',
  puzzleRule2: 'Üstünde aynı sayı olan zarlardan o sayı kadarını yan yana getir: iki 2, üç 3. Birler eşleşmez',
  puzzleRule3: 'Tamamlanan grup, sen üstünde durdukça bekler. Yandaki zara geç, grup kaybolur',
  puzzleRule4: 'Köşedeki mühür altındaki zarın yüzlerini gösterir: yuvarlamanın üste ne getireceğini söyler',
  puzzleRule5: 'Bütün zarları temizle. Ne kadar az hamle, o kadar çok yıldız',
  levelStuck: 'Çıkmaz: tahtada {left} zar kaldı, bir kombo için {need} gerekir',
  levelStranded: 'Çıkmaz: bu zardan gidecek yer yok',
  levelFloorStuck: 'Çıkmaz: zeminden itilecek zar yok, yukarı çıkılacak zar da yok',
  levelFloorFaces: 'Çıkmaz: itmek zarı çevirmez, kombo için yeterli yüz de yok',
  levelShort: 'Hamleler bitti. Eksik kalan: {short}',
  lessonThrees:
    "Merhaba! Visual Interconnection'a hoş geldin. Ben buranın laborantıyım ve bugün sana masayla çalışmayı öğreteceğim.\n\n" +
    'Otuzlu yıllarda Doktor Rhine insanlardan zar atmalarını ve istedikleri yüzü var güçleriyle dilemelerini isterdi. Biz zarları atmayız. Onları yönlendiririz.\n\n' +
    'Bir zarın üstünde duruyorsun. Onu yönlendir: yuvarlanır ve başka bir yüz üste gelir.\n\n' +
    "Bugün üçüncü kanal açık: 3'lerle çalışıyoruz. Üç 3'ü yan yana koy: bu bir kombodur ve gidecek. Diğer kombinasyonlar çalışmaz: yüzleri çarpıyla işaretli.",
  lessonStep:
    "Başardın! Rhine'ın zarları yalnızca düşerdi. Seninkiler şimdiden sözünü dinliyor.\n\n" +
    'Şimdi adımlar. Zarların üstünde yürüyebilirsin, birinden yanındakine. Adım hamle sayılmaz: istediğin kadar yürü.\n\n' +
    "Hamle, yuvarlamaktır. Yalnızca üstünde durduğun zar yuvarlanır, o da yalnızca boş bir yere. Gereken zara yürü ve 3'leri topla.",
  lessonWalk:
    'Şimdi adımlar. Zarların üstünde yürüyebilirsin, birinden yanındakine. Adım hamle sayılmaz: istediğin kadar yürü.\n\n' +
    'Hamle, yuvarlamaktır. Yalnızca üstünde durduğun zar yuvarlanır, o da yalnızca boş bir yere.\n\n' +
    'Kombo hemen gitmez; giden zarların üstünde de yürüyebilirsin. Onların üstünden diğerlerine geç ve ikinci komboyu topla.',
  lessonLink:
    'Kombo hemen gitmez. İki hamlesi vardır: ilkinde zarlar yarıya kadar batar, ikincisinde tamamen.\n\n' +
    'Burada dört zar var, 3 ise üç zar ister. Artan zar tek başına kalır ve bu bir çıkmazdır. Demek ki onu gidenlerin yanına zamanında yuvarlamak gerek.\n\n' +
    'Giden zarların üstünde, diğerlerinde olduğu gibi yürünür. Onların üstünden dördüncüye git ve onu üstünde 3 olacak şekilde komboya yuvarla. Buna zincir denir.\n\n' +
    'Bir de masadan hediye: zincire katılan her zar, gidenlere bir hamle daha verir.',
  lessonHold:
    'Giden bir kombonun iki hamlesi vardır. Ama zincire katılan her zar ona bir hamle daha verir.\n\n' +
    'İlk hamlede getirdin: komboda yine iki hamle var. İkincide: bir. Her hamlede bir zar getir, kombo bekler.',
  lessonFloor:
    'Altındaki zar giderse zeminde kalırsın. Korkma: [biz bekleriz]. Giden bir zardan kendin de zemine inebilirsin.\n\n' +
    'Zeminden zarlar itilir. İtilen zar bir kare kayar ve dönmez. İtmek bir hamledir.\n\n' +
    'Yeniden yukarı: giden bir zarın üstünden, o hâlâ oradayken. Ya da itilemeyen bir zarın üstünden: arkasında masanın kenarı ya da başka bir zar vardır.',
  lessonClimb:
    'Zeminden yeniden yukarı çıkılabilir. Giden bir zara, o hâlâ oradayken çık.\n\n' +
    'Ya da itilemeyen bir zara: arkasında masanın kenarı ya da başka bir zar vardır. Giden bir kombonun yanındaki kareden ise bitişikteki her zara çıkarsın.',
  lessonSeven:
    "Her zar oyuncusunun bildiği bir sır: karşılıklı yüzlerin toplamı yedidir. 1'in karşısında 6, 2'nin karşısında 5, 3'ün karşısında 4 vardır.\n\n" +
    'Üstte 4 görüyorsan, 3 alttadır. Onu görmüyorsun, ama orada.\n\n' +
    'Aynı yöne iki yuvarlama, ve alttaki yüz üstte.',
  lessonTwos:
    'Giriş kursu bitti. Tebrikler: masa sözünü dinliyor.\n\n' +
    "Buradan sonra bir kanal daha açık. Artık 2'ler ve 3'ler [kabul ediliyor]: 2 iki zar ister, 3 üç zar.\n\n" +
    'Zarları önceden say: hangi kombolara yetiyorlar?',
  lessonGlass:
    'Giden bir zar [şimdiden yarı yarıya burada]. Bu yüzden üstünden yuvarlanabilirsin: zarın onun yerini alır.\n\n' +
    'Yüz tutarsa zarın zincire katılır. Tutmazsa yalnızca yeri alır.',
  lessonFives:
    "Beşinci kanal açık. Yalnızca 5'lerle çalışıyoruz.\n\n" +
    "Beş 5'i yan yana koy: bu bir kombodur ve gidecek, [bize].",
  lineCombo: "Merhaba! Ben buranın laborantıyım. Bugün üçüncü kanal açık: üç 3'ü yan yana koy: bu bir kombodur ve gidecek.",
  lineStep: "Başardın! Rhine'ın zarları yalnızca düşerdi, seninkiler seni dinliyor. Üstlerinde yürüyebilirsin: adım hamle değildir.",
  lineWalk: 'Kombo hemen gitmez: oraya, yüzeyin altına gider. Buradayken üstünden yürüyerek diğerlerine geç.',
  lineSide: 'Kurs bitti: masa seni dinliyor. Şimdi bir oyuncu sırrı: yandaki yüz seninle gelir. Götür, sonra çevir.',
  lineSeven: "İkinci sır: karşılıklı yüzlerin toplamı yedidir. 4'ün altında 3 var. Onu görmüyorsun ama orada.",
  lineLink: 'Zar, kombonun istediğinden fazla mı? Artanı, gidenler buradayken yanlarına yuvarla. Bu bir zincirdir.',
  lineFloor: 'Giden bir zardan zemine inebilirsin. Korkma: [biz bekleriz]. Zeminden zarlar itilir.',
  lineGlass: 'Giden bir zar [şimdiden yarı yarıya burada]. Üstünden yuvarlanabilirsin: seninki onun yerini alır.',
  lineFaces: "Bir kanal daha açıldı: artık 2'ler de 3'ler de [kabul ediliyor]. Zarları önceden say.",
  ruleThrees: "Kombo, yan yana üç 3'tür: gider. Yalnızca 3'ler çalışır; diğer yüzler çarpıyla işaretli.",
  ruleStep: 'Zarların üstünde adım hamle değildir. Hamle, üstünde durduğun zarı boş bir yere yuvarlamaktır.',
  ruleWalk: 'Adım hamle değildir; hamle yuvarlamaktır. Giden bir kombonun üstünde yürüyebilir, ondan başka bir zara geçebilirsin.',
  ruleLink: 'Kombo iki hamlede gider. Yanına aynı yüzlü bir zar yuvarla: bu bir zincirdir. Böyle her zar gidenlere bir hamle daha verir.',
  ruleHold: 'Zincirdeki her zar, giden komboya bir hamle daha verir.',
  ruleFloor: 'Altındaki zar gitti: zemindesin. Zeminden zar itilir: dönmeden kayar ve bu bir hamledir. Yukarı: giden bir zarın ya da itilemeyen bir zarın üstünden.',
  ruleClimb: 'Zeminden yukarı: giden bir zara ya da itilemeyen bir zara.',
  ruleSeven: 'Karşılıklı yüzlerin toplamı yedidir: 1 ile 6, 2 ile 5, 3 ile 4. Aynı yöne iki yuvarlama, ve alttaki yüz üstte.',
  ruleTwos: "2'ler ve 3'ler çalışır. 2 iki zar ister, 3 üç zar.",
  ruleGlass: 'Giden bir zarın üstünden yuvarlanabilirsin. Yüz tutarsa zar zincire katılır.',
  ruleFives: "Yalnızca 5'ler çalışır. Kombo, yan yana beş 5'tir.",
  // A proposal, like the Russian lines they follow.
  roadHintChain: 'Kombo giderken ona bir zar daha yuvarla.',
  roadHintWalk: 'Giden zarın üstünden yürüyebilirsin.',
  roadHintPush: 'Giden zardan zemine in ve it.',
  roadHintFixed: 'Soluk zar yerinde durur. Başka zara geç.',
  shellProtocol: 'SÜRESİZ OTURUM',
  shellLimited: 'GÜNÜN OTURUMU {time}',
  shellLevels: 'ALAN TEMİZLİĞİ',
  shellExercise: 'BECERİ TESTİ',
  shellTasks: 'KANAL TEMİZLİĞİ',
  shellRecords: 'OTURUM KAYDI',
  shellSystem: 'PARAMETRELER',
  shellHowTo: 'KULLANIM TALİMATI',
  shellReadme: 'EK NOT',
  howRoll: "Bir zarın üstünde duruyorsun ve onu yuvarlıyorsun: yan yüzü üste gelir.\nBoş bir kareye zar seninle birlikte yuvarlanır. Komşu zara ise yalnızca geçersin.\nKarşılıklı yüzlerin toplamı yedidir: 1'in altında 6 vardır.",
  howCombo: 'Kombo, üst yüzündeki nokta sayısı kadar zarın yan yana gelmesidir: iki 2, üç 3, altı 6.\nTamamlanan kombo gider.',
  howChain: 'Kombo hemen gitmez.\nO giderken yanına aynı yüzlü bir zar daha yuvarla: komboyla birlikte gider. Buna zincir denir.',
  howOnes: "1'ler kombo oluşturmaz.\nBir 1'i giden bir komboya getir: tahtadaki diğer bütün 1'ler gider.",
  howLevels: 'SEVİYELER: tahtadaki bütün zarları temizle.\nYalnızca seviyenin yüzleri çalışır, diğerleri çarpıyla işaretlidir.\nHamle sayısı sınırlıdır: ne kadar az hamle, o kadar çok yıldız.\nBurada zeminin kuralları ayrıdır: yukarı yalnızca giden bir zarın üstünden çıkılır.',
  howProtocol: 'PROTOKOL: zarlar kendiliğinden gelir.\nZincir puanı katlar.\nAlan dolar ve dolu kalırsa oturum biter.',
  shareScore: 'VI — karşı tarafa gönderildi: {score}',
};
