#!/usr/bin/env python3
"""Build the shipped, deterministic Latin corpus from curated lexical frames.

No network, AI account, live database, or production writes. Vocabulary input is
an explicit export of collection IDs, word IDs, Latin forms and meanings only.
Every surface token is tied to that export. Review the validation report before
importing an additional collection; this builder never invents new inflections.
"""
import gzip, hashlib, json, random, re, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parent
V=json.loads((ROOT/'landscape-vocabulary.json').read_text())
def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD',s.lower()) if not unicodedata.combining(c))
def key(s): return norm(s).split(',')[0].split(' (')[0]
WORDS={key(w['latin']):w for w in V['words'].values()}
for alias,source in {'in-acc':'in (m. akk.)','cum-prep':'cum (m. abl.)','cum-conj':'cum','ante-adv':'ante'}.items():
    WORDS[alias]=next(w for w in V['words'].values() if norm(w['latin'])==source)
COLS=sorted(V['collections'].values(),key=lambda c:int(c['name'].split()[-1]))
LEVEL={c['id']:int(c['name'].split()[-1]) for c in COLS}
def tok(text,lemma):
    w=WORDS.get(lemma)
    if not w: raise ValueError('Unknown lemma: '+lemma)
    return {'text':text,'wordId':w['id']}
def latin_tokens(text,lemma):return [tok(t,lemma) for t in text.split()]
def phrase(text,lemma):return (latin_tokens(text,lemma),)
def signature(tokens):return ' '.join(norm(t['text']) for t in tokens)

# Full forms are explicit for third-declension and irregular words. No generic
# '-or' nominative or unverified guessed perfect stems are generated.
N={}
def noun(lemma,forms,german,tags,plural=False):
    a=forms.split(); de=german.split('|')
    assert len(a)==5 and len(de)==3,(lemma,forms,german)
    N[lemma]={'lemma':lemma,'nom':a[0],'acc':a[1],'gen':a[2],'dat':a[3],'abl':a[4],
              'de':de[0],'deacc':de[1],'dedat':de[2],'tags':set(tags.split()),'plural':plural}
def n12(lemma,stem,decl,german,tags):
    tails={'a':['a','am','ae','ae','a'],'o':['us','um','i','o','o'],'n':['um','um','i','o','o']}[decl]
    noun(lemma,' '.join(stem+x for x in tails),german,tags)
n12('servus','serv','o','der Sklave|den Sklaven|dem Sklaven','person')
noun('senator','senator senatorem senatoris senatori senatore','der Senator|den Senator|dem Senator','person')
n12('forum','for','n','das Forum|das Forum|dem Forum','place')
n12('curia','curi','a','das Rathaus|das Rathaus|dem Rathaus','place')
n12('turba','turb','a','die Menschenmenge|die Menschenmenge|der Menschenmenge','crowd')
n12('circus','circ','o','die Rennbahn|die Rennbahn|der Rennbahn','place')
n12('ludus','lud','o','das Spiel|das Spiel|dem Spiel','event')
n12('amicus','amic','o','der Freund|den Freund|dem Freund','person')
n12('populus','popul','o','das Volk|das Volk|dem Volk','crowd')
n12('porta','port','a','das Tor|das Tor|dem Tor','place thing')
n12('equus','equ','o','das Pferd|das Pferd|dem Pferd','animal')
n12('signum','sign','n','das Zeichen|das Zeichen|dem Zeichen','thing abstract')
noun('victor','victor victorem victoris victori victore','der Sieger|den Sieger|dem Sieger','person')
n12('praemium','praemi','n','die Belohnung|die Belohnung|der Belohnung','thing')
n12('amica','amic','a','die Freundin|die Freundin|der Freundin','person')
n12('templum','templ','n','der Tempel|den Tempel|dem Tempel','place')
n12('aedificium','aedifici','n','das Gebäude|das Gebäude|dem Gebäude','place')
n12('basilica','basilic','a','die Halle|die Halle|der Halle','place')
noun('mercator','mercator mercatorem mercatoris mercatori mercatore','der Händler|den Händler|dem Händler','person')
n12('bestia','besti','a','das Tier|das Tier|dem Tier','animal')
n12('taberna','tabern','a','der Laden|den Laden|dem Laden','place')
noun('mulier','mulier mulierem mulieris mulieri muliere','die Frau|die Frau|der Frau','person')
noun('clamor','clamor clamorem clamoris clamori clamore','der Lärm|den Lärm|dem Lärm','sound')
noun('thermae','thermae thermas thermarum thermis thermis','die Thermen|die Thermen|den Thermen','place',True)
noun('vestis','vestis vestem vestis vesti veste','das Kleid|das Kleid|dem Kleid','thing wearable')
n12('donum','don','n','das Geschenk|das Geschenk|dem Geschenk','thing')
noun('senex','senex senem senis seni sene','der alte Mann|den alten Mann|dem alten Mann','person')
n12('vinum','vin','n','der Wein|den Wein|dem Wein','food')
n12('pecunia','pecuni','a','das Geld|das Geld|dem Geld','thing')
noun('fur','fur furem furis furi fure','der Dieb|den Dieb|dem Dieb','person')
noun('uxor','uxor uxorem uxoris uxori uxore','die Ehefrau|die Ehefrau|der Ehefrau','person')
noun('adulescens','adulescens adulescentem adulescentis adulescenti adulescente','der junge Mann|den jungen Mann|dem jungen Mann','person')
n12('nuntius','nunti','o','der Bote|den Boten|dem Boten','person')
n12('victoria','victori','a','der Sieg|den Sieg|dem Sieg','abstract event')
noun('consul','consul consulem consulis consuli consule','der Konsul|den Konsul|dem Konsul','person')
noun('lictor','lictor lictorem lictoris lictori lictore','der Liktor|den Liktor|dem Liktor','person')
n12('iniuria','iniuri','a','das Unrecht|das Unrecht|dem Unrecht','abstract')
n12('barbarus','barbar','o','der Fremde|den Fremden|dem Fremden','person')
n12('patria','patri','a','die Heimat|die Heimat|der Heimat','place abstract')
noun('arma','arma arma armorum armis armis','die Waffen|die Waffen|den Waffen','thing weapon',True)
n12('deus','de','o','der Gott|den Gott|dem Gott','divinity')
n12('periculum','pericul','n','die Gefahr|die Gefahr|der Gefahr','abstract')
noun('puer','puer puerum pueri puero puero','der Junge|den Jungen|dem Jungen','person')
n12('domina','domin','a','die Herrin|die Herrin|der Herrin','person')
n12('serva','serv','a','die Sklavin|die Sklavin|der Sklavin','person')
n12('mensa','mens','a','der Tisch|den Tisch|dem Tisch','thing')
n12('cena','cen','a','die Mahlzeit|die Mahlzeit|der Mahlzeit','food event')
n12('puella','puell','a','das Mädchen|das Mädchen|dem Mädchen','person')
noun('liberi','liberi liberos liberorum liberis liberis','die Kinder|die Kinder|den Kindern','person',True)
noun('mater','mater matrem matris matri matre','die Mutter|die Mutter|der Mutter','person')
noun('aedes','aedes aedes aedium aedibus aedibus','das Haus|das Haus|dem Haus','place',True)
n12('sacrum','sacr','n','das Opfer|das Opfer|dem Opfer','thing event')
n12('convivium','convivi','n','das Gastmahl|das Gastmahl|dem Gastmahl','food event')
n12('toga','tog','a','die Toga|die Toga|der Toga','thing wearable')
n12('tunica','tunic','a','die Tunika|die Tunika|der Tunika','thing wearable')
n12('verbum','verb','n','das Wort|das Wort|dem Wort','abstract sound')
n12('copia','copi','a','der Vorrat|den Vorrat|dem Vorrat','thing')
n12('consilium','consili','n','der Plan|den Plan|dem Plan','abstract')
n12('filius','fili','o','der Sohn|den Sohn|dem Sohn','person')
n12('auxilium','auxili','n','die Hilfe|die Hilfe|der Hilfe','abstract')
n12('filia','fili','a','die Tochter|die Tochter|der Tochter','person')
n12('oculus','ocul','o','das Auge|das Auge|dem Auge','body')
noun('pater','pater patrem patris patri patre','der Vater|den Vater|dem Vater','person')
n12('libertus','libert','o','der Freigelassene|den Freigelassenen|dem Freigelassenen','person')
n12('negotium','negoti','n','die Aufgabe|die Aufgabe|der Aufgabe','abstract')
noun('vox','vox vocem vocis voci voce','die Stimme|die Stimme|der Stimme','sound')
n12('patronus','patron','o','der Patron|den Patron|dem Patron','person')
n12('via','vi','a','die Straße|die Straße|der Straße','place')
noun('mons','mons montem montis monti monte','der Berg|den Berg|dem Berg','place')
n12('propinquus','propinqu','o','der Verwandte|den Verwandten|dem Verwandten','person')
noun('gens','gens gentem gentis genti gente','der Stamm|den Stamm|dem Stamm','crowd')
noun('parentes','parentes parentes parentum parentibus parentibus','die Eltern|die Eltern|den Eltern','person',True)
noun('soror','soror sororem sororis sorori sorore','die Schwester|die Schwester|der Schwester','person')
n12('ara','ar','a','der Altar|den Altar|dem Altar','place thing')
n12('gaudium','gaudi','n','die Freude|die Freude|der Freude','abstract')
n12('dea','de','a','die Göttin|die Göttin|der Göttin','divinity')
noun('salus','salus salutem salutis saluti salute','die Rettung|die Rettung|der Rettung','abstract')
noun('pax','pax pacem pacis paci pace','der Frieden|den Frieden|dem Frieden','abstract')
noun('agmen','agmen agmen agminis agmini agmine','der Heereszug|den Heereszug|dem Heereszug','crowd')
noun('hospes','hospes hospitem hospitis hospiti hospite','der Gast|den Gast|dem Gast','person')
n12('dominus','domin','o','der Herr|den Herrn|dem Herrn','person')
n12('aqua','aqu','a','das Wasser|das Wasser|dem Wasser','food')
n12('cibus','cib','o','die Nahrung|die Nahrung|der Nahrung','food')
noun('oratio','oratio orationem orationis orationi oratione','die Rede|die Rede|der Rede','sound abstract')
n12('gratia','grati','a','der Dank|den Dank|dem Dank','abstract')
noun('mos','mos morem moris mori more','der Brauch|den Brauch|dem Brauch','abstract')
noun('maiores','maiores maiores maiorum maioribus maioribus','die Vorfahren|die Vorfahren|den Vorfahren','person',True)
noun('munus','munus munus muneris muneri munere','das Geschenk|das Geschenk|dem Geschenk','thing')
noun('iter','iter iter itineris itineri itinere','die Reise|die Reise|der Reise','event')
noun('multitudo','multitudo multitudinem multitudinis multitudini multitudine','die Menschenmenge|die Menschenmenge|der Menschenmenge','crowd')
noun('homo','homo hominem hominis homini homine','der Mensch|den Menschen|dem Menschen','person')
noun('liber','liber librum libri libro libro','das Buch|das Buch|dem Buch','thing text')
n12('poeta','poet','a','der Dichter|den Dichter|dem Dichter','person')
noun('comes','comes comitem comitis comiti comite','der Begleiter|den Begleiter|dem Begleiter','person')
n12('sinistra','sinistr','a','die linke Hand|die linke Hand|der linken Hand','body')
noun('carmen','carmen carmen carminis carmini carmine','das Gedicht|das Gedicht|dem Gedicht','text sound')
noun('urbs','urbs urbem urbis urbi urbe','die Stadt|die Stadt|der Stadt','place')
n12('provincia','provinci','a','die Provinz|die Provinz|der Provinz','place')
n12('bellum','bell','n','der Krieg|den Krieg|dem Krieg','event abstract')
noun('imperator','imperator imperatorem imperatoris imperatori imperatore','der Feldherr|den Feldherrn|dem Feldherrn','person')
noun('calamitas','calamitas calamitatem calamitatis calamitati calamitate','das Unglück|das Unglück|dem Unglück','abstract')
n12('maritus','marit','o','der Ehemann|den Ehemann|dem Ehemann','person')
noun('vir','vir virum viri viro viro','der Mann|den Mann|dem Mann','person')
n12('murus','mur','o','die Mauer|die Mauer|der Mauer','place')
noun('hostis','hostis hostem hostis hosti hoste','der Feind|den Feind|dem Feind','person')
n12('ira','ir','a','der Zorn|den Zorn|dem Zorn','abstract')
noun('frater','frater fratrem fratris fratri fratre','der Bruder|den Bruder|dem Bruder','person')
n12('lacrima','lacrim','a','die Träne|die Träne|der Träne','body')
n12('ripa','rip','a','das Ufer|das Ufer|dem Ufer','place')
noun('nex','nex necem necis neci nece','der Tod|den Tod|dem Tod','abstract')
noun('pons','pons pontem pontis ponti ponte','die Brücke|die Brücke|der Brücke','place')
noun('munitio','munitio munitionem munitionis munitioni munitione','die Befestigung|die Befestigung|der Befestigung','place')
n12('telum','tel','n','das Geschoss|das Geschoss|dem Geschoss','thing weapon')
n12('fiducia','fiduci','a','das Vertrauen|das Vertrauen|dem Vertrauen','abstract')
n12('gladius','gladi','o','das Schwert|das Schwert|dem Schwert','thing weapon')
noun('mors','mors mortem mortis morti morte','der Tod|den Tod|dem Tod','abstract')
n12('causa','caus','a','die Ursache|die Ursache|der Ursache','abstract')
noun('scelus','scelus scelus sceleris sceleri scelere','das Verbrechen|das Verbrechen|dem Verbrechen','abstract')
noun('rex','rex regem regis regi rege','der König|den König|dem König','person')
noun('sors','sors sortem sortis sorti sorte','das Schicksal|das Schicksal|dem Schicksal','abstract')
noun('sanguis','sanguis sanguinem sanguinis sanguini sanguine','das Blut|das Blut|dem Blut','body')
noun('legio','legio legionem legionis legioni legione','die Legion|die Legion|der Legion','crowd')
noun('labor','labor laborem laboris labori labore','die Arbeit|die Arbeit|der Arbeit','abstract')
noun('miles','miles militem militis militi milite','der Soldat|den Soldaten|dem Soldaten','person')
n12('oppidum','oppid','n','die Stadt|die Stadt|der Stadt','place')
noun('censor','censor censorem censoris censori censore','der Zensor|den Zensor|dem Zensor','person')
n12('sententia','sententi','a','die Meinung|die Meinung|der Meinung','abstract')
n12('proelium','proeli','n','die Schlacht|die Schlacht|der Schlacht','event')
noun('moenia','moenia moenia moenium moenibus moenibus','die Stadtmauern|die Stadtmauern|den Stadtmauern','place',True)
noun('virtus','virtus virtutem virtutis virtuti virtute','die Tapferkeit|die Tapferkeit|der Tapferkeit','abstract')
noun('crimen','crimen crimen criminis crimini crimine','der Vorwurf|den Vorwurf|dem Vorwurf','abstract')
n12('familia','famili','a','die Familie|die Familie|der Familie','crowd')
n12('exemplum','exempl','n','das Beispiel|das Beispiel|dem Beispiel','abstract')
n12('vita','vit','a','das Leben|das Leben|dem Leben','abstract')
noun('nox','nox noctem noctis nocti nocte','die Nacht|die Nacht|der Nacht','time')
n12('somnus','somn','o','der Schlaf|den Schlaf|dem Schlaf','abstract')
noun('lux','lux lucem lucis luci luce','das Licht|das Licht|dem Licht','thing')
noun('insidiae','insidiae insidias insidiarum insidiis insidiis','die Falle|die Falle|der Falle','thing',True)
n12('potentia','potenti','a','die Macht|die Macht|der Macht','abstract')
noun('copiae','copiae copias copiarum copiis copiis','die Truppen|die Truppen|den Truppen','crowd',True)
noun('navis','navis navem navis navi nave','das Schiff|das Schiff|dem Schiff','thing place')
n12('monumentum','monument','n','das Denkmal|das Denkmal|dem Denkmal','thing place')
n12('imperium','imperi','n','die Herrschaft|die Herrschaft|der Herrschaft','abstract')
noun('corpus','corpus corpus corporis corpori corpore','der Körper|den Körper|dem Körper','body')
n12('aurum','aur','n','das Gold|das Gold|dem Gold','thing')
n12('regnum','regn','n','das Reich|das Reich|dem Reich','place abstract')
noun('caput','caput caput capitis capiti capite','der Kopf|den Kopf|dem Kopf','body')
noun('auctor','auctor auctorem auctoris auctori auctore','der Verfasser|den Verfasser|dem Verfasser','person')
noun('suspicio','suspicio suspicionem suspicionis suspicioni suspicione','der Verdacht|den Verdacht|dem Verdacht','abstract')
n12('animus','anim','o','der Mut|den Mut|dem Mut','abstract')
n12('dextera','dexter','a','die rechte Hand|die rechte Hand|der rechten Hand','body')
noun('virgo','virgo virginem virginis virgini virgine','die junge Frau|die junge Frau|der jungen Frau','person')
n12('umerus','umer','o','die Schulter|die Schulter|der Schulter','body')

# Explicit active indicative principal forms and semantic object restrictions.
# German finite verbs are kept as chunks, so separable verbs are not misgraded.
VERBS=[]
def verb(lemma,present,perfect,gpresent,gperfect,objects=None,subjects='person',aux='hat'):
    assert lemma in WORDS,lemma
    VERBS.append({'lemma':lemma,'present':present,'perfect':perfect,'gp':gpresent,'gpart':gperfect,'objects':objects,'subjects':set(subjects.split()),'aux':aux})
verb('esse','est','fuit','ist','gewesen',None,'person crowd place thing animal',aux='ist')
verb('adesse','adest','adfuit','ist da','da gewesen',None,'person crowd',aux='ist')
verb('stare','stat','stetit','steht','gestanden',None,'person crowd animal')
verb('clamare','clamat','clamavit','ruft laut','laut gerufen')
verb('ridere','ridet','risit','lacht','gelacht')
verb('gaudere','gaudet','gavisus est','freut sich','sich gefreut')
verb('properare','properat','properavit','eilt','geeilt',aux='ist')
verb('tacere','tacet','tacuit','schweigt','geschwiegen')
verb('currere','currit','cucurrit','läuft','gelaufen',None,'person animal',aux='ist')
verb('surgere','surgit','surrexit','steht auf','aufgestanden',aux='ist')
verb('accedere','accedit','accessit','kommt herbei','herbeigekommen',aux='ist')
verb('patere','patet','patuit','steht offen','offengestanden',None,'place')
verb('exspectare','exspectat','exspectavit','erwartet','erwartet','person crowd event')
verb('vocare','vocat','vocavit','ruft','gerufen','person')
verb('dare','dat','dedit','gibt','gegeben',['donum','praemium','signum','pecunia','cibus','aqua','vinum','munus'])
verb('videre','videt','vidit','sieht','gesehen','person place thing animal crowd')
verb('petere','petit','petivit','sucht auf','aufgesucht','person place')
verb('spectare','spectat','spectavit','betrachtet','betrachtet','person place thing animal event')
verb('intrare','intrat','intravit','betritt','betreten',['forum','curia','templum','aedificium','taberna','basilica','thermae','aedes','urbs','oppidum'])
verb('vendere','vendit','vendidit','verkauft','verkauft',['equus','vinum','vestis','toga','tunica','liber','gladius','aurum','cibus'])
verb('tollere','tollit','sustulit','hebt hoch','hochgehoben',['liber','gladius','telum','vestis','donum','munus','mensa','caput','arma','toga','tunica'])
verb('relinquere','relinquit','reliquit','verlässt','verlassen','person place')
verb('deponere','deponit','deposuit','legt ab','abgelegt','wearable weapon')
verb('amare','amat','amavit','liebt','geliebt','person animal')
verb('laudare','laudat','laudavit','lobt','gelobt','person')
verb('sumere','sumit','sumpsit','nimmt','genommen',['liber','gladius','telum','vestis','pecunia','donum','munus','aurum','arma','cibus','aqua','vinum'])
verb('consistere','consistit','constitit','hält an','angehalten')
verb('dubitare','dubitat','dubitavit','zögert','gezögert')
verb('respondere','respondet','respondit','antwortet','geantwortet')
verb('nuntiare','nuntiat','nuntiavit','meldet','gemeldet','event')
verb('dolere','dolet','doluit','bedauert','bedauert',['iniuria','calamitas','nex','mors'])
verb('pugnare','pugnat','pugnavit','kämpft','gekämpft')
verb('defendere','defendit','defendit','verteidigt','verteidigt','person place')
verb('colere','colit','coluit','verehrt','verehrt','divinity')
verb('vivere','vivit','vixit','lebt','gelebt')
verb('mittere','mittit','misit','schickt','geschickt','person')
verb('emere','emit','emit','kauft','gekauft',['liber','gladius','vestis','toga','tunica','donum','equus','bestia','cibus','vinum','aurum'])
verb('parare','parat','paravit','bereitet vor','vorbereitet','event')
verb('ornare','ornat','ornavit','schmückt','geschmückt',['mensa','templum','ara','aedes'])
verb('laborare','laborat','laboravit','arbeitet','gearbeitet')
verb('ostendere','ostendit','ostendit','zeigt','gezeigt','thing text')
verb('portare','portat','portavit','trägt','getragen',['donum','praemium','vestis','toga','tunica','liber','gladius','arma','telum','pecunia','aurum','cibus','aqua','vinum','munus'])
verb('dicere','dicit','dixit','sagt','gesagt',['verbum','sententia'])
verb('attingere','attingit','attigit','berührt','berührt','thing body')
verb('probare','probat','probavit','billigt','gebilligt',['consilium','sententia'])
verb('gerere','gerit','gessit','trägt','getragen','wearable weapon')
verb('remanere','remanet','remansit','bleibt zurück','zurückgeblieben',aux='ist')
verb('venire','venit','venit','kommt','gekommen',aux='ist')
verb('audire','audit','audivit','hört','gehört','sound')
verb('ducere','ducit','duxit','führt','geführt','person animal crowd')
verb('orare','orat','oravit','betet','gebetet')
verb('considere','considit','consedit','setzt sich','sich gesetzt')
verb('praebere','praebet','praebuit','bietet an','angeboten','food thing')
verb('bibere','bibit','bibit','trinkt','getrunken',['aqua','vinum'])
verb('habere','habet','habuit','hat','gehabt',['liber','equus','gladius','pecunia','consilium','donum','aurum','imperium','regnum'])
verb('inducere','inducit','induxit','führt hinein','hineingeführt','person animal')
verb('circumvenire','circumvenit','circumvenit','umringt','umringt','person','crowd')
verb('aspicere','aspicit','aspexit','erblickt','erblickt','person place thing animal')
verb('capere','capit','cepit','nimmt','genommen',['liber','gladius','telum','vestis','pecunia','donum','munus','aurum','arma'])
verb('corripere','corripit','corripuit','ergreift','ergriffen','person thing')
verb('legere','legit','legit','liest','gelesen','text')
verb('servare','servat','servavit','rettet','gerettet','person animal')
verb('necare','necat','necavit','tötet','getötet',['hostis'])
verb('munire','munit','munivit','befestigt','befestigt',['urbs','oppidum','ripa'])
verb('tenere','tenet','tenuit','hält fest','festgehalten',['liber','gladius','telum','vestis','pecunia','donum','munus','toga','tunica'])
verb('alere','alit','aluit','ernährt','ernährt','person animal')
verb('flere','flet','flevit','weint','geweint')
verb('occupare','occupat','occupavit','besetzt','besetzt','place')
verb('terrere','terret','terruit','erschreckt','erschreckt','person animal')
verb('cognoscere','cognoscit','cognovit','erkennt','erkannt','person')
verb('expellere','expellit','expulit','vertreibt','vertrieben','person animal')
verb('liberare','liberat','liberavit','befreit','befreit','person')
verb('timere','timet','timuit','fürchtet','gefürchtet',['periculum','mors','scelus','ira','iniuria','bellum','hostis','barbarus','rex','bestia'])
verb('vincere','vincit','vicit','besiegt','besiegt',['hostis','barbarus','rex','legio','copiae'])
verb('amittere','amittit','amisit','verliert','verloren','thing')
verb('manere','manet','mansit','bleibt','geblieben',aux='ist')
verb('restare','restat','restitit','bleibt übrig','übrig geblieben',None,'person thing',aux='ist')
verb('consulere','consulit','consuluit','befragt','befragt','person')
verb('aperire','aperit','aperuit','öffnet','geöffnet',['porta','taberna','liber'])
verb('superare','superat','superavit','besiegt','besiegt',['hostis','barbarus','rex','legio','copiae'])
verb('accusare','accusat','accusavit','klagt an','angeklagt','person')
verb('curare','curat','curavit','pflegt','gepflegt','person animal')
verb('dimittere','dimittit','dimisit','entlässt','entlassen','person')
verb('errare','errat','erravit','irrt sich','sich geirrt')
verb('desperare','desperat','desperavit','verzweifelt','verzweifelt',aux='ist')
verb('excitare','excitat','excitavit','weckt','geweckt','person')
verb('animadvertere','animadvertit','animadvertit','bemerkt','bemerkt',['lux','insidiae','scelus','periculum','clamor','telum','fur'])
verb('arcessere','arcessit','arcessivit','holt','geholt','person')
verb('claudere','claudit','clausit','schließt','geschlossen',['porta','taberna','liber'])
verb('discedere','discedit','discessit','geht weg','weggegangen',aux='ist')
verb('convocare','convocat','convocavit','versammelt','versammelt','crowd')
verb('vitare','vitat','vitavit','vermeidet','vermieden',['periculum','insidiae','bellum','proelium'])
verb('monere','monet','monuit','ermahnt','ermahnt','person')
verb('postulare','postulat','postulavit','fordert','gefordert',['auxilium','pecunia','praemium','pax'])
verb('pellere','pellit','pepulit','vertreibt','vertrieben','person animal')
verb('perspicere','perspicit','perspexit','erkennt','erkannt',['scelus','insidiae','causa','consilium'])
verb('excedere','excedit','excessit','geht hinaus','hinausgegangen',aux='ist')
verb('abducere','abducit','abduxit','führt weg','weggeführt','person animal')
verb('rapere','rapit','rapuit','raubt','geraubt','thing')
verb('indicare','indicat','indicavit','meldet','gemeldet',['scelus','insidiae','periculum','victoria'])
verb('laedere','laedit','laesit','verletzt','verletzt','person animal')
verb('quaerere','quaerit','quaesivit','sucht','gesucht','person thing')
verb('interrogare','interrogat','interrogavit','fragt','gefragt','person')
verb('reperire','reperit','repperit','findet','gefunden','person thing')
verb('continere','continet','continuit','hält fest','festgehalten','person')
verb('sentire','sentit','sensit','spürt','gespürt',['ira','gaudium','fiducia','periculum'])
verb('crescere','crescit','crevit','wächst','gewachsen',None,'animal',aux='ist')

# Ambiguous unmarked present/perfect surface forms are only used as present.
# Perfect forms with participles (e.g. gavīsūs est) are intentionally excluded:
# this release introduces active simple indicative perfect, not deponent rules.
ADVERBS={
 'ibi':'dort','hic':'hier','subito':'plötzlich','hodie':'heute','diu':'lange',
 'tandem':'endlich','nunc':'jetzt','denique':'schließlich','statim':'sofort',
 'iam':'schon','semper':'immer','certe':'sicherlich','tantum':'nur','numquam':'niemals',
 'undique':'von allen Seiten','repente':'plötzlich','palam':'öffentlich','bene':'gut',
 'primo':'zuerst','postea':'später','deinde':'dann','frustra':'vergeblich','primum':'zuerst',
 'procul':'weit entfernt','postremo':'schließlich','adhuc':'noch','profecto':'tatsächlich',
 'imprimis':'besonders','protinus':'sofort','nuper':'neulich','paene':'fast','iterum':'wieder',
}
CLAUSES=[]
def add(tokens,translations,tense,frame,core=None):
    ids={t['wordId'] for t in tokens}
    if not ids or len(tokens)<2:return
    levels=[LEVEL[V['words'][x]['collectionId']] for x in ids]
    if any(not v or len(v)<2 for v in translations):return
    CLAUSES.append({'tokens':tokens,'translations':translations,'tense':tense,'frame':frame,
                    'core':core or signature(tokens),'level':max(levels),'_signature':signature(tokens),'_ids':ids})
def object_ok(v,n):
    return n['lemma'] in v['objects'] if isinstance(v['objects'],list) else bool(n['tags']&set(v['objects'].split()))
def german_clause(s,v,o,tense,adverb=None):
    subject=s['de'];obj=[o['deacc']] if o else []
    adv=[adverb] if adverb else []
    if tense=='present':
        # Put the particle at the end in German separable/reflexive predicates.
        pieces=v['gp'].split(' ',1);finite=pieces[0];tail=[pieces[1]] if len(pieces)>1 else []
        if tail and tail[0].startswith('sich '):tail=['sich',tail[0][5:]]
        if tail==['sich']:base=[subject,finite,'sich',*adv,*obj]
        else:base=[subject,finite,*adv,*obj,*tail]
        alt=[adverb,finite,subject,*obj,*tail] if adverb else ([*obj,finite,subject,*tail] if obj else base)
    else:
        part=v['gpart'];reflexive=part.startswith('sich ')
        if reflexive:part=part[5:]
        middle=['sich'] if reflexive else []
        base=[subject,v['aux'],*middle,*adv,*obj,part]
        alt=[adverb,v['aux'],subject,*middle,*obj,part] if adverb else ([*obj,v['aux'],subject,*middle,part] if obj else base)
    return list(dict.fromkeys([tuple(base),tuple(alt)]))

for v in VERBS:
    for s in N.values():
        if s['plural'] or not s['tags']&v['subjects']:continue
        if v['lemma'] in ['vincere','superare','necare','occupare'] and s['lemma'] not in ['consul','imperator','miles','rex','vir','hostis','barbarus','lictor']:continue
        # An isolated 'is' needs a complement and an open gate is more natural
        # than claiming every building stands open.
        if v['lemma']=='esse':continue
        if v['lemma']=='patere' and s['lemma'] not in ['porta','taberna']:continue
        if v['lemma']=='crescere' and s['lemma']!='equus':continue
        objects=[n for n in N.values() if object_ok(v,n) and n['lemma']!=s['lemma']] if v['objects'] else [None]
        if v['lemma'] in ['attingere','ostendere','praebere','corripere','amittere','rapere']:
            objects=[n for n in objects if n['lemma'] not in ['lux','copia','insidiae']]
        # Distribute semantic object choices across subjects without exploding
        # the candidate set into a Cartesian product of superficial variants.
        if len(objects)>7:
            offset=sum(ord(c) for c in s['lemma'])%len(objects)
            objects=list({n['lemma']:n for n in objects[:2]+[objects[(offset+i*7)%len(objects)] for i in range(5)]}.values())
        for o in objects:
            for tense in ['present','perfect']:
                if tense=='perfect' and (v['perfect']==v['present'] or ' ' in v['perfect']):continue
                tokens=[tok(s['nom'],s['lemma'])]+([tok(o['acc'],o['lemma'])] if o else [])+[tok(v[tense],v['lemma'])]
                core=s['lemma']+'|'+v['lemma']+'|'+(o['lemma'] if o else '')
                add(tokens,german_clause(s,v,o,tense),tense,'transitive' if o else 'intransitive',core)
                # At most one contextual adjunct is used. Selection later never
                # counts the same lexical proposition twice for one collection.
                adjuncts=list(ADVERBS.items())
                offset=sum(ord(c) for c in core)%len(adjuncts)
                for adv,de in [adjuncts[(offset+j*11)%len(adjuncts)] for j in range(3)]:
                    if adv not in WORDS:continue
                    if adv in ['tantum','imprimis','undique']:continue
                    if adv=='diu' and v['lemma'] not in ['stare','tacere','exspectare','spectare','pugnare','laborare','vivere','remanere','legere','manere','flere','orare']:continue
                    if adv=='procul' and (o or v['lemma'] not in ['stare','clamare','laborare','vivere','pugnare']):continue
                    if adv=='adhuc' and v['lemma'] not in ['stare','tacere','exspectare','laborare','vivere','remanere','manere','flere']:continue
                    if v['lemma']=='adesse' and adv in ['ibi','hic']:continue
                    if adv=='bene' and v['lemma'] not in ['laborare','respondere','parare','curare','orare','legere']:continue
                    if adv=='nuper' and tense!='perfect':continue
                    if adv=='paene' and v['lemma'] in ['amare','vivere','patere','habere','adesse','manere','tacere']:continue
                    if adv=='undique' and v['lemma'] not in ['venire','accedere','clamare']:continue
                    if adv=='imprimis' and not o:continue
                    at=[tok(s['nom'],s['lemma']),tok(adv,adv)]+([tok(o['acc'],o['lemma'])] if o else [])+[tok(v[tense],v['lemma'])]
                    add(at,german_clause(s,v,o,tense,de),tense,'adverb-'+adv,core)

# Locative and movement frames use the correct Latin preposition and case.
LOCATIONS=[('in','in (m. abl.)','abl','in'),('ante','ante (m. akk.)','acc','vor'),('apud','apud (m. akk.)','acc','bei')]
# Keys in the export strip parenthetical grammar labels, so the two in entries
# are resolved explicitly instead of colliding in WORDS.
for preposition,source,case,deprep in LOCATIONS:
    match=next((w for w in V['words'].values() if norm(w['latin'])==source),None)
    if not match:continue
    for s in N.values():
        if s['plural'] or 'person' not in s['tags']:continue
        for place in N.values():
            if 'place' not in place['tags'] or place['plural'] or place['lemma'] in ['patria','regnum','navis']:continue
            if preposition=='in' and place['lemma'] in ['ara','monumentum']:continue
            for v in [x for x in VERBS if x['lemma'] in ['stare','laborare','orare','tacere','clamare','remanere','vivere']]:
                if v['lemma']=='vivere' and place['lemma'] not in ['urbs','oppidum']:continue
                if place['lemma'] in ['murus','mons','pons'] and v['lemma'] not in ['stare','clamare','remanere','laborare']:continue
                tokens=[tok(s['nom'],s['lemma']),{'text':preposition,'wordId':match['id']},tok(place[case],place['lemma']),tok(v['present'],v['lemma'])]
                translated_prep=('auf' if place['lemma'] in ['forum','circus','via','mons','murus','pons'] else 'an' if place['lemma']=='ripa' else 'in') if preposition=='in' else deprep
                loc=translated_prep+' '+place['dedat']
                gp=v['gp'].split(' ',1);tail=gp[1:]
                add(tokens,[[s['de'],gp[0],loc,*tail],[loc,gp[0],s['de'],*tail]],'present','location-'+preposition,s['lemma']+'|'+v['lemma']+'|'+place['lemma'])

# Adjectival predicates add a different sentence structure; these are genuine
# descriptions rather than another tense/adverb copy of the same proposition.
FEMININE={'amica','domina','serva','puella','filia','mater','soror','uxor','mulier','virgo','via','porta','curia','basilica','taberna','ara','ripa','patria','provincia','urbs','nox','navis','lux','pecunia','mensa','toga','tunica','vestis','aqua','cena','oratio','gens','pax','salus','victoria','iniuria','calamitas','ira','lacrima','nex','munitio','fiducia','mors','causa','sors','legio','sententia','virtus','familia','vita','potentia','suspicio','dextera','turba','multitudo','sinistra','copia','gratia','dea','bestia'}
NEUTER={'forum','templum','aedificium','signum','praemium','donum','vinum','periculum','sacrum','convivium','verbum','consilium','auxilium','negotium','gaudium','munus','iter','carmen','bellum','scelus','oppidum','proelium','crimen','exemplum','monumentum','imperium','corpus','aurum','regnum','caput','telum'}
ADJECTIVES=[
 ('magnus','magnus magna magnum','groß','place thing body'),
 ('bonus','bonus bona bonum','gut','person thing text abstract'),
 ('miser','miser misera miserum','unglücklich','person'),
 ('superbus','superbus superba superbum','überheblich','person'),
 ('malus','malus mala malum','schlecht','person thing text abstract'),
 ('tutus','tutus tuta tutum','sicher','person place'),
 ('vivus','vivus viva vivum','lebendig','person animal'),
 ('altus','altus alta altum','hoch','place'),
 ('falsus','falsus falsa falsum','falsch','abstract'),
 ('clarus','clarus clara clarum','berühmt','person place'),
 ('solus','solus sola solum','allein','person'),
 ('vehemens','vehemens vehemens vehemens','heftig','sound'),
 ('ingens','ingens ingens ingens','gewaltig','place thing crowd'),
 ('verus','verus vera verum','wahr','abstract'),
 ('potens','potens potens potens','mächtig','person'),
 ('pulcher','pulcher pulchra pulchrum','schön','person place thing'),
 ('novus','novus nova novum','neu','place thing'),
 ('inimicus','inimicus inimica inimicum','feindlich','person'),
 ('ferus','ferus fera ferum','wild','animal'),
 ('infestus','infestus infesta infestum','feindlich','person'),
 ('improbus','improbus improba improbum','unanständig','person'),
 ('manifestus','manifestus manifesta manifestum','offenkundig','abstract'),
 ('angustus','angustus angusta angustum','eng','place'),
]
for lemma,forms,de,tags in ADJECTIVES:
    for s in N.values():
        if s['plural'] or not s['tags']&set(tags.split()):continue
        # Truth/falsehood is a property of claims, not every abstract noun;
        # height/width describes buildings/routes, not arbitrary locations.
        if lemma in ['falsus','verus'] and s['lemma'] not in ['sententia','crimen','verbum']:continue
        if lemma=='altus' and s['lemma'] not in ['murus','mons','aedificium','templum','monumentum']:continue
        if lemma=='angustus' and s['lemma'] not in ['via','porta','pons','taberna']:continue
        if lemma=='manifestus' and s['lemma'] not in ['scelus','iniuria','causa']:continue
        if lemma=='magnus' and s['lemma'] in ['sanguis','lux','pecunia','aurum','vestis','toga','tunica','lacrima']:continue
        if lemma=='ingens' and s['lemma'] not in ['forum','curia','circus','turba','populus','templum','aedificium','basilica','mensa','mons','gens','agmen','multitudo','urbs','murus','pons','munitio','legio','oppidum','familia','copiae','navis','monumentum','regnum']:continue
        if lemma in ['bonus','malus'] and 'person' not in s['tags'] and s['lemma'] not in ['liber','carmen','donum','munus','consilium','exemplum','signum','gladius','navis']:continue
        if lemma=='novus' and s['lemma'] not in ['gladius','liber','vestis','toga','tunica','taberna','aedificium','templum','mensa','monumentum','porta','navis','consilium']:continue
        gender=2 if s['lemma'] in NEUTER else 1 if s['lemma'] in FEMININE else 0
        form=forms.split()[gender]
        add([tok(s['nom'],s['lemma']),tok(form,lemma),tok('est','esse')],[[s['de'],'ist',de],[de,'ist',s['de']]],'present','adjectival',s['lemma']+'|esse|'+lemma)

# A few less frequent vocabulary items require their own argument structure;
# these authored pairs also avoid guessing constructions from a gloss.
AUTHORED=[]
def authored(level,latin,german,mapping,tense='present',alt=None):
    words=latin.split();lemmas=mapping.split('|');assert len(words)==len(lemmas),(latin,mapping)
    for index,lemma in enumerate(lemmas):
        if index and lemma in ['nam','sed','itaque','quod','quia','immo','tum'] and not words[index-1].endswith((',',':',';')):words[index-1]+=','
    if lemmas[0] in ['ubi','si','postquam','dum','etsi','quamquam','cum-conj'] and not words[2].endswith(','):words[2]+=','
    if 'qui' in lemmas:
        words[0]+=',';words[2]+=','
    german_tiles=german.split('|')
    for index,chunk in enumerate(german_tiles):
        if index>1 and chunk in ['denn','aber','weil','deshalb','dann','vielmehr'] and not german_tiles[index-1].endswith((',',':',';')):german_tiles[index-1]+=','
    if german_tiles[0] in ['sobald','wenn','obwohl','nachdem','während'] and not german_tiles[2].endswith(','):german_tiles[2]+=','
    if 'qui' in lemmas:
        german_tiles[0]+=',';german_tiles[1]+=','
    tokens=[tok(text,lemma) for text,lemma in zip(words,lemmas)]
    add(tokens,[german_tiles]+([alt.split('|')] if alt else []),tense,'authored',latin)

# Third-declension nouns, polysemous particles and argument-sensitive verbs are
# covered with complete reviewed examples instead of a free morphology engine.
authored(1,'Ubi senator est','wo|ist|der Senator','ubi?|senator|esse')
authored(1,'Servus senatorem rogat','der Sklave|fragt|den Senator','servus|senator|rogare')
authored(2,'Amicus signum dat','der Freund|gibt|ein Zeichen','amicus|signum|dare')
authored(4,'Senator de pecunia cogitat','der Senator|denkt|über das Geld|nach','senator|de|pecunia|cogitare')
authored(5,'Senator vivere debet','der Senator|muss|leben','senator|vivere|debere')
authored(5,'Consul iniuriam dolet','der Konsul|bedauert|das Unrecht','consul|iniuria|dolere')
authored(6,'Domina servam laborare iubet','die Herrin|befiehlt|der Sklavin|zu arbeiten','domina|serva|laborare|iubere')
authored(6,'Donum puellae placet','das Geschenk|gefällt|dem Mädchen','donum|puella|placere')
authored(7,'Filius patrem videre vult','der Sohn|will|den Vater|sehen','filius|pater|videre|velle')
authored(7,'Pater consilium probat','der Vater|billigt|den Plan','pater|consilium|probare')
authored(8,'Libertus negotium agit','der Freigelassene|erledigt|die Aufgabe','libertus|negotium|agere')
authored(8,'Soror domum venit','die Schwester|kommt|nach Hause','soror|domum|venire')
authored(9,'Servus domino paret','der Sklave|gehorcht|dem Herrn','servus|dominus|parere')
authored(9,'Senator orationem habet','der Senator|hält|eine Rede','senator|oratio|habere')
authored(9,'Amicus convivio interest','der Freund|nimmt|am Gastmahl|teil','amicus|convivium|interesse')
authored(10,'Poeta carmen facere cupit','der Dichter|möchte|ein Gedicht|machen','poeta|carmen|facere|cupere')
authored(11,'Frater mihi credit','der Bruder|glaubt|mir','frater|mihi|credere')
authored(11,'Vir patriam defendere potest','der Mann|kann|die Heimat|verteidigen','vir|patria|defendere|posse')
authored(12,'Vir gladio caret','der Mann|hat|kein Schwert','vir|gladius|carere')
authored(12,'Senator amico confidit','der Senator|vertraut|dem Freund','senator|amicus|confidere')
authored(12,'Consul de ponte prospicit','der Konsul|schaut|von der Brücke|herab','consul|de|pons|prospicere')
authored(14,'Consul tibi respondet','der Konsul|antwortet|dir','consul|tibi|respondere')
authored(14,'Censor sententiam dicit','der Zensor|äußert|eine Meinung','censor|sententia|dicere')
authored(15,'Senator paci studet','der Senator|strebt|nach Frieden','senator|pax|studere')
authored(16,'Consul militi imperat','der Konsul|befiehlt|dem Soldaten','consul|miles|imperare')
authored(17,'Rex imperium temperat','der König|lenkt|die Herrschaft','rex|imperium|temperare')
authored(17,'Miles telum conicit','der Soldat|wirft|das Geschoss','miles|telum|conicere')
authored(17,'Pater valet','der Vater|ist|gesund','pater|valere')
authored(18,'Miles gladio hostem laedit','der Soldat|verletzt|den Feind|mit dem Schwert','miles|gladius|hostis|laedere')
authored(18,'Pater filium interrogat','der Vater|fragt|den Sohn','pater|filius|interrogare')
authored(19,'Vir scelus negat','der Mann|leugnet|das Verbrechen','vir|scelus|negare')
authored(19,'Amicus mihi concedit','der Freund|gibt|mir|nach','amicus|mihi|concedere')
authored(19,'Pecunia deficit','das Geld|geht|aus','pecunia|deficere')
authored(19,'Servus secum pecuniam portat','der Sklave|trägt|das Geld|bei sich','servus|secum|pecunia|portare')

# Authored focus examples for function words and forms which cannot safely be
# inferred from a generic verb/object frame. No AcI, subjunctive or passive.
authored(1,'Forum ibi est','das Forum|ist|dort','forum|ibi|esse')
authored(1,'Curia hic est','das Rathaus|ist|hier','curia|hic|esse')
authored(1,'Senator subito adest','der Senator|ist|plötzlich|da','senator|subito|adesse')
authored(1,'Servus gaudet nam senator adest','der Sklave|freut sich|denn|der Senator|ist da','servus|gaudere|nam|senator|adesse')
authored(1,'Senator clamat tum servus adest','der Senator|ruft laut|dann|ist|der Sklave|da','senator|clamare|tum|servus|adesse')
authored(1,'Ave senator','sei gegrüßt|Senator','ave!|senator')
authored(1,'Salve senator','sei gegrüßt|Senator','salve!|senator')
authored(1,'Salvete servi','seid gegrüßt|Sklaven','salvete!|servus')
authored(2,'Circus patet','die Rennbahn|steht|offen','circus|patere')
authored(2,'Servi hic sunt','die Sklaven|sind|hier','servus|hic|sunt')
authored(2,'Amicus etiam ridet','der Freund|lacht|auch','amicus|etiam|ridere')
authored(2,'Senator tacet sed servus clamat','der Senator|schweigt|aber|der Sklave|ruft laut','senator|tacere|sed|servus|clamare')
authored(3,'Servus per forum currit','der Sklave|läuft|durch das Forum','servus|per|forum|currere')
authored(3,'Senator ad curiam properat','der Senator|eilt|zum Rathaus','senator|ad|curia|properare')
authored(3,'Servus in basilicam currit','der Sklave|läuft|in die Halle','servus|in-acc|basilica|currere')
authored(3,'Amica ad templum contendit','die Freundin|eilt|zum Tempel','amica|ad|templum|contendere')
authored(3,'Ludus populum delectat','das Spiel|erfreut|das Volk','ludus|populus|delectare')
authored(3,'Quis tabernam intrat','wer|betritt|den Laden','quis?|taberna|intrare')
authored(3,'Quid mercator vendit','was|verkauft|der Händler','quid?|mercator|vendere')
authored(3,'Cur servus non ridet','warum|lacht|der Sklave|nicht','cur?|servus|non|ridere')
authored(3,'Amica autem basilicam spectat','die Freundin|aber|betrachtet|die Halle','amica|autem|basilica|spectare')
authored(3,'Mercator clamat itaque servus accedit','der Händler|ruft laut|deshalb|kommt|der Sklave|herbei','mercator|clamare|itaque|servus|accedere')
authored(3,'Clamor populum delectat','der Lärm|unterhält|das Volk','clamor|populus|delectare')
authored(3,'Turba clamorem tollit','die Menschenmenge|erhebt|Geschrei','turba|clamor|tollere')
authored(4,'Servus adesse vult','der Sklave|will|da sein','servus|adesse|vult')
authored(4,'Turba forum complet','die Menschenmenge|füllt|das Forum','turba|forum|complere')
authored(4,'Senex pro amico pecuniam dat','der alte Mann|gibt|für den Freund|Geld','senex|pro|amicus|pecunia|dare')
authored(4,'Amica tamen ridet','die Freundin|lacht|dennoch','amica|tamen|ridere')
authored(4,'Senex te laudat','der alte Mann|lobt|dich','senex|te|laudare')
authored(4,'Mulier cum amica ridet','die Frau|lacht|mit der Freundin','mulier|cum-prep|amica|ridere')
authored(5,'Senator gaudet quod servus adest','der Senator|freut sich|weil|der Sklave|da ist','senator|gaudere|quod|servus|adesse')
authored(5,'Nuntius ex curia currit','der Bote|läuft|aus dem Rathaus','nuntius|e / ex|curia|currere')
authored(5,'Circum templum turba stat','um den Tempel herum|steht|die Menschenmenge','circum|templum|turba|stare')
authored(5,'Consul sine armis pugnat','der Konsul|kämpft|ohne Waffen','consul|sine|arma|pugnare')
authored(5,'Servis ridere licet','die Sklaven|dürfen|lachen','servus|ridere|licet')
authored(5,'Periculum adest','die Gefahr|ist|da','periculum|adesse')
authored(6,'Tu bene laboras','du|arbeitest|gut','tu|bene|laborare')
authored(6,'Puer illuc currit','der Junge|läuft|dorthin','puer|illuc|currere')
authored(6,'Post cenam mater laborat','nach der Mahlzeit|arbeitet|die Mutter','post|cena|mater|laborare')
authored(6,'Puella paulo post accedit','das Mädchen|kommt|ein wenig später|herbei','puella|paulo|post|accedere')
authored(7,'Pater servum admittit','der Vater|lässt|den Sklaven|zu','pater|servus|admittere')
authored(7,'Filius currere non vult','der Sohn|will|nicht|laufen','filius|currere|non|nolle')
authored(7,'Circiter viginti servi laborant','ungefähr zwanzig Sklaven|arbeiten','circiter|viginti|servus|laborare')
authored(7,'Pater togam cum tunica componit','der Vater|vergleicht|die Toga|mit der Tunika','pater|toga|cum-prep|tunica|componere')
authored(7,'Filia oculos ad patrem convertit','die Tochter|richtet|die Augen|auf den Vater','filia|oculus|ad|pater|convertere')
authored(7,'Pater auxilium petit','der Vater|bittet|um Hilfe','pater|auxilium|petere')
authored(7,'Nonne filius adest','ist|der Sohn|etwa nicht|da','non-ne|filius|adesse')
authored(8,'Nuntius ad aram pervenit','der Bote|kommt|zum Altar','nuntius|ad|ara|pervenire')
authored(8,'Parens filium amat','der Vater|liebt|den Sohn','parens|filius|amare')
authored(8,'Pax gaudium dat','der Frieden|bringt|Freude','pax|gaudium|dare')
authored(8,'Senator de salute cogitat','der Senator|denkt|über die Rettung|nach','senator|de|salus|cogitare')
authored(9,'Hospes vobis iter narrat','der Gast|erzählt|euch|von der Reise','hospes|vobis|iter|narrare')
authored(9,'Amicus dominum convenit','der Freund|trifft|den Herrn','amicus|dominus|convenire')
authored(9,'Hospes quoque aquam bibit','der Gast|trinkt|auch|Wasser','hospes|quoque|aqua|bibere')
authored(9,'Pater atque filius consident','der Vater|und|der Sohn|setzen sich','pater|atque|filius|considere')
authored(9,'Filius sicut pater laborat','der Sohn|arbeitet|wie der Vater','filius|sicut|pater|laborare')
authored(10,'Poeta carmen legere instituit','der Dichter|beginnt|ein Gedicht|zu lesen','poeta|carmen|legere|instituere')
authored(10,'Liber poetae placet','das Buch|gefällt|dem Dichter','liber|poeta|placet')
authored(10,'Comes eo properat','der Begleiter|eilt|dorthin','comes|eo|properare')
authored(10,'Senator consilium scit','der Senator|kennt|den Plan','senator|consilium|scire')
authored(10,'Liber an carmen placet','gefällt|das Buch|oder|das Gedicht','liber|an|carmen|placet')
authored(10,'Ut pater filius laborat','wie der Vater|arbeitet|der Sohn','ut|pater|filius|laborare')
authored(11,'Ego te prohibeo','ich|halte|dich|ab','ego|te|prohibere')
authored(11,'Frater a ripa venit','der Bruder|kommt|vom Ufer','frater|a / ab|ripa|venire')
authored(11,'Vir enim patriam defendit','der Mann|verteidigt|nämlich|die Heimat','vir|enim|patria|defendere')
authored(11,'Frater se servat','der Bruder|rettet|sich','frater|se|servare')
authored(11,'Ubi frater venit, mater gaudet','sobald|der Bruder|kommt,|freut sich|die Mutter','ubi|frater|venire|mater|gaudere')
authored(11,'O mater flet','oh|die Mutter|weint','o(h)|mater|flere')
authored(12,'Amicus propius accedit','der Freund|kommt|näher|herbei','amicus|propius|accedere')
authored(12,'Senator quidem respondet','der Senator|antwortet|freilich','senator|quidem|respondere')
authored(12,'Ne pater quidem adest','nicht einmal der Vater|ist|da','ne ... quidem|pater|ne ... quidem|adesse')
authored(12,'Amicus mecum laborat','der Freund|arbeitet|mit mir','amicus|mecum|laborare')
authored(12,'Constat: pater adest','es steht fest:|der Vater|ist da','constat|pater|adesse')
authored(13,'Multi servi laborant','viele Sklaven|arbeiten','multus|servus|laborare')
authored(13,'Senator totam urbem videt','der Senator|sieht|die ganze Stadt','senator|totus|urbs|videre')
authored(13,'Ultimus servus accedit','der letzte Sklave|kommt|herbei','ultimus|servus|accedere')
authored(13,'Rex scelus ignorat','der König|kennt|das Verbrechen|nicht','rex|scelus|ignorare')
authored(13,'Si pater adest puer gaudet','wenn|der Vater|da ist|freut sich|der Junge','si|pater|adesse|puer|gaudere')
authored(13,'Pater propter filium timet','der Vater|hat|wegen des Sohnes|Angst','pater|propter|filius|timere')
authored(13,'Num rex timet','hat|der König|etwa|Angst','num|rex|timere')
authored(13,'Et pater et filius laborant','sowohl der Vater|als auch der Sohn|arbeiten','et ... et|pater|et ... et|filius|laborare')
authored(13,'Ita pater putat','so|meint|es der Vater','ita|pater|putare')
authored(13,'Pater inquit: servus adest','der Vater|sagt:|der Sklave|ist da','pater|inquit|servus|adesse')
authored(14,'Nos patriam defendimus','wir|verteidigen|die Heimat','nos|patria|defendere')
authored(14,'Vos bene laboratis','ihr|arbeitet|gut','vos|bene|laborare')
authored(14,'Consul nobis auxilium praebet','der Konsul|bietet|uns|Hilfe','consul|nobis|auxilium|praebere')
authored(14,'Mater me amat','die Mutter|liebt|mich','mater|me|amare')
authored(14,'Pater filium suum laudat','der Vater|lobt|seinen Sohn','pater|filius|suus|laudare')
authored(14,'Meus pater adest','mein Vater|ist|da','meus|pater|adesse')
authored(14,'Tuus frater ridet','dein Bruder|lacht','tuus|frater|ridere')
authored(14,'Noster consul patriam defendit','unser Konsul|verteidigt|die Heimat','noster|consul|patria|defendere')
authored(14,'Alius servus aquam portat','ein anderer Sklave|trägt|das Wasser','alius|servus|aqua|portare')
authored(14,'Unus miles portam servat','ein einziger Soldat|bewacht|das Tor','unus|miles|porta|servare')
authored(14,'Cuncti amici adsunt','alle Freunde|sind|da','cuncti|amicus|adesse')
authored(14,'Consul solum pecuniam petit','der Konsul|verlangt|nur Geld','consul|solum|pecunia|petere')
authored(14,'Miles vero manet','der Soldat|aber|bleibt','miles|vero|manere')
authored(14,'Equidem ita censeo','ich allerdings|meine|es so','equidem|ita|censere')
authored(14,'Postquam miles venit consul gaudet','nachdem|der Soldat|gekommen ist|freut sich|der Konsul','postquam|miles|venire|consul|gaudere','perfect')
authored(15,'Pater filium appellat','der Vater|ruft|den Sohn|an','pater|filius|appellare')
authored(15,'Vester pater adest','euer Vater|ist|da','vester|pater|adesse')
authored(15,'Puer consilium nescit','der Junge|kennt|den Plan|nicht','puer|consilium|nescire')
authored(15,'Consul praemium decernit','der Konsul|beschließt|eine Belohnung','consul|praemium|decernere')
authored(15,'Rex populum subicit','der König|unterwirft|das Volk','rex|populus|subicere')
authored(15,'Servus laborat neque tacet','der Sklave|arbeitet|und|schweigt nicht','servus|laborare|neque|tacere')
authored(15,'Puella ridet quia pater adest','das Mädchen|lacht|weil|der Vater|da ist','puella|ridere|quia|pater|adesse')
authored(15,'Puer qui laborat gaudet','der Junge|der arbeitet|freut sich','puer|qui|laborare|gaudere')
authored(16,'Pauci servi tacent','wenige Sklaven|schweigen','pauci|servus|tacere')
authored(16,'Duo amici adsunt','zwei Freunde|sind|da','duo|amicus|adesse')
authored(16,'Primus miles accedit','der erste Soldat|kommt|herbei','primus|miles|accedere')
authored(16,'Summus mons procul est','der höchste Berg|ist|weit entfernt','summus|mons|procul|esse')
authored(16,'Is amicus me monet','dieser Freund|ermahnt|mich','is|amicus|me|monere')
authored(16,'Nocte servus laborat','nachts|arbeitet|der Sklave','nox|servus|laborare')
authored(17,'Dum pater laborat filius legit','während|der Vater|arbeitet|liest|der Sohn','dum|pater|laborare|filius|legere')
authored(17,'Etsi miles timet pugnat','obwohl|der Soldat|Angst hat|kämpft er','etsi|miles|timere|pugnare')
authored(17,'Quamquam pater laborat gaudet','obwohl|der Vater|arbeitet|freut er sich','quamquam|pater|laborare|gaudere')
authored(17,'Cum pater venit filius gaudet','wenn|der Vater|kommt|freut sich|der Sohn','cum-conj|pater|venire|filius|gaudere')
authored(17,'Miles sibi auxilium petit','der Soldat|erbittet|für sich|Hilfe','miles|sibi|auxilium|petere')
authored(17,'Amicus dono contentus est','der Freund|ist|mit dem Geschenk|zufrieden','amicus|donum|contentus|esse')
authored(17,'Senator consilium pristinum probat','der Senator|billigt|den früheren Plan','senator|consilium|pristinus|probare')
authored(17,'Miles hostem virtute praestat','der Soldat|übertrifft|den Feind|an Tapferkeit','miles|hostis|virtus|praestare')
authored(17,'Consul copias agmini adiungit','der Konsul|schließt|die Truppen|dem Heereszug|an','consul|copiae|agmen|adiungere')
authored(18,'Nonnulli servi laborem vitant','einige Sklaven|vermeiden|die Arbeit','nonnulli|servus|labor|vitare')
authored(18,'Nemo adest','niemand|ist|da','nemo|adesse')
authored(18,'Servus per portam ruit','der Sklave|stürmt|durch das Tor','servus|per|porta|ruere')
authored(18,'Pater filio pecuniam committit','der Vater|vertraut|dem Sohn|Geld|an','pater|filius|pecunia|committere')
authored(18,'Miles hosti gladium eripit','der Soldat|entreißt|dem Feind|das Schwert','miles|hostis|gladius|eripere')
authored(18,'Quin domum venis','warum|kommst du|nicht|nach Hause','quin|domum|venire')
authored(19,'Ambo amici tacent','beide Freunde|schweigen','ambo|amicus|tacere')
authored(19,'Plerique servi laborant','die meisten Sklaven|arbeiten','plerique|servus|laborare')
authored(19,'Patriam defendere oportet','man|muss|die Heimat|verteidigen','patria|defendere|oportet')
authored(19,'Vis magna est','die Kraft|ist|groß','vis|magnus|esse')
authored(19,'Vires deficiunt','die Kräfte|lassen|nach','vires|deficere')
authored(19,'Consul ita existimat','der Konsul|meint|es so','consul|ita|existimare')
authored(19,'Servus ante laboravit','der Sklave|hat|vorher|gearbeitet','servus|ante-adv|laborare','perfect')
authored(19,'Servus non tacet immo clamat','der Sklave|schweigt nicht|vielmehr|ruft er laut','servus|non|tacere|immo|clamare')
authored(4,'Servus tantum vinum sumit','der Sklave|nimmt|nur Wein','servus|tantum|vinum|sumere')
authored(5,'Undique nuntii accedunt','von allen Seiten|kommen|Boten|herbei','undique|nuntius|accedere')
authored(9,'Hospes domino gratias agit','der Gast|dankt|dem Herrn','hospes|dominus|gratia|agere')
authored(9,'Pater de more maiorum narrat','der Vater|erzählt|vom Brauch der Vorfahren','pater|de|mos|maiores|narrare')
authored(10,'Pater putat: poeta adest','der Vater|denkt:|der Dichter|ist da','pater|putare|poeta|adesse')
authored(11,'Vir de ira cogitat','der Mann|denkt|über den Zorn|nach','vir|de|ira|cogitare')
authored(12,'Vir fiduciam habet','der Mann|hat|Vertrauen','vir|fiducia|habere')
authored(13,'Rex sortem timet','der König|fürchtet|das Schicksal','rex|sors|timere')
authored(13,'Consul causam cognoscit','der Konsul|erkennt|die Ursache','consul|causa|cognoscere')
authored(14,'Miles laborem timet','der Soldat|fürchtet|die Arbeit','miles|labor|timere')
authored(15,'Pater exemplum ostendit','der Vater|zeigt|ein Beispiel','pater|exemplum|ostendere')
authored(15,'Consul virtutem laudat','der Konsul|lobt|die Tapferkeit','consul|virtus|laudare')
authored(15,'Senator imprimis patriam amat','der Senator|liebt|vor allem die Heimat','senator|imprimis|patria|amare')
authored(15,'Pater vitam amat','der Vater|liebt|das Leben','pater|vita|amare')
authored(16,'Puer somnum cupit','der Junge|wünscht sich|Schlaf','puer|somnus|cupere')
authored(17,'Rex potentiam habet','der König|hat|Macht','rex|potentia|habere')
authored(18,'Senator suspicionem habet','der Senator|hat|einen Verdacht','senator|suspicio|habere')
authored(19,'Miles animum non amittit','der Soldat|verliert|den Mut|nicht','miles|animus|non|amittere')

def distractors_for(answers,tokens,tense='present'):
    """Plausible but non-synonymous alternatives; never invent answer variants."""
    used={x for answer in answers for x in answer}
    meaning_key=lambda s:re.sub(r'[^a-z0-9]','',norm(s))
    source_meanings={meaning_key(m) for t in tokens for group in V['words'][t['wordId']]['meanings'] for m in group}
    noun_choices=[]
    rivals=[N[k] for k in ['senator','servus','puer','rex','fur','amicus','mater','amica','domina','serva','filia','soror','gladius','donum','aqua','aurum','liber','vinum','porta','pecunia','liberi','parentes','arma']]
    for chunk in answers[0]:
        for n in N.values():
            for field in ['de','deacc','dedat']:
                needle=n[field];pattern=r'(?<!\w)'+re.escape(needle)+r'(?!\w)'
                if not re.search(pattern,chunk):continue
                for rival in rivals:
                    if rival['lemma']==n['lemma']:continue
                    if not n['tags']&rival['tags']:continue
                    # Same German gender/number preserves genuinely plausible
                    # case agreement, including weak masculine noun endings.
                    if [n[f].split()[0] for f in ['de','deacc','dedat']]!=[rival[f].split()[0] for f in ['de','deacc','dedat']]:continue
                    meanings={meaning_key(m) for group in WORDS[rival['lemma']]['meanings'] for m in group}
                    if meanings&source_meanings:continue
                    choice=re.sub(pattern,rival[field],chunk)
                    if choice not in used and choice not in noun_choices:noun_choices.append(choice)
    opposites={'öffnet':'schließt','schließt':'öffnet','lobt':'tadelt','sieht':'hört','hört':'sieht','liest':'schreibt','nimmt':'gibt','gibt':'nimmt','verkauft':'gekauft' if tense=='perfect' else 'kauft','kauft':'verkauft','liebt':'hasst','lacht':'weint','weint':'lacht','schweigt':'schreit','lebt':'stirbt','geöffnet':'geschlossen','geschlossen':'geöffnet','gesehen':'gehört','gehört':'gesehen','gelobt':'getadelt','gelesen':'geschrieben'}
    verb_choices=[opposites[x] for x in answers[0] if x in opposites and opposites[x] not in used]
    seed=int(hashlib.sha256(signature(tokens).encode()).hexdigest()[:8],16)
    choices=[]
    if noun_choices:choices.append(noun_choices[seed%len(noun_choices)])
    if verb_choices:choices.append(verb_choices[seed%len(verb_choices)])
    for choice in noun_choices[seed%max(1,len(noun_choices)):]+noun_choices+['morgen','nicht','ihr']:
        if len(choices)>=3:break
        if choice not in choices and choice not in used:choices.append(choice)
    return choices

def build():
    rng=random.Random(20261113)
    output=[];report=[];global_latin=set()
    for collection in COLS:
        level=LEVEL[collection['id']];focus={w['id'] for w in V['words'].values() if w['collectionId']==collection['id']}
        candidates=[c for c in CLAUSES if c['level']<=level and c['_ids']&focus]
        for c in candidates:c['_focus']=c['_ids']&focus;c['_event']='|'.join(c['core'].split('|')[1:]) if '|' in c['core'] else c['core']
        rng.shuffle(candidates)
        # Prefer 2+ focus items and a broad spread of distinct lexical events.
        selected=[];used_cores=set();event_counts={};frames={};usage={w:0 for w in focus}
        for turn in range(100):
            pool=[]
            for c in candidates:
                if c['core'] in used_cores or c['_signature'] in global_latin:continue
                event=c['_event']
                if c['frame']!='authored' and event_counts.get(event,0)>=2:continue
                ids=c['_focus']
                score=sum(8/(1+usage[w]) for w in sorted(ids))+min(len(ids),3)*2-frames.get(c['frame'],0)*.12
                if c['frame']=='authored':score+=2
                pool.append((score,c))
            if not pool:break
            c=max(pool,key=lambda x:x[0])[1]
            selected.append(c);used_cores.add(c['core']);frames[c['frame']]=frames.get(c['frame'],0)+1
            event='|'.join(c['core'].split('|')[1:]) if '|' in c['core'] else c['core'];event_counts[event]=event_counts.get(event,0)+1
            for wid in {t['wordId'] for t in c['tokens']} & focus:usage[wid]+=1
            global_latin.add(signature(c['tokens']))
        # Early vocabulary has few single-clause propositions. Combine two
        # independent events with et; never duplicate a lexical event-pair.
        eligible=[c for c in CLAUSES if c['level']<=level and c['tense']=='present' and len(c['tokens'])<=4 and c['frame'] in ['intransitive','transitive']] if len(selected)<100 else []
        rng.shuffle(eligible);eligible=eligible[:250]
        pairs=[]
        for a in eligible:
            for b in eligible:
                if a['core']>=b['core'] or a['core']==b['core']:continue
                same=a['tokens'][0]['wordId']==b['tokens'][0]['wordId']
                av=a['core'].split('|')[1];bv=b['core'].split('|')[1]
                if same and {av,bv} in [{'stare','properare'},{'stare','currere'},{'tacere','clamare'},{'gaudere','flere'}]:continue
                tokens=a['tokens']+[tok('et','et')]+b['tokens'][1 if same else 0:]
                if not any(t['wordId'] in focus for t in tokens):continue
                pairs.append((a,b,tokens))
        rng.shuffle(pairs)
        for a,b,tokens in pairs:
            if len(selected)>=100:break
            sig=signature(tokens)
            if sig in global_latin:continue
            same=a['tokens'][0]['wordId']==b['tokens'][0]['wordId']
            translations=[list(a['translations'][0])+['und']+list(b['translations'][0])[1 if same else 0:]]
            selected.append({'tokens':tokens,'translations':translations,'tense':'present','frame':'coordinated','core':a['core']+'&&'+b['core']})
            global_latin.add(sig)
            for wid in {t['wordId'] for t in tokens} & focus:usage[wid]+=1
        for i,c in enumerate(selected):
            tokens=[dict(t) for t in c['tokens']]
            tokens[0]['text']=tokens[0]['text'][0].upper()+tokens[0]['text'][1:]
            question_ids={WORDS[k]['id'] for k in ['ubi?','quis?','quid?','cur?','non-ne','num','quin']}
            latin=' '.join(t['text'] for t in tokens)+('?' if tokens[0]['wordId'] in question_ids or any(t['text']=='an' for t in tokens) else '.')
            answers=[list(t) for t in c['translations']]
            # Expand the safe V2 constituent frontings of authored main clauses.
            # Focus particles stay attached to their phrase: never front 'nur'
            # alone. Questions, relatives and multi-clause statements retain
            # their authored order(s), rather than accepting bag-of-words guesses.
            if c['frame']=='authored' and not latin.endswith('?'):
                a=answers[0]
                connectors={'und','aber','denn','deshalb','dann','weil','wenn','obwohl','nachdem','während','sobald','vielmehr'}
                simple=not any(x in connectors or ':' in x or ',' in x for x in a)
                subject=lambda x:bool(re.match(r'^(der |die |das |ein |eine |mein |dein |unser |euer |dieser |beide |alle |viele |wenige |einige |ich |du$|wir$|ihr$)',x))
                frontable=lambda x:bool(re.match(r'^(der |den |die |das |dem |ein |eine |einen |einem |einer |seinen |seine |sein |seinem |seiner |meinen |deinen |unseren |euren |mir$|dir$|euch$|uns$|mich$|dich$|ihn$|ihm$|sie$|ihnen$|nur |vor allem |mit |nach |durch |über |zum |zur |von |vom |am |auf |bei |für |um |ohne |aus |in |nachts$|dort$|hier$|heute$|sofort$|plötzlich$|Freude$|Schlaf$|Macht$|Vertrauen$|Hilfe$|Geld$)',x))
                if simple and len(a)>=3 and subject(a[0]):
                    for tile_index in range(2,len(a)):
                        if frontable(a[tile_index]):answers.append([a[tile_index],a[1],a[0],*a[2:tile_index],*a[tile_index+1:]])
                elif simple and len(a)>=3 and subject(a[2]) and frontable(a[0]):answers.append([a[2],a[1],a[0],*a[3:]])
                answers=[list(x) for x in dict.fromkeys(tuple(x) for x in answers)]
            # Wrong time/negation/person chunks are intentionally not synonyms.
            distractors=distractors_for(answers,tokens,c['tense'])
            output.append({'id':f'landscape-l{level:02d}-'+hashlib.sha256(latin.encode()).hexdigest()[:12], 'collectionId':collection['id'],'latin':latin,
                           'tokens':tokens,'translations':answers,'distractors':distractors,
                           'focusWordIds':sorted({t['wordId'] for t in tokens}&focus),
                           'tense':c['tense'],'difficulty':1 if len(tokens)<=4 else 2 if len(tokens)<=7 else 3,
                           'grammar':['formulaic-greeting'] if tokens[0]['text'] in ['Ave','Salve','Salvete'] else ['indicative-present' if c['tense']=='present' else 'indicative-perfect','coordination' if c['frame']=='coordinated' else 'simple-clause'],
                           'sourceFrame':c['frame']})
        report.append({'collectionId':collection['id'],'name':collection['name'],'count':len(selected),
                       'coveredWords':sum(v>0 for v in usage.values()),'totalWords':len(focus),
                       'uncoveredWords':sorted(V['words'][w]['latin'] for w,n in usage.items() if not n),
                       'frames':frames})
    catalogue={'schema':1,'version':'2026-11-13.1','provenance':'Curated lexical frames, canonical admin Latin vocabulary, deterministic offline build.',
               'collections':[{**c,'lesson':LEVEL[c['id']]} for c in COLS],'sentences':output}
    payload=(json.dumps(catalogue,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    (ROOT/'landscape-sentences.json.gz').write_bytes(gzip.compress(payload,compresslevel=9,mtime=0))
    (ROOT/'landscape-content-report.json').write_text(json.dumps({'schema':1,'collections':report},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'sentences':len(output),'collections':report},ensure_ascii=False))
if __name__=='__main__':build()
