#!/usr/bin/env node
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {validateSentenceCatalogue} from './landscape-content.mjs';

const [command,...argv]=process.argv.slice(2),flags={};
for(let i=0;i<argv.length;i++){
  const argument=argv[i];
  if(!argument.startsWith('--'))throw Error('Option erwartet: '+argument);
  flags[argument.slice(2)]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;
}
function read(path){const bytes=readFileSync(resolve(path));return JSON.parse((String(path).endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'));}
function help(){console.log(`Satzinhalte prüfen/importieren – ohne Netzwerk oder KI-Konto

node server/landscape-content-cli.mjs validate --file KATALOG.json[.gz] --vocabulary VOKABELN.json [--minimum 100]
node server/landscape-content-cli.mjs merge --file NEUE-SÄTZE.json --base KATALOG.json.gz --vocabulary VOKABELN.json --output VORBEREITETER-KATALOG.json.gz --reviewed

Der Import schreibt ausschließlich den ausdrücklich genannten Ausgabepfad.
Bestehende Aufgaben-IDs werden nie stillschweigend ersetzt. Neue Sammlungen
bleiben ohne Satzvorrat für Vokabelübungen verfügbar. --reviewed bestätigt die
separate Prüfung von Latein, Übersetzungen, Wortstellungen und Ablenkungen.`);}
try{
  if(!['validate','merge'].includes(command)){help();if(command&&command!=='help')process.exitCode=1;}
  else{
    if(typeof flags.file!=='string'||typeof flags.vocabulary!=='string')throw Error('--file und --vocabulary sind erforderlich.');
    const incoming=read(flags.file),vocabulary=read(flags.vocabulary);
    let candidate=incoming;
    if(command==='merge'){
      if(flags.reviewed!==true||typeof flags.base!=='string'||typeof flags.output!=='string')throw Error('Merge braucht --base, --output und die ausdrückliche Inhaltsprüfung --reviewed.');
      const base=read(flags.base),ids=new Set((base.sentences||[]).map(s=>s.id));
      for(const sentence of incoming.sentences||[])if(ids.has(sentence.id))throw Error('Bestehende Aufgaben-ID: '+sentence.id);
      const collections=new Map([...(base.collections||[]),...(incoming.collections||[])].map(c=>[c.id,c]));
      candidate={...base,schema:1,version:new Date().toISOString(),collections:[...collections.values()],sentences:[...(base.sentences||[]),...(incoming.sentences||[])]};
    }
    const minimum=flags.minimum===undefined?0:Number(flags.minimum);
    if(!Number.isInteger(minimum)||minimum<0)throw Error('--minimum muss eine nichtnegative ganze Zahl sein.');
    const result=validateSentenceCatalogue(candidate,vocabulary,{minimumPerCollection:minimum});
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
    else if(command==='merge'){
      const destination=resolve(flags.output),temporary=destination+`.tmp-${process.pid}`;
      if(destination===resolve(flags.base)||destination===resolve(flags.file))throw Error('Ausgabe muss eine neue vorbereitete Datei sein; Live-Bestand wird nicht überschrieben.');
      if(existsSync(destination))throw Error('Ausgabedatei existiert bereits; einen neuen Pfad wählen.');
      mkdirSync(dirname(destination),{recursive:true});
      const payload=Buffer.from(JSON.stringify(candidate)+'\n');
      writeFileSync(temporary,destination.endsWith('.gz')?gzipSync(payload):payload,{flag:'wx'});renameSync(temporary,destination);
      console.log('Geprüfter Katalog vorbereitet: '+destination);
    }
  }
}catch(error){console.error(error.message);process.exitCode=1;}
