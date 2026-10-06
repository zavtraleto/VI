import type { Texts } from '../i18n';

/**
 * French. Not yet read by a native speaker. The space French puts before a colon or a semicolon
 * is written here as a plain one: `i18n.ts` makes it a space no line breaks at.
 */
export const FR: Texts = {
  tut_roll: 'Tu es debout sur un dé. Guide-le : il roule, et une face latérale passe au-dessus',
  tut_pair: 'Roule le 2 à côté du 2',
  tut_count: 'Deux 2 côte à côte, et ils sont partis chez nous. Autant de dés que de points : trois 3, quatre 4',
  tut_three: 'Un 3 en demande trois. Glisse le tien entre eux',
  tut_carry: 'Le 4 est sur le côté. Tant que tu roules le long de lui, il reste sur le côté. Amène-le et bascule-le vers le haut',
  tut_floor: "Ton dé est parti, tu es au sol. D'ici, on pousse les dés. Pousse le 5 vers les autres",
  tut_mount: "Un éclair : un dé monte ici. Monte dessus tant qu'il est bas",
  tut_seven: 'Un 1 en haut veut dire un 6 en bas : les faces opposées font sept. Deux roulements, et il est en haut',
  tut_chain: "Tant qu'un groupe s'en va, le canal est ouvert. Passe sur le dé voisin et ajoute-le au groupe : le score se multiplie",
  tut_ones: "Le 1 est à part : les 1 ne s'assemblent pas. Amène-le au groupe qui s'en va",
  tut_alone: 'Tous ceux qui étaient à part sont partis. Il en reste un : celui sur lequel tu te tiens',
  tut_end: "À partir d'ici, les dés arrivent d'eux-mêmes. Ne laisse pas le plateau se remplir, sinon nous ne t'entendrons plus",
  newBest: 'Nouveau record',
  dailyBest: 'Meilleur résultat du jour. La session du jour est la même pour tous, une nouvelle arrive à minuit UTC',
  dailyNote: 'La session du jour est la même pour tous. Une nouvelle arrive à minuit UTC',
  practiceNote: "Partie d'entraînement : record non enregistré",
  notSaved: 'Stockage indisponible : record non enregistré',
  hintFloor: 'Au sol, tu pousses les cubes',
  hintMount: 'Monte sur un cube qui apparaît',
  hintChain: "Ajoute des cubes identiques tant qu'ils s'enfoncent",
  hintOne: 'Amène un 1 à une chaîne et tous les autres 1 disparaissent',
  hintLow: 'Tu peux rouler sur un cube transparent',
  customNote: 'Variables modifiées : record non enregistré',
  tier_intro: 'Premiers pas',
  tier_path: 'Le long chemin',
  tier_decoy: 'Fausse paire',
  tier_pair: 'Deux groupes',
  tier_big: 'Un grand groupe',
  tier_tight: "À l'étroit",
  tier_hard: 'Difficiles',
  puzzleHeld: 'Le groupe est formé. Passe sur un dé voisin et il disparaît',
  deadNoExit: 'Impasse : aucun dé où passer, et il reste des dés. Annule le coup',
  deadSingle: "Impasse : il resterait un seul dé, sans rien à quoi l'assembler. Annule le coup",
  puzzleRule1: 'Un pas sur le dé voisin ne coûte rien. Rouler ton dé sur une case vide est un coup',
  puzzleRule2: "Réunis autant de dés portant le même nombre en haut que ce nombre : deux 2, trois 3. Les 1 ne s'assemblent pas",
  puzzleRule3: 'Un groupe formé attend tant que tu es dessus. Passe sur un dé voisin et le groupe disparaît',
  puzzleRule4: "Le sceau dans le coin montre les faces du dé sous toi : il dit ce qu'un roulement amènera en haut",
  puzzleRule5: "Retire tous les dés. Moins il y a de coups, plus il y a d'étoiles",
  levelStuck: 'Impasse : il reste {left} sur le plateau, et un combo en demande {need}',
  levelStranded: 'Impasse : depuis ce dé, on ne peut aller nulle part',
  levelShort: 'Plus de coups. Il en manquait : {short}',
  lessonThrees:
    "Bonjour ! Bienvenue dans Visual Interconnection. Je suis le laborantin d'ici, et aujourd'hui je t'apprends à travailler avec la table.\n\n" +
    'Dans les années trente, le docteur Rhine demandait aux gens de lancer des dés en souhaitant de toutes leurs forces la face voulue. Nous, nous ne lançons pas les dés. Nous les guidons.\n\n' +
    'Tu es debout sur un dé. Guide-le en suivant la flèche : il roulera, et une autre face passera au-dessus.\n\n' +
    "Aujourd'hui, le troisième canal est ouvert : nous travaillons avec les 3. Mets trois 3 côte à côte : c'est un combo, et il s'en ira. Les autres combinaisons ne marchent pas : leurs faces sont barrées.",
  lessonStep:
    "Réussi ! Les dés de Rhine ne faisaient que tomber. Les tiens t'obéissent déjà.\n\n" +
    "Maintenant, les pas. Tu peux marcher sur les dés, de l'un au voisin. Un pas ne compte pas comme un coup : marche autant que tu veux.\n\n" +
    "Un coup, c'est rouler. Seul le dé sur lequel tu te tiens roule, et seulement vers une place libre. Va jusqu'au dé qu'il te faut et réunis les 3.",
  lessonWalk:
    "Maintenant, les pas. Tu peux marcher sur les dés, de l'un au voisin. Un pas ne compte pas comme un coup : marche autant que tu veux.\n\n" +
    "Un coup, c'est rouler. Seul le dé sur lequel tu te tiens roule, et seulement vers une place libre.\n\n" +
    "Un combo ne part pas tout de suite, et tu peux aussi marcher sur les dés qui s'en vont. Passe par eux jusqu'aux autres et réunis le second combo.",
  lessonLink:
    "Un combo ne part pas tout de suite. Il a deux coups : au premier, les dés s'enfoncent à moitié ; au second, tout à fait.\n\n" +
    "Il y a quatre dés ici, et un 3 en demande trois. Celui qui reste serait seul, et c'est une impasse. Il faut donc l'amener à temps à ceux qui s'en vont.\n\n" +
    "On marche sur les dés qui s'en vont comme sur les autres. Va par eux jusqu'au quatrième et amène-le au combo, le 3 en haut. Cela s'appelle une chaîne.\n\n" +
    "Et un cadeau de la table : chaque dé qui entre dans la chaîne donne à ceux qui s'en vont un coup de plus.",
  lessonHold:
    "Un combo qui s'en va a deux coups. Mais chaque dé qui entre dans la chaîne lui donne un coup de plus.\n\n" +
    'Amené au premier coup : le combo a de nouveau deux coups. Au second : un. Amène un dé à chaque coup, et il attendra.',
  lessonFloor:
    "Si le dé sous toi s'en va, tu te retrouveras au sol. Ce n'est pas grave : [nous attendrons]. Tu peux aussi descendre toi-même d'un dé qui s'en va.\n\n" +
    "Depuis le sol, on pousse les dés. Un dé poussé glisse d'une case sans tourner. Pousser est un coup.\n\n" +
    "Pour remonter : par un dé qui s'en va, tant qu'il est encore là. Ou par un dé qu'on ne peut pas pousser : derrière lui, le bord de la table ou un autre dé.",
  lessonClimb:
    "Du sol, on peut remonter. Monte sur un dé qui s'en va, tant qu'il est encore là.\n\n" +
    "Ou sur un dé qu'on ne peut pas pousser : derrière lui, le bord de la table ou un autre dé. Et depuis une case voisine d'un combo qui s'en va, tu montes sur n'importe quel dé d'à côté.",
  lessonSeven:
    'Un secret que tout joueur de dés connaît : les faces opposées font sept. En face du 1 il y a le 6, en face du 2 le 5, en face du 3 le 4.\n\n' +
    'Tu vois un 4 en haut : le 3 est donc en bas. Tu ne le vois pas, mais il est là.\n\n' +
    'Deux roulements dans le même sens, et la face du bas est en haut.',
  lessonTwos:
    "Le cours d'introduction est terminé. Félicitations : la table t'obéit.\n\n" +
    "À partir d'ici, un canal de plus est ouvert. Maintenant les 2 et les 3 [sont acceptés] : un 2 demande deux dés, un 3 en demande trois.\n\n" +
    "Compte les dés à l'avance : pour quels combos y en a-t-il assez ?",
  lessonGlass:
    "Un dé qui s'en va est [déjà à moitié ici]. C'est pourquoi tu peux rouler dessus : ton dé prend sa place.\n\n" +
    'Si la face correspond, ton dé rejoint la chaîne. Sinon, il prend simplement la place.',
  lessonFives:
    "Le cinquième canal est ouvert. Nous ne travaillons qu'avec les 5.\n\n" +
    "Mets cinq 5 côte à côte : c'est un combo, et il s'en ira [chez nous].",
  lineCombo: "Trois 3 côte à côte font un combo, et il s'en va. Mène le dé le long de la flèche.",
  lineStep: "Tu peux marcher sur les dés : un pas n'est pas un coup. C'est le dé sous toi qui roule.",
  lineWalk: "Un combo ne s'en va pas d'un coup : il a deux coups. Marche dessus jusqu'aux autres.",
  lineSide: 'La face de côté reste de côté tant que tu roules tout droit. Amène-la, puis tourne.',
  lineSeven: 'Les faces opposées font sept : sous le 4, il y a le 3. Deux roulements dans le même sens.',
  lineLink: "Un dé en trop, c'est une impasse. Amène-le au combo qui s'en va : c'est une chaîne.",
  lineFloor: "D'un dé qui s'en va, tu peux descendre au sol. Depuis le sol, on pousse les dés.",
  lineGlass: "Tu peux rouler sur un dé qui s'en va : le tien prend sa place.",
  lineFaces: 'Deux canaux sont ouverts : les 2 et les 3. Compte les dés avant.',
  ruleThrees: "Un combo, c'est trois 3 côte à côte : il s'en va. Seuls les 3 marchent, les autres faces sont barrées.",
  ruleStep: "Un pas sur les dés n'est pas un coup. Un coup, c'est rouler le dé sur lequel tu te tiens vers une place libre.",
  ruleWalk: "Un pas n'est pas un coup ; un coup, c'est rouler. Tu peux marcher sur un combo qui s'en va et en descendre sur un autre dé.",
  ruleLink: "Un combo s'en va en deux coups. Amène-lui un dé avec la même face : c'est une chaîne. Chaque dé ainsi amené donne à ceux qui s'en vont un coup de plus.",
  ruleHold: "Chaque dé d'une chaîne donne au combo qui s'en va un coup de plus.",
  ruleFloor: "Le dé sous toi est parti : tu es au sol. Depuis le sol, on pousse un dé : il glisse sans tourner, et c'est un coup. Pour remonter : par un dé qui s'en va ou par un dé qu'on ne peut pas pousser.",
  ruleClimb: "Du sol vers le haut : sur un dé qui s'en va, ou sur un dé qu'on ne peut pas pousser.",
  ruleSeven: 'Les faces opposées font sept : 1 et 6, 2 et 5, 3 et 4. Deux roulements dans le même sens, et la face du bas est en haut.',
  ruleTwos: 'Les 2 et les 3 marchent. Un 2 demande deux dés ; un 3, trois.',
  ruleGlass: "Tu peux rouler sur un dé qui s'en va. Si la face correspond, le dé rejoint la chaîne.",
  ruleFives: "Seuls les 5 marchent. Un combo, c'est cinq 5 côte à côte.",
  shellProtocol: 'SESSION SANS LIMITE',
  shellLimited: 'SESSION DU JOUR {time}',
  shellLevels: 'NETTOYAGE DU CHAMP',
  shellExercise: 'TEST DE COMPÉTENCE',
  shellTasks: 'NETTOYAGE DU CANAL',
  shellRecords: 'JOURNAL DES SESSIONS',
  shellSystem: 'PARAMÈTRES',
  shellHowTo: 'MODE OPÉRATOIRE',
  shellReadme: 'NOTE JOINTE',
  howRoll: 'Tu es sur un dé et tu le fais rouler : une face latérale vient dessus.\nVers une case vide, le dé roule avec toi. Sur un dé voisin, tu passes simplement.\nLes faces opposées font sept : sous un 1 se trouve un 6.',
  howCombo: "Un combo, c'est autant de dés côte à côte que leur face du dessus a de points : deux 2, trois 3, six 6.\nUn combo formé s'en va.",
  howChain: "Un combo ne s'en va pas tout de suite.\nPendant qu'il s'en va, amène-lui un dé de plus avec la même face : il part avec le combo. C'est une chaîne.",
  howOnes: "Les 1 ne forment pas de combo.\nAmène un 1 à un combo qui s'en va, et tous les autres 1 du plateau s'en vont.",
  howLevels: "NIVEAUX : enlève tous les dés du plateau.\nSeules les faces du niveau marchent, les autres sont barrées.\nLes coups sont limités : moins tu en joues, plus tu as d'étoiles.",
  howProtocol: 'PROTOCOLE : les dés arrivent tout seuls.\nUne chaîne multiplie le score.\nSi le plateau se remplit et reste plein, la session est finie.',
  shareScore: "VI — envoyé de l'autre côté : {score}",
};
