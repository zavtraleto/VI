import type { Texts } from '../i18n';

/** German. Not yet read by a native speaker. */
export const DE: Texts = {
  newBest: 'Neuer Rekord',
  notSaved: 'Dein Rekord konnte nicht gespeichert werden',
  hintFloor: 'Auf dem Boden schiebst du Würfel',
  hintMount: 'Steig auf einen aufsteigenden Würfel',
  hintChain: 'Füge gleiche Würfel hinzu, solange sie sinken',
  hintOne: 'Bring eine 1 an eine Kette, und alle anderen 1er verschwinden',
  hintLow: 'Über einen durchsichtigen Würfel kannst du rollen',
  customNote: 'Variablen geändert: Rekord nicht gespeichert',
  levelStuck: 'Sackgasse: Auf dem Feld stehen noch {left}, ein Combo braucht {need}',
  levelStranded: 'Sackgasse: Von diesem Würfel geht es nicht weiter',
  levelFloorStuck: 'Sackgasse: Vom Boden aus lässt sich nichts schieben, und nach oben führt nichts',
  levelFloorFaces: 'Sackgasse: Vom Boden aus schiebt man Würfel nur, und für ein Combo fehlen die Seiten',
  levelShort: 'Keine Züge mehr. Es fehlten: {short}',
  lessonThrees:
    'Hallo! Willkommen bei Visual Interconnection. Ich bin der Laborassistent hier, und heute bringe ich dir bei, mit dem Tisch zu arbeiten.\n\n' +
    'In den Dreißigern bat Doktor Rhine Menschen, Würfel zu werfen und sich mit aller Kraft die gewünschte Seite zu wünschen. Wir werfen die Würfel nicht. Wir führen sie.\n\n' +
    'Du stehst auf einem Würfel. Führe ihn: Er rollt, und eine andere Seite kommt nach oben.\n\n' +
    'Heute ist der dritte Kanal offen: Wir arbeiten mit 3ern. Lege drei 3er nebeneinander: Das ist ein Combo, und es wird gehen. Andere Kombinationen wirken nicht: Ihre Seiten sind mit einem Kreuz markiert.',
  lessonStep:
    'Geschafft! Rhines Würfel sind nur gefallen. Deine hören schon auf dich.\n\n' +
    'Jetzt zu den Schritten. Du kannst über die Würfel gehen, von einem zum nächsten. Ein Schritt zählt nicht als Zug: Geh, so viel du willst.\n\n' +
    'Ein Zug ist ein Rollen. Es rollt nur der Würfel, auf dem du stehst, und nur auf einen freien Platz. Geh zum richtigen Würfel und sammle die 3er.',
  lessonWalk:
    'Jetzt zu den Schritten. Du kannst über die Würfel gehen, von einem zum nächsten. Ein Schritt zählt nicht als Zug: Geh, so viel du willst.\n\n' +
    'Ein Zug ist ein Rollen. Es rollt nur der Würfel, auf dem du stehst, und nur auf einen freien Platz.\n\n' +
    'Ein Combo geht nicht sofort, und auch über gehende Würfel kannst du gehen. Geh über sie zu den anderen und sammle das zweite Combo.',
  lessonLink:
    'Ein Combo geht nicht sofort. Es hat zwei Züge: Im ersten sinken die Würfel zur Hälfte, im zweiten ganz.\n\n' +
    'Hier stehen vier Würfel, und eine 3 braucht drei. Der übrige bliebe allein, und das ist eine Sackgasse. Also muss er rechtzeitig zu den gehenden gerollt werden.\n\n' +
    'Über gehende Würfel geht man wie über alle anderen. Geh über sie zum vierten und rolle ihn mit der 3 nach oben an das Combo. Das heißt Kette.\n\n' +
    'Und ein Geschenk des Tisches: Jeder Würfel, der in die Kette kommt, gibt den gehenden einen Zug mehr.',
  lessonHold:
    'Ein gehendes Combo hat zwei Züge. Aber jeder Würfel, der in die Kette kommt, gibt ihm einen Zug mehr.\n\n' +
    'Im ersten Zug herangerollt: Das Combo hat wieder zwei Züge. Im zweiten: einen. Rolle in jedem Zug einen Würfel heran, und es wartet.',
  lessonFloor:
    'Wenn der Würfel unter dir geht, stehst du auf dem Boden. Das macht nichts: [Wir warten]. Von einem gehenden Würfel kannst du auch selbst absteigen.\n\n' +
    'Vom Boden aus werden Würfel geschoben. Ein geschobener Würfel gleitet ein Feld weit und dreht sich nicht. Schieben ist ein Zug.\n\n' +
    'Wieder nach oben: über einen gehenden Würfel, solange er noch da ist. Oder über einen, der sich nicht schieben lässt: Hinter ihm ist der Rand des Tisches oder ein anderer Würfel.',
  lessonClimb:
    'Vom Boden kommst du wieder nach oben. Steig auf einen gehenden Würfel, solange er noch da ist.\n\n' +
    'Oder auf einen Würfel, der sich nicht schieben lässt: Hinter ihm ist der Rand des Tisches oder ein anderer Würfel. Und vom Feld neben einem gehenden Combo steigst du auf jeden Würfel daneben.',
  lessonSeven:
    'Ein Geheimnis, das jeder Würfelspieler kennt: Gegenüber ergibt immer sieben. Gegenüber der 1 liegt die 6, gegenüber der 2 die 5, gegenüber der 3 die 4.\n\n' +
    'Siehst du oben eine 4, liegt die 3 unten. Du siehst sie nicht, aber sie ist da.\n\n' +
    'Zweimal in dieselbe Richtung rollen, und die untere Seite ist oben.',
  lessonTwos:
    'Der Einführungskurs ist vorbei. Glückwunsch: Der Tisch hört auf dich.\n\n' +
    'Ab hier ist ein weiterer Kanal offen. Jetzt [werden] 2er und 3er [angenommen]: Eine 2 braucht zwei Würfel, eine 3 drei.\n\n' +
    'Zähle die Würfel vorher: Für welche Combos reichen sie?',
  lessonGlass:
    'Ein gehender Würfel ist [schon halb hier]. Deshalb kannst du über ihn rollen: Dein Würfel nimmt seinen Platz ein.\n\n' +
    'Passt die Seite, reiht sich dein Würfel in die Kette ein. Wenn nicht, nimmt er einfach den Platz ein.',
  lessonFives:
    'Der fünfte Kanal ist offen. Wir arbeiten nur mit 5ern.\n\n' +
    'Lege fünf 5er nebeneinander: Das ist ein Combo, und es wird gehen, [zu uns].',
  lineCombo: 'Hallo! Ich bin hier der Laborassistent. Heute ist der dritte Kanal offen: Leg drei 3er nebeneinander: Das ist ein Combo, und es geht.',
  lineStep: 'Geschafft! Rhines Würfel sind nur gefallen, deine hören auf dich. Du kannst über sie gehen: Ein Schritt ist kein Zug.',
  lineWalk: 'Ein Combo geht nicht sofort: dorthin, unter die Oberfläche. Solange es hier ist, geh darüber zu den anderen.',
  lineSide: 'Der Kurs ist vorbei: Der Tisch hört auf dich. Jetzt ein Spielergeheimnis: Eine Seite an der Flanke fährt mit. Bring sie hin, dann dreh.',
  lineSeven: 'Das zweite Geheimnis: Gegenüber ergibt immer sieben. Unter der 4 liegt die 3. Du siehst sie nicht, aber sie ist da.',
  lineLink: 'Mehr Würfel, als das Combo braucht? Rolle den übrigen zu den gehenden, solange sie hier sind. Das ist eine Kette.',
  lineFloor: 'Von einem gehenden Würfel kannst du auf den Boden steigen. Das macht nichts: [Wir warten]. Vom Boden werden Würfel geschoben.',
  lineGlass: 'Ein gehender Würfel ist [schon halb hier]. Du kannst über ihn rollen: Deiner nimmt seinen Platz ein.',
  lineFaces: 'Ein weiterer Kanal ist offen: Jetzt [werden] 2er und 3er [angenommen]. Zähl die Würfel vorher.',
  ruleThrees: 'Ein Combo sind drei 3er nebeneinander: Es geht. Nur 3er wirken, die anderen Seiten sind mit einem Kreuz markiert.',
  ruleStep: 'Ein Schritt über die Würfel ist kein Zug. Ein Zug ist, den Würfel, auf dem du stehst, auf einen freien Platz zu rollen.',
  ruleWalk: 'Ein Schritt ist kein Zug, ein Zug ist ein Rollen. Über ein gehendes Combo kannst du gehen und von ihm auf einen anderen Würfel steigen.',
  ruleLink: 'Ein Combo geht in zwei Zügen. Rolle einen Würfel mit derselben Seite heran: Das ist eine Kette. Jeder solche Würfel gibt den gehenden einen Zug mehr.',
  ruleHold: 'Jeder Würfel einer Kette gibt dem gehenden Combo einen Zug mehr.',
  ruleFloor: 'Der Würfel unter dir ist weg: Du bist am Boden. Vom Boden wird ein Würfel geschoben: Er gleitet, dreht sich nicht, und das ist ein Zug. Nach oben: über einen gehenden Würfel oder einen, der sich nicht schieben lässt.',
  ruleClimb: 'Vom Boden nach oben: auf einen gehenden Würfel oder auf einen, der sich nicht schieben lässt.',
  ruleSeven: 'Gegenüber ergibt immer sieben: 1 und 6, 2 und 5, 3 und 4. Zweimal in dieselbe Richtung rollen, und die untere Seite ist oben.',
  ruleTwos: '2er und 3er wirken. Eine 2 braucht zwei Würfel, eine 3 drei.',
  ruleGlass: 'Über einen gehenden Würfel kannst du rollen. Passt die Seite, reiht sich der Würfel in die Kette ein.',
  ruleFives: 'Nur 5er wirken. Ein Combo sind fünf 5er nebeneinander.',
  // A proposal, like the Russian lines they follow.
  roadHintChain: 'Zu einem [gehenden Combo] kann man Würfel hinzufügen.',
  roadHintWalk: 'Ein Combo [geht] langsam. Auf [gehenden Würfeln] kann man laufen.',
  roadHintPush: 'Steig über [gehende Würfel] auf den Boden. Dort [schiebe].',
  roadHintClimb: 'Vom Boden hinauf und zurück: über [gehende Würfel].',
  hintSeven: '[Gegenüberliegende Seiten] ergeben zusammen immer [7].',
  hintLinkMove: 'Ein [Glied] schenkt dem Combo einen Zug.',
  hintRollIn: 'In einen [gehenden Würfel] kann man auch [hineinrollen].',
  hintOnes: 'Roll eine [1:Eins] an [gehende Würfel]: alle anderen [1:Einsen] gehen.',
  hintOnesPush: 'Schieb eine [1:Eins] zum [Combo], dann geht sie mit.',
  signalTitle: 'ÜBERTRAGUNG',
  campaignEnd: 'Fortsetzung folgt. Bis neue Level kommen, kannst du den {Endlosmodus} ausprobieren.',
  liveIntro: 'Keine Stufe: eine [Live-Sitzung]. Die Würfel kommen von selbst. [Drei Minuten], eigene Wertung. {Überspringen}',
  shellProtocol: 'DIE WÜRFEL KOMMEN OHNE ENDE',
  shellLevels: 'RÄUME DAS FELD',
  shellRecords: 'DIE BESTEN SPIELER',
  shellSystem: 'TON, SPRACHE UND MEHR',
  shellHowTo: 'DIE REGELN IN EINER MINUTE',
  shellReadme: 'EINE NOTIZ DES INSTITUTS',
  howRoll: 'Du stehst auf einem Würfel und rollst ihn: Eine Seitenfläche kommt nach oben.\nIn ein leeres Feld rollt der Würfel mit dir. Auf einen Nachbarwürfel trittst du einfach hinüber.\nGegenüber ergibt immer sieben: Unter einer 1 liegt eine 6.',
  howCombo: 'Ein Combo sind so viele Würfel nebeneinander, wie ihre obere Seite Augen hat: zwei 2er, drei 3er, sechs 6er.\nEin fertiges Combo geht.',
  howChain: 'Ein Combo geht nicht sofort.\nSolange es geht, rolle noch einen Würfel mit derselben Seite heran: Er geht mit dem Combo. Das ist eine Kette.',
  howOnes: 'Einsen bilden kein Combo.\nBring eine 1 an ein gehendes Combo, und alle anderen 1er auf dem Feld gehen.',
  howLevels: 'STUFEN: Räume alle Würfel vom Feld.\nDie Seiten in der Ecke sind die, die du zusammenbringen musst.\nAm Boden gelten hier eigene Regeln: Nach oben geht es nur über einen gehenden Würfel.',
  howLive: 'LIVE-SITZUNG: drei Minuten Endlos-Modus zwischen den Kapiteln.\nKann übersprungen werden.',
  howProtocol: 'ENDLOS: Die Würfel kommen von selbst.\nEine Kette vervielfacht die Punkte.\nLäuft das Feld voll und bleibt voll, ist das Spiel vorbei.',
  shareScore: 'VI — auf die andere Seite gesendet: {score}',
};
