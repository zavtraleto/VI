import type { Texts } from '../i18n';

/** Portuguese, as it is written in Brazil. Not yet read by a native speaker. */
export const PT: Texts = {
  tut_roll: 'Você está sobre um dado. Conduza-o: ele rola, e uma face lateral fica em cima',
  tut_pair: 'Leve o 2 para junto do 2',
  tut_count: 'Dois 2 lado a lado, e eles já vieram para nós. Tantos dados quantos pontos: três 3, quatro 4',
  tut_three: 'Um 3 precisa de três. Encaixe o seu entre eles',
  tut_carry: 'O 4 está na lateral. Enquanto você rola ao longo dele, ele continua na lateral. Leve-o até lá e vire-o para cima',
  tut_floor: 'Seu dado se foi, você está no chão. Daqui os dados são empurrados. Empurre o 5 até os outros',
  tut_mount: 'Um raio: aqui sobe um dado. Suba nele enquanto está baixo',
  tut_seven: 'Um 1 em cima significa um 6 embaixo: faces opostas somam sete. Duas roladas, e ele fica em cima',
  tut_chain: 'Enquanto um grupo está saindo, o canal está aberto. Passe para o dado vizinho e junte-o ao grupo: a pontuação se multiplica',
  tut_ones: 'O 1 é à parte: os uns não se juntam. Leve-o até o grupo que está saindo',
  tut_alone: 'Todos os que eram à parte se foram. Sobrou um: aquele em que você pisa',
  tut_end: 'Daqui em diante os dados chegam sozinhos. Não deixe o tabuleiro encher, ou não ouviremos você',
  newBest: 'Novo recorde',
  dailyBest: 'Melhor resultado do dia. A sessão do dia é a mesma para todos; uma nova chega à meia-noite UTC',
  dailyNote: 'A sessão do dia é a mesma para todos. Uma nova chega à meia-noite UTC',
  practiceNote: 'Partida de treino: recorde não salvo',
  notSaved: 'Armazenamento indisponível: recorde não salvo',
  hintFloor: 'No chão você empurra os cubos',
  hintMount: 'Suba em um cubo que está surgindo',
  hintChain: 'Junte cubos iguais enquanto eles afundam',
  hintOne: 'Leve um 1 até uma corrente e todos os outros 1 somem',
  hintLow: 'Dá para rolar por cima de um cubo transparente',
  customNote: 'Variáveis alteradas: recorde não salvo',
  tier_intro: 'Primeiros passos',
  tier_path: 'O caminho longo',
  tier_decoy: 'Par falso',
  tier_pair: 'Dois grupos',
  tier_big: 'Um grupo grande',
  tier_tight: 'Apertado',
  tier_hard: 'Difíceis',
  puzzleHeld: 'O grupo está formado. Passe para um dado vizinho e ele some',
  deadNoExit: 'Beco sem saída: não há dado para onde passar e ainda restam dados. Desfaça a jogada',
  deadSingle: 'Beco sem saída: sobraria um dado só, sem par possível. Desfaça a jogada',
  puzzleRule1: 'Um passo para um dado vizinho não custa nada. Rolar seu dado para uma casa vazia é uma jogada',
  puzzleRule2: 'Junte tantos dados com o mesmo número em cima quanto esse número: dois 2, três 3. Os uns não se juntam',
  puzzleRule3: 'Um grupo formado espera enquanto você está sobre ele. Passe para um dado vizinho e o grupo some',
  puzzleRule4: 'O selo no canto mostra as faces do dado sob você: ele diz o que uma rolada trará para cima',
  puzzleRule5: 'Retire todos os dados. Quanto menos jogadas, mais estrelas',
  levelStuck: 'Beco sem saída: restam {left} no tabuleiro, e um combo pede {need}',
  levelStranded: 'Beco sem saída: deste dado não há para onde ir',
  levelFloorStuck: 'Beco sem saída: do chão não há o que empurrar nem por onde subir',
  levelFloorFaces: 'Beco sem saída: empurrar não gira o dado, e faltam faces para um combo',
  levelShort: 'As jogadas acabaram. Faltaram: {short}',
  lessonThrees:
    'Olá! Boas-vindas ao Visual Interconnection. Sou o assistente do laboratório, e hoje vou ensinar você a trabalhar com a mesa.\n\n' +
    'Nos anos trinta, o doutor Rhine pedia às pessoas que jogassem dados e desejassem com toda a força a face que queriam. Nós não jogamos os dados. Nós os conduzimos.\n\n' +
    'Você está em cima de um dado. Conduza-o pela seta: ele vai rolar, e outra face ficará em cima.\n\n' +
    'Hoje está aberto o terceiro canal: trabalhamos com os 3. Ponha três 3 lado a lado: isso é um combo, e ele vai sair. Outras combinações não funcionam: suas faces estão riscadas.',
  lessonStep:
    'Conseguiu! Os dados de Rhine só caíam. Os seus já obedecem a você.\n\n' +
    'Agora, os passos. Dá para andar pelos dados, de um para o vizinho. Um passo não conta como jogada: ande quanto quiser.\n\n' +
    'Uma jogada é rolar. Só rola o dado em que você está, e só para um lugar livre. Vá até o dado de que precisa e junte os 3.',
  lessonWalk:
    'Agora, os passos. Dá para andar pelos dados, de um para o vizinho. Um passo não conta como jogada: ande quanto quiser.\n\n' +
    'Uma jogada é rolar. Só rola o dado em que você está, e só para um lugar livre.\n\n' +
    'Um combo não sai na hora, e também dá para andar pelos dados que estão saindo. Passe por eles até os outros e junte o segundo combo.',
  lessonLink:
    'Um combo não sai na hora. Ele tem duas jogadas: na primeira os dados afundam pela metade; na segunda, de vez.\n\n' +
    'Aqui há quatro dados, e um 3 pede três. O que sobra ficará sozinho, e isso é um beco sem saída. Então é preciso rolar esse dado a tempo até os que estão saindo.\n\n' +
    'Pelos dados que estão saindo se anda como pelos outros. Vá por eles até o quarto e role-o até o combo com o 3 em cima. Isso se chama corrente.\n\n' +
    'E um presente da mesa: cada dado que entra na corrente dá aos que estão saindo mais uma jogada.',
  lessonHold:
    'Um combo que está saindo tem duas jogadas. Mas cada dado que entra na corrente dá a ele mais uma jogada.\n\n' +
    'Chegou na primeira jogada: o combo volta a ter duas. Na segunda: uma. Leve um dado a cada jogada, e ele vai esperar.',
  lessonFloor:
    'Se o dado sob você sair, você ficará no chão. Não tem problema: [nós esperamos]. Também dá para descer por conta própria de um dado que está saindo.\n\n' +
    'Do chão, os dados são empurrados. Um dado empurrado desliza uma casa e não gira. Empurrar é uma jogada.\n\n' +
    'De volta para cima: por um dado que está saindo, enquanto ele ainda está lá. Ou por um que não dá para empurrar: atrás dele está a borda da mesa ou outro dado.',
  lessonClimb:
    'Do chão dá para voltar para cima. Suba em um dado que está saindo, enquanto ele ainda está lá.\n\n' +
    'Ou em um dado que não dá para empurrar: atrás dele está a borda da mesa ou outro dado. E de uma casa ao lado de um combo que está saindo você sobe em qualquer dado vizinho.',
  lessonSeven:
    'Um segredo que todo jogador de dados conhece: faces opostas somam sete. Em frente ao 1 fica o 6, em frente ao 2 o 5, em frente ao 3 o 4.\n\n' +
    'Você vê um 4 em cima: então o 3 está embaixo. Você não o vê, mas ele está lá.\n\n' +
    'Duas roladas para o mesmo lado, e a face de baixo fica em cima.',
  lessonTwos:
    'O curso de introdução acabou. Parabéns: a mesa obedece a você.\n\n' +
    'Daqui em diante há mais um canal aberto. Agora [são aceitos] os 2 e os 3: um 2 pede dois dados, um 3 pede três.\n\n' +
    'Conte os dados antes: para quais combos eles dão?',
  lessonGlass:
    'Um dado que está saindo [já está meio aqui]. Por isso dá para rolar por cima dele: seu dado fica no lugar dele.\n\n' +
    'Se a face coincidir, seu dado entra na corrente. Se não, ele só ocupa o lugar.',
  lessonFives:
    'Está aberto o quinto canal. Trabalhamos só com os 5.\n\n' +
    'Ponha cinco 5 lado a lado: isso é um combo, e ele vai sair [para nós].',
  lineCombo: 'Olá! Sou o assistente do laboratório. Hoje o terceiro canal está aberto: ponha três 3 lado a lado: isso é um combo, e ele vai sair.',
  lineStep: 'Conseguiu! Os dados de Rhine só caíam, e os seus obedecem a você. Dá para andar por eles: um passo não é uma jogada.',
  lineWalk: 'Um combo não sai de uma vez: vai para lá, sob a superfície. Enquanto está aqui, ande por ele até os outros.',
  lineSide: 'O curso acabou: a mesa obedece a você. Agora, um segredo de jogadores: a face do lado viaja com você. Leve-a e vire.',
  lineSeven: 'O segundo segredo: faces opostas somam sete. Sob o 4 está o 3. Você não o vê, mas ele está lá.',
  lineLink: 'Mais dados do que o combo pede? Role o que sobra até os que estão saindo, enquanto estão aqui. Isso é uma corrente.',
  lineFloor: 'De um dado que está saindo dá para descer ao chão. Não tem problema: [nós esperamos]. Do chão, os dados são empurrados.',
  lineGlass: 'Um dado que está saindo [já está meio aqui]. Dá para rolar por cima dele: o seu fica no lugar dele.',
  lineFaces: 'Mais um canal foi aberto: agora [são aceitos] os 2 e os 3. Conte os dados antes.',
  ruleThrees: 'Um combo são três 3 lado a lado: ele sai. Só os 3 funcionam; as outras faces estão riscadas.',
  ruleStep: 'Um passo pelos dados não é uma jogada. Uma jogada é rolar o dado em que você está para um lugar livre.',
  ruleWalk: 'Um passo não é uma jogada; uma jogada é rolar. Por um combo que está saindo dá para andar e descer dele para outro dado.',
  ruleLink: 'Um combo sai em duas jogadas. Role até ele um dado com a mesma face: isso é uma corrente. Cada dado assim dá aos que estão saindo mais uma jogada.',
  ruleHold: 'Cada dado de uma corrente dá ao combo que está saindo mais uma jogada.',
  ruleFloor: 'O dado sob você saiu: você está no chão. Do chão um dado é empurrado: desliza sem girar, e isso é uma jogada. Para cima: por um dado que está saindo ou por um que não dá para empurrar.',
  ruleClimb: 'Do chão para cima: em um dado que está saindo, ou em um que não dá para empurrar.',
  ruleSeven: 'Faces opostas somam sete: 1 e 6, 2 e 5, 3 e 4. Duas roladas para o mesmo lado, e a face de baixo fica em cima.',
  ruleTwos: 'Funcionam os 2 e os 3. Um 2 pede dois dados; um 3, três.',
  ruleGlass: 'Dá para rolar por cima de um dado que está saindo. Se a face coincidir, o dado entra na corrente.',
  ruleFives: 'Só os 5 funcionam. Um combo são cinco 5 lado a lado.',
  shellProtocol: 'SESSÃO SEM LIMITE',
  shellLimited: 'SESSÃO DO DIA {time}',
  shellLevels: 'LIMPEZA DO CAMPO',
  shellExercise: 'TESTE DE HABILIDADE',
  shellTasks: 'LIMPEZA DO CANAL',
  shellRecords: 'REGISTRO DE SESSÕES',
  shellSystem: 'PARÂMETROS',
  shellHowTo: 'PROCEDIMENTO',
  shellReadme: 'NOTA ANEXA',
  howRoll: 'Você está sobre um dado e o faz rolar: uma face lateral fica em cima.\nPara uma casa vazia o dado rola com você. Para um dado vizinho você apenas passa.\nFaces opostas somam sete: sob um 1 há um 6.',
  howCombo: 'Um combo são tantos dados lado a lado quantos pontos tem a face de cima: dois 2, três 3, seis 6.\nUm combo formado sai.',
  howChain: 'Um combo não sai na hora.\nEnquanto ele sai, role até ele mais um dado com a mesma face: ele sai junto com o combo. Isso é uma corrente.',
  howOnes: 'Os 1 não formam combo.\nLeve um 1 até um combo que está saindo, e todos os outros 1 do tabuleiro saem.',
  howLevels: 'NÍVEIS: tire todos os dados do tabuleiro.\nSó as faces do nível funcionam, as outras estão riscadas.\nAs jogadas são limitadas: quanto menos, mais estrelas.\nAqui o chão tem regras próprias: só se sobe por um dado que está saindo.',
  howProtocol: 'PROTOCOLO: os dados chegam sozinhos.\nUma corrente multiplica os pontos.\nSe o tabuleiro encher e continuar cheio, a sessão acaba.',
  shareScore: 'VI — enviado para o outro lado: {score}',
};
