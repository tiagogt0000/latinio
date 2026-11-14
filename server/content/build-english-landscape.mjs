#!/usr/bin/env node
// Authored application tasks, not a runtime generator or a paid AI dependency.
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateSentenceCatalogue} from '../landscape-content.mjs';

const directory=new URL('./',import.meta.url);
const vocabulary=JSON.parse(readFileSync(new URL('landscape-english-vocabulary.json',directory),'utf8'));
const normalize=value=>value.toLocaleLowerCase('en').replace(/^\(to\)\s*/,'').trim();
const words=new Map(Object.values(vocabulary.words).map(word=>[normalize(word.latin),word]));
const aliases={outback:'the outback',homesick:'be homesick',determined:'be determined to do something',Olympics:'the Olympic Games',
  'feed on':'feed on',injure:'injure somebody','bump into':'bump into somebody',snorkel:'snorkel',shorten:'shorten',
  provoke:'provoke','take on':'take (on sth.)',apply:'apply for something',contact:'contact somebody',
  'tend be':'tend to be something','tend do':'tend to do something',lacks:'somebody lacks something',
  oppose:'oppose something',state:'state something',discuss:'discuss something',
  'one hand':'On the one hand, ...','other hand':'On the other hand, ...','first place':'In the first place, ...',
  Firstly:'Firstly, ...',Secondly:'Secondly, ...',Thirdly:'Thirdly, ...',
  disagree:'disagree (with)',afraid:"I'm afraid ...",dig:'dig (for sth.)',camp:'camp (out)',sort:'sort (of)',
  debate:'debate sth.',bully:'bully sb.','all-star':'all-star team/player',empower:'empower sb.',criticize:'criticize sb. (for)',
  worries:'No worries, mate.'};
function wordFor(key){const word=words.get(normalize(aliases[key]||key));if(!word)throw Error('Unknown vocabulary key: '+key);return word;}
const authored=[];
let currentCollection=null;
function unit(name){currentCollection=Object.values(vocabulary.collections).find(c=>c.name===name);if(!currentCollection)throw Error('Missing collection '+name);}
function add(marked,answer,distractors,{tense='present',alternatives=[]}={}){
  const tokens=[];
  function appendPlain(value){for(const part of value.trim().split(/\s+/).filter(Boolean)){
    if(/^[.,!?;:]+$/.test(part)&&tokens.length)tokens.at(-1).text+=part;
    else tokens.push({text:part,wordId:null,kind:'glue'});
  }}
  let cursor=0;
  for(const match of marked.matchAll(/\{([^:{}]+):([^{}]+)\}/g)){
    appendPlain(marked.slice(cursor,match.index));tokens.push({text:match[2],wordId:wordFor(match[1]).id});cursor=match.index+match[0].length;
  }
  appendPlain(marked.slice(cursor));
  const prompt=tokens.map(token=>token.text).join(' ');
  const focusWordIds=[...new Set(tokens.filter(token=>vocabulary.words[token.wordId]?.collectionId===currentCollection.id).map(token=>token.wordId))];
  if(!focusWordIds.length)throw Error('No focus word: '+prompt);
  const translations=[answer,...alternatives].map(a=>a.split('|'));
  const id='landscape-en-'+createHash('sha256').update(currentCollection.id+'\n'+prompt+'\n'+answer).digest('hex').slice(0,16);
  authored.push({id,subject:'english',direction:'de-en',collectionId:currentCollection.id,prompt,latin:prompt,
    promptLanguage:'de',answerLanguage:'en',tokens,translations,distractors,focusWordIds,tense,
    difficulty:translations[0].length<=4?1:2,usage:'occasional-application'});
}

unit('LW 2');
add('Das Land ist {independent:unabhängig}.','The country|is|independent',['dependent','crowded']);
add('Diese Insel war eine {dependency:Kolonie}.','This island|was|a dependency',['a suburb','a reef'],{tense:'past'});
add('Die Aussicht ist {incredible:unglaublich}.','The view|is|incredible',['ordinary','poisonous']);
add('Diese {statistics:Statistiken} sind nützlich.','These statistics|are|useful',['These stories','is']);
add('Die Stadt ist {populous:bevölkerungsreich}.','The city|is|populous',['empty','rural']);
add('Eine {billion:Milliarde} ist eine große Zahl.','A billion|is|a large number',['A million','a small number']);
add('Sie spricht {Hindi:Hindi}.','She|speaks|Hindi',['German','hears']);
add('Die Flagge {represent:repräsentiert} das Land.','The flag|represents|the country',['hides','the city']);
add('Wir besuchen ein {coastal:Küstendorf}.','We|visit|a coastal village',['an inland village','leave']);
add('Hinter dem {bush:Busch} sitzt ein Vogel.','A bird|sits|behind the bush',['in front of the bush','A fox']);
add('Ich sehe eine rote {coral:Koralle}.','I|can see|a red coral',['a red flower','a blue coral']);
add('Das {kangaroo:Känguru} verlässt sein {territory:Revier}.','The kangaroo|leaves|its territory',['The camel','enters']);
add('Wir fahren durch {outback:das Hinterland Australiens}.','We|drive|through the outback',['through the city','fly']);
add('Eine {spider:Spinne} sitzt am Fenster.','A spider|sits|by the window',['A moth','under the table']);
add('Die Luft ist heute {humid:feuchtwarm}.','The air|is|humid|today',['dry','yesterday'],{alternatives:['Today|the air|is|humid']});
add('Das Dorf ist {remote:abgelegen}.','The village|is|remote',['urban','overcrowded']);
add('Dieser Strand ist {sandy:sandig}.','This beach|is|sandy',['rocky','private']);
add('Die Landschaft ist {stunning:atemberaubend}.','The landscape|is|stunning',['ordinary','dangerous']);
add('Das ist ein {urban:städtisches} Gebiet.','This|is|an urban area',['a rural area','a remote island']);
add('Wir betrachten {Aboriginal:Aborigine-Kunst}.','We|look at|Aboriginal art',['Roman art','walk past']);
add('Das {camel:Kamel} steht neben dem Zelt.','The camel|stands|next to the tent',['The koala','inside the tent']);
add('Der Mann war ein {convict:Sträfling}.','The man|was|a convict',['a guide','a tourist'],{tense:'past'});
add('Der {koala:Koala} sitzt im Baum.','The koala|sits|in the tree',['The fox','under the tree']);
add('Diese Pflanze ist {poisonous:giftig}.','This plant|is|poisonous',['harmless','edible']);

unit('LW 3');
add('Unser {flight:Flug} bringt uns zu unserem {destination:Reiseziel}.','Our flight|takes us|to our destination',['Our train','away from our destination']);
add('Der Brunnen am {quay:Kai} ist {circular:rund}.','The fountain|by the quay|is|circular',['triangular','by the airport']);
add('Der {wharf:Anlegeplatz} liegt im {waterfront:Hafenviertel}.','The wharf|is|at the waterfront',['The airport','in the mountains']);
add('Dieser {suburb:Vorort} ist {trendy:angesagt}.','This suburb|is|trendy',['old-fashioned','deserted']);
add('Sie {settle:lassen sich} in diesem {district:Viertel} nieder.','They|settle|in this district',['leave','outside the city']);
add('Wir besuchen einen {botanic:botanischen} Garten.','We|visit|a botanic garden',['a private office','avoid']);
add('Das {business:Unternehmen} besitzt einen {private:privaten} Garten.','The business|owns|a private garden',['a public garden','rents']);
add('Über uns fliegt ein {flying fox:Flughund}.','A flying fox|flies|above us',['A fox','below us']);
add('Der {fox:Fuchs} läuft durch den Garten.','The fox|runs|through the garden',['The koala','around the house']);
add('Diese {opera:Oper} ist {contemporary:zeitgenössisch}.','This opera|is|contemporary',['ancient','private']);
add('Die Kinder {beg:betteln} um ein Eis.','The children|beg|for an ice cream',['pay','for a ticket']);
add('Sie {guide:führt} uns durch das Museum.','She|guides us|through the museum',['follows us','past the station']);
add('Dieser {testimonial:Erfahrungsbericht} ist {honest:ehrlich}.','This testimonial|is|honest',['dishonest','outdated']);
add('Was ist deine {take on:Meinung zu} dem Plan?','What|is|your take on the plan',['your name','your destination']);
add('Unsere Fahrt führt durch eine {scenic:landschaftlich schöne} Gegend.','Our trip|takes us|through a scenic area',['through an industrial area','back home']);
add('Die Farbe {transform:verwandelt} den Raum.','The colour|transforms|the room',['hides','the garden']);
add('Diese Brücke ist ein {landmark:Wahrzeichen}.','This bridge|is|a landmark',['a wharf','a suburb']);
add('Für Fotografen ist diese Insel ein {paradise:Paradies}.','This island|is|a paradise|for photographers',['a prison','for drivers'],{alternatives:['For photographers|this island|is|a paradise']});
add('Ich {apply:bewerbe mich um} diese Stelle.','I|apply for|this job',['give up','this island']);
add('Bitte {contact:nimm Kontakt mit} unserer Lehrerin auf.','Please|contact|our teacher',['avoid','our neighbour']);
add('Mein Nachbar ist {Aussie:Australier} und organisiert ein {barbecue:Grillfest}.','My neighbour|is an Aussie|and|organises a barbecue',['is a tourist','organises an opera']);
add('{though:Obwohl} es regnet, gehen wir hinaus.','Though it is raining|we|go outside',['Because it is sunny','stay inside'],{alternatives:['We|go outside|though it is raining']});
add('Ich mag {especially:besonders} die Aussicht.','I|especially|like the view',['rarely','dislike the view']);
add('Sie {swallow:schluckt} etwas Wasser.','She|swallows|some water',['spills','some juice']);
add('Die Ladung wiegt eine {ton:Tonne}.','The load|weighs|a ton',['a kilogram','The passenger']);

unit('LW 4');
add('Ich {accept:akzeptiere} deine {statement:Aussage}.','I|accept|your statement',['reject','your invitation']);
add('Unser Nachbar ist {talkative:gesprächig}.','Our neighbour|is|talkative',['silent','homesick']);
add('Sie interessiert sich für {photography:Fotografie}.','She|is interested in|photography',['statistics','is afraid of']);
add('Ich {homesick:habe Heimweh}.','I|am|homesick',['talkative','self-confident']);
add('Nach einigen Tagen {get homesick:bekomme ich Heimweh}.','After a few days|I|get homesick',['After a few minutes','get hungry']);
add('Die Sprecherin wirkt {self-confident:selbstbewusst}.','The speaker|seems|self-confident',['unsure','homesick']);
add('Mein Freund ist {easy-going:gelassen}.','My friend|is|easy-going',['nervous','talkative']);
add('Das Reisen verändert unsere {way of life:Lebensweise}.','Travelling|changes|our way of life',['our address','protects']);
add('Das ist eine {general:allgemeine} Frage.','This|is|a general question',['a private question','a circular shape']);
add('Die Besprechung ist {in progress:im Gange}.','The meeting|is|in progress',['over','cancelled']);
add('Das {sunscreen:Sonnenschutzmittel} liegt in meiner Tasche.','The sunscreen|is|in my bag',['The camera','on the table']);
add('{worries:Kein Problem!}','No worries|mate',['Be careful','never mind the map']);
add('Ihre {intonation:Intonation} klingt freundlich.','Her intonation|sounds|friendly',['Her statement','angry']);
add('Die {pitch:Tonhöhe} {rise:steigt} am Satzende.','The pitch|rises|at the end of the sentence',['falls','at the beginning of the sentence']);
add('Er {tend be:neigt dazu, ruhig zu sein}.','He|tends to be|quiet',['used to be','loud']);
add('Sie {tend do:neigt dazu, früh aufzustehen}.','She|tends to|get up early',['is unable to','go to bed late']);
add('Mein Bruder steht {among:zwischen} seinen Freunden.','My brother|stands|among his friends',['behind the building','beside the river']);
add('Ich bin mir bei dieser Antwort {unsure:unsicher}.','I|am unsure|about this answer',['am certain','about the journey']);
add('Dem Jungen {lacks:fehlt es an} {confidence:Selbstvertrauen}.','The boy|lacks|confidence',['has','patience']);
add('Bitte {pay attention to:achte auf} die Schilder.','Please|pay attention to|the signs',['walk past','the flowers']);
add('Das Geräusch {distract:lenkt mich ab}.','The noise|distracts me',['calms me','The view']);
add('Das Buch hat {several:mehrere} {section:Abschnitte}.','The book|has|several sections',['one section','several paintings']);
add('Der Hund läuft {back and forth:hin und her}.','The dog|runs|back and forth',['in a circle','away from us']);
add('Meine {skin:Haut} ist trocken.','My skin|is|dry',['wet','My hair']);

unit('LW 5');
add('Mein {sunburn:Sonnenbrand} tut weh.','My sunburn|hurts',['My headache','has gone']);
add('Wir {brainstorm:brainstormen} neue Ideen.','We|brainstorm|new ideas',['reject','old rules']);
add('Sie {oppose:lehnen den Plan ab}.','They|oppose|the plan',['support','the comparison']);
add('Mein Bruder lebt im {abroad:Ausland}.','My brother|lives|abroad',['nearby','My sister']);
add('{in addition:Außerdem} brauchen wir eine Karte.','In addition|we|need a map',['Instead','need a ticket']);
add('Bitte {state:äußere} deine Meinung {briefly:in wenigen Worten}.','Please|state|your opinion|briefly',['hide','in detail']);
add('{personally:Persönlich} bevorzuge ich die Küste.','Personally|I|prefer the coast',['Generally','prefer the city']);
add('Wir {discuss:besprechen} morgen das Problem.','We|will discuss|the problem|tomorrow',['will ignore','yesterday'],{tense:'future',alternatives:['Tomorrow|we|will discuss|the problem']});
add('{furthermore:Des Weiteren} ist der Garten privat.','Furthermore|the garden|is private',['However','is public']);
add('{in my view:Meiner Ansicht nach} ist die Lösung fair.','In my view|the solution|is fair',['In her view','is unfair'],{alternatives:['The solution|is fair|in my view']});
add('{one hand:Einerseits} ist die Reise spannend, {other hand:andererseits} ist sie teuer.','On the one hand|the trip is exciting|on the other hand|it is expensive',['the trip is boring','it is cheap']);
add('Wir {take a different view:vertreten einen anderen Standpunkt}.','We|take a different view',['agree completely','They']);
add('Dieser {comparison:Vergleich} ist hilfreich.','This comparison|is|helpful',['This statement','misleading']);
add('{first place:Zunächst} brauchen wir mehr Informationen.','In the first place|we|need more information',['In the end','need less information']);
add('{Firstly:Erstens} ist die Wohnung günstig.','Firstly|the flat|is cheap',['Secondly','is expensive']);
add('{Secondly:Zweitens} liegt sie nahe am Bahnhof.','Secondly|it|is near the station',['Thirdly','is far from the station']);
add('{Thirdly:Drittens} ist die Straße ruhig.','Thirdly|the street|is quiet',['Firstly','is noisy']);
add('Sie hat einen {sunburn:Sonnenbrand} auf der Nase.','She|has|sunburn on her nose',['sunburn on her arm','He']);
add('Das Studium im {abroad:Ausland} ist eine gute Erfahrung.','Studying abroad|is|a good experience',['Working at home','a bad experience']);
add('Der {comparison:Vergleich} zeigt einen Unterschied.','The comparison|shows|a difference',['a similarity','The photograph']);
add('Ich {oppose:lehne diese Entscheidung ab}.','I|oppose|this decision',['accept','this invitation']);
add('Die Schüler {discuss:diskutieren über} das Foto.','The students|discuss|the photograph',['copy','The teachers']);
add('Er erklärt den Weg {briefly:kurz}.','He|explains|the route|briefly',['in detail','the rule'],{alternatives:['He|briefly|explains|the route']});
add('{personally:Persönlich} finde ich den Vorschlag interessant.','Personally|I|find the suggestion interesting',['Generally','find the suggestion boring']);

unit('LW 6');
add('Auf der Karte ist ein {cape:Kap} eingezeichnet.','The map|shows|a cape',['a reef','The photograph']);
add('Das {reef:Riff} liegt nahe an der Küste.','The reef|is|close to the coast',['The mountain','far from the coast']);
add('Wir bleiben in der {wet:Nässe} nicht draußen.','We|do not stay outside|in the wet',['stay outside','in the sunshine']);
add('Die {folk:Leute} im Dorf sind freundlich.','The folk|in the village|are friendly',['are unfriendly','in the city']);
add('Der Frühling ist meine liebste {season:Jahreszeit}.','Spring|is|my favourite season',['Winter','my favourite place']);
add('Sie ist {determined:fest entschlossen}, den Weg zu finden.','She|is determined to|find the path',['is afraid to','leave the village']);
add('Der {cyclone:Wirbelsturm} erreicht die Küste.','The cyclone|reaches|the coast',['The flight','leaves']);
add('Dieses {insect:Insekt} hat sechs Beine.','This insect|has|six legs',['eight legs','This spider']);
add('Der {python:Python} liegt unter einem Ast.','The python|lies|under a branch',['The moth','above a branch']);
add('{luckily:Glücklicherweise} ist die Tür offen.','Luckily|the door|is open',['Unfortunately','is closed'],{alternatives:['The door|is open|luckily']});
add('Auf dem Foto ist ein {human:Mensch} zu sehen.','The photo|shows|a human',['a koala','The map']);
add('Dieses Tier {feed on:ernährt sich von} Früchten.','This animal|feeds on|fruit',['lives under','insects']);
add('Wir sehen {mainly:hauptsächlich} Vögel.','We|mainly|see birds',['rarely','hear dogs']);
add('Bitte {provoke:provoziere} das Tier nicht.','Please|do not provoke|the animal',['provoke','the guide']);
add('Die scharfe Kante kann deine Hand {injure:verletzen}.','The sharp edge|can injure|your hand',['can protect','your foot']);
add('Eine {moth:Motte} sitzt am Fenster.','A moth|sits|by the window',['A butterfly','under the chair']);
add('Diese {season:Jahreszeit} ist sehr warm.','This season|is|very warm',['This district','very cold']);
add('Vom {cape:Kap} aus sehen wir das Meer.','From the cape|we|can see the sea',['From the clinic','can see the mountains'],{alternatives:['We|can see the sea|from the cape']});
add('Das {reef:Riff} ist voller Korallen.','The reef|is|full of coral',['The bush','full of sand']);
add('Die {folk:Leute} kommen zum Fest.','The folk|come|to the festival',['leave','to the station']);
add('Wir finden {human:menschliche} Fußspuren.','We|find|human footprints',['animal footprints','hide']);
add('Ich bin {determined:fest entschlossen}, ihr zu helfen.','I|am determined to|help her',['am unwilling to','ignore her']);
add('Das {insect:Insekt} sitzt auf einem Blatt.','The insect|sits|on a leaf',['The snake','under a stone']);
add('Der {cyclone:Wirbelsturm} ist noch weit entfernt.','The cyclone|is still|far away',['The cape','nearby']);

unit('LW 7');
add('Das {crocodile:Krokodil} liegt am Fluss.','The crocodile|lies|by the river',['The camel','in the greenhouse']);
add('Ich {bump into:treffe meinen Nachbarn zufällig} am Bahnhof.','I|bump into my neighbour|at the station',['call my neighbour','at the airport']);
add('Wir {snorkel:schnorcheln} am Riff.','We|snorkel|by the reef',['camp','in the greenhouse']);
add('Die Pflanzen stehen im {greenhouse:Gewächshaus}.','The plants|are|in the greenhouse',['in the clinic','The paintings']);
add('Bitte {shorten:verkürze} den Brief.','Please|shorten|the letter',['lengthen','the journey']);
add('Dies ist ein {formal:förmlicher} Brief.','This|is|a formal letter',['an informal message','a scenic view']);
add('Wir reisen in {the tropics:die Tropen}.','We|travel|to the tropics',['to the mountains','return']);
add('Die {coastline:Küstenlinie} ist sehr lang.','The coastline|is|very long',['The river','very short']);
add('Das Hotel bietet {entertainment:Unterhaltung}.','The hotel|offers|entertainment',['work experience','needs']);
add('Die {facilities:Einrichtungen} sind modern.','The facilities|are|modern',['old-fashioned','is']);
add('Der Zug ist {overcrowded:überfüllt}.','The train|is|overcrowded',['empty','remote']);
add('Sie lebt in einer {rural:ländlichen} Gegend.','She|lives|in a rural area',['in an urban area','works']);
add('Dies ist eine {suburban:Vorstadtstraße}.','This|is|a suburban street',['a coastal path','a mountain road']);
add('Der See liegt {inland:im Landesinneren}.','The lake|is|inland',['on the coast','The reef']);
add('Das Wetter ist heute {mild:mild}.','The weather|is|mild|today',['severe','tomorrow'],{alternatives:['Today|the weather|is|mild']});
add('Der Winter ist hier {mild:mild}.','Winter|is|mild|here',['severe','there'],{alternatives:['Here|winter|is|mild']});
add('Ein {crocodile:Krokodil} schwimmt im Wasser.','A crocodile|swims|in the water',['A koala','under the bridge']);
add('Im {greenhouse:Gewächshaus} ist es warm.','It|is warm|in the greenhouse',['is cold','in the clinic']);
add('Die Einladung klingt sehr {formal:förmlich}.','The invitation|sounds|very formal',['very casual','The intonation']);
add('Die Stadt hat wenig {entertainment:Unterhaltung} zu bieten.','The town|offers|little entertainment',['lots of entertainment','little sunshine']);
add('Diese {facilities:Einrichtungen} sind heute geschlossen.','These facilities|are|closed|today',['open','yesterday'],{alternatives:['Today|these facilities|are|closed']});
add('Die Straße folgt der {coastline:Küstenlinie}.','The road|follows|the coastline',['the river','leaves']);
add('Meine Freundin lernt {snorkel:schnorcheln}.','My friend|learns to|snorkel',['camp','is afraid to']);
add('Die neue Straße {shorten:verkürzt} unsere Fahrt.','The new road|shortens|our journey',['lengthens','our coastline']);

unit('LW 8');
add('Diese Region ist {mountainous:gebirgig}.','This region|is|mountainous',['flat','overcrowded']);
add('Sein Mantel ist {old-fashioned:altmodisch}.','His coat|is|old-fashioned',['trendy','tiny']);
add('Wir besuchen die {southern:südliche} Küste.','We|visit|the southern coast',['the northern coast','leave']);
add('Das Zimmer ist {tiny:winzig}.','The room|is|tiny',['huge','remote']);
add('Wir lernen eine neue {collocation:Kollokation}.','We|learn|a new collocation',['a new intonation','forget']);
add('Dieser Text ist {descriptive:beschreibend}.','This text|is|descriptive',['argumentative','circular']);
add('Ich bin {disagree:anderer Meinung als} mein Bruder.','I|disagree with|my brother',['agree with','my sister']);
add('Diese Behauptung ist {nonsense:Unsinn}.','This claim|is|nonsense',['true','a record']);
add('Ich möchte eine {direct:direkte} Antwort.','I|want|a direct answer',['an indirect answer','a scenic route']);
add('Seine Bemerkung war {hurtful:verletzend}.','His comment|was|hurtful',['kind','descriptive'],{tense:'past'});
add('{afraid:Leider} bin ich heute beschäftigt.','I am afraid|I|am busy today',['I am glad','am free today']);
add('Du {have a point:hast nicht ganz Unrecht}.','You|have a point',['are completely wrong','He']);
add('Zum Geburtstag bekomme ich einen {gift voucher:Geschenkgutschein}.','For my birthday|I|get a gift voucher',['get a bill','For my journey'],{alternatives:['I|get a gift voucher|for my birthday']});
add('Die Männer {dig:graben nach} Gold.','The men|dig for|gold',['look at','coral']);
add('Wir {camp:zelten} am Fluss.','We|camp|by the river',['snorkel','in the clinic']);
add('Sie {dream:träumt} von einer Reise.','She|dreams|of a journey',['speaks','of a comparison']);
add('Dieses {painting:Gemälde} hängt im Museum.','This painting|hangs|in the museum',['This photograph','in the clinic']);
add('Welche {sort:Art} Tee möchtest du?','What sort of tea|would you|like',['What sort of food','avoid']);
add('{fewer:Weniger} Menschen haben diese {opportunity:Gelegenheit}.','Fewer people|have|this opportunity',['More people','this responsibility']);
add('Dieses Praktikum gibt mir {work experience:Praxiserfahrung}.','This placement|gives me|work experience',['a gift voucher','costs me']);
add('Ihre {health:Gesundheit} ist ihr wichtig.','Her health|is important|to her',['Her appearance','to him']);
add('Der {patient:Patient} wartet in der {clinic:Klinik}.','The patient|waits|in the clinic',['The guide','at the quay']);
add('Unsere {community:Gemeinschaft} hilft neuen Nachbarn.','Our community|helps|new neighbours',['ignores','new patients']);
add('Diese Stelle ist eine gute {opportunity:Chance}.','This job|is|a good opportunity',['a bad decision','a gift voucher']);

unit('LW 9');
add('Die Klasse {debate:debattiert über} {racism:Rassismus}.','The class|debates|racism',['ignores','photography']);
add('Diese Bemerkung ist {racist:rassistisch}.','This comment|is|racist',['respectful','descriptive']);
add('Bitte {bully:mobbe niemanden}.','Please|do not bully|anyone',['bully','your neighbour only']);
add('Die {height:Höhe} der Mauer beträgt zwei Meter.','The height of the wall|is|two metres',['three metres','The length of the wall']);
add('Sie ist eine {professional:professionelle} Sportlerin.','She|is|a professional athlete',['an amateur athlete','a patient']);
add('Der {peak:Gipfel} liegt über den Wolken.','The peak|is|above the clouds',['The reef','below the clouds']);
add('Die {female:weiblichen} und {male:männlichen} Spieler trainieren zusammen.','The female and male players|train|together',['The young and old players','separately']);
add('Wir schauen uns {Olympics:die Olympischen Spiele} an.','We|watch|the Olympic Games',['the opera','organise']);
add('Ich {admire:bewundere} ihre Geduld.','I|admire|her patience',['criticize','her appearance']);
add('Zehn Mannschaften spielen in dieser {league:Liga}.','Ten teams|play|in this league',['Nine teams','in this district']);
add('Ich habe ihn {recently:vor Kurzem} gesehen.','I|saw him|recently',['a year ago','heard him'],{tense:'past',alternatives:['Recently|I|saw him']});
add('Die {all-star:Auswahlmannschaft} ist {successful:erfolgreich}.','The all-star team|is|successful',['The school team','unsuccessful']);
add('Sie gewannen drei Spiele {in a row:in Folge}.','They|won|three games|in a row',['lost','three seasons'],{tense:'past'});
add('Sie hat einen neuen {record:Rekord} aufgestellt.','She|has set|a new record',['has forgotten','a new rule'],{tense:'perfect'});
add('{due to:Aufgrund} der {pandemic:Pandemie} blieb das Museum geschlossen.','Due to the pandemic|the museum|remained closed',['Despite the pandemic','remained open'],{tense:'past',alternatives:['The museum|remained closed|due to the pandemic']});
add('Er ist ein {passionate:leidenschaftlicher} Musiker.','He|is|a passionate musician',['an indifferent musician','a professional athlete']);
add('Alle Menschen verdienen {equal:gleiche} Rechte.','All people|deserve|equal rights',['unequal rights','special gifts']);
add('Auch die {minority:Minderheit} hat eine Stimme.','The minority|also|has a voice',['The majority','has no voice']);
add('Die Ausstellung zeigt {indigenous:indigene} Kunst.','The exhibition|shows|indigenous art',['Roman art','hides']);
add('Das Projekt {empower:stärkt} junge Menschen.','The project|empowers|young people',['discourages','older people']);
add('Dieses Foto erinnert mich an meine {childhood:Kindheit}.','This photo|reminds me of|my childhood',['my journey','my first job']);
add('{criticize:Kritisiere niemanden wegen} seines {appearance:Aussehens}.','Do not criticize anyone|for|their appearance',['Praise everyone','their patience']);
add('Der Fotograf arbeitet sehr {professional:professionell}.','The photographer|works|very professionally',['very carelessly','The patient']);
add('Diese Geschichte handelt von einer {successful:erfolgreichen} Mannschaft.','This story|is about|a successful team',['an unsuccessful team','is told by']);

const catalogue={schema:1,subject:'english',version:'2026-11-14.1',
  provenance:'Individually authored short German-to-English application tasks using the canonical English vocabulary export.',
  collections:Object.values(vocabulary.collections),sentences:authored};
const validation=validateSentenceCatalogue(catalogue,vocabulary,{subject:'english',minimumPerCollection:20});
if(!validation.ok)throw Error(validation.errors.join('\n'));
if(validation.stats.collections.some(c=>c.count<20||c.count>30))throw Error('Each English collection needs 20–30 application tasks.');
writeFileSync(new URL('landscape-english-sentences.json.gz',directory),gzipSync(Buffer.from(JSON.stringify(catalogue)+'\n'),{mtime:0}));
writeFileSync(new URL('landscape-english-content-report.json',directory),JSON.stringify({schema:1,subject:'english',...validation},null,2)+'\n');
console.log(JSON.stringify({path:fileURLToPath(new URL('landscape-english-sentences.json.gz',directory)),tasks:authored.length,collections:validation.stats.collections,warnings:validation.warnings},null,2));
