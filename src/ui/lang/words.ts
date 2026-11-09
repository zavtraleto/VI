/**
 * The words a player presses or reads, in the languages of the player: the names of the files of
 * the menu and of their fields, the commands, the names of panels and of their readings, the
 * readings over a board, the goals of a level, the settings and their values. Each stands under
 * the English word it has in `src/shell/text.ts`; the kana beside it stays as it is.
 *
 * Not yet read by native speakers. A word has to fit where its English one stands:
 * `src/shell/text.test.ts` measures them.
 */
export const WORDS = {
  // The files of the menu and the bar that runs one.
  // What the bar of a file of the menu does: a file is played, read or opened.
  PLAY: { ru: 'ИГРАТЬ', es: 'JUGAR', pt: 'JOGAR', tr: 'OYNA', de: 'SPIELEN', fr: 'JOUER' },
  READ: { ru: 'ЧИТАТЬ', es: 'LEER', pt: 'LER', tr: 'OKU', de: 'LESEN', fr: 'LIRE' },
  OPEN: { ru: 'ОТКРЫТЬ', es: 'ABRIR', pt: 'ABRIR', tr: 'AÇ', de: 'ÖFFNEN', fr: 'OUVRIR' },
  EXECUTE: { ru: 'ВЫПОЛНИТЬ', es: 'EJECUTAR', pt: 'EXECUTAR', tr: 'ÇALIŞTIR', de: 'AUSFÜHREN', fr: 'EXÉCUTER' },
  ENDLESS: { ru: 'БЕСКОНЕЧНЫЙ', es: 'SIN FIN', pt: 'INFINITO', tr: 'SONSUZ', de: 'ENDLOS', fr: 'SANS FIN' },
  LEVELS: { ru: 'УРОВНИ', es: 'NIVELES', pt: 'NÍVEIS', tr: 'SEVİYELER', de: 'STUFEN', fr: 'NIVEAUX' },
  TASKS: { ru: 'ЗАДАЧИ', es: 'TAREAS', pt: 'TAREFAS', tr: 'GÖREVLER', de: 'AUFGABEN', fr: 'TÂCHES' },
  'HIGH SCORES': { ru: 'РЕКОРДЫ', es: 'RÉCORDS', pt: 'RECORDES', tr: 'REKORLAR', de: 'BESTENLISTE', fr: 'RECORDS' },
  SETTINGS: { ru: 'НАСТРОЙКИ', es: 'AJUSTES', pt: 'AJUSTES', tr: 'AYARLAR', de: 'OPTIONEN', fr: 'RÉGLAGES' },
  'HOW TO PLAY': { ru: 'КАК ИГРАТЬ', es: 'CÓMO JUGAR', pt: 'COMO JOGAR', tr: 'OYNANIŞ', de: 'ANLEITUNG', fr: 'GUIDE' },
  STORY: { ru: 'ИСТОРИЯ', es: 'HISTORIA', pt: 'HISTÓRIA', tr: 'HİKAYE', de: 'GESCHICHTE', fr: 'HISTOIRE' },
  // The command of the menu that goes on with the levels where the player stopped.
  CONTINUE: { ru: 'ПРОДОЛЖИТЬ', es: 'CONTINUAR', pt: 'CONTINUAR', tr: 'DEVAM ET', de: 'FORTSETZEN', fr: 'CONTINUER' },
  // What the line under the name of a card of the menu counts.
  GAMES: { ru: 'ИГРЫ', es: 'PARTIDAS', pt: 'PARTIDAS', tr: 'OYUN', de: 'SPIELE', fr: 'PARTIES' },
  RECORDS: { ru: 'ЗАПИСИ', es: 'REGISTROS', pt: 'REGISTROS', tr: 'KAYITLAR', de: 'AUFNAHMEN', fr: 'BANDES' },
  // The names of panels.
  PAUSE: { ru: 'ПАУЗА', es: 'PAUSA', pt: 'PAUSA', tr: 'DURAKLATILDI', de: 'PAUSE', fr: 'PAUSE' },
  RESULT: { ru: 'РЕЗУЛЬТАТ', es: 'RESULTADO', pt: 'RESULTADO', tr: 'SONUÇ', de: 'ERGEBNIS', fr: 'RÉSULTAT' },
  RULES: { ru: 'ПРАВИЛА', es: 'REGLAS', pt: 'REGRAS', tr: 'KURALLAR', de: 'REGELN', fr: 'RÈGLES' },
  CLEARED: { ru: 'ПРОЙДЕНО', es: 'SUPERADO', pt: 'CONCLUÍDO', tr: 'TAMAMLANDI', de: 'GESCHAFFT', fr: 'TERMINÉ' },
  LANGUAGE: { ru: 'ЯЗЫК', es: 'IDIOMA', pt: 'IDIOMA', tr: 'DİL', de: 'SPRACHE', fr: 'LANGUE' },
  FAILED: { ru: 'НЕУДАЧА', es: 'FALLIDO', pt: 'FALHOU', tr: 'BAŞARISIZ', de: 'GESCHEITERT', fr: 'ÉCHEC' },
  'NEW RECORD': { ru: 'НОВЫЙ РЕКОРД', es: 'NUEVO RÉCORD', pt: 'NOVO RECORDE', tr: 'YENİ REKOR', de: 'NEUER REKORD', fr: 'NOUVEAU RECORD' },
  // The calls (docs/superpowers/specs/2026-11-05-vi-live-calls-design.md, section 11).
  INCOMING: { ru: 'ВХОДЯЩИЙ', es: 'ENTRANTE', pt: 'CHAMADA', tr: 'GELEN ARAMA', de: 'EINGEHEND', fr: 'APPEL ENTRANT' },
  ACCEPT: { ru: 'ПРИНЯТЬ', es: 'ACEPTAR', pt: 'ATENDER', tr: 'KABUL ET', de: 'ANNEHMEN', fr: 'RÉPONDRE' },
  DECLINE: { ru: 'СБРОСИТЬ', es: 'RECHAZAR', pt: 'RECUSAR', tr: 'REDDET', de: 'ABLEHNEN', fr: 'REFUSER' },
  'HANG UP': { ru: 'ПОЛОЖИТЬ ТРУБКУ', es: 'COLGAR', pt: 'DESLIGAR', tr: 'KAPAT', de: 'AUFLEGEN', fr: 'RACCROCHER' },
  CALLS: { ru: 'ЗВОНКИ', es: 'LLAMADAS', pt: 'CHAMADAS', tr: 'ARAMALAR', de: 'ANRUFE', fr: 'APPELS' },
  'LINE LOST': { ru: 'СВЯЗЬ ПРЕРВАЛАСЬ', es: 'SIN LÍNEA', pt: 'LINHA CAIU', tr: 'HAT KOPTU', de: 'LEITUNG WEG', fr: 'LIGNE COUPÉE' },
  // A record of the link: the word of `novelRecord` in `src/ui/i18n.ts`.
  RECORD: { ru: 'ЗАПИСЬ', es: 'REGISTRO', pt: 'REGISTRO', tr: 'KAYIT', de: 'AUFNAHME', fr: 'BANDE' },
  // The commands.
  SKIP: { ru: 'ПРОПУСТИТЬ', es: 'SALTAR', pt: 'PULAR', tr: 'ATLA', de: 'ÜBERSPRINGEN', fr: 'PASSER' },
  RESUME: { ru: 'ПРОДОЛЖИТЬ', es: 'CONTINUAR', pt: 'CONTINUAR', tr: 'DEVAM ET', de: 'FORTSETZEN', fr: 'REPRENDRE' },
  RESTART: { ru: 'ЗАНОВО', es: 'REINICIAR', pt: 'REINICIAR', tr: 'YENİDEN BAŞLAT', de: 'NEUSTART', fr: 'RECOMMENCER' },
  AGAIN: { ru: 'ЕЩЁ РАЗ', es: 'OTRA VEZ', pt: 'DE NOVO', tr: 'TEKRAR', de: 'NOCHMAL', fr: 'ENCORE' },
  MENU: { ru: 'МЕНЮ', es: 'MENÚ', pt: 'MENU', tr: 'MENÜ', de: 'MENÜ', fr: 'MENU' },
  // Back from the list of the levels to the board left in pause, with its number after it.
  'TO LEVEL': { ru: 'К УРОВНЮ', es: 'AL NIVEL', pt: 'AO NÍVEL', tr: 'SEVİYE', de: 'ZU STUFE', fr: 'AU NIVEAU' },
  BACK: { ru: 'НАЗАД', es: 'ATRÁS', pt: 'VOLTAR', tr: 'GERİ', de: 'ZURÜCK', fr: 'RETOUR' },
  NEXT: { ru: 'ДАЛЬШЕ', es: 'SIGUIENTE', pt: 'PRÓXIMO', tr: 'SONRAKİ', de: 'WEITER', fr: 'SUIVANT' },
  // The fewest moves of a board: a word of the program, the same in every language (the owner, 28 October 2026).
  PAR: { ru: 'PAR', es: 'PAR', pt: 'PAR', tr: 'PAR', de: 'PAR', fr: 'PAR' },
  EXIT: { ru: 'ВЫХОД', es: 'SALIR', pt: 'SAIR', tr: 'ÇIKIŞ', de: 'BEENDEN', fr: 'QUITTER' },
  START: { ru: 'НАЧАТЬ', es: 'EMPEZAR', pt: 'COMEÇAR', tr: 'BAŞLA', de: 'START', fr: 'COMMENCER' },
  UNDO: { ru: 'ОТМЕНИТЬ', es: 'DESHACER', pt: 'DESFAZER', tr: 'GERİ AL', de: 'RÜCKGÄNGIG', fr: 'ANNULER' },
  REGISTER: { ru: 'РЕГИСТРАЦИЯ', es: 'REGISTRARSE', pt: 'REGISTRAR', tr: 'KAYDOL', de: 'ANMELDEN', fr: "S'INSCRIRE" },
  SHARE: { ru: 'ПОДЕЛИТЬСЯ', es: 'COMPARTIR', pt: 'COMPARTILHAR', tr: 'PAYLAŞ', de: 'TEILEN', fr: 'PARTAGER' },
  COPIED: { ru: 'СКОПИРОВАНО', es: 'COPIADO', pt: 'COPIADO', tr: 'KOPYALANDI', de: 'KOPIERT', fr: 'COPIÉ' },
  SENT: { ru: 'ОТПРАВЛЕНО', es: 'ENVIADO', pt: 'ENVIADO', tr: 'GÖNDERİLDİ', de: 'GESENDET', fr: 'ENVOYÉ' },
  // A command that brings an advertisement of the platform says so: the word for one stands in it.
  'HINT · AD': { ru: 'ПОДСКАЗКА ЗА РЕКЛАМУ', es: 'PISTA · ANUNCIO', pt: 'DICA · ANÚNCIO', tr: 'İPUCU · REKLAM', de: 'TIPP · WERBUNG', fr: 'INDICE · PUB' },
  'DOUBLE · AD': { ru: 'УДВОИТЬ ЗА РЕКЛАМУ', es: 'DOBLAR · ANUNCIO', pt: 'DOBRAR · ANÚNCIO', tr: 'İKİ KAT · REKLAM', de: 'VERDOPPELN · WERBUNG', fr: 'DOUBLER · PUB' },
  // The readings of a result and of the log.
  SCORE: { ru: 'СЧЁТ', es: 'PUNTOS', pt: 'PONTOS', tr: 'PUAN', de: 'PUNKTE', fr: 'SCORE' },
  BEST: { ru: 'РЕКОРД', es: 'MEJOR', pt: 'MELHOR', tr: 'EN İYİ', de: 'BESTWERT', fr: 'MEILLEUR' },
  'MAX CHAIN': { ru: 'МАКС. ЦЕПОЧКА', es: 'CADENA MÁX.', pt: 'CORRENTE MÁX.', tr: 'EN UZUN ZİNCİR', de: 'LÄNGSTE KETTE', fr: 'CHAÎNE MAX.' },
  TIME: { ru: 'ВРЕМЯ', es: 'TIEMPO', pt: 'TEMPO', tr: 'SÜRE', de: 'ZEIT', fr: 'TEMPS' },
  MOVES: { ru: 'ХОДЫ', es: 'MOVIMIENTOS', pt: 'JOGADAS', tr: 'HAMLE', de: 'ZÜGE', fr: 'COUPS' },
  FEWEST: { ru: 'МИНИМУМ', es: 'MÍNIMO', pt: 'MÍNIMO', tr: 'EN AZ', de: 'MINIMUM', fr: 'MINIMUM' },
  'MOVES LEFT': { ru: 'ОСТАЛОСЬ ХОДОВ', es: 'RESTANTES', pt: 'RESTANTES', tr: 'KALAN HAMLE', de: 'ZÜGE ÜBRIG', fr: 'COUPS RESTANTS' },
  RANK: { ru: 'МЕСТО', es: 'PUESTO', pt: 'POSIÇÃO', tr: 'SIRA', de: 'RANG', fr: 'RANG' },
  'TO CONNECTION': { ru: 'ДО СВЯЗИ', es: 'HASTA ENLACE', pt: 'ATÉ CONEXÃO', tr: 'BAĞLANTIYA', de: 'BIS KONTAKT', fr: 'AVANT LIAISON' },
  STARS: { ru: 'ЗВЁЗДЫ', es: 'ESTRELLAS', pt: 'ESTRELAS', tr: 'YILDIZ', de: 'STERNE', fr: 'ÉTOILES' },
  'NO ENTRY': { ru: 'НЕТ ЗАПИСЕЙ', es: 'SIN REGISTROS', pt: 'SEM REGISTROS', tr: 'KAYIT YOK', de: 'KEINE EINTRÄGE', fr: 'AUCUNE ENTRÉE' },
  'NO NAME': { ru: 'БЕЗ ИМЕНИ', es: 'SIN NOMBRE', pt: 'SEM NOME', tr: 'İSİMSİZ', de: 'OHNE NAMEN', fr: 'SANS NOM' },
  YOU: { ru: 'ТЫ', es: 'TÚ', pt: 'VOCÊ', tr: 'SEN', de: 'DU', fr: 'TOI' },
  NAME: { ru: 'ИМЯ', es: 'NOMBRE', pt: 'NOME', tr: 'İSİM', de: 'NAME', fr: 'NOM' },
  CONNECTING: { ru: 'ПОДКЛЮЧЕНИЕ', es: 'CONECTANDO', pt: 'CONECTANDO', tr: 'BAĞLANIYOR', de: 'VERBINDE', fr: 'CONNEXION' },
  OFFLINE: { ru: 'НЕТ СВЯЗИ', es: 'SIN CONEXIÓN', pt: 'SEM CONEXÃO', tr: 'BAĞLANTI YOK', de: 'OFFLINE', fr: 'HORS LIGNE' },
  // The readings over a board: of a level, and of the endless game.
  LEVEL: { ru: 'УРОВЕНЬ', es: 'NIVEL', pt: 'NÍVEL', tr: 'SEVİYE', de: 'STUFE', fr: 'NIVEAU' },
  LINK: { ru: 'СВЯЗЬ', es: 'ENLACE', pt: 'LIGAÇÃO', tr: 'BAĞ', de: 'KONTAKT', fr: 'LIEN' },
  SIGNAL: { ru: 'СИГНАЛ', es: 'SEÑAL', pt: 'SINAL', tr: 'SİNYAL', de: 'SIGNAL', fr: 'SIGNAL' },
  'NO ROOM': { ru: 'НЕТ МЕСТА', es: 'SIN SITIO', pt: 'SEM ESPAÇO', tr: 'YER YOK', de: 'KEIN PLATZ', fr: 'COMPLET' },
  // What a line of the goal of a level counts.
  DICE: { ru: 'КОСТИ', es: 'DADOS', pt: 'DADOS', tr: 'ZAR', de: 'WÜRFEL', fr: 'DÉS' },
  FACE: { ru: 'ГРАНЬ', es: 'CARA', pt: 'FACE', tr: 'YÜZ', de: 'SEITE', fr: 'FACE' },
  CHAIN: { ru: 'ЦЕПОЧКА', es: 'CADENA', pt: 'CORRENTE', tr: 'ZİNCİR', de: 'KETTE', fr: 'CHAÎNE' },
  LEFT: { ru: 'ОСТАЛОСЬ', es: 'QUEDAN', pt: 'RESTAM', tr: 'KALAN', de: 'ÜBRIG', fr: 'RESTE' },
  CLEAR: { ru: 'УБРАТЬ', es: 'LIMPIAR', pt: 'LIMPAR', tr: 'TEMİZLE', de: 'RÄUMEN', fr: 'VIDER' },
  // The settings and their values.
  SOUND: { ru: 'ЗВУК', es: 'SONIDO', pt: 'SOM', tr: 'SES', de: 'TON', fr: 'SON' },
  EFFECTS: { ru: 'ЭФФЕКТЫ', es: 'EFECTOS', pt: 'EFEITOS', tr: 'EFEKTLER', de: 'EFFEKTE', fr: 'EFFETS' },
  // The owner, 30 October 2026: «на русском "ввод" пусть будет».
  ON: { ru: 'ВКЛ', es: 'SÍ', pt: 'SIM', tr: 'AÇIK', de: 'AN', fr: 'OUI' },
  OFF: { ru: 'ВЫКЛ', es: 'NO', pt: 'NÃO', tr: 'KAPALI', de: 'AUS', fr: 'NON' },
  ALL: { ru: 'ВСЕ', es: 'TODOS', pt: 'TODOS', tr: 'TÜMÜ', de: 'ALLE', fr: 'TOUS' },
  CALM: { ru: 'СПОКОЙНО', es: 'SUAVES', pt: 'SUAVES', tr: 'SAKİN', de: 'RUHIG', fr: 'CALMES' },
} as const satisfies Record<string, Record<'ru' | 'es' | 'pt' | 'tr' | 'de' | 'fr', string>>;
